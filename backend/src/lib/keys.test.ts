import { test } from "node:test";
import assert from "node:assert/strict";
import { amt, ts, ttl, pk, sk, prefix, gsi1, gsi2, META } from "./keys.ts";

test("padded amounts sort numerically", () => {
  const sorted = [5, 100, 9, 1000, 25].map(amt).sort();
  assert.deepEqual(sorted.map(Number), [5, 9, 25, 100, 1000]);
});

test("highest bid is the last key, so a reverse query returns it first", () => {
  const keys = [50, 5000, 300].map((n) => sk.bid(n, "x")).sort();
  assert.equal(keys.at(-1), sk.bid(5000, "x"));
});

test("amt rejects values that would break ordering", () => {
  assert.throws(() => amt(-1), RangeError);
  assert.throws(() => amt(1.5), RangeError);
  assert.throws(() => amt(Number.NaN), RangeError);
  assert.throws(() => amt(1e21), RangeError);
});

test("timestamps sort chronologically as strings", () => {
  const a = ts("2026-09-26T04:00:00.000Z");
  const b = ts("2026-09-26T04:00:00.001Z");
  const c = ts("2026-10-01T00:00:00.000Z");
  assert.ok(a < b && b < c);
  assert.throws(() => ts("not a date"), RangeError);
});

test("#META sorts before every entity prefix in the same partition", () => {
  const siblings = [
    META,
    sk.chat("2026-09-26T04:00:00.000Z", "c1"),
    sk.txn("2026-09-26T04:00:00.000Z", "t1"),
    sk.vote("u1", "v1"),
    sk.bid(10, "b1"),
    sk.offer(10, "o1"),
    sk.activityLog("2026-09-26T04:00:00.000Z", "l1"),
    sk.interaction("vote", "2026-09-26", "i1"),
  ].sort();
  assert.equal(siblings[0], META, "parent item must sort first");
});

test("begins_with prefixes actually match the keys they select", () => {
  assert.ok(sk.interaction("vote", "2026-09-26", "i1").startsWith(prefix.interaction("vote")));
  assert.ok(!sk.interaction("bid", "2026-09-26", "i1").startsWith(prefix.interaction("vote")));
  assert.ok(sk.chat("2026-09-26T04:00:00.000Z", "c1").startsWith(prefix.chat()));
  assert.ok(sk.bid(1, "b1").startsWith(prefix.bid()));
  assert.ok(sk.txn("2026-09-26T04:00:00.000Z", "t1").startsWith(prefix.txn()));
});

test("ledger entries share the user partition so a transaction is single-partition", () => {
  const userId = "u1";
  assert.equal(pk.user(userId), "USER#u1");
  // The balance item and the ledger entry must have the SAME PK for TransactWriteItems
  // to update both atomically within one partition.
  const balanceItem = { PK: pk.user(userId), SK: META };
  const ledgerItem = { PK: pk.user(userId), SK: sk.txn(ts("2026-09-26T04:00:00.000Z"), "t1") };
  assert.equal(balanceItem.PK, ledgerItem.PK);
  assert.notEqual(balanceItem.SK, ledgerItem.SK);
});

test("interactions nest under their capybara so no index is needed", () => {
  assert.equal(pk.capy("c1"), "CAPY#c1");
  assert.ok(sk.interaction("vote", "2026-09-26", "i1").startsWith("IXN#vote#"));
});

test("wallet and email lookups are case- and whitespace-insensitive", () => {
  assert.equal(gsi1.byWallet("  AbC123 ").GSI1PK, "WALLET#abc123");
  assert.equal(gsi2.byEmail(" Nic@Example.COM ").GSI2PK, "EMAIL#nic@example.com");
});

test("moderation queue key is stable and namespaced", () => {
  const q = gsi2.pendingCustomVote("2026-09-26T04:00:00.000Z", "v1");
  assert.equal(q.GSI2PK, "MODQ#vote");
  assert.equal(q.GSI2SK, "2026-09-26T04:00:00.000Z#v1");
});

test("GSI2 namespaces do not collide across entities", () => {
  const partitions = [
    gsi2.byEmail("a@b.c").GSI2PK,
    gsi2.txnById("t1").GSI2PK,
    gsi2.nftByOwner("u1", "n1").GSI2PK,
    gsi2.resaleByStatus("listed", "2026-09-26T04:00:00.000Z", "r1").GSI2PK,
    gsi2.pendingCustomVote("2026-09-26T04:00:00.000Z", "v1").GSI2PK,
  ];
  assert.equal(new Set(partitions).size, partitions.length);
});

test("for-sale index separates listed from unlisted", () => {
  assert.notEqual(gsi1.nftBySale(1, 10, "n1").GSI1PK, gsi1.nftBySale(0, 10, "n1").GSI1PK);
});

test("audit log partitions by day", () => {
  assert.equal(pk.auditDay("2026-09-26T23:59:59.999Z"), "AUDIT#2026-09-26");
  assert.notEqual(pk.auditDay("2026-09-26T00:00:00Z"), pk.auditDay("2026-09-27T00:00:00Z"));
});

test("ttl is epoch seconds, not milliseconds", () => {
  const d = new Date("2026-09-26T04:00:00.000Z");
  assert.equal(ttl(d), Math.floor(d.getTime() / 1000));
  assert.ok(ttl(d) < 1e11, "must be seconds, DynamoDB ignores millisecond TTLs");
});
