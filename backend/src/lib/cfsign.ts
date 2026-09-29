// CloudFront signed cookies with a custom policy (paid cameras, docs/VIDEO_DESIGN.md section 4).
// Format: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-setting-signed-cookie-custom-policy.html
// The policy is compact JSON (no whitespace), signed with RSA and SHA-1 by the private half of a
// key in the distribution's trusted key group, and every value uses CloudFront's URL-safe base64.

import { sign } from "node:crypto";

/** CloudFront's base64: '+' -> '-', '=' -> '_', '/' -> '~'. */
export const cfBase64 = (b: Buffer): string =>
  b.toString("base64").replace(/\+/g, "-").replace(/=/g, "_").replace(/\//g, "~");

/** One statement: this resource (a trailing * is a wildcard), until this second. */
export function policyFor(resource: string, expiresEpochS: number): string {
  if (!Number.isSafeInteger(expiresEpochS) || expiresEpochS <= 0) throw new RangeError("expiry must be epoch seconds");
  return JSON.stringify({ Statement: [{ Resource: resource, Condition: { DateLessThan: { "AWS:EpochTime": expiresEpochS } } }] });
}

export interface SignedCookies {
  "CloudFront-Policy": string;
  "CloudFront-Signature": string;
  "CloudFront-Key-Pair-Id": string;
}

export function signedCookies(resource: string, expiresEpochS: number, keyPairId: string, privateKeyPem: string): SignedCookies {
  const policy = policyFor(resource, expiresEpochS);
  return {
    "CloudFront-Policy": cfBase64(Buffer.from(policy, "utf8")),
    "CloudFront-Signature": cfBase64(sign("RSA-SHA1", Buffer.from(policy, "utf8"), privateKeyPem)),
    "CloudFront-Key-Pair-Id": keyPairId,
  };
}

/**
 * Set-Cookie values. Path scopes them to one camera's files, so the browser sends them nowhere
 * else (not to the API, not to another camera). No Domain attribute: host-only, the site itself.
 * HttpOnly keeps them from scripts; SameSite=Strict keeps them off cross-site requests.
 */
export function setCookieHeaders(cookies: SignedCookies, path: string, maxAgeS: number): string[] {
  const attrs = `Path=${path}; Max-Age=${Math.max(0, Math.floor(maxAgeS))}; Secure; HttpOnly; SameSite=Strict`;
  return Object.entries(cookies).map(([name, value]) => `${name}=${value}; ${attrs}`);
}
