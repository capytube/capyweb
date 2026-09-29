import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTransaction, classify, derivedId, fingerprint, IDEMPOTENCY_TTL_HOURS, type LedgerRequest } from "./ledger.ts";
import { STARTING_BALANCE, CHAT_COST, REACTION_COST } from "./economy.ts";

const NOW = "2026-09-29T08:00:00.000Z";

const req = (over: Partial<LedgerRequest> = {}): LedgerRequest => ({
  userId: "u1",
  idemKey: "key-00000001",
  fingerprint: "fp",
  postings: [{ userId: "u1", amount: -3, type: "vote", related_type: "vote", related_id: "v1", role: "debit" }],
  records: [{ Put: { TableName: "t", Item: { PK: "IXN#i1", SK: "VOTE#u1#v1" }, ConditionExpression: "attribute_not_exists(PK)" } }],
  result: { ok: true },
  ...over,
});

test("money defaults: no free coins and no charges until someone decides otherwise", () => {
  assert.equal(STARTING_BALANCE, 0);
  assert.equal(CHAT_COST, 0);
  assert.equal(REACTION_COST, 0);
});

test("the idempotency marker is first, in the caller's partition, conditional and expiring", () => {
  const { items, roles } = buildTransaction(req(), NOW);
  assert.equal(roles[0].kind, "marker");
  const m = items[0].Put!;
  assert.equal(m.Item!.PK, "USER#u1");
  assert.equal(m.Item!.SK, "IDEM#key-00000001");
  assert.equal(m.ConditionExpression, "attribute_not_exists(PK)");
  assert.equal(m.Item!.expiresAt, Date.parse(NOW) / 1000 + IDEMPOTENCY_TTL_HOURS * 3600);
  assert.deepEqual(m.Item!.result, { ok: true }, "the result is stored for replays");
});

test("a debit can never take a balance below zero, and needs a real user item", () => {
  const { items } = buildTransaction(req(), NOW);
  const u = items[1].Update!;
  assert.deepEqual(u.Key, { PK: "USER#u1", SK: "#META" });
  assert.match(u.UpdateExpression!, /balance = balance - :amt/);
  assert.equal(u.ConditionExpression, "attribute_exists(PK) AND balance >= :amt");
  assert.equal(u.ExpressionAttributeValues![":amt"], 3, "the condition compares the positive amount");
});

test("every balance change has one immutable ledger entry for the same signed amount", () => {
  const r = req({
    postings: [
      { userId: "u1", amount: -7, type: "bid", role: "debit" },
      { userId: "u2", amount: 5, type: "bid_refund", role: "refund" },
    ],
  });
  const { items, roles } = buildTransaction(r, NOW);
  const balances = roles.map((x, i) => [x, items[i]] as const).filter(([x]) => x.kind === "balance");
  const entries = roles.map((x, i) => [x, items[i]] as const).filter(([x]) => x.kind === "entry");
  assert.equal(balances.length, 2);
  assert.equal(entries.length, 2);
  for (const [, it] of entries) {
    const put = it.Put!;
    assert.equal(put.ConditionExpression, "attribute_not_exists(PK)", "entries are insert-only");
    assert.match(String(put.Item!.SK), /^TXN#2026-09-29T08:00:00\.000Z#/);
    assert.equal(put.Item!.GSI1PK, "TXN");
    assert.match(String(put.Item!.GSI2PK), /^TXN#/);
  }
  assert.equal(entries[0][1].Put!.Item!.amount, -7);
  assert.equal(entries[0][1].Put!.Item!.PK, "USER#u1");
  assert.equal(entries[1][1].Put!.Item!.amount, 5);
  assert.equal(entries[1][1].Put!.Item!.PK, "USER#u2", "a refund lands in the refunded user's own partition");
  assert.equal(balances[1][1].Update!.ConditionExpression, "attribute_exists(PK)", "credits need no floor");
  // No item is touched twice (DynamoDB would reject the whole transaction).
  const keys = items.map((i) => {
    const k = i.Put ? { PK: i.Put.Item!.PK, SK: i.Put.Item!.SK } : (i.Update ?? i.ConditionCheck)!.Key;
    return JSON.stringify(k);
  });
  assert.equal(new Set(keys).size, keys.length);
});

test("entry ids are deterministic per user, key and role", () => {
  const a = buildTransaction(req(), NOW).entryIds.debit;
  const b = buildTransaction(req(), "2026-09-29T09:00:00.000Z").entryIds.debit;
  assert.equal(a, b, "a retry derives the same id");
  assert.equal(a, derivedId("u1", "key-00000001", "debit"));
  assert.notEqual(a, buildTransaction(req({ idemKey: "key-00000002" }), NOW).entryIds.debit);
  assert.notEqual(derivedId("u1", "k"), derivedId("u2", "k"), "keys are scoped per user");
  assert.match(a, /^[A-Za-z0-9_-]{22}$/, "safe inside a sort key");
});

test("fingerprints separate different requests under one key", () => {
  assert.equal(fingerprint("vote", "i1", "carrots", 1), fingerprint("vote", "i1", "carrots", 1));
  assert.notEqual(fingerprint("vote", "i1", "carrots", 1), fingerprint("vote", "i1", "carrots", 2));
  assert.notEqual(fingerprint("bid", "i1", 5), fingerprint("bid", "i2", 5));
});

test("malformed postings are refused before anything is sent", () => {
  assert.throws(() => buildTransaction(req({ postings: [{ userId: "u1", amount: 0, type: "vote", role: "d" }] }), NOW));
  assert.throws(() => buildTransaction(req({ postings: [{ userId: "u1", amount: 1.5, type: "vote", role: "d" }] }), NOW));
  assert.throws(
    () => buildTransaction(req({ postings: [
      { userId: "u1", amount: -1, type: "vote", role: "a" },
      { userId: "u1", amount: 1, type: "grant", role: "b" },
    ] }), NOW),
    /one posting per user/,
  );
});

test("a free action writes the marker and records only - no balance change, no entry", () => {
  const { items, roles } = buildTransaction(req({ postings: [] }), NOW);
  assert.deepEqual(roles.map((r) => r.kind), ["marker", "record"]);
  assert.equal(items.length, 2);
});

test("cancellation reasons map to the right outcome, a used key first", () => {
  const { roles } = buildTransaction(req(), NOW); // marker, balance, entry, record
  const c = (codes: string[]) => classify(roles, codes.map((Code) => ({ Code })));
  assert.deepEqual(c(["ConditionalCheckFailed", "ConditionalCheckFailed", "None", "None"]), { kind: "replay" });
  assert.deepEqual(c(["None", "ConditionalCheckFailed", "None", "None"]), { kind: "insufficient" });
  assert.deepEqual(c(["None", "None", "None", "ConditionalCheckFailed"]), { kind: "record", index: 0 });
  assert.deepEqual(c(["None", "TransactionConflict", "None", "None"]), { kind: "retry" });
  assert.deepEqual(c(["None", "None", "ConditionalCheckFailed", "None"]), { kind: "unknown" });
  assert.deepEqual(classify(roles, []), { kind: "unknown" });
});
