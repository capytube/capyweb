import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, cleanAll, encodeCursor, decodeCursor, BadCursor, type CursorCtx } from "./ddb.ts";

test("clean strips every key attribute so the table design never reaches a client", () => {
  const raw = {
    PK: "CAPY#c1",
    SK: "#META",
    GSI1PK: "CAPY",
    GSI1SK: "NAME#Magnus",
    GSI2PK: "x",
    GSI2SK: "y",
    expiresAt: 1790000000,
    id: "c1",
    name: "Magnus",
    bio: "A very tame capybara",
  };
  const out = clean(raw)!;
  assert.deepEqual(out, { id: "c1", name: "Magnus", bio: "A very tame capybara" });
  for (const k of ["PK", "SK", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK", "expiresAt"]) {
    assert.ok(!(k in out), `${k} must not be exposed`);
  }
});

test("clean handles absent items and preserves falsy domain values", () => {
  assert.equal(clean(undefined), undefined);
  const out = clean({ PK: "a", SK: "b", price: 0, is_for_sale: false, note: "" })!;
  assert.deepEqual(out, { price: 0, is_for_sale: false, note: "" });
});

test("cleanAll maps a page and tolerates an empty result", () => {
  assert.deepEqual(cleanAll([]), []);
  assert.deepEqual(cleanAll(undefined), []);
  assert.deepEqual(cleanAll([{ PK: "a", SK: "b", id: "1" }]), [{ id: "1" }]);
});

const CTX: CursorCtx = { index: "GSI1", pk: "CAPY", ascending: true };
const KEY = { GSI1PK: "CAPY", GSI1SK: "NAME#Einstein", PK: "CAPY#einstein", SK: "#META" };

test("a cursor round-trips for the query that produced it", () => {
  const c = encodeCursor(KEY, CTX)!;
  assert.deepEqual(decodeCursor(c, CTX), KEY);
  assert.ok(!/[+/=]/.test(c), "must be base64url so it survives a query string unescaped");
});

test("a cursor does not describe the table's key layout", () => {
  const decoded = Buffer.from(encodeCursor(KEY, CTX)!, "base64url").toString("utf8");
  for (const attr of ["PK", "SK", "GSI1PK", "GSI1SK"]) {
    assert.ok(!decoded.includes(`"${attr}"`), `${attr} attribute name must not appear in the cursor`);
  }
});

test("a cursor from one query is rejected by another", () => {
  const c = encodeCursor(KEY, CTX)!;
  // Same index, different partition: replaying this used to be a 500 from DynamoDB.
  assert.throws(() => decodeCursor(c, { ...CTX, pk: "NFT#SALE#1" }), BadCursor);
  // Same partition, opposite direction: replaying this used to page from the wrong end.
  assert.throws(() => decodeCursor(c, { ...CTX, ascending: false }), BadCursor);
  // Different index entirely.
  assert.throws(() => decodeCursor(c, { ...CTX, index: "GSI2" }), BadCursor);
  // Base table rather than an index.
  assert.throws(() => decodeCursor(c, { index: undefined, pk: "CAPY#magnus", ascending: true }), BadCursor);
  // Same partition, different sort-key prefix.
  assert.throws(() => decodeCursor(c, { ...CTX, skPrefix: "IXN#" }), BadCursor);
});

test("a malformed cursor is rejected rather than silently restarting at page 1", () => {
  const b64 = (v: string) => Buffer.from(v).toString("base64url");
  assert.equal(encodeCursor(undefined, CTX), undefined);
  assert.equal(decodeCursor(undefined, CTX), undefined);
  for (const bad of [
    "not-base64-$$$",
    b64("[1,2,3]"),
    b64('"str"'),
    b64("null"),
    b64("{}"),
    b64('["wronghash",["a","b","c","d"]]'),
  ]) {
    assert.throws(() => decodeCursor(bad, CTX), BadCursor, `should reject ${bad}`);
  }
});

test("a cursor with the right hash but a tampered value list is rejected", () => {
  const good = encodeCursor(KEY, CTX)!;
  const [hash] = JSON.parse(Buffer.from(good, "base64url").toString("utf8"));
  const forge = (values: unknown) =>
    Buffer.from(JSON.stringify([hash, values])).toString("base64url");
  assert.throws(() => decodeCursor(forge(["a", "b"]), CTX), BadCursor, "wrong arity");
  assert.throws(() => decodeCursor(forge(["a", "b", "c", 4]), CTX), BadCursor, "non-string value");
  assert.throws(() => decodeCursor(forge(["a", "b", "c", ""]), CTX), BadCursor, "empty value");
  assert.throws(() => decodeCursor(forge("nope"), CTX), BadCursor, "not an array");
});

test("base-table cursors carry only PK and SK", () => {
  const ctx: CursorCtx = { pk: "NFT#capy-1234", skPrefix: "OFFER#", ascending: false };
  const key = { PK: "NFT#capy-1234", SK: "OFFER#00000000000000000007#offer-2" };
  assert.deepEqual(decodeCursor(encodeCursor(key, ctx)!, ctx), key);
});

test("playback locators never reach an unauthenticated client", () => {
  // On a private, paid stream these ARE the paywall: whoever holds the Livepeer playback id
  // or the S3 video URL can watch without paying. Playback is obtained via GET /stream/{id},
  // which resolves it server-side and can be gated.
  const privateStream = {
    PK: "STREAM#wall-cam",
    SK: "#META",
    id: "wall-cam",
    title: "Climbing wall cam",
    access_type: "private",
    price_per_10_sec: 1,
    streaming_address: "livepeer-playback-id-abc123",
    s3_video_address: "https://capyapp-media.s3.ap-southeast-1.amazonaws.com/private/wall.mp4",
  };
  const out = clean(privateStream)!;
  assert.ok(!("streaming_address" in out), "Livepeer playback id must not be exposed");
  assert.ok(!("s3_video_address" in out), "S3 video URL must not be exposed");
  assert.deepEqual(out, {
    id: "wall-cam",
    title: "Climbing wall cam",
    access_type: "private",
    price_per_10_sec: 1,
  });
});

test("public streams are stripped too - the catalog never serves playback", () => {
  const out = clean({ id: "main-cam", access_type: "public", streaming_address: "pb-xyz" })!;
  assert.ok(!("streaming_address" in out));
});

test("credential-shaped field names are stripped whatever entity carries them", () => {
  const out = clean({
    id: "x",
    api_key: "sk-live-1",
    apiKey: "sk-live-2",
    livepeer_token: "t",
    user_password: "p",
    aws_secret_access_key: "s",
    private_key: "pk",
    signature: "sig",
    webhook_secret: "ws",
    name: "kept",
    token_count: 5,
  })!;
  assert.deepEqual(out, { id: "x", name: "kept", token_count: 5 },
    "only genuine domain fields survive; token_count is a count, not a token");
});
