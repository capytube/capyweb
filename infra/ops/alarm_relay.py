#!/usr/bin/env python3
"""Relay capyweb's alarms from the SQS queue to the capyweb room (infra/ops/alarm-relay.yaml).

Run by infra/ops/alarm-relay-job.sh on Mac mini 3 every 5 minutes, with only the reader role's session in
the environment. Reads the queue until it is empty (10 at a time, at most MAX_MESSAGES a run), makes one
line per alarm that went to ALARM or came back to OK from ALARM, posts all of a run's lines in one
`herdr-ask --project capyweb --post`, and deletes the messages only after the post succeeded. A failed run
leaves them for the next one (the queue keeps them 4 days). Delivery is at least once: if herdr-ask
delivers the post but still exits non-zero, the next run posts the same lines again.

Every room is read by people outside the team, so a line holds no account id, ARN, hostname, e-mail
address, IP address or queue URL: the alarm's reason is sanitised, and anything that is not an alarm is
posted as a one-line notice with no body.

Usage: alarm_relay.py --queue-url URL [--dry-run]    (--dry-run prints the lines, posts and deletes nothing)
Standard library and the aws CLI only.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

BANGKOK = timezone(timedelta(hours=7))
MAX_MESSAGES = 100   # a run's ceiling; the rest waits for the next run
VISIBILITY = 120     # seconds a received message stays hidden: the job's timeout
REASON_MAX = 120

# Order matters: a URL holds a hostname, an ARN holds an account id.
_SANITISE = [
    re.compile(r"[a-z][a-z0-9+.-]*://[^\s)\]>\"']*", re.I),       # URLs, queue URLs included, glued too
    re.compile(r"arn:[a-z0-9-]*:[^\s)\]>\"']*", re.I),               # ARNs, glued to a word too ("Warn: x" is kept)
    re.compile(r"\S+@\S+"),                                          # e-mail addresses
    re.compile(r"(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?!\.?\d)"),          # IPv4, glued to a word too
    re.compile(r"(?<![0-9a-f:])[0-9a-f]*::[0-9a-f:]*(?:%[\w.-]+)?", re.I),  # IPv6 with "::" (::1, fe80::1%eth0)
    re.compile(r"(?<![0-9a-f:])(?:[0-9a-f]{0,4}:){3,7}[0-9a-f]{0,4}(?![0-9a-f:])", re.I),  # IPv6, 3+ colons (a time has 2)
    re.compile(r"\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b", re.I),             # hostnames
    re.compile(r"\bip-\d{1,3}(?:-\d{1,3}){3}\b", re.I),               # EC2 private names (ip-10-0-12-7)
    re.compile(r"\d{12,}"),                                          # account ids (any run of 12+ digits)
    re.compile(r"(?<!\d)\d{4}-\d{4}-\d{4}(?!\d)"),                    # account ids as the console groups them
]


def sanitise(text: str, limit: int = REASON_MAX) -> str:
    """The text with every identifier above removed, whitespace collapsed, cut to `limit` characters."""
    for pattern in _SANITISE:
        text = pattern.sub("", text)
    # Tidy what the removals leave: "(account )" -> "(account)", "x () y" -> "x y".
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\(\s*\)|\[\s*\]", "", text)
    text = re.sub(r"\s+([,.;:)\]])", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def topic_name(topic_arn: str) -> str:
    return topic_arn.rsplit(":", 1)[-1] if isinstance(topic_arn, str) else ""


def stage_of(topic: str):
    m = re.match(r"capyapp-capyweb-(dev|prod)-", topic)
    return m.group(1) if m else None


def short_topic(topic: str) -> str:
    short = topic[len("capyapp-capyweb-"):] if topic.startswith("capyapp-capyweb-") else ""
    return sanitise(short, 40) or "an unknown topic"


def short_alarm(name: str, stage) -> str:
    for prefix in ([f"capyapp-capyweb-{stage}-"] if stage else []) + ["capyapp-capyweb-"]:
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    return sanitise(name, 60) or "an alarm"


def _when(alarm: dict, envelope: dict) -> datetime:
    for value, fmt in ((alarm.get("StateChangeTime"), "%Y-%m-%dT%H:%M:%S.%f%z"),
                       (envelope.get("Timestamp"), "%Y-%m-%dT%H:%M:%S.%f%z")):
        if isinstance(value, str):
            try:
                return datetime.strptime(value.replace("Z", "+0000"), fmt)
            except ValueError:
                pass
    return datetime.now(timezone.utc)


def decide(body: str):
    """One queue message -> ("post", sort key, line) or ("skip", None, why)."""
    try:
        envelope = json.loads(body)
        topic = topic_name(envelope.get("TopicArn", "")) if isinstance(envelope, dict) else ""
    except (ValueError, TypeError):
        envelope, topic = {}, ""
    if not isinstance(envelope, dict):
        envelope = {}
    stage = stage_of(topic)
    tag = f"[capyweb {stage}]" if stage else "[capyweb]"
    try:
        alarm = json.loads(envelope.get("Message", ""))
    except (ValueError, TypeError):
        alarm = None
    if not (isinstance(alarm, dict) and "AlarmName" in alarm and "NewStateValue" in alarm):
        when = _when({}, envelope)
        return "post", when, f"[capyweb] notice on {short_topic(topic)}"
    new, old = alarm.get("NewStateValue"), alarm.get("OldStateValue")
    name = alarm["AlarmName"] if isinstance(alarm["AlarmName"], str) else ""
    reason = alarm.get("NewStateReason") if isinstance(alarm.get("NewStateReason"), str) else ""
    if not (new == "ALARM" or (new == "OK" and old == "ALARM")):
        return "skip", None, f"{old} -> {new}"
    when = _when(alarm, envelope)
    line = f"{tag} {short_alarm(name, stage)}: {new} at {when.astimezone(BANGKOK):%H:%M} +07"
    reason = sanitise(reason)
    return "post", when, f"{line} — {reason}" if reason else line


# -- the queue and the room ------------------------------------------------------------------------

class RelayError(Exception):
    pass


def _region(queue_url: str) -> str:
    m = re.match(r"https://sqs\.([a-z0-9-]+)\.amazonaws\.com/", queue_url)
    if not m:
        raise RelayError("the queue URL is not an SQS URL")
    return m.group(1)


def aws(args: list, queue_url: str) -> str:
    out = subprocess.run(["aws", "sqs", *args, "--region", _region(queue_url), "--queue-url", queue_url,
                          "--output", "json"], capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        first = (out.stderr.strip().splitlines() or ["no output"])[-1]
        raise RelayError(f"aws sqs {args[0]} failed: {sanitise(first, 160)}")
    return out.stdout


def receive(queue_url: str) -> list:
    out = aws(["receive-message", "--max-number-of-messages", "10", "--wait-time-seconds", "1",
               "--visibility-timeout", str(VISIBILITY)], queue_url)
    return json.loads(out).get("Messages", []) if out.strip() else []


def delete(queue_url: str, messages: list) -> None:
    for i in range(0, len(messages), 10):
        entries = [{"Id": str(n), "ReceiptHandle": m["ReceiptHandle"]} for n, m in enumerate(messages[i:i + 10])]
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(entries, f)
        try:
            out = json.loads(aws(["delete-message-batch", "--entries", f"file://{f.name}"], queue_url) or "{}")
        finally:
            os.unlink(f.name)
        if out.get("Failed"):
            raise RelayError(f"{len(out['Failed'])} message(s) not deleted")


def post(text: str) -> None:
    # herdr-ask gets no AWS session: it needs none.
    env = {k: v for k, v in os.environ.items() if not k.startswith("AWS_")}
    env["HERDR_ASK_MASTER"] = "herdr-master"
    out = subprocess.run(["herdr-ask", "--project", "capyweb", "--post", text], env=env,
                         capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        raise RelayError(f"herdr-ask failed (exit {out.returncode})")


def run(queue_url: str, dry_run: bool, receive=receive, post=post, delete=delete, out=print) -> int:
    seen = {}
    try:
        while len(seen) < MAX_MESSAGES:
            batch = [m for m in receive(queue_url) if m["MessageId"] not in seen]
            if not batch:
                break
            for m in batch:
                seen[m["MessageId"]] = m
        decided = [decide(m.get("Body", "")) for m in seen.values()]
        posts = sorted((d for d in decided if d[0] == "post"), key=lambda d: d[1])
        lines = list(dict.fromkeys(d[2] for d in posts))   # SNS may deliver twice: one line each
        skipped = len(decided) - len(posts)
        if dry_run:
            for line in lines:
                out(line)
            out(f"alarm-relay: dry run, {len(seen)} message(s), {len(lines)} line(s), {skipped} skipped; nothing posted or deleted")
            return 0
        if lines:
            post("\n".join(lines))
        delete(queue_url, list(seen.values()))
    except Exception as e:   # a timeout, a reply that is not JSON, ...: the same safe failure
        why = str(e) if isinstance(e, RelayError) else sanitise(f"{type(e).__name__}: {e}", 160)
        out(f"alarm-relay: FAILED after {len(seen)} message(s): {why}; nothing deleted that was not posted")
        return 1
    out(f"alarm-relay: {len(seen)} message(s), {len(lines)} line(s) posted, {skipped} skipped, all deleted")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--queue-url", required=True)
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    return run(a.queue_url, a.dry_run)


if __name__ == "__main__":
    sys.exit(main())
