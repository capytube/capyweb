"""Forwards mail sent to contact@capytube.xyz (infra/mail/contact-mail.yaml; tests: test_forwarder.py).

SES receives the mail, stores it at s3://<bucket>/inbound/<messageId>, then invokes this function
(asynchronously). The function reads the stored message, rewrites the address headers so that SES may send it
from our own domain, and sends it to the forward address kept in SSM (a SecureString, read with decryption and
cached per container). Subject and body are passed through byte for byte.

Logs carry only the SES message id, the spam and virus verdicts, the decision and the id SES gave the sent
message. Never an address, a subject or a body: errors are logged by their code alone.

Python 3.12, standard library and boto3 only.
"""
import json
import logging
import os
import re
from email.header import Header, decode_header, make_header
from email.message import EmailMessage
from email.policy import SMTP
from email.utils import getaddresses

CONTACT = "contact@capytube.xyz"
LOOP_HEADER = "X-CapyTube-Forwarded"
INBOUND_PREFIX = "inbound/"
# SES v1 SendRawEmail takes messages up to 10 MB. Stay a little under it: the headers we add, and SES's own
# (DKIM-Signature, Message-ID), come on top.
MAX_RAW_BYTES = 10_000_000
NAME_MAX = 64

# Headers that would break the forward (a signature over the old From), expose the forward address to the
# sender (read receipts, delivery headers) or name a sender SES would refuse to send as.
DROP_HEADERS = {
    "from", "to", "cc", "bcc", "reply-to", "sender", "return-path", "errors-to",
    "dkim-signature", "domainkey-signature", "arc-seal", "arc-message-signature", "arc-authentication-results",
    "authentication-results", "received-spf", "delivered-to", "x-original-to", "envelope-to", "x-envelope-to",
    "x-forwarded-to", "disposition-notification-to", "return-receipt-to", "x-confirm-reading-to",
}
DROP_PREFIXES = ("resent-", "x-ses-", "x-capytube-")

_ID = re.compile(r"[A-Za-z0-9._-]{1,200}")
_VERDICT = re.compile(r"[A-Z_]{1,32}")
_ADDRESS = re.compile(r"[^\s<>()\[\],;:\"\\@]+@[^\s<>()\[\],;:\"\\@]+\.[^\s<>()\[\],;:\"\\@]+")
# A header line naming the loop header, at the top of the message or inside a bounce or complaint report
# that quotes a message we forwarded.
_LOOP_LINE = re.compile(rb"(?im)^" + LOOP_HEADER.encode() + rb"[ \t]*:")

log = logging.getLogger("forwarder")
log.setLevel(logging.INFO)

_FORWARD_TO = {}   # parameter name -> address, per container
_CLIENTS = {}


class ForwardError(Exception):
    """Carries only a code, never an address or content."""


class Config:
    def __init__(self, bucket, config_set, forward_to_param):
        self.bucket, self.config_set, self.forward_to_param = bucket, config_set, forward_to_param

    @classmethod
    def from_env(cls):
        return cls(os.environ["BUCKET"], os.environ["CONFIG_SET"], os.environ["FORWARD_TO_PARAM"])


def _log(**fields):
    log.info(json.dumps(fields, sort_keys=True))


def _code(exc):
    """An AWS error code, or the exception's class name. Never its message: those can quote an address."""
    err = getattr(exc, "response", None)
    if isinstance(err, dict):
        code = err.get("Error", {}).get("Code")
        if isinstance(code, str) and re.fullmatch(r"[A-Za-z0-9.:_-]{1,64}", code):
            return code
    return type(exc).__name__


# ---- The forward address -------------------------------------------------------------------------------

def forward_address(ssm, name):
    if name not in _FORWARD_TO:
        value = ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"].strip()
        if not _ADDRESS.fullmatch(value):
            raise ForwardError("forward-address-not-an-address")
        _FORWARD_TO[name] = value
    return _FORWARD_TO[name]


# ---- Reading and rewriting the message -----------------------------------------------------------------

def split_message(raw):
    """(header bytes including the last header's line end, line end, body bytes)."""
    m = re.search(rb"\r?\n\r?\n", raw)
    if not m:
        eol = b"\r\n" if b"\r\n" in raw else b"\n"
        return (raw if raw.endswith(b"\n") or not raw else raw + eol), eol, b""
    eol = b"\r\n" if raw[m.start():m.start() + 2] == b"\r\n" else b"\n"
    head_end = m.start() + len(eol)
    return raw[:head_end], eol, raw[m.end():]


def header_fields(head):
    """[(lower-case name, raw bytes of the whole field, folded lines included)]."""
    fields = []
    for line in head.splitlines(keepends=True):
        if line[:1] in (b" ", b"\t") and fields:
            name, data = fields[-1]
            fields[-1] = (name, data + line)
        else:
            name = line.split(b":", 1)[0].strip().decode("ascii", "replace").lower() if b":" in line else ""
            fields.append((name, line))
    return fields


def _field_value(data):
    text = data.split(b":", 1)[1] if b":" in data else b""
    text = re.sub(rb"\r?\n", b"", text)
    try:
        return text.decode("utf-8").strip()
    except UnicodeDecodeError:
        return text.decode("latin-1").strip()


def parse_sender(from_value):
    """(display name or "", address or "") of the first mailbox in a From value."""
    for name, addr in getaddresses([from_value or ""]):
        if addr and _ADDRESS.fullmatch(addr):
            try:
                name = str(make_header(decode_header(name))) if name else ""
            except Exception:  # a malformed encoded word: keep the text as it came
                pass
            name = re.sub(r"[\x00-\x1f\x7f]+", " ", name)
            name = " ".join(name.split()).strip("\"' ")
            return name[:NAME_MAX].strip(), addr
    return "", ""


def from_header(name, addr, eol):
    display = name or (addr.split("@", 1)[0][:NAME_MAX] if addr else "Unknown sender")
    text = f"{display} via CapyTube contact"
    if text.isascii():
        quoted = text.replace("\\", "\\\\").replace('"', '\\"')
        return f'From: "{quoted}" <{CONTACT}>'
    encoded = Header(text, "utf-8", header_name="From").encode(linesep=eol.decode(), maxlinelen=76)
    return f"From: {encoded} <{CONTACT}>"


def rewrite(raw, forward_to):
    """The message as we send it, and the original sender's address ("" when it has none we can use)."""
    head, eol, body = split_message(raw)
    fields = header_fields(head)
    from_value = next((_field_value(d) for n, d in fields if n == "from"), "")
    name, addr = parse_sender(from_value)
    kept = [d for n, d in fields if n not in DROP_HEADERS and not n.startswith(DROP_PREFIXES)]
    new = [from_header(name, addr, eol)]
    if addr:
        new.append(f"Reply-To: {addr}")
    new += [f"To: {forward_to}", f"{LOOP_HEADER}: 1"]
    added = eol.join(line.encode("utf-8") for line in new) + eol
    return added + b"".join(kept) + eol + body, addr


def notice(forward_to, reply_to, reason, size, bucket, key):
    msg = EmailMessage(policy=SMTP)
    msg["From"] = f'"CapyTube contact" <{CONTACT}>'
    msg["To"] = forward_to
    if reply_to:
        msg["Reply-To"] = reply_to
    msg["Subject"] = "CapyTube contact: a message could not be forwarded"
    msg[LOOP_HEADER] = "1"
    why = {"too-large": "it is over the 10 MB SES sends", "rejected": "SES refused to send it as it came"}[reason]
    msg.set_content(
        f"A message to {CONTACT} was not forwarded: {why}.\n\n"
        f"Size: {size} bytes\nBucket: {bucket}\nKey: {key}\n\n"
        "It is kept for 90 days. Replying to this notice answers the sender, when the message named one.\n")
    return msg.as_bytes()


# ---- The handler ---------------------------------------------------------------------------------------

def _verdict(receipt, name):
    status = (receipt.get(name) or {}).get("status", "")
    return status if isinstance(status, str) and _VERDICT.fullmatch(status) else "UNKNOWN"


def _event_has_loop_header(mail):
    return any(isinstance(h, dict) and str(h.get("name", "")).lower() == LOOP_HEADER.lower()
               for h in mail.get("headers") or [])


def _event_sender(mail):
    values = (mail.get("commonHeaders") or {}).get("from") or []
    return parse_sender(", ".join(v for v in values if isinstance(v, str)))[1]


def _send(ses, cfg, forward_to, data):
    resp = ses.send_raw_email(Source=CONTACT, Destinations=[forward_to], RawMessage={"Data": data},
                              ConfigurationSetName=cfg.config_set)
    return resp["MessageId"]


def process(event, s3, ses, ssm, cfg):
    ses_event = event["Records"][0]["ses"]
    mail, receipt = ses_event["mail"], ses_event["receipt"]
    message_id = mail.get("messageId", "")
    if not isinstance(message_id, str) or not _ID.fullmatch(message_id):
        raise ForwardError("bad-message-id")
    spam, virus = _verdict(receipt, "spamVerdict"), _verdict(receipt, "virusVerdict")
    line = {"sesMessageId": message_id, "spam": spam, "virus": virus}

    recipients = [r.lower() for r in receipt.get("recipients") or [] if isinstance(r, str)]
    if spam == "FAIL":
        decision = "drop-spam"
    elif virus == "FAIL":
        decision = "drop-virus"
    elif CONTACT not in recipients:
        decision = "drop-not-for-contact"
    elif _event_has_loop_header(mail):
        decision = "drop-loop"
    else:
        decision = None
    if decision:
        _log(**line, decision=decision)
        return decision

    try:
        forward_to = forward_address(ssm, cfg.forward_to_param)
        key = INBOUND_PREFIX + message_id
        obj = s3.get_object(Bucket=cfg.bucket, Key=key)
        size = int(obj.get("ContentLength") or 0)
        if size > MAX_RAW_BYTES:
            sent = _send(ses, cfg, forward_to, notice(forward_to, _event_sender(mail), "too-large", size,
                                                      cfg.bucket, key))
            decision = "notice-too-large"
        else:
            raw = obj["Body"].read()
            if _LOOP_LINE.search(raw):
                _log(**line, decision="drop-loop")
                return "drop-loop"
            out, sender = rewrite(raw, forward_to)
            if len(out) > MAX_RAW_BYTES:
                sent = _send(ses, cfg, forward_to, notice(forward_to, sender, "too-large", len(raw),
                                                          cfg.bucket, key))
                decision = "notice-too-large"
            else:
                try:
                    sent = _send(ses, cfg, forward_to, out)
                    decision = "forwarded"
                except Exception as exc:
                    if _code(exc) not in ("MessageRejected", "InvalidParameterValue"):
                        raise
                    _log(**line, decision="rejected", error=_code(exc))
                    sent = _send(ses, cfg, forward_to, notice(forward_to, sender, "rejected", len(raw),
                                                              cfg.bucket, key))
                    decision = "notice-rejected"
    except Exception as exc:
        code = _code(exc) if not isinstance(exc, ForwardError) else str(exc)
        _log(**line, decision="error", error=code)
        raise ForwardError(code) from None
    _log(**line, decision=decision, sentMessageId=sent)
    return decision


def _client(name):
    if name not in _CLIENTS:
        import boto3  # in the Lambda runtime; the tests inject their own clients
        _CLIENTS[name] = boto3.client(name)
    return _CLIENTS[name]


def handler(event, _context):
    return process(event, _client("s3"), _client("ses"), _client("ssm"), Config.from_env())
