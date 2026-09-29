"""Tests for alarm_relay.py: python3 -m unittest infra/ops/test_alarm_relay.py (scripts/guard.sh runs them)."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import alarm_relay as r  # noqa: E402

ACCT = "619071347239"


def envelope(topic, message, timestamp="2026-09-29T18:23:05.000Z"):
    return json.dumps({"Type": "Notification", "TopicArn": f"arn:aws:sns:ap-southeast-1:{ACCT}:{topic}",
                       "Message": message if isinstance(message, str) else json.dumps(message),
                       "Timestamp": timestamp})


def alarm(name, new, old, reason, when="2026-09-29T18:23:00.123+0000"):
    return {"AlarmName": name, "AlarmArn": f"arn:aws:cloudwatch:ap-southeast-1:{ACCT}:alarm:{name}",
            "AWSAccountId": ACCT, "NewStateValue": new, "OldStateValue": old, "NewStateReason": reason,
            "StateChangeTime": when, "Region": "Asia Pacific (Singapore)"}


THRESHOLD = ("Threshold Crossed: 1 out of the last 1 datapoints [0.0 (29/09/26 18:18:00)] was less than the "
             "threshold (1.0) (minimum 1 datapoint for OK -> ALARM transition).")


class Sanitise(unittest.TestCase):
    def test_removes_every_identifier(self):
        dirty = (f"acct {ACCT} arn:aws:sns:ap-southeast-1:{ACCT}:capyapp-capyweb-prod-alarms "
                 f"https://sqs.ap-southeast-1.amazonaws.com/{ACCT}/capyapp-capyweb-alarm-relay "
                 "host d3jz2uh04tmtrh.cloudfront.net api zw8fiyexsd.execute-api.ap-southeast-1.amazonaws.com "
                 "mail someone@example.com ip 10.0.12.7 v6 2001:db8::1 done")
        clean = r.sanitise(dirty, 500)
        self.assertEqual(clean, "acct host api mail ip v6 done")
        for bad in (ACCT, "arn:", "https", "cloudfront", "amazonaws", "@", "10.0", "2001"):
            self.assertNotIn(bad, clean)

    def test_keeps_the_ordinary_reason(self):
        self.assertEqual(r.sanitise(THRESHOLD, 500), THRESHOLD)   # times, dates and numbers survive

    def test_any_run_of_twelve_digits_goes(self):
        self.assertEqual(r.sanitise("a 123456789012 b 1234567890123 c 12345678901"), "a b c 12345678901")

    def test_tidies_what_is_left(self):
        self.assertEqual(r.sanitise(f"from us-east-1 (account {ACCT})"), "from us-east-1 (account)")
        self.assertEqual(r.sanitise(f"x (arn:aws:foo) y [https://a.b/c] z, {ACCT}."), "x y z,.")

    def test_identifiers_glued_to_words_go_too(self):
        # review rv headless 2026-09-30 (Kimi): these survived the first version
        for dirty in ("x10.0.12.7", "10.0.12.7x", "z2001:db8::1", f"xarn:aws:sns:x:{ACCT}:y", "::1", "fe80::1%eth0",
                      "ip 10.0.12.7.", "host [2001:db8::1]:443", "z_https://ex.com/x", "0https://ex.com/x",
                      "6190-7134-7239", "ip-10-0-12-7", "fe80::1%eth0.Zone"):
            clean = r.sanitise(f"a {dirty} b", 500)
            for bad in ("10.0", "10-0", "2001", "db8", "arn:", "::", "fe80", "://", "ex.com", "7134", "Zone", ACCT):
                self.assertNotIn(bad, clean, f"{dirty!r} -> {clean!r}")

    def test_ordinary_words_and_times_stay(self):
        for keep in ("Warn: disk", "at 18:23:05", "version 1.2.3", "(29/09/26 18:18:00)", "Learn: x"):
            self.assertEqual(r.sanitise(keep, 500), keep)

    def test_cut_to_120(self):
        cut = r.sanitise("x" * 300)
        self.assertEqual(len(cut), 120)
        self.assertTrue(cut.endswith("…"))


class Decide(unittest.TestCase):
    def test_prod_alarm_line(self):
        kind, _, line = r.decide(envelope("capyapp-capyweb-prod-alarms",
                                          alarm("capyapp-capyweb-prod-site-down", "ALARM", "OK", THRESHOLD)))
        self.assertEqual(kind, "post")
        self.assertEqual(line, "[capyweb prod] site-down: ALARM at 01:23 +07 — " + THRESHOLD[:119].rstrip() + "…")
        self.assertLessEqual(len(line.split(" — ", 1)[1]), 120)
        self.assertNotIn(ACCT, line)

    def test_ok_from_alarm_is_posted(self):
        kind, _, line = r.decide(envelope("capyapp-capyweb-dev-alarms",
                                          alarm("capyapp-capyweb-dev-api-down", "OK", "ALARM", "Threshold Crossed: fine")))
        self.assertEqual((kind, line), ("post", "[capyweb dev] api-down: OK at 01:23 +07 — Threshold Crossed: fine"))

    def test_insufficient_data_transitions_are_skipped(self):
        for new, old in (("INSUFFICIENT_DATA", "OK"), ("INSUFFICIENT_DATA", "ALARM"), ("OK", "INSUFFICIENT_DATA")):
            kind, _, _ = r.decide(envelope("capyapp-capyweb-prod-alarms", alarm("capyapp-capyweb-prod-x", new, old, "r")))
            self.assertEqual(kind, "skip", f"{old} -> {new}")

    def test_first_alarm_from_insufficient_data_is_posted(self):
        kind, _, line = r.decide(envelope("capyapp-capyweb-prod-alarms",
                                          alarm("capyapp-capyweb-prod-site-down", "ALARM", "INSUFFICIENT_DATA", "r")))
        self.assertEqual((kind, line), ("post", "[capyweb prod] site-down: ALARM at 01:23 +07 — r"))

    def test_egress_topic_in_us_east_1_gives_the_stage(self):
        body = envelope("capyapp-capyweb-prod-egress-alarm",
                        alarm("capyapp-capyweb-prod-cloudfront-egress", "ALARM", "OK", "Threshold Crossed"))
        body = body.replace("ap-southeast-1", "us-east-1")
        self.assertEqual(r.decide(body)[2], "[capyweb prod] cloudfront-egress: ALARM at 01:23 +07 — Threshold Crossed")

    def test_anything_else_is_a_notice_with_no_body(self):
        budget = envelope("capyapp-capyweb-alerts", f"AWS Budget Notification ... account {ACCT} ... someone@example.com")
        self.assertEqual(r.decide(budget)[1:], (r.decide(budget)[1], "[capyweb] notice on alerts"))
        self.assertEqual(r.decide("not json")[2], "[capyweb] notice on an unknown topic")
        self.assertEqual(r.decide(json.dumps({"TopicArn": 5}))[0], "post")

    def test_fields_that_are_not_strings_show_nothing_odd(self):
        weird = {"AlarmName": {"x": 1}, "NewStateValue": "ALARM", "OldStateValue": "OK", "NewStateReason": ["u"],
                 "StateChangeTime": "2026-09-29T18:23:00.000+0000"}
        self.assertEqual(r.decide(envelope("capyapp-capyweb-prod-alarms", weird))[2], "[capyweb prod] an alarm: ALARM at 01:23 +07")

    def test_no_reason_no_dash(self):
        self.assertEqual(r.decide(envelope("capyapp-capyweb-prod-alarms",
                                           alarm("capyapp-capyweb-prod-site-down", "ALARM", "OK", f"arn:aws:x {ACCT}")))[2],
                         "[capyweb prod] site-down: ALARM at 01:23 +07")


class Run(unittest.TestCase):
    def setUp(self):
        self.queue = [
            {"MessageId": "1", "ReceiptHandle": "h1", "Body": envelope(
                "capyapp-capyweb-prod-alarms", alarm("capyapp-capyweb-prod-site-down", "ALARM", "OK", "a",
                                                     when="2026-09-29T18:25:00.000+0000"))},
            {"MessageId": "2", "ReceiptHandle": "h2", "Body": envelope(
                "capyapp-capyweb-dev-alarms", alarm("capyapp-capyweb-dev-api-down", "INSUFFICIENT_DATA", "OK", "b"))},
            {"MessageId": "3", "ReceiptHandle": "h3", "Body": envelope(
                "capyapp-capyweb-dev-alarms", alarm("capyapp-capyweb-dev-api-down", "ALARM", "OK", "c",
                                                    when="2026-09-29T18:20:00.000+0000"))},
        ]
        self.posted, self.deleted, self.printed = [], [], []

    def receive(self, _url):
        batch, self.queue = self.queue[:2], self.queue[2:]
        return batch

    def go(self, dry_run=False, post=None):
        return r.run("https://sqs.ap-southeast-1.amazonaws.com/x/q", dry_run, receive=self.receive,
                     post=post or self.posted.append, delete=lambda _u, ms: self.deleted.extend(m["MessageId"] for m in ms),
                     out=self.printed.append)

    def test_one_post_in_time_order_then_everything_deleted(self):
        self.assertEqual(self.go(), 0)
        self.assertEqual(self.posted, ["[capyweb dev] api-down: ALARM at 01:20 +07 — c\n"
                                       "[capyweb prod] site-down: ALARM at 01:25 +07 — a"])
        self.assertEqual(sorted(self.deleted), ["1", "2", "3"])   # the skipped one too
        self.assertEqual(self.printed, ["alarm-relay: 3 message(s), 2 line(s) posted, 1 skipped, all deleted"])

    def test_a_failed_post_deletes_nothing(self):
        def fail(_text):
            raise r.RelayError("herdr-ask failed (exit 1)")
        self.assertEqual(self.go(post=fail), 1)
        self.assertEqual(self.deleted, [])
        self.assertIn("FAILED", self.printed[-1])

    def test_dry_run_posts_and_deletes_nothing(self):
        self.assertEqual(self.go(dry_run=True), 0)
        self.assertEqual((self.posted, self.deleted), ([], []))
        self.assertEqual(len(self.printed), 3)

    def test_a_timeout_is_a_clean_failure(self):
        import subprocess
        def slow(_url):
            raise subprocess.TimeoutExpired(["aws", "sqs", "https://sqs.ap-southeast-1.amazonaws.com/%s/q" % ACCT], 60)
        rc = r.run("u", False, receive=slow, post=self.posted.append,
                   delete=lambda _u, ms: self.deleted.extend(ms), out=self.printed.append)
        self.assertEqual((rc, self.posted, self.deleted), (1, [], []))
        self.assertIn("FAILED", self.printed[-1])
        self.assertNotIn(ACCT, self.printed[-1])

    def test_nothing_waiting_posts_nothing(self):
        self.queue = []
        self.assertEqual(self.go(), 0)
        self.assertEqual((self.posted, self.deleted), ([], []))

    def test_a_duplicate_delivery_is_one_line(self):
        self.queue = [dict(self.queue[0], MessageId="1"), dict(self.queue[0], MessageId="9", ReceiptHandle="h9")]
        self.go()
        self.assertEqual(len(self.posted[0].splitlines()), 1)
        self.assertEqual(sorted(self.deleted), ["1", "9"])


if __name__ == "__main__":
    unittest.main()
