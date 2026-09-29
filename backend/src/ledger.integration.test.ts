// Integration tests against DynamoDB Local. OPT-IN: skipped unless DDB_LOCAL_ENDPOINT is set, so
// `npm test` (and the pre-push hook) never needs Docker or a network. How to run: infra/README.md,
// "Ledger integration tests". Only a loopback endpoint is accepted, with dummy credentials set in
// this process, so the suite can never reach AWS or read ~/.aws.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const ENDPOINT = process.env.DDB_LOCAL_ENDPOINT;
const skip = ENDPOINT ? false : "set DDB_LOCAL_ENDPOINT=http://127.0.0.1:8010 to run (see infra/README.md)";

if (ENDPOINT) {
  const host = new URL(ENDPOINT).hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error(`DDB_LOCAL_ENDPOINT must be loopback, got ${host}`);
  }
  process.env.AWS_ENDPOINT_URL_DYNAMODB = ENDPOINT;
  process.env.AWS_ACCESS_KEY_ID = "local";
  process.env.AWS_SECRET_ACCESS_KEY = "local";
  process.env.AWS_REGION = "ap-southeast-1";
  process.env.AWS_CONFIG_FILE = "/dev/null";
  process.env.AWS_SHARED_CREDENTIALS_FILE = "/dev/null";
  delete process.env.AWS_PROFILE;
  delete process.env.AWS_SESSION_TOKEN;
  process.env.TABLE_MAIN = `capyapp-capyweb-test-${Date.now()}`;
}

// Loaded after the environment is pinned: ddb.ts builds its client at import time.
type Mods = {
  writes: typeof import("./writes.ts");
  ledger: typeof import("./lib/ledger.ts");
  ddb: typeof import("./lib/ddb.ts");
  sdk: typeof import("@aws-sdk/client-dynamodb");
  lib: typeof import("@aws-sdk/lib-dynamodb");
  keys: typeof import("./lib/keys.ts");
};
let M: Mods;

async function call(m: string, target: string, sub: string, body?: unknown, key?: string) {
  const [p, search] = target.split("?");
  const r = await M.writes.handler({
    requestContext: { http: { method: m, path: `/dev${p}` }, stage: "dev", authorizer: { jwt: { claims: { sub, token_use: "access" } } } },
    queryStringParameters: search ? Object.fromEntries(new URLSearchParams(search)) : undefined,
    headers: key ? { "idempotency-key": key } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.statusCode, body: JSON.parse(r.body) };
}

/** The public chat read: no authorizer context at all, as API Gateway sends it. */
async function publicGet(target: string) {
  const [p, search] = target.split("?");
  const r = await M.writes.handler({
    requestContext: { http: { method: "GET", path: `/dev${p}` }, stage: "dev" },
    queryStringParameters: search ? Object.fromEntries(new URLSearchParams(search)) : undefined,
  });
  return { status: r.statusCode, body: JSON.parse(r.body), headers: r.headers };
}

const put = (Item: Record<string, unknown>) =>
  M.ddb.doc.send(new M.lib.PutCommand({ TableName: M.ddb.TABLE, Item }));

/** Every ledger entry of a user, straight from the table. */
async function entries(user: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const r = await M.ddb.doc.send(new M.lib.QueryCommand({
      TableName: M.ddb.TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :t)",
      ExpressionAttributeValues: { ":pk": `USER#${user}`, ":t": "TXN#" },
      ConsistentRead: true,
      ExclusiveStartKey: start,
    }));
    out.push(...(r.Items ?? []));
    start = r.LastEvaluatedKey;
  } while (start);
  return out;
}
const sum = (xs: Record<string, unknown>[]) => xs.reduce((a, x) => a + (x.amount as number), 0);
const balance = async (u: string) => (await M.ledger.getAccount(u))?.balance ?? 0;

/**
 * TEST-ONLY setup: put an account at an exact balance. It creates the account the normal way
 * (which pays the sign-up grant), then overwrites the balance directly on DynamoDB Local - something
 * no code path in the API can do. The difference is remembered as the account's opening offset, so
 * the invariant below still checks that every change AFTER setup has exactly one matching entry.
 */
const opening = new Map<string, number>();
async function startAt(u: string, coins: number) {
  await M.ledger.ensureAccount(u);
  const { pk, META } = M.keys;
  await M.ddb.doc.send(new M.lib.UpdateCommand({
    TableName: M.ddb.TABLE, Key: { PK: pk.user(u), SK: META },
    UpdateExpression: "SET balance = :b", ExpressionAttributeValues: { ":b": coins },
  }));
  opening.set(u, coins - sum(await entries(u)));
}

/**
 * The ledger's core invariant: a user's entries add up to their balance (less any test-only
 * opening offset from startAt), and the balance is never negative.
 */
async function assertBooksBalance(u: string) {
  const b = await balance(u);
  assert.ok(b >= 0, `${u} balance ${b} went negative`);
  assert.equal(sum(await entries(u)) + (opening.get(u) ?? 0), b, `${u}: entries must add up to the balance`);
}

const newUser = () => randomUUID();
const key = () => randomUUID();

before(async () => {
  if (skip) return;
  M = {
    writes: await import("./writes.ts"),
    ledger: await import("./lib/ledger.ts"),
    ddb: await import("./lib/ddb.ts"),
    sdk: await import("@aws-sdk/client-dynamodb"),
    lib: await import("@aws-sdk/lib-dynamodb"),
    keys: await import("./lib/keys.ts"),
  };
  // Same key schema as MainTable in infra/backend/template.yaml.
  const client = new M.sdk.DynamoDBClient({});
  // A container that has just started resets connections for a few seconds; wait until it answers
  // rather than failing every test on a startup race.
  for (let tries = 1; ; tries++) {
    try {
      await client.send(new M.sdk.ListTablesCommand({ Limit: 1 }));
      break;
    } catch (e) {
      if (tries >= 30) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const S = "S" as const;
  await client.send(new M.sdk.CreateTableCommand({
    TableName: M.ddb.TABLE,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: ["PK", "SK", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK"].map((AttributeName) => ({ AttributeName, AttributeType: S })),
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }, { AttributeName: "SK", KeyType: "RANGE" }],
    GlobalSecondaryIndexes: ["GSI1", "GSI2"].map((IndexName) => ({
      IndexName,
      KeySchema: [{ AttributeName: `${IndexName}PK`, KeyType: "HASH" }, { AttributeName: `${IndexName}SK`, KeyType: "RANGE" }],
      Projection: { ProjectionType: "ALL" },
    })),
  }));

  const { pk, sk, gsi1, META } = M.keys;
  const now = new Date().toISOString();
  await put({ PK: pk.stream("s1"), SK: META, entity: "LiveStream", id: "s1", title: "Main cam", access_type: "public", ...gsi1.streamsByAccess("public", now, "s1") });
  await put({ PK: pk.stream("s-priv"), SK: META, entity: "LiveStream", id: "s-priv", title: "Wall cam", access_type: "private", ...gsi1.streamsByAccess("private", now, "s-priv") });
  await put({ PK: pk.stream("s-none"), SK: META, entity: "LiveStream", id: "s-none", title: "No access type" });
  const ixn = (id: string, type: string, extra: Record<string, unknown>) => put({
    PK: pk.capy("c1"), SK: sk.interaction(type, "2026-10-01", id), entity: "Interaction", id, capybara_id: "c1",
    interaction_type: type, title: id, session_date: "2026-10-01", ...extra, ...gsi1.interactionById(id),
  });
  const options = [{ id: "carrots", title: "Carrots" }, { id: "pandan", title: "Pandan" }];
  await ixn("v-open", "vote", { vote_cost: 2, custom_request_cost: 5, options });
  await ixn("v-cheap", "vote", { vote_cost: 1, options });
  await ixn("v-closed", "vote", { vote_cost: 1, options, status: "closed" });
  await ixn("v-decided", "vote", { vote_cost: 1, options, result: "carrots" });
  await ixn("v-expired", "vote", { vote_cost: 1, options, closes_at: "2020-01-01T00:00:00.000Z" });
  await ixn("b-open", "bid", { current_bid: 5 });
});

after(async () => {
  if (skip) return;
  await new M.sdk.DynamoDBClient({}).send(new M.sdk.DeleteTableCommand({ TableName: M.ddb.TABLE }));
});

test("the first GET /me grants 50 coins once, as one signup_grant entry, and only the name is writable", { skip }, async () => {
  const u = newUser();
  const me = await call("GET", "/me", u);
  assert.equal(me.status, 200);
  assert.deepEqual({ balance: me.body.balance, display_name: me.body.display_name }, { balance: 50, display_name: null });
  const grants = (await entries(u)).filter((x) => x.type === "signup_grant");
  assert.equal(grants.length, 1);
  assert.equal(grants[0].amount, 50);
  assert.equal((await entries(u)).length, 1, "the grant is the only entry");
  // Repeated first calls, and the other routes that create an account, never grant again.
  for (let i = 0; i < 3; i++) assert.equal((await call("GET", "/me", u)).body.balance, 50);
  assert.equal((await call("PUT", "/me", u, { display_name: "Capy Fan" })).body.display_name, "Capy Fan");
  await M.ledger.ensureAccount(u);
  assert.equal((await call("PUT", "/me", u, { balance: 999 })).status, 400);
  assert.equal(await balance(u), 50);
  assert.equal((await entries(u)).length, 1);
  await assertBooksBalance(u);
});

test("concurrent first calls grant exactly once, and later credits still add up", { skip }, async () => {
  const u = newUser();
  const race = await Promise.all([
    ...Array.from({ length: 10 }, () => call("GET", "/me", u)),
    call("PUT", "/me", u, { display_name: "Racer" }),
    M.ledger.ensureAccount(u).then((a) => ({ status: 200, body: a })),
  ]);
  assert.ok(race.every((r) => r.status === 200), race.map((r) => r.status).join(","));
  assert.ok(race.every((r) => r.body.balance === 50), "every caller sees the one grant");
  assert.equal(await balance(u), 50);
  assert.equal((await entries(u)).filter((x) => x.type === "signup_grant").length, 1);
  await M.ledger.credit(u, 7, key()); // an admin-style grant on top: a separate entry
  assert.equal(await balance(u), 57);
  assert.equal((await entries(u)).length, 2);
  await assertBooksBalance(u);
});

test("a debit that would overdraw is refused and changes nothing", { skip }, async () => {
  const u = newUser();
  await startAt(u, 3);
  const r = await call("POST", "/interactions/v-open/votes", u, { option_id: "carrots", number_of_votes: 2 }, key()); // 2 x 2 = 4
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "insufficient_coins");
  assert.equal(await balance(u), 3);
  assert.equal((await entries(u)).filter((x) => x.type === "vote").length, 0, "no entry for the refusal");
  const ok = await call("POST", "/interactions/v-open/votes", u, { option_id: "carrots", number_of_votes: 1 }, key());
  assert.equal(ok.status, 201);
  assert.equal(ok.body.charged, 2, "the price comes from the interaction item");
  assert.equal(await balance(u), 1);
  await assertBooksBalance(u);
});

test("a user who never signed in to /me cannot be debited", { skip }, async () => {
  const r = await call("POST", "/interactions/v-cheap/votes", newUser(), { option_id: "carrots" }, key());
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "insufficient_coins");
});

test("20 concurrent debits never overdraw, and the entries add up to the balance change", { skip }, async () => {
  const u = newUser();
  await startAt(u, 10);
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    call("POST", "/interactions/v-cheap/votes", u, { option_id: "pandan" }, key())));
  const codes = results.map((r) => r.status === 201 ? "ok" : r.body.code);
  const okCount = codes.filter((c) => c === "ok").length;
  const refused = codes.filter((c) => c === "insufficient_coins").length;
  const busy = codes.filter((c) => c === "conflict").length;
  console.log(`  20 concurrent 1-coin votes on 10 coins: ${okCount} charged, ${refused} refused (insufficient), ${busy} busy (conflict)`);
  assert.equal(okCount + refused + busy, 20, `unexpected outcomes: ${codes.join(",")}`);
  assert.ok(okCount <= 10, "never more debits than coins");
  const b = await balance(u);
  assert.equal(b, 10 - okCount, "each success took exactly one coin");
  assert.ok(b >= 0);
  const debits = (await entries(u)).filter((x) => x.type === "vote");
  assert.equal(debits.length, okCount, "one ledger entry per success, none for refusals");
  assert.equal(sum(debits), -okCount);
  await assertBooksBalance(u);
});

test("an idempotent retry charges once and replays the first answer", { skip }, async () => {
  const u = newUser();
  await startAt(u, 10);
  const k = key();
  const body = { option_id: "carrots", number_of_votes: 2 };
  const first = await call("POST", "/interactions/v-open/votes", u, body, k);
  assert.equal(first.status, 201);
  const again = await call("POST", "/interactions/v-open/votes", u, body, k);
  assert.equal(again.status, 200);
  assert.equal(again.body.replayed, true);
  assert.equal(again.body.vote.id, first.body.vote.id);
  // Concurrent duplicates too: several copies of one request race, one charge.
  const k2 = key();
  const race = await Promise.all(Array.from({ length: 5 }, () => call("POST", "/interactions/v-open/votes", u, body, k2)));
  assert.equal(race.filter((r) => r.status === 201).length, 1, race.map((r) => r.status).join(","));
  assert.ok(race.every((r) => r.status === 201 || (r.status === 200 && r.body.replayed) || r.body.code === "conflict"));
  assert.equal(await balance(u), 10 - 4 - 4);
  // The same key for a different request is refused, not replayed.
  const other = await call("POST", "/interactions/v-open/votes", u, { option_id: "pandan", number_of_votes: 2 }, k);
  assert.equal(other.status, 409);
  assert.equal(other.body.code, "idempotency_mismatch");
  // Keys are per user: another user's identical key is a separate request.
  const v = newUser();
  await startAt(v, 4);
  assert.equal((await call("POST", "/interactions/v-open/votes", v, body, k)).status, 201);
  await assertBooksBalance(u);
  await assertBooksBalance(v);
});

test("closed, decided, expired, unknown and wrong-type interactions are refused without a charge", { skip }, async () => {
  const u = newUser();
  await startAt(u, 10);
  for (const id of ["v-closed", "v-decided", "v-expired"]) {
    const r = await call("POST", `/interactions/${id}/votes`, u, { option_id: "carrots" }, key());
    assert.equal(r.status, 409, id);
    assert.equal(r.body.code, "interaction_closed", id);
  }
  assert.equal((await call("POST", "/interactions/nope/votes", u, { option_id: "carrots" }, key())).status, 404);
  assert.equal((await call("POST", "/interactions/b-open/votes", u, { option_id: "carrots" }, key())).body.code, "wrong_type");
  assert.equal((await call("POST", "/interactions/v-open/votes", u, { option_id: "durian" }, key())).status, 400);
  assert.equal(await balance(u), 10);
  await assertBooksBalance(u);
});

test("a re-priced interaction charges the stored price, never one the client assumed", { skip }, async () => {
  const u = newUser();
  await startAt(u, 5);
  const { pk, sk } = M.keys;
  await M.ddb.doc.send(new M.lib.UpdateCommand({
    TableName: M.ddb.TABLE, Key: { PK: pk.capy("c1"), SK: sk.interaction("vote", "2026-10-01", "v-cheap") },
    UpdateExpression: "SET vote_cost = :c", ExpressionAttributeValues: { ":c": 3 },
  }));
  // The price moved to 3: the server charges the new price, never a client-supplied one.
  const r = await call("POST", "/interactions/v-cheap/votes", u, { option_id: "carrots" }, key());
  assert.equal(r.body.charged, 3);
  await M.ddb.doc.send(new M.lib.UpdateCommand({
    TableName: M.ddb.TABLE, Key: { PK: pk.capy("c1"), SK: sk.interaction("vote", "2026-10-01", "v-cheap") },
    UpdateExpression: "SET vote_cost = :c", ExpressionAttributeValues: { ":c": 1 },
  }));
  await assertBooksBalance(u);
});

test("custom requests cost votes plus the custom fee and wait for review", { skip }, async () => {
  const u = newUser();
  await startAt(u, 10);
  const r = await call("POST", "/interactions/v-open/votes", u, { custom_request: "Mango please" }, key());
  assert.equal(r.status, 201);
  assert.equal(r.body.charged, 2 + 5);
  assert.equal(r.body.vote.status, "pending_review");
  const q = await M.ddb.query({ index: "GSI2", pk: "MODQ#vote" });
  assert.ok(q.items.some((i) => i.id === r.body.vote.id), "a custom request joins the moderation queue");
  assert.equal((await call("POST", "/interactions/v-cheap/votes", u, { custom_request: "x" }, key())).body.code, "no_custom");
  await assertBooksBalance(u);
});

test("bids: charged in full, the outbid bidder is refunded once, raising your own bid pays the difference", { skip }, async () => {
  const a = newUser();
  const b = newUser();
  await startAt(a, 50);
  await startAt(b, 50);
  assert.equal((await call("POST", "/interactions/b-open/bids", a, { amount: 5 }, key())).body.code, "bid_too_low");
  const r1 = await call("POST", "/interactions/b-open/bids", a, { amount: 10 }, key());
  assert.equal(r1.status, 201);
  assert.equal(await balance(a), 40);
  const r2 = await call("POST", "/interactions/b-open/bids", b, { amount: 12 }, key());
  assert.equal(r2.status, 201);
  assert.equal(r2.body.previous_bid_refunded, true);
  assert.equal(await balance(a), 50, "a was refunded");
  assert.equal(await balance(b), 38);
  const r3 = await call("POST", "/interactions/b-open/bids", b, { amount: 15 }, key());
  assert.equal(r3.body.charged, 3, "raising your own bid pays only the difference");
  assert.equal(await balance(b), 35);
  assert.equal((await call("POST", "/interactions/b-open/bids", a, { amount: 15 }, key())).body.code, "bid_too_low");
  assert.equal((await call("POST", "/interactions/b-open/bids", a, { amount: 1000 }, key())).body.code, "insufficient_coins");
  // Concurrent bids: exactly one of several equal bids can win; the loser pays nothing.
  const c = newUser();
  await startAt(c, 50);
  const race = await Promise.all([call("POST", "/interactions/b-open/bids", a, { amount: 20 }, key()), call("POST", "/interactions/b-open/bids", c, { amount: 20 }, key())]);
  assert.equal(race.filter((r) => r.status === 201).length, 1, race.map((r) => r.body.code ?? r.status).join(","));
  assert.equal((await balance(a)) + (await balance(b)) + (await balance(c)), 150 - 20, "only the standing high bid is held");
  for (const u of [a, b, c]) await assertBooksBalance(u);
});

test("a user cannot read or write another user's items", { skip }, async () => {
  const a = newUser();
  const b = newUser();
  await startAt(a, 5);
  for (let i = 0; i < 3; i++) await call("POST", "/interactions/v-cheap/votes", a, { option_id: "carrots" }, key());
  const ta = await call("GET", "/me/transactions?limit=2", a);
  const page = await call("GET", "/me/transactions", a);
  assert.equal(page.body.count, 4);
  const tb = await call("GET", "/me/transactions", b);
  assert.equal(tb.body.count, 0, "b sees none of a's entries");
  // a's cursor is bound to a's partition: b cannot page through a's history with it.
  const r = await M.writes.handler({
    requestContext: { http: { method: "GET", path: "/dev/me/transactions" }, stage: "dev", authorizer: { jwt: { claims: { sub: b, token_use: "access" } } } },
    queryStringParameters: { cursor: ta.body.cursor },
  });
  assert.ok(ta.body.cursor, "a has a second page");
  assert.equal(r.statusCode, 400);
  // Entries expose no key plumbing and no other user's id.
  for (const e of page.body.items) {
    assert.deepEqual(Object.keys(e).filter((k) => /PK|SK|user_id/.test(k)), []);
  }
  // b's writes land in b's partition whatever b sends.
  assert.equal((await call("PUT", "/me", b, { display_name: "Bee", id: a })).status, 400);
  await call("PUT", "/me", b, { display_name: "Bee" });
  assert.equal((await M.ledger.getAccount(a))?.display_name, null);
  assert.equal(await balance(a), 2);
});

test("chat: length limits, a display name first, one post per 2 s, newest first, public read without ids", { skip }, async () => {
  const u = newUser();
  const w = newUser();
  const x = newUser();
  const noName = await call("POST", "/streams/s1/chat", u, { text: "hi" });
  assert.equal(noName.status, 409);
  assert.equal(noName.body.code, "display_name_required");
  for (const [who, name] of [[u, "Ursula"], [w, "Walt"], [x, "Xena"]]) await call("PUT", "/me", who, { display_name: name });
  assert.equal((await call("POST", "/streams/s1/chat", u, { text: "x".repeat(281) })).status, 400);
  assert.equal((await call("POST", "/streams/s1/chat", u, { text: "" })).status, 400);
  assert.equal((await call("POST", "/streams/nope/chat", u, { text: "hi" })).status, 404);

  const long = await call("POST", "/streams/s1/chat", u, { text: "x".repeat(280) });
  assert.equal(long.status, 201);
  assert.ok(long.body.message.id, "the poster gets the id, to mark its own line");
  const tooSoon = await call("POST", "/streams/s1/chat", u, { text: "again" });
  assert.equal(tooSoon.status, 429);
  assert.equal(tooSoon.body.code, "slow_down");
  const first = await call("POST", "/streams/s1/chat", w, { text: "first" }); // other users are not held up
  assert.equal(first.status, 201);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal((await call("POST", "/streams/s1/chat", x, { text: "second" })).status, 201);
  await new Promise((r) => setTimeout(r, 2_050));
  assert.equal((await call("POST", "/streams/s1/chat", u, { text: "after the wait" })).status, 201);

  assert.equal((await call("POST", "/streams/s1/reactions", u, { reaction: "capylove" })).body.reactions.capylove, 1);
  assert.equal((await call("POST", "/streams/s1/reactions", w, { reaction: "capylove" })).body.reactions.capylove, 2);
  assert.equal((await call("POST", "/streams/nope/reactions", u, { reaction: "capylove" })).status, 404);

  // Reading is public: no token, a short shared cache, display names only.
  const list = await publicGet("/streams/s1/chat?limit=3");
  assert.equal(list.status, 200);
  assert.equal(list.headers["cache-control"], "public, max-age=5");
  assert.deepEqual(list.body.items.map((m: { text: string }) => m.text), ["after the wait", "second", "first"]);
  assert.equal(list.body.items[2].display_name, "Walt");
  for (const m of list.body.items) assert.deepEqual(Object.keys(m).sort(), ["createdAt", "display_name", "id", "stream_id", "text"]);
  assert.equal(list.body.reactions.capylove, 2);
  const next = await publicGet(`/streams/s1/chat?limit=3&cursor=${encodeURIComponent(list.body.cursor)}`);
  assert.equal(next.body.items[0].text.length, 280);
  assert.equal(next.body.reactions, undefined, "counts ride on the first page only");
  assert.equal((await entries(u)).filter((x) => x.type === "chat").length, 0, "chat is free: no ledger entries");
});

test("streams that are not explicitly public refuse chat reads, posts and reactions with 403", { skip }, async () => {
  const u = newUser();
  await call("PUT", "/me", u, { display_name: "Priya" });
  for (const s of ["s-priv", "s-none"]) {
    const read = await publicGet(`/streams/${s}/chat`);
    assert.equal(read.status, 403, `read ${s}`);
    assert.equal(read.body.code, "private_stream");
    assert.equal(read.headers["cache-control"], "no-store", "a refusal is not cached");
    assert.equal((await call("POST", `/streams/${s}/chat`, u, { text: "hi" })).body.code, "private_stream", `post ${s}`);
    assert.equal((await call("POST", `/streams/${s}/reactions`, u, { reaction: "capywow" })).body.code, "private_stream", `react ${s}`);
  }
  const { pk, sk } = M.keys;
  const leftovers = await M.ddb.doc.send(new M.lib.GetCommand({ TableName: M.ddb.TABLE, Key: { PK: pk.stream("s-priv"), SK: sk.reactions() } }));
  assert.equal(leftovers.Item, undefined, "nothing was written");
  assert.equal((await publicGet("/streams/nope/chat")).status, 404);
});
