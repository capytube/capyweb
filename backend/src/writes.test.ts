// Unit tests: no network. Any DynamoDB call that slips through goes to a closed loopback port with
// dummy credentials, so it fails fast here instead of reaching AWS or reading ~/.aws.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://127.0.0.1:9";
process.env.AWS_ACCESS_KEY_ID = "local";
process.env.AWS_SECRET_ACCESS_KEY = "local";
process.env.AWS_REGION = "ap-southeast-1";
process.env.AWS_CONFIG_FILE = "/dev/null";
process.env.AWS_SHARED_CREDENTIALS_FILE = "/dev/null";
delete process.env.AWS_PROFILE;
delete process.env.AWS_SESSION_TOKEN;

const { matchRoute, handler, isOpen } = await import("./writes.ts");

const seg = (p: string) => p.split("/").filter(Boolean);
const SUB = "0b6e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b";

function ev(m: string, p: string, opts: { sub?: string | null; body?: unknown; headers?: Record<string, string> } = {}) {
  const claims = opts.sub === null ? undefined : { sub: opts.sub ?? SUB };
  return {
    requestContext: { http: { method: m, path: `/dev${p}` }, stage: "dev", ...(claims && { authorizer: { jwt: { claims } } }) },
    headers: opts.headers ?? {},
    body: opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
  };
}
const call = async (...a: Parameters<typeof ev>) => {
  const r = await handler(ev(...a));
  return { status: r.statusCode, body: JSON.parse(r.body), headers: r.headers };
};

test("every documented write route dispatches, by method and path", () => {
  const cases: [string, string, string][] = [
    ["GET", "/me", "getMe"],
    ["PUT", "/me", "putMe"],
    ["GET", "/me/transactions", "listTransactions"],
    ["POST", "/interactions/i1/votes", "vote"],
    ["POST", "/interactions/i1/bids", "bid"],
    ["GET", "/streams/s1/chat", "listChat"],
    ["POST", "/streams/s1/chat", "postChat"],
    ["POST", "/streams/s1/reactions", "react"],
  ];
  for (const [m, p, kind] of cases) {
    const r = matchRoute(m, seg(p));
    assert.ok(r && r !== "method" && r.kind === kind, `${m} ${p} should be ${kind}`);
  }
});

test("wrong verbs and unknown paths do not reach a handler", () => {
  assert.equal(matchRoute("DELETE", seg("/me")), "method");
  assert.equal(matchRoute("POST", seg("/me/transactions")), "method");
  assert.equal(matchRoute("GET", seg("/interactions/i1/votes")), "method");
  assert.equal(matchRoute("PUT", seg("/streams/s1/chat")), "method");
  for (const p of ["/", "/me/balance", "/users/u2", "/users/u2/transactions", "/me/transactions/x",
    "/interactions/i1", "/interactions/i1/votes/x", "/streams/s1", "/capybaras/c1/interactions"]) {
    assert.equal(matchRoute("GET", seg(p)), null, `${p} must not match`);
  }
});

test("no route takes a user id: the caller comes only from the verified token", async () => {
  // There is no /users/{id} anything; a user id in a path is simply not a route.
  assert.equal((await call("GET", "/users/someone-else/transactions")).status, 404);
  // A request with no authorizer claims fails closed, before any read.
  for (const [m, p] of [["GET", "/me"], ["GET", "/me/transactions"], ["POST", "/streams/s1/chat"], ["POST", "/interactions/i1/votes"]]) {
    const r = await call(m, p, { sub: null, body: { text: "hi" } });
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.equal(r.body.code, "unauthorized");
  }
  // A sub that could smuggle a key delimiter is refused.
  assert.equal((await call("GET", "/me", { sub: "u#1" })).status, 401);
});

test("the body cannot name a user, a balance or a price", async () => {
  const put = await call("PUT", "/me", { body: { display_name: "Nic", balance: 1_000_000 } });
  assert.equal(put.status, 400);
  assert.match(put.body.error, /unknown field.*balance/);

  const key = { "idempotency-key": "k-0000000001" };
  const vote = await call("POST", "/interactions/i1/votes", { body: { option_id: "carrots", user_id: "someone-else" }, headers: key });
  assert.equal(vote.status, 400);
  const priced = await call("POST", "/interactions/i1/votes", { body: { option_id: "carrots", cost: 0 }, headers: key });
  assert.equal(priced.status, 400, "the client may not send a cost");
  const bid = await call("POST", "/interactions/i1/bids", { body: { amount: 5, user_id: "x" }, headers: key });
  assert.equal(bid.status, 400);
});

test("spending requires an Idempotency-Key", async () => {
  const v = await call("POST", "/interactions/i1/votes", { body: { option_id: "carrots" } });
  assert.equal(v.status, 400);
  assert.match(v.body.error, /Idempotency-Key/);
  const b = await call("POST", "/interactions/i1/bids", { body: { amount: 5 } });
  assert.equal(b.status, 400);
});

test("bad bodies are 400 before any read", async () => {
  const key = { "idempotency-key": "k-0000000001" };
  assert.equal((await call("POST", "/streams/s1/chat", { body: "not json" })).status, 400);
  assert.equal((await call("POST", "/streams/s1/chat", { body: "[1,2]" })).status, 400);
  assert.equal((await call("POST", "/streams/s1/chat", { body: { text: "x".repeat(281) } })).status, 400);
  assert.equal((await call("POST", "/streams/s1/chat", { body: { text: "   " } })).status, 400);
  assert.equal((await call("POST", "/streams/s1/chat", { body: "x".repeat(5000) })).status, 400);
  assert.equal((await call("POST", "/streams/s1/reactions", { body: { reaction: "capyhate" } })).status, 400);
  assert.equal((await call("POST", "/interactions/i1/bids", { body: { amount: "5" }, headers: key })).status, 400);
  assert.equal((await call("POST", "/interactions/i1/bids", { body: { amount: 0 }, headers: key })).status, 400);
  assert.equal((await call("POST", "/interactions/i1/votes", { body: { option_id: "a", number_of_votes: 11 }, headers: key })).status, 400);
  assert.equal((await call("POST", "/interactions/i1/votes", { body: { option_id: "a", custom_request: "mango" }, headers: key })).status, 400);
  assert.equal((await call("POST", "/interactions/i1/votes", { body: {}, headers: key })).status, 400);
  assert.equal((await call("PUT", "/me", { body: { display_name: "admin" } })).status, 400);
  assert.equal((await call("GET", "/streams/bad%23id/chat")).status, 400);
});

test("wrong verb is 405, unknown path 404, and both are uncached", async () => {
  const r = await call("DELETE", "/me");
  assert.equal(r.status, 405);
  assert.equal(r.headers["cache-control"], "no-store");
  assert.equal((await call("GET", "/nope")).status, 404);
});

test("an interaction is open until staff close it, declare a result, or its closing time passes", () => {
  const now = "2026-09-29T08:00:00.000Z";
  assert.equal(isOpen({}, now), true);
  assert.equal(isOpen({ status: "open" }, now), true);
  assert.equal(isOpen({ status: "closed" }, now), false);
  assert.equal(isOpen({ status: "draft" }, now), false, "anything but open is closed");
  assert.equal(isOpen({ result: "carrots" }, now), false);
  assert.equal(isOpen({ closes_at: "2026-09-29T07:59:59.999Z" }, now), false);
  assert.equal(isOpen({ closes_at: "2026-09-29T08:00:00.001Z" }, now), true);
});
