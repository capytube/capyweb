// Unit tests: no network. The DynamoDB client is a fake that records each command; any real call
// that slipped through would go to a closed loopback port with dummy credentials.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://127.0.0.1:9";
process.env.AWS_ACCESS_KEY_ID = "local";
process.env.AWS_SECRET_ACCESS_KEY = "local";
process.env.AWS_REGION = "ap-southeast-1";
process.env.AWS_CONFIG_FILE = "/dev/null";
process.env.AWS_SHARED_CREDENTIALS_FILE = "/dev/null";
delete process.env.AWS_PROFILE;
delete process.env.AWS_SESSION_TOKEN;
process.env.TABLE_MAIN = "capyapp-capyweb-test-main";
process.env.SIGNUP_CAP_DAY = "40";
process.env.SIGNUP_CAP_HOUR = "10";

const { capSignUp, counters, readLimits, resetForTests, PUBLIC_MESSAGE } = await import("./signupcap.ts");

const NOW = new Date("2026-09-29T13:25:00.000Z");
// A marker, not a real address: the check is that nothing from the event reaches the log.
const EMAIL = "marker-in-place-of-the-address";

const event = (triggerSource = "PreSignUp_SignUp") => ({
  version: "1",
  region: "ap-southeast-1",
  userPoolId: "ap-southeast-1_test",
  userName: "3f1c",
  triggerSource,
  callerContext: { awsSdkVersion: "x", clientId: "c" },
  request: { userAttributes: { email: EMAIL } },
  response: { autoConfirmUser: false, autoVerifyEmail: false, autoVerifyPhone: false },
});

/** A fake client: records every command's input and answers with the next scripted outcome. */
function fake(...outcomes: (Error | undefined)[]) {
  const sent: any[] = [];
  const send = async (cmd: { input: unknown }) => {
    sent.push(cmd.input);
    const o = outcomes.shift();
    if (o) throw o;
    return {};
  };
  return { sent, send };
}

const canceled = (...codes: string[]) =>
  Object.assign(new Error("Transaction cancelled"), { name: "TransactionCanceledException", CancellationReasons: codes.map((Code) => ({ Code })) });

/** Captures console.log for one test, so refusal lines can be checked and do not clutter the run. */
function logs(t: { mock: { method: Function } }): string[] {
  const lines: string[] = [];
  t.mock.method(console, "log", (...a: unknown[]) => { lines.push(a.map(String).join(" ")); });
  return lines;
}

beforeEach(() => resetForTests());

test("under the cap: one transaction with both counters, and the event comes back unchanged", async () => {
  const { sent, send } = fake();
  const e = event();
  const before = structuredClone(e);
  const out = await capSignUp(e, send, NOW);
  assert.equal(out, e);
  assert.deepEqual(out, before, "no auto-confirm, no auto-verify, nothing added");

  assert.equal(sent.length, 1);
  const items = sent[0].TransactItems;
  assert.equal(items.length, 2, "exactly the day and the hour counter");
  const [day, hour] = items.map((i: any) => i.Update);
  assert.deepEqual(day.Key, { PK: "SIGNUPS#2026-09-29", SK: "DAY" });
  assert.deepEqual(hour.Key, { PK: "SIGNUPS#2026-09-29", SK: "HOUR#13" });
  for (const [u, limit] of [[day, 40], [hour, 10]] as const) {
    assert.equal(u.TableName, "capyapp-capyweb-test-main");
    assert.match(u.UpdateExpression, /^ADD #n :one /);
    assert.equal(u.ConditionExpression, "attribute_not_exists(#n) OR #n < :limit");
    assert.deepEqual(u.ExpressionAttributeNames, { "#n": "n" });
    assert.equal(u.ExpressionAttributeValues[":one"], 1);
    assert.equal(u.ExpressionAttributeValues[":limit"], limit);
    assert.equal(u.ExpressionAttributeValues[":exp"], Date.parse("2026-10-01T00:00:00.000Z") / 1000);
  }
});

test("at the day cap or the hour cap the visitor gets the public message, and one log line without personal data", async (t) => {
  const lines = logs(t);
  for (const [codes, reason] of [[["ConditionalCheckFailed", "None"], "day_cap"], [["None", "ConditionalCheckFailed"], "hour_cap"],
    [["ConditionalCheckFailed", "ConditionalCheckFailed"], "day_cap"]] as const) {
    resetForTests();
    const { send } = fake(canceled(...codes));
    await assert.rejects(capSignUp(event(), send, NOW), (err: Error) => err.message === PUBLIC_MESSAGE);
    assert.deepEqual(JSON.parse(lines.at(-1)!), { signup: "refused", reason });
  }
  assert.equal(lines.length, 3, "one line per refusal");
  assert.ok(lines.every((l) => !l.includes(EMAIL) && !l.includes("3f1c")), "no email address or user name in the log");
  assert.doesNotMatch(PUBLIC_MESSAGE, /\d/, "no numbers in what the visitor sees");
});

test("any other failure also refuses (fail closed), with the same public message", async (t) => {
  const lines = logs(t);
  const failures = [
    Object.assign(new Error("Throughput exceeds the current capacity"), { name: "ProvisionedThroughputExceededException" }),
    Object.assign(new Error("Rate exceeded"), { name: "ThrottlingException" }),
    Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:443"), { name: "Error" }),
    canceled("ThrottlingError", "None"),
    canceled("ValidationError", "None"),
  ];
  for (const f of failures) {
    resetForTests();
    const { sent, send } = fake(f);
    await assert.rejects(capSignUp(event(), send, NOW), (err: Error) => err.message === PUBLIC_MESSAGE);
    assert.equal(sent.length, 1, `${f.name} is not retried`);
    assert.equal(JSON.parse(lines.at(-1)!).reason, "error");
  }
  assert.ok(lines.every((l) => !l.includes("10.0.0.1")), "the error's name is logged, not its message");
});

test("two sign-ups racing for a counter retry, and give up closed if the race never clears", async (t) => {
  logs(t);
  const ok = fake(canceled("TransactionConflict", "None"));
  await capSignUp(event(), ok.send, NOW);
  assert.equal(ok.sent.length, 2, "retried once, then counted");

  const stuck = fake(canceled("None", "TransactionConflict"), canceled("None", "TransactionConflict"), canceled("None", "TransactionConflict"));
  await assert.rejects(capSignUp(event(), stuck.send, NOW), { message: PUBLIC_MESSAGE });
  assert.equal(stuck.sent.length, 3, "three attempts at most");
});

test("admin-created and external-provider sign-ups pass through without a write", async () => {
  for (const source of ["PreSignUp_AdminCreateUser", "PreSignUp_ExternalProvider"]) {
    const { sent, send } = fake();
    const e = event(source);
    assert.equal(await capSignUp(e, send, NOW), e);
    assert.equal(sent.length, 0, source);
  }
});

test("after a cap refusal this container refuses without writing until that hour (or day) is over", async (t) => {
  logs(t);
  const f = fake(canceled("None", "ConditionalCheckFailed"));
  await assert.rejects(capSignUp(event(), f.send, NOW), { message: PUBLIC_MESSAGE });
  await assert.rejects(capSignUp(event(), f.send, new Date("2026-09-29T13:59:59.999Z")), { message: PUBLIC_MESSAGE });
  assert.equal(f.sent.length, 1, "the second refusal cost no write");
  await capSignUp(event(), f.send, new Date("2026-09-29T14:00:00.000Z"));
  assert.equal(f.sent.length, 2, "a new hour writes again");

  resetForTests();
  const d = fake(canceled("ConditionalCheckFailed", "None"));
  await assert.rejects(capSignUp(event(), d.send, NOW), { message: PUBLIC_MESSAGE });
  await assert.rejects(capSignUp(event(), d.send, new Date("2026-09-29T23:59:59.999Z")), { message: PUBLIC_MESSAGE });
  assert.equal(d.sent.length, 1, "the day cap holds for the rest of the UTC day");
  await capSignUp(event(), d.send, new Date("2026-09-30T00:00:00.000Z"));
  assert.equal(d.sent.length, 2);

  resetForTests();
  const e = fake(Object.assign(new Error("x"), { name: "ThrottlingException" }));
  await assert.rejects(capSignUp(event(), e.send, NOW));
  await capSignUp(event(), e.send, NOW);
  assert.equal(e.sent.length, 2, "an error is not remembered: the next sign-up tries again");
});

test("keys and expiry at a UTC day boundary", () => {
  const last = counters(new Date("2026-09-29T23:59:59.999Z"));
  const first = counters(new Date("2026-09-30T00:00:00.000Z"));
  assert.deepEqual(last.day, { PK: "SIGNUPS#2026-09-29", SK: "DAY" });
  assert.deepEqual(last.hour, { PK: "SIGNUPS#2026-09-29", SK: "HOUR#23" });
  assert.deepEqual(first.day, { PK: "SIGNUPS#2026-09-30", SK: "DAY" });
  assert.deepEqual(first.hour, { PK: "SIGNUPS#2026-09-30", SK: "HOUR#00" });
  assert.equal(last.expiresAt, Date.parse("2026-10-01T00:00:00.000Z") / 1000, "epoch seconds, two days after the day began");
  assert.equal(first.expiresAt, Date.parse("2026-10-02T00:00:00.000Z") / 1000);
  assert.equal(last.dayEnds, Date.parse("2026-09-30T00:00:00.000Z"));
  assert.equal(last.hourEnds, Date.parse("2026-09-30T00:00:00.000Z"));
  // A local-time offset must not move the day: the same instant written with +08:00.
  assert.deepEqual(counters(new Date("2026-09-30T07:59:59.999+08:00")).day, last.day);
});

test("limits come from the environment, and a bad value refuses rather than letting everyone in", async (t) => {
  assert.deepEqual(readLimits({ SIGNUP_CAP_DAY: "40", SIGNUP_CAP_HOUR: "10" }), { day: 40, hour: 10 });
  for (const env of [{}, { SIGNUP_CAP_DAY: "40" }, { SIGNUP_CAP_DAY: "", SIGNUP_CAP_HOUR: "10" },
    { SIGNUP_CAP_DAY: "0", SIGNUP_CAP_HOUR: "10" }, { SIGNUP_CAP_DAY: "4.5", SIGNUP_CAP_HOUR: "10" }, { SIGNUP_CAP_DAY: "x", SIGNUP_CAP_HOUR: "1" }]) {
    assert.throws(() => readLimits(env), /SIGNUP_CAP_DAY/, JSON.stringify(env));
  }
  const lines = logs(t);
  const saved = process.env.SIGNUP_CAP_HOUR;
  delete process.env.SIGNUP_CAP_HOUR;
  try {
    const { sent, send } = fake();
    await assert.rejects(capSignUp(event(), send, NOW), { message: PUBLIC_MESSAGE });
    assert.equal(sent.length, 0);
    assert.equal(JSON.parse(lines.at(-1)!).reason, "error");
  } finally {
    process.env.SIGNUP_CAP_HOUR = saved;
  }
});
