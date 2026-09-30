"""Tests for forwarder/forwarder.py: python3 -B infra/mail/test_forwarder.py (scripts/guard.sh runs them). No AWS: the
S3, SES and SSM clients are fakes."""
import base64
import io
import os
import sys
import unittest
from email import message_from_bytes
from email.header import decode_header, make_header
from email.policy import default

# The function lives alone in forwarder/, the directory `aws cloudformation package` zips.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "forwarder"))
import forwarder as f  # noqa: E402

FORWARD_TO = "owner@example.test"
SENDER = "jane.doe@example.test"
SUBJECT = b"Subject: Question about the =?utf-8?q?capybara_cam=C3=A9ra?=\r\n\tfolded part"
BODY = (b"--b1\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
        + "Hello, été line\r\n\r\n.trailing dot\r\n  spaces kept  \r\n--b1--\r\n".encode("utf-8"))
CFG = f.Config("capyapp-capyweb-contact-mail-000000000000", "capyapp-capyweb-contact", "/capyapp/capyweb/contact/forward-to")


def message(from_line=b"From: Jane Doe <jane.doe@example.test>", extra=b"", body=BODY):
    return (b"Return-Path: <bounce@example.test>\r\n"
            b"Received: from mx.example.test by inbound-smtp.ap-southeast-1.amazonaws.com\r\n"
            b"X-SES-Spam-Verdict: PASS\r\n"
            b"Received-SPF: pass (spfCheck: domain of example.test designates ...) client-ip=192.0.2.1;\r\n"
            b"Authentication-Results: amazonses.com; spf=pass smtp.mailfrom=example.test; dkim=pass\r\n"
            b"DKIM-Signature: v=1; a=rsa-sha256; d=example.test; s=s1;\r\n\th=From:To:Subject; b=abc\r\n"
            b"DKIM-Signature: v=1; a=rsa-sha256; d=relay.example.test; s=s2; b=def\r\n"
            + from_line + b"\r\n"
            b"Sender: list@example.test\r\n"
            b"To: CapyTube <contact@capytube.xyz>\r\n"
            b"Cc: other@example.test\r\n"
            b"Bcc: hidden@example.test\r\n"
            b"Reply-To: elsewhere@example.test\r\n"
            b"Disposition-Notification-To: jane.doe@example.test\r\n"
            b"Delivered-To: contact@capytube.xyz\r\n"
            b"Resent-From: resender@example.test\r\n"
            + SUBJECT + b"\r\n"
            b"Message-ID: <m1@example.test>\r\n"
            b"MIME-Version: 1.0\r\n"
            b"Content-Type: multipart/alternative; boundary=\"b1\"\r\n"
            + extra +
            b"\r\n" + body)


def event(spam="PASS", virus="PASS", recipients=("contact@capytube.xyz",), headers=(), message_id="o3vrnil0e2ic28tr"):
    return {"Records": [{"eventSource": "aws:ses", "ses": {
        "mail": {"messageId": message_id, "source": "bounce@example.test",
                 "headers": [{"name": n, "value": v} for n, v in headers],
                 "commonHeaders": {"from": ["Jane Doe <jane.doe@example.test>"], "subject": "Question"}},
        "receipt": {"recipients": list(recipients), "spamVerdict": {"status": spam},
                    "virusVerdict": {"status": virus}, "spfVerdict": {"status": "PASS"}}}}]}


class FakeS3:
    def __init__(self, raw, length=None):
        self.raw, self.length, self.calls = raw, length, []

    def get_object(self, Bucket, Key):
        self.calls.append((Bucket, Key))
        return {"ContentLength": len(self.raw) if self.length is None else self.length, "Body": io.BytesIO(self.raw)}


class FakeSes:
    def __init__(self, reject_first=None):
        self.sent, self.reject_first = [], reject_first

    def send_raw_email(self, **kw):
        if self.reject_first and not self.sent:
            self.sent.append(None)
            err = Exception(f"Email address is not verified: {FORWARD_TO}")
            err.response = {"Error": {"Code": self.reject_first, "Message": f"about {FORWARD_TO}"}}
            raise err
        self.sent.append(kw)
        return {"MessageId": "0100019a-sent-id-000000"}


class FakeSsm:
    def __init__(self, value=FORWARD_TO):
        self.value, self.calls = value, []

    def get_parameter(self, Name, WithDecryption):
        self.calls.append((Name, WithDecryption))
        return {"Parameter": {"Value": self.value}}


def headers_of(data):
    head, _, _ = f.split_message(data)
    return f.header_fields(head)


class Base(unittest.TestCase):
    def setUp(self):
        f._FORWARD_TO.clear()

    def run_one(self, raw, ev=None, s3=None, ses=None, ssm=None):
        self.s3, self.ses, self.ssm = s3 or FakeS3(raw), ses or FakeSes(), ssm or FakeSsm()
        with self.assertLogs("forwarder", "INFO") as cap:
            try:
                decision = f.process(ev or event(), self.s3, self.ses, self.ssm, CFG)
            except f.ForwardError as exc:
                decision = exc
        self.logs = cap.output
        return decision


class Drops(Base):
    def test_spam_fail(self):
        self.assertEqual(self.run_one(message(), event(spam="FAIL")), "drop-spam")
        self.assertEqual((self.s3.calls, self.ses.sent, self.ssm.calls), ([], [], []))

    def test_virus_fail(self):
        self.assertEqual(self.run_one(message(), event(virus="FAIL")), "drop-virus")
        self.assertEqual(self.ses.sent, [])

    def test_gray_and_processing_failed_still_forward(self):
        self.assertEqual(self.run_one(message(), event(spam="GRAY", virus="PROCESSING_FAILED")), "forwarded")

    def test_loop_header_in_the_event(self):
        ev = event(headers=[("X-CapyTube-Forwarded", "1")])
        self.assertEqual(self.run_one(message(), ev), "drop-loop")
        self.assertEqual((self.s3.calls, self.ses.sent), ([], []))

    def test_loop_header_in_the_message(self):
        self.assertEqual(self.run_one(message(extra=b"x-capytube-forwarded: 1\r\n")), "drop-loop")
        self.assertEqual(self.ses.sent, [])

    def test_loop_header_quoted_in_a_bounce_report(self):
        report = (b"--r\r\nContent-Type: text/rfc822-headers\r\n\r\nFrom: x\r\nX-CapyTube-Forwarded: 1\r\n--r--\r\n")
        self.assertEqual(self.run_one(message(body=report)), "drop-loop")

    def test_not_for_contact(self):
        self.assertEqual(self.run_one(message(), event(recipients=["someone@example.test"])), "drop-not-for-contact")

    def test_a_bad_message_id_is_an_error_before_anything_is_read(self):
        with self.assertRaises(f.ForwardError):
            f.process(event(message_id="../x"), FakeS3(b""), FakeSes(), FakeSsm(), CFG)


class Rewrite(Base):
    def forwarded(self, raw):
        self.assertEqual(self.run_one(raw), "forwarded")
        (sent,) = self.ses.sent
        return sent

    def test_the_send_call(self):
        sent = self.forwarded(message())
        self.assertEqual(sent["Source"], "contact@capytube.xyz")
        self.assertEqual(sent["Destinations"], [FORWARD_TO])
        self.assertEqual(sent["ConfigurationSetName"], "capyapp-capyweb-contact")
        self.assertEqual(self.s3.calls, [(CFG.bucket, "inbound/o3vrnil0e2ic28tr")])

    def test_from_with_a_display_name(self):
        data = self.forwarded(message())["RawMessage"]["Data"]
        self.assertIn(b'\r\nFrom: "Jane Doe via CapyTube contact" <contact@capytube.xyz>\r\n', b"\r\n" + data)
        msg = message_from_bytes(data, policy=default)
        self.assertEqual(msg["From"].addresses[0].display_name, "Jane Doe via CapyTube contact")
        self.assertEqual(msg["Reply-To"], SENDER)
        self.assertEqual(msg["To"], FORWARD_TO)
        self.assertEqual(msg["X-CapyTube-Forwarded"], "1")

    def test_from_without_a_display_name_uses_the_local_part(self):
        data = self.forwarded(message(b"From: jane.doe@example.test"))["RawMessage"]["Data"]
        msg = message_from_bytes(data, policy=default)
        self.assertEqual(msg["From"].addresses[0].display_name, "jane.doe via CapyTube contact")
        self.assertEqual(msg["From"].addresses[0].addr_spec, "contact@capytube.xyz")
        self.assertEqual(msg["Reply-To"], SENDER)

    def test_a_non_ascii_name_is_rfc2047_encoded(self):
        name = "José 山田 カピバラ好きの人ですよ。よろしく"
        encoded = f"=?utf-8?b?{base64.b64encode(name.encode()).decode()}?=".encode()
        data = self.forwarded(message(b"From: " + encoded + b" <jane.doe@example.test>"))["RawMessage"]["Data"]
        head, _, _ = f.split_message(data)
        self.assertTrue(head.isascii(), "every header line is ASCII")
        for line in head.split(b"\r\n"):
            self.assertLessEqual(len(line), 998)
        (from_field,) = [d for n, d in f.header_fields(head) if n == "from"]
        self.assertIn(b"=?utf-8?", from_field)
        msg = message_from_bytes(data, policy=default)
        # Python 3.9's reader puts a space between two adjacent encoded words (the Lambda runs 3.12,
        # and the forwarder's output is the same on both), so compare without whitespace.
        squash = lambda s: "".join(s.split())
        self.assertEqual(squash(msg["From"].addresses[0].display_name), squash(f"{name} via CapyTube contact"))
        self.assertEqual(msg["From"].addresses[0].addr_spec, "contact@capytube.xyz")

    def test_a_raw_utf8_name_is_encoded_too(self):
        data = self.forwarded(message("From: Élodie <jane.doe@example.test>".encode()))["RawMessage"]["Data"]
        (from_field,) = [d for n, d in headers_of(data) if n == "from"]
        self.assertTrue(from_field.isascii())
        self.assertEqual(str(make_header(decode_header(from_field.decode()[6:].split(" <")[0]))),
                         "Élodie via CapyTube contact")

    def test_quotes_in_a_name_stay_inside_the_quoted_string(self):
        data = self.forwarded(message(b'From: "Jane \\"JD\\" Doe" <jane.doe@example.test>'))["RawMessage"]["Data"]
        msg = message_from_bytes(data, policy=default)
        self.assertEqual(msg["From"].addresses[0].addr_spec, "contact@capytube.xyz")
        self.assertEqual(len(msg["From"].addresses), 1)

    def test_removed_headers(self):
        data = self.forwarded(message())["RawMessage"]["Data"]
        names = [n for n, _ in headers_of(data)]
        for gone in ("cc", "bcc", "sender", "return-path", "dkim-signature", "authentication-results",
                     "received-spf", "disposition-notification-to", "delivered-to", "resent-from", "x-ses-spam-verdict"):
            self.assertNotIn(gone, names)
        for once in ("from", "to", "reply-to", "subject", "x-capytube-forwarded"):
            self.assertEqual(names.count(once), 1, once)
        for kept in ("received", "message-id", "mime-version", "content-type"):
            self.assertIn(kept, names)
        for leak in (b"other@", b"hidden@", b"list@", b"bounce@", b"elsewhere@", b"resender@"):
            self.assertNotIn(leak, data)

    def test_body_and_subject_byte_for_byte(self):
        original = message()
        data = self.forwarded(original)["RawMessage"]["Data"]
        self.assertEqual(f.split_message(data)[2], BODY)
        self.assertTrue(data.endswith(b"\r\n\r\n" + BODY))
        (subject,) = [d for n, d in headers_of(data) if n == "subject"]
        self.assertEqual(subject, SUBJECT + b"\r\n")
        (ctype,) = [d for n, d in headers_of(data) if n == "content-type"]
        self.assertIn(ctype, original)

    def test_lf_only_messages_keep_their_line_ends(self):
        raw = message().replace(b"\r\n", b"\n")
        data = self.forwarded(raw)["RawMessage"]["Data"]
        self.assertNotIn(b"\r", data)
        self.assertEqual(f.split_message(data)[2], BODY.replace(b"\r\n", b"\n"))

    def test_no_from_means_no_reply_to(self):
        raw = message().replace(b"From: Jane Doe <jane.doe@example.test>\r\n", b"")
        msg = message_from_bytes(self.forwarded(raw)["RawMessage"]["Data"], policy=default)
        self.assertEqual(msg["From"].addresses[0].display_name, "Unknown sender via CapyTube contact")
        self.assertIsNone(msg["Reply-To"])


class Size(Base):
    def test_a_large_stored_object_sends_a_notice_without_reading_it(self):
        s3 = FakeS3(b"never read", length=f.MAX_RAW_BYTES + 1)
        self.assertEqual(self.run_one(b"", s3=s3), "notice-too-large")
        (sent,) = self.ses.sent
        msg = message_from_bytes(sent["RawMessage"]["Data"], policy=default)
        self.assertEqual(sent["Destinations"], [FORWARD_TO])
        self.assertEqual(msg["To"], FORWARD_TO)
        self.assertEqual(msg["Reply-To"], SENDER)
        self.assertEqual(msg["X-CapyTube-Forwarded"], "1")
        text = msg.get_content()
        self.assertIn("Key: inbound/o3vrnil0e2ic28tr", text)
        self.assertIn(f"Bucket: {CFG.bucket}", text)
        self.assertIn(str(f.MAX_RAW_BYTES + 1), text)

    def test_a_message_over_the_limit_after_the_rewrite_sends_a_notice(self):
        raw = message(body=b"x" * (f.MAX_RAW_BYTES - len(message(body=b"")) + 1))
        self.assertLessEqual(len(raw), f.MAX_RAW_BYTES + 1)
        self.assertEqual(self.run_one(raw), "notice-too-large")
        self.assertLess(len(self.ses.sent[0]["RawMessage"]["Data"]), 10_000)

    def test_a_rejected_forward_falls_back_to_the_notice(self):
        self.assertEqual(self.run_one(message(), ses=FakeSes(reject_first="MessageRejected")), "notice-rejected")
        text = message_from_bytes(self.ses.sent[1]["RawMessage"]["Data"], policy=default).get_content()
        self.assertIn("refused", text)


class Logs(Base):
    SECRETS = (FORWARD_TO, "owner@", SENDER, "jane", "Jane", "example.test", "Question", "capybara", "Hello", "@")

    def assert_clean(self):
        self.assertTrue(self.logs)
        for line in self.logs:
            for bad in self.SECRETS:
                self.assertNotIn(bad, line)

    def test_forwarded_line(self):
        self.run_one(message())
        self.assert_clean()
        self.assertEqual(len(self.logs), 1)
        for want in ('"sesMessageId": "o3vrnil0e2ic28tr"', '"spam": "PASS"', '"virus": "PASS"',
                     '"decision": "forwarded"', '"sentMessageId": "0100019a-sent-id-000000"'):
            self.assertIn(want, self.logs[0])

    def test_every_path_logs_clean(self):
        for ev, s3, ses in ((event(spam="FAIL"), None, None), (event(headers=[("X-CapyTube-Forwarded", "1")]), None, None),
                            (event(), FakeS3(b"", length=f.MAX_RAW_BYTES + 1), None),
                            (event(), None, FakeSes(reject_first="MessageRejected")),
                            (event(), None, FakeSes(reject_first="Throttling"))):
            f._FORWARD_TO.clear()
            self.run_one(message(), ev, s3=s3, ses=ses)
            self.assert_clean()

    def test_an_error_carries_only_its_code(self):
        result = self.run_one(message(), ses=FakeSes(reject_first="Throttling"))
        self.assertIsInstance(result, f.ForwardError)
        self.assertEqual(str(result), "Throttling")
        self.assertIsNone(result.__cause__)
        self.assertTrue(result.__suppress_context__)
        self.assertIn('"decision": "error"', self.logs[-1])
        self.assert_clean()

    def test_verdicts_are_logged_only_when_they_look_like_verdicts(self):
        self.run_one(message(), event(spam="jane@example.test"))
        self.assertIn('"spam": "UNKNOWN"', self.logs[0])
        self.assert_clean()


class SsmCache(Base):
    def test_read_once_per_container_with_decryption(self):
        ssm = FakeSsm()
        for _ in range(3):
            self.run_one(message(), ssm=ssm)
        self.assertEqual(ssm.calls, [("/capyapp/capyweb/contact/forward-to", True)])
        self.assertEqual(len(self.ses.sent), 1)

    def test_not_read_for_a_dropped_mail(self):
        ssm = FakeSsm()
        self.run_one(message(), event(spam="FAIL"), ssm=ssm)
        self.assertEqual(ssm.calls, [])

    def test_a_value_that_is_not_an_address_is_refused_and_not_cached(self):
        result = self.run_one(message(), ssm=FakeSsm("not an address"))
        self.assertIsInstance(result, f.ForwardError)
        self.assertEqual(f._FORWARD_TO, {})
        self.assertEqual(self.ses.sent, [])


if __name__ == "__main__":
    unittest.main()
