import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { cfBase64, policyFor, signedCookies, setCookieHeaders } from "./cfsign.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const fromCf = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");

test("CloudFront base64 swaps the three characters that are unsafe in a cookie", () => {
  const b = Buffer.from([0xfb, 0xff, 0xbf, 0x00]); // standard base64: "+/+/AA=="
  assert.equal(b.toString("base64"), "+/+/AA==");
  assert.equal(cfBase64(b), "-~-~AA__");
});

test("the policy is compact JSON naming one resource and an epoch-second expiry", () => {
  const p = policyFor("https://dev.capytube.xyz/paid/wall-cam/*", 1790000090);
  assert.equal(p, '{"Statement":[{"Resource":"https://dev.capytube.xyz/paid/wall-cam/*","Condition":{"DateLessThan":{"AWS:EpochTime":1790000090}}}]}');
  assert.ok(!/\s/.test(p), "CloudFront rejects a policy with whitespace");
  assert.throws(() => policyFor("x", 1.5), RangeError);
  assert.throws(() => policyFor("x", 1790000090000 * 1e6), RangeError);
});

test("the signature is RSA-SHA1 over the policy, verifiable with the public half", () => {
  const c = signedCookies("https://dev.capytube.xyz/paid/wall-cam/*", 1790000090, "KD0MHU27L6GFD", PEM);
  assert.equal(c["CloudFront-Key-Pair-Id"], "KD0MHU27L6GFD");
  const policy = fromCf(c["CloudFront-Policy"]);
  assert.equal(JSON.parse(policy.toString()).Statement[0].Resource, "https://dev.capytube.xyz/paid/wall-cam/*");
  assert.ok(verify("RSA-SHA1", policy, publicKey, fromCf(c["CloudFront-Signature"])));
  const other = Buffer.from(policy.toString().replace("wall-cam", "main-cam"));
  assert.ok(!verify("RSA-SHA1", other, publicKey, fromCf(c["CloudFront-Signature"])), "a changed policy must not verify");
  for (const v of Object.values(c)) assert.match(v, /^[A-Za-z0-9_~-]+$/, "cookie-safe characters only");
});

test("Set-Cookie is scoped to one camera's path, host-only, Secure, HttpOnly and Strict", () => {
  const c = signedCookies("https://dev.capytube.xyz/paid/wall-cam/*", 1790000090, "K1", PEM);
  const h = setCookieHeaders(c, "/paid/wall-cam/", 89.7);
  assert.equal(h.length, 3);
  for (const line of h) {
    assert.match(line, /^CloudFront-(Policy|Signature|Key-Pair-Id)=[^;]+; Path=\/paid\/wall-cam\/; Max-Age=89; Secure; HttpOnly; SameSite=Strict$/);
    assert.ok(!/Domain=/i.test(line));
  }
  assert.match(setCookieHeaders(c, "/p/", -5)[0], /Max-Age=0;/);
});
