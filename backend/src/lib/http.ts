// Response shaping and input validation for API Gateway HTTP API (payload format 2.0).

import { BadCursor } from "./ddb.ts";

export interface Event {
  rawPath?: string;
  requestContext?: {
    http?: { method?: string; path?: string };
    stage?: string;
    /** Filled by the HTTP API's JWT authorizer after it has verified the token's signature. */
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
  pathParameters?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  /** HTTP API v2 lower-cases header names. */
  headers?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface Response {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Catalog data changes rarely and is read constantly, so let CloudFront absorb the repeats:
 * s-maxage keeps it at the edge for 5 minutes, which is the main thing keeping Lambda and
 * DynamoDB request counts (and the bill) down. See docs/PLAN.md section 3.
 */
export const CACHE_PUBLIC = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
export const NO_STORE = "no-store";

export function json(statusCode: number, body: unknown, cacheControl = NO_STORE): Response {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": cacheControl },
    body: JSON.stringify(body),
  };
}

export const ok = (body: unknown) => json(200, body, CACHE_PUBLIC);
/**
 * Authenticated responses. Never `ok()`: that one is s-maxage cached, and a CloudFront or
 * browser cache holding one user's balance for the next caller is the classic leak.
 */
export const okPrivate = (body: unknown) => json(200, body, NO_STORE);
export const created = (body: unknown) => json(201, body, NO_STORE);
export const badRequest = (message: string) => json(400, { error: message });
export const notFound = (what = "not found") => json(404, { error: what });

/** Ids are opaque to us but must not smuggle key delimiters into a partition key. */
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function requireId(value: string | undefined, field = "id"): string {
  if (!value || !ID_RE.test(value)) throw new BadInput(`invalid ${field}`);
  return value;
}

/** Reject anything not in the allow-list rather than passing it through to a key. */
export function requireEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  field: string,
): T | undefined {
  // Absent means "no filter". Present-but-empty (?access=) is a mistake, not a filter:
  // silently widening would double the DynamoDB reads and return data the caller did not ask for.
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new BadInput(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

export const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export function parseLimit(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_LIMIT;
  // Decimal digits only: Number() would otherwise accept 0x10 and 1e2, which pass the
  // range check while contradicting the error message the caller is shown.
  if (!/^\d+$/.test(raw)) throw new BadInput(`limit must be an integer between 1 and ${MAX_LIMIT}`);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    throw new BadInput(`limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  return n;
}

export class BadInput extends Error {}

/**
 * Any other client-facing error. `code` is a stable machine-readable word the client can switch
 * on (for example `insufficient_coins`); `message` is for people. Both are safe to show.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Throwable form of a 400, for call sites that are not themselves validators. */
export const badRequestError = (message: string): BadInput => new BadInput(message);

export const method = (e: Event): string => e.requestContext?.http?.method ?? "GET";
export const path = (e: Event): string => e.requestContext?.http?.path ?? e.rawPath ?? "";

/**
 * Path segments with the API Gateway stage stripped.
 *
 * A non-$default stage prefixes every path: a request to /capybaras arrives as
 * "/dev/capybaras". Dispatching on the raw path makes every route 404, so the leading
 * segment is dropped when it matches requestContext.stage. "$default" is never prefixed.
 */
export function pathSegments(e: Event): string[] {
  const seg = path(e).split("/").filter(Boolean);
  const stage = e.requestContext?.stage;
  if (stage && stage !== "$default" && seg[0] === stage) seg.shift();
  return seg;
}
export const qs = (e: Event, key: string): string | undefined => e.queryStringParameters?.[key] ?? undefined;
export const header = (e: Event, name: string): string | undefined => e.headers?.[name.toLowerCase()] ?? undefined;

/**
 * The caller, from the verified JWT only. Never from the body, a header or a path parameter:
 * the API Gateway JWT authorizer has already checked signature, issuer, audience and expiry
 * before the Lambda runs, and `sub` is the one claim a client cannot choose.
 * No claims at all means the route was deployed without the authorizer - fail closed.
 * Only access tokens are accepted (`token_use: access`); an ID token is 401.
 */
export function callerId(e: Event): string {
  const claims = e.requestContext?.authorizer?.jwt?.claims;
  // Access tokens only. Cognito ID tokens also pass the authorizer (their aud is the client id), but
  // they are identity statements for the client, not grants to call the API.
  if (claims?.token_use !== "access") throw new HttpError(401, "sign in required", "unauthorized");
  const sub = claims.sub;
  if (typeof sub !== "string" || !ID_RE.test(sub)) throw new HttpError(401, "sign in required", "unauthorized");
  return sub;
}

/** Bodies are tiny (a name, a chat line, a vote). Anything bigger is a mistake or an attack. */
export const MAX_BODY_BYTES = 4096;

/** Parse a JSON object body. Absent body = {}. Arrays, scalars and oversize bodies are 400. */
export function jsonBody(e: Event): Record<string, unknown> {
  if (e.body === undefined || e.body === null || e.body === "") return {};
  const raw = e.isBase64Encoded ? Buffer.from(e.body, "base64").toString("utf8") : e.body;
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw new BadInput(`body larger than ${MAX_BODY_BYTES} bytes`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadInput("body must be JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BadInput("body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

/** Reject fields the route does not accept, so "nothing else is writable" is explicit, not implied. */
export function onlyFields(body: Record<string, unknown>, allowed: readonly string[]): void {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) throw new BadInput(`unknown field(s): ${extra.join(", ")}`);
}

/**
 * Wrap a handler so bad input becomes 400 and anything unexpected becomes 500 without
 * leaking an internal message or stack to the caller.
 */
export function guard(fn: (e: Event) => Promise<Response>) {
  return async (e: Event): Promise<Response> => {
    try {
      return await fn(e);
    } catch (err) {
      if (err instanceof BadInput || err instanceof BadCursor) return badRequest(err.message);
      if (err instanceof HttpError) {
        return json(err.status, err.code ? { error: err.message, code: err.code } : { error: err.message });
      }
      console.error("unhandled", { path: path(e), err: err instanceof Error ? err.message : String(err) });
      return json(500, { error: "internal error" });
    }
  };
}
