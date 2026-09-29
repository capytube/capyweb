// Unit tests: no network. DynamoDB and SSM calls that slip through go to a closed loopback port
// with dummy credentials, so they fail fast here instead of reaching AWS or reading ~/.aws.
// The coin movements themselves are covered against DynamoDB Local in ledger.integration.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://127.0.0.1:9";
process.env.AWS_ENDPOINT_URL_SSM = "http://127.0.0.1:9";
process.env.AWS_ACCESS_KEY_ID = "local";
process.env.AWS_SECRET_ACCESS_KEY = "local";
process.env.AWS_REGION = "ap-southeast-1";
process.env.AWS_CONFIG_FILE = "/dev/null";
process.env.AWS_SHARED_CREDENTIALS_FILE = "/dev/null";
process.env.AWS_MAX_ATTEMPTS = "1";
delete process.env.AWS_PROFILE;
delete process.env.AWS_SESSION_TOKEN;
process.env.SITE_ORIGIN = "https://dev.capytube.xyz";
process.env.SIGNING_KEY_PAIR_ID = "KTEST";
process.env.SIGNING_KEY_PARAM = "/capyapp/capyweb/test/playback-signing-key";

const { handler, nextPass, renewAfter, sellable, GRACE_SECONDS, CHARGE_WHEN_UNDER_SECONDS, RENEW_BEFORE_END_SECONDS } = await import("./playback.ts");
const { PLAYBACK_BLOCK_SECONDS } = await import("./lib/economy.ts");
const { HttpError } = await import("./lib/http.ts");

const SUB = "0b6e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
const KEY = { "idempotency-key": "k-0123456789" };

function ev(m: string, p: string, opts: { sub?: string | null; tokenUse?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const claims = opts.sub === null ? undefined : { sub: opts.sub ?? SUB, token_use: opts.tokenUse ?? "access" };
  return {
    requestContext: { http: { method: m, path: `/dev${p}` }, stage: "dev", ...(claims && { authorizer: { jwt: { claims } } }) },
    headers: opts.headers ?? KEY,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  };
}
const call = async (...a: Parameters<typeof ev>) => {
  const r = await handler(ev(...a));
  return { status: r.statusCode, body: JSON.parse(r.body), cookies: r.cookies };
};

test("a purchase adds one block from now, or from where the paid time ends", () => {
  const now = 1_790_000_000;
  const B = PLAYBACK_BLOCK_SECONDS;
  assert.equal(B, 60);
  // Nothing paid: one block from now, at 6 x the 10-second price.
  assert.deepEqual(nextPass(now, 0, 1), { charge: 6, paidUntil: now + B });
  assert.deepEqual(nextPass(now, 0, 3), { charge: 18, paidUntil: now + B });
  // Run out a while ago: from now, never back-dated.
  assert.deepEqual(nextPass(now, now - 500, 1), { charge: 6, paidUntil: now + B });
  // The player's renewal, 20 s before the end: extends from the end, so time is paid exactly once.
  assert.deepEqual(nextPass(now, now + 20, 1), { charge: 6, paidUntil: now + 20 + B });
  // 30 s or more still paid (a reload, a second tab, a few seconds or most of a block later):
  // nothing charged, nothing moved.
  assert.deepEqual(nextPass(now, now + B, 1), { charge: 0, paidUntil: now + B });
  assert.deepEqual(nextPass(now, now + B - 3, 1), { charge: 0, paidUntil: now + B - 3 });
  assert.deepEqual(nextPass(now, now + CHARGE_WHEN_UNDER_SECONDS, 1), { charge: 0, paidUntil: now + CHARGE_WHEN_UNDER_SECONDS });
  // Under 30 s left: charged, from the end.
  assert.deepEqual(nextPass(now, now + CHARGE_WHEN_UNDER_SECONDS - 1, 1), { charge: 6, paidUntil: now + CHARGE_WHEN_UNDER_SECONDS - 1 + B });
});

test("steady renewals charge one block per block of time watched", () => {
  let now = 1_790_000_000;
  let paid = 0;
  let spent = 0;
  for (let i = 0; i < 30; i++) {
    const n = nextPass(now, paid, 1);
    spent += n.charge;
    paid = n.paidUntil;
    now += renewAfter(now, paid); // the player comes back when told to
  }
  const watched = now - 1_790_000_000;
  // 6 coins a minute, give or take the one block paid ahead.
  assert.ok(Math.abs(spent - (watched / 60) * 6) <= 6, `spent ${spent} for ${watched} s`);
});

test("the player is told to renew before the paid time runs out, and never at once", () => {
  const now = 1_790_000_000;
  assert.equal(renewAfter(now, now + 60), 40);
  assert.equal(renewAfter(now, now + 80), 60);
  assert.equal(renewAfter(now, now + 10), 5);
  assert.equal(renewAfter(now, now - 100), 5);
  assert.ok(GRACE_SECONDS > 60 - 40, "cookies outlive the paid time by more than the renewal lead");
  assert.ok(RENEW_BEFORE_END_SECONDS < CHARGE_WHEN_UNDER_SECONDS, "the player's renewal always lands where it is charged");
});

test("only a priced paid camera with something to show is for sale", () => {
  const code = (s: Record<string, unknown> | undefined) => {
    try { sellable(s); return "ok"; } catch (e) { assert.ok(e instanceof HttpError); return `${e.status} ${e.code}`; }
  };
  const paid = { id: "wall-cam", access_type: "private", video_mode: "recording", price_per_10_sec: 1 };
  assert.equal(sellable(paid), 1);
  assert.equal(code(undefined), "404 not_found");
  assert.equal(code({ ...paid, access_type: "public" }), "400 free_camera");
  assert.equal(code({ ...paid, access_type: undefined }), "409 not_for_sale");
  assert.equal(code({ ...paid, video_mode: undefined }), "409 offline");
  assert.equal(code({ ...paid, video_mode: undefined, is_live: true }), "ok");
  assert.equal(code({ ...paid, video_mode: "live", is_live: false }), "409 offline");
  for (const bad of [undefined, 0, -1, 1.5, "1", null]) {
    assert.equal(code({ ...paid, price_per_10_sec: bad }), "409 not_priced", `price ${String(bad)}`);
  }
});

test("routing and sign-in are checked before anything is read", async () => {
  assert.equal((await call("POST", "/playback")).status, 404);
  assert.equal((await call("POST", "/playback/wall-cam/extra")).status, 404);
  assert.equal((await call("GET", "/playback/wall-cam")).status, 405);
  assert.equal((await call("POST", "/playback/wall-cam", { sub: null })).status, 401);
  assert.equal((await call("POST", "/playback/wall-cam", { tokenUse: "id" })).status, 401, "ID tokens are not API grants");
  assert.equal((await call("POST", "/playback/wall%2Fcam")).status, 400);
  assert.equal((await call("POST", "/playback/wall-cam", { headers: {} })).status, 400, "an Idempotency-Key is required");
  const extra = await call("POST", "/playback/wall-cam", { body: { price_per_10_sec: 0 } });
  assert.equal(extra.status, 400, "the client never sends a price or anything else");
});

test("if the signing key cannot be read, the answer is 503 and no coins move", async () => {
  // SSM is a closed port here. Had the handler gone on to the ledger, DynamoDB (also closed)
  // would have made it a 500; a 503 not_ready shows it stopped before any coin could move.
  const r = await call("POST", "/playback/wall-cam");
  assert.equal(r.status, 503);
  assert.equal(r.body.code, "not_ready");
  assert.equal(r.cookies, undefined);
});
