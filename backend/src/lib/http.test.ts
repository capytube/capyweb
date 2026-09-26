import { test } from "node:test";
import assert from "node:assert/strict";
import {
  json, ok, badRequest, notFound, requireId, requireEnum, parseLimit, guard,
  BadInput, CACHE_PUBLIC, NO_STORE, MAX_LIMIT, qs, path, pathSegments,
} from "./http.ts";

test("catalog reads are cacheable at the edge, errors are not", () => {
  assert.equal(ok({ a: 1 }).headers["cache-control"], CACHE_PUBLIC);
  assert.match(CACHE_PUBLIC, /s-maxage=\d+/, "CloudFront caching is the main cost lever");
  assert.equal(badRequest("x").headers["cache-control"], NO_STORE);
  assert.equal(notFound().headers["cache-control"], NO_STORE);
  assert.equal(json(500, {}).headers["cache-control"], NO_STORE);
});

test("requireId rejects anything that could smuggle a key delimiter", () => {
  assert.equal(requireId("abc-123_X"), "abc-123_X");
  for (const bad of ["", undefined, "a#b", "a/b", "a b", "../x", "a".repeat(129)]) {
    assert.throws(() => requireId(bad as string | undefined), BadInput, `should reject ${JSON.stringify(bad)}`);
  }
});

test("requireEnum allows absent, rejects unknown", () => {
  const types = ["vote", "bid"] as const;
  assert.equal(requireEnum("vote", types, "type"), "vote");
  assert.equal(requireEnum(undefined, types, "type"), undefined);
  // Present-but-empty (?type=) is a typo, not "no filter": widening silently would double
  // the DynamoDB reads and return data the caller did not ask for.
  assert.throws(() => requireEnum("", types, "type"), BadInput);
  assert.throws(() => requireEnum("other", types, "type"), BadInput);
  assert.throws(() => requireEnum("VOTE", types, "type"), BadInput, "must be case-sensitive");
});

test("parseLimit bounds the page size", () => {
  assert.equal(parseLimit(undefined), 50);
  assert.equal(parseLimit(""), 50);
  assert.equal(parseLimit("1"), 1);
  assert.equal(parseLimit(String(MAX_LIMIT)), MAX_LIMIT);
  // Number() accepts hex and exponent forms, which would pass the range check while
  // contradicting the error message; only decimal digits are allowed.
  for (const bad of ["0", "-1", "1.5", "abc", String(MAX_LIMIT + 1), "1e3", "0x10", "1e2", " 5", "+5"]) {
    assert.throws(() => parseLimit(bad), BadInput, `should reject ${bad}`);
  }
});

test("guard turns bad input into 400 and hides internal errors behind 500", async () => {
  const bad = guard(async () => {
    throw new BadInput("nope");
  });
  const r1 = await bad({});
  assert.equal(r1.statusCode, 400);
  assert.equal(JSON.parse(r1.body).error, "nope");

  const boom = guard(async () => {
    throw new Error("connection string with a secret in it");
  });
  const r2 = await boom({});
  assert.equal(r2.statusCode, 500);
  assert.equal(JSON.parse(r2.body).error, "internal error");
  assert.ok(!r2.body.includes("secret"), "internal detail must not reach the client");
});

test("path and query read payload format 2.0", () => {
  const e = {
    requestContext: { http: { method: "GET", path: "/capybaras/abc" } },
    queryStringParameters: { limit: "10" },
  };
  assert.equal(path(e), "/capybaras/abc");
  assert.equal(qs(e, "limit"), "10");
  assert.equal(qs(e, "missing"), undefined);
  assert.equal(qs({ queryStringParameters: null }, "x"), undefined);
});

test("pathSegments strips the API Gateway stage prefix", () => {
  // A non-$default stage prefixes every path, so /capybaras arrives as /dev/capybaras.
  // Without stripping, segment 0 is the stage and every route 404s.
  const withStage = {
    requestContext: { http: { method: "GET", path: "/dev/capybaras/magnus" }, stage: "dev" },
  };
  assert.deepEqual(pathSegments(withStage), ["capybaras", "magnus"]);

  assert.deepEqual(
    pathSegments({ requestContext: { http: { path: "/prod/nfts/n1/offers" }, stage: "prod" } }),
    ["nfts", "n1", "offers"],
  );

  // $default is never prefixed, so nothing may be stripped.
  assert.deepEqual(
    pathSegments({ requestContext: { http: { path: "/capybaras" }, stage: "$default" } }),
    ["capybaras"],
  );

  // No stage at all (Function URL, direct invoke).
  assert.deepEqual(pathSegments({ rawPath: "/capybaras/magnus" }), ["capybaras", "magnus"]);

  // A collection that happens to share the stage name must not be eaten twice.
  assert.deepEqual(
    pathSegments({ requestContext: { http: { path: "/dev/dev/x" }, stage: "dev" } }),
    ["dev", "x"],
  );
});
