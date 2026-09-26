import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTargets, probe } from "./healthcheck.ts";

test("parseTargets reads name=url and the optional body expectation", () => {
  assert.deepEqual(parseTargets("api=https://a/health"), [{ name: "api", url: "https://a/health" }]);
  assert.deepEqual(parseTargets("api=https://a/health|\"ok\":true"), [
    { name: "api", url: "https://a/health", expect: '"ok":true' },
  ]);
  assert.deepEqual(parseTargets(" api=https://a , site=https://b "), [
    { name: "api", url: "https://a" },
    { name: "site", url: "https://b" },
  ]);
});

test("parseTargets treats absent or empty config as no targets, and rejects junk", () => {
  assert.deepEqual(parseTargets(undefined), []);
  assert.deepEqual(parseTargets(""), []);
  assert.deepEqual(parseTargets(",,"), []);
  assert.throws(() => parseTargets("no-equals-sign"), /bad TARGETS entry/);
  assert.throws(() => parseTargets("=https://a"), /bad TARGETS entry/);
});

test("a URL that cannot be reached is unhealthy, not an exception", async () => {
  // .invalid is reserved by RFC 2606 and never resolves.
  const p = await probe({ name: "gone", url: "https://nothing.invalid/" }, 3000);
  assert.equal(p.healthy, false);
  assert.equal(p.status, 0);
  assert.ok(p.error, "must record why");
  assert.ok(p.ms >= 0);
});

test("a slow endpoint is cut off by the timeout rather than hanging the run", async () => {
  const p = await probe({ name: "slow", url: "https://10.255.255.1/" }, 300);
  assert.equal(p.healthy, false);
  assert.ok(p.ms < 5000, "must give up near the timeout, not wait for the socket");
});
