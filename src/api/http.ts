// Typed HTTP client for the capyweb API (capyweb-umh), replacing generateClient<Schema>().
//
// Deliberately free of Vite and Amplify imports: configuration is injected by the app at
// startup rather than read from import.meta.env here, so this module runs under plain Node
// and is directly testable.
//
// AUTH IS A SEAM, NOT A FEATURE YET. `getToken` is inert until Cognito lands (capyweb-w26):
// nothing calls an authenticated route today, because every write route is still unbuilt.
// When the user pool exists, the app supplies a real token provider and nothing else changes.

export interface ApiConfig {
  /** Base URL of the HTTP API stage, without a trailing slash. */
  baseUrl: string;
  /** Returns a bearer token, or undefined when the caller is anonymous. */
  getToken?: () => string | undefined | Promise<string | undefined>;
  /** Injectable for tests. Defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
}

let config: ApiConfig | undefined;

export function configureApi(next: ApiConfig): void {
  if (!next.baseUrl) throw new Error("configureApi: baseUrl is required");
  config = { ...next, baseUrl: next.baseUrl.replace(/\/+$/, "") };
}

/** Test seam: forget the configuration so a test can assert the unconfigured error. */
export function resetApiConfig(): void {
  config = undefined;
}

function requireConfig(): ApiConfig {
  if (!config) {
    throw new Error("API not configured - call configureApi({ baseUrl }) before any request");
  }
  return config;
}

/** A non-2xx response. `body` carries the API's `{ error }` message when it sent one. */
export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(status: number, url: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
  /** 404 is routine (a capybara that does not exist), not a failure worth reporting loudly. */
  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/** A list endpoint's envelope. `cursor` is opaque and belongs only to the query that returned it. */
export interface Page<T> {
  items: T[];
  count: number;
  cursor?: string;
  /** Set when an unfiltered list merged two partitions and could not page. */
  truncated?: boolean;
  hint?: string;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Send the bearer token. Defaults to false: catalog reads are anonymous. */
  authenticated?: boolean;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const url = new URL(baseUrl + (path.startsWith("/") ? path : `/${path}`));
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const cfg = requireConfig();
  const url = buildUrl(cfg.baseUrl, path, opts.query);
  const headers: Record<string, string> = { accept: "application/json" };

  if (opts.authenticated) {
    const token = await cfg.getToken?.();
    if (!token) {
      throw new ApiError(401, url, "sign-in required");
    }
    headers.authorization = `Bearer ${token}`;
  }

  const doFetch = cfg.fetch ?? globalThis.fetch;
  const res = await doFetch(url, { method: "GET", headers, signal: opts.signal });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // A non-JSON body from a 200 usually means something other than our API answered -
    // a proxy, or the SPA's index.html served for a missing path.
    if (res.ok) throw new ApiError(res.status, url, "expected JSON, got something else");
    body = undefined;
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : undefined) ?? `request failed with ${res.status}`;
    throw new ApiError(res.status, url, message);
  }

  return body as T;
}

/** GET a list endpoint. Returns the envelope so callers can page. */
export const getPage = <T>(path: string, opts: RequestOptions = {}) => request<Page<T>>(path, opts);

/** GET a list endpoint and keep only the items, for callers that never page. */
export async function getAll<T>(path: string, opts: RequestOptions = {}): Promise<T[]> {
  const page = await getPage<T>(path, opts);
  return page.items ?? [];
}

/**
 * GET a single item, returning undefined for 404 rather than throwing. A missing capybara is
 * an ordinary outcome; every other error still throws.
 */
export async function getOne<T>(path: string, opts: RequestOptions = {}): Promise<T | undefined> {
  try {
    return await request<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.isNotFound) return undefined;
    throw err;
  }
}

/**
 * Walk every page of a list endpoint. Guarded by `maxPages` so a server that kept returning a
 * cursor could never spin forever.
 */
export async function getEvery<T>(
  path: string,
  opts: RequestOptions = {},
  maxPages = 20,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await getPage<T>(path, { ...opts, query: { ...opts.query, cursor } });
    out.push(...(res.items ?? []));
    cursor = res.cursor;
    if (!cursor) break;
  }
  return out;
}
