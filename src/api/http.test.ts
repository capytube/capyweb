import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  configureApi, resetApiConfig, request, getPage, getAll, getOne, getEvery, ApiError,
} from "./http.ts";

/** Records what the client asked for, and replies with whatever the test queued. */
function stub(replies: Array<{ status?: number; body?: unknown; text?: string }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  let i = 0;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    const r = replies[Math.min(i++, replies.length - 1)];
    const status = r.status ?? 200;
    const text = r.text ?? (r.body === undefined ? "" : JSON.stringify(r.body));
    return { ok: status >= 200 && status < 300, status, text: async () => text } as Response;
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetchImpl };
}

beforeEach(() => resetApiConfig());

test("refuses to send anything before it is configured", async () => {
  await assert.rejects(() => request("/capybaras"), /API not configured/);
  assert.throws(() => configureApi({ baseUrl: "" }), /baseUrl is required/);
});

test("joins base and path without doubling or dropping a slash", async () => {
  const { calls, fetchImpl } = stub([{ body: { items: [], count: 0 } }]);
  configureApi({ baseUrl: "https://api.example.com/dev/", fetch: fetchImpl });
  await getPage("/capybaras");
  await getPage("capybaras");
  assert.equal(calls[0].url, "https://api.example.com/dev/capybaras");
  assert.equal(calls[1].url, "https://api.example.com/dev/capybaras");
});

test("query params are encoded, and empty or undefined ones are dropped", async () => {
  const { calls, fetchImpl } = stub([{ body: { items: [], count: 0 } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl });
  await getPage("/capybaras", {
    query: { limit: 10, type: "vote", cursor: undefined, access: "", live: true },
  });
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("limit"), "10");
  assert.equal(url.searchParams.get("type"), "vote");
  assert.equal(url.searchParams.get("live"), "true");
  // The API 400s on a present-but-empty enum, so the client must not send one.
  assert.ok(!url.searchParams.has("cursor"));
  assert.ok(!url.searchParams.has("access"));
});

test("catalog reads are anonymous - no authorization header", async () => {
  const { calls, fetchImpl } = stub([{ body: { items: [], count: 0 } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl, getToken: () => "tok" });
  await getPage("/capybaras");
  assert.ok(!("authorization" in calls[0].headers), "must not send a token unasked");
});

test("an authenticated request sends the token, and fails closed without one", async () => {
  const { calls, fetchImpl } = stub([{ body: { ok: true } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl, getToken: async () => "tok-123" });
  await request("/me", { authenticated: true });
  assert.equal(calls[0].headers.authorization, "Bearer tok-123");

  // No provider, or a provider with no session: refuse locally rather than send an
  // unauthenticated request to a route that will reject it.
  resetApiConfig();
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl });
  await assert.rejects(() => request("/me", { authenticated: true }), (e: ApiError) => e.status === 401);

  resetApiConfig();
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl, getToken: () => undefined });
  await assert.rejects(() => request("/me", { authenticated: true }), (e: ApiError) => e.status === 401);
});

test("the API's error message is surfaced, not a generic one", async () => {
  const { fetchImpl } = stub([{ status: 400, body: { error: "limit must be an integer between 1 and 100" } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl });
  await assert.rejects(
    () => getPage("/capybaras", { query: { limit: 0 } }),
    (e: ApiError) => e instanceof ApiError && e.status === 400 && /limit must be an integer/.test(e.message),
  );
});

test("an error body that is not JSON still produces a useful ApiError", async () => {
  const { fetchImpl } = stub([{ status: 502, text: "<html>gateway</html>" }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl });
  await assert.rejects(
    () => getPage("/capybaras"),
    (e: ApiError) => e.status === 502 && /request failed with 502/.test(e.message),
  );
});

test("a 200 that is not JSON is an error, not silently undefined", async () => {
  // This is what the SPA fallback serves for a mistyped path: index.html with status 200.
  const { fetchImpl } = stub([{ status: 200, text: "<!doctype html><title>CapyTube</title>" }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl });
  await assert.rejects(() => getPage("/capybaras"), /expected JSON/);
});

test("getOne turns 404 into undefined but lets every other error through", async () => {
  const notFound = stub([{ status: 404, body: { error: "capybara not found" } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: notFound.fetchImpl });
  assert.equal(await getOne("/capybaras/nope"), undefined);

  resetApiConfig();
  const boom = stub([{ status: 500, body: { error: "internal error" } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: boom.fetchImpl });
  await assert.rejects(() => getOne("/capybaras/x"), (e: ApiError) => e.status === 500);
});

test("getAll returns items, and tolerates a response with none", async () => {
  const { fetchImpl } = stub([{ body: { items: [{ id: "a" }, { id: "b" }], count: 2 } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl });
  assert.deepEqual(await getAll<{ id: string }>("/capybaras"), [{ id: "a" }, { id: "b" }]);

  resetApiConfig();
  const empty = stub([{ body: { count: 0 } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: empty.fetchImpl });
  assert.deepEqual(await getAll("/capybaras"), []);
});

test("getEvery follows cursors and stops when one is not returned", async () => {
  const { calls, fetchImpl } = stub([
    { body: { items: [{ id: "1" }], count: 1, cursor: "c1" } },
    { body: { items: [{ id: "2" }], count: 1, cursor: "c2" } },
    { body: { items: [{ id: "3" }], count: 1 } },
  ]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl });
  assert.deepEqual(await getEvery<{ id: string }>("/capybaras"), [{ id: "1" }, { id: "2" }, { id: "3" }]);
  assert.equal(calls.length, 3);
  assert.ok(!new URL(calls[0].url).searchParams.has("cursor"), "first page sends no cursor");
  assert.equal(new URL(calls[1].url).searchParams.get("cursor"), "c1");
  assert.equal(new URL(calls[2].url).searchParams.get("cursor"), "c2");
});

test("getEvery cannot spin forever on a server that always returns a cursor", async () => {
  const { calls, fetchImpl } = stub([{ body: { items: [{ id: "x" }], count: 1, cursor: "always" } }]);
  configureApi({ baseUrl: "https://api.example.com/dev", fetch: fetchImpl });
  const items = await getEvery("/capybaras", {}, 3);
  assert.equal(calls.length, 3, "must stop at maxPages");
  assert.equal(items.length, 3);
});
