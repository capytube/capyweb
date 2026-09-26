// Response shaping and input validation for API Gateway HTTP API (payload format 2.0).

import { BadCursor } from "./ddb.ts";

export interface Event {
  rawPath?: string;
  requestContext?: { http?: { method?: string; path?: string }; stage?: string };
  pathParameters?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
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
      console.error("unhandled", { path: path(e), err: err instanceof Error ? err.message : String(err) });
      return json(500, { error: "internal error" });
    }
  };
}
