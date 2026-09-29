// Browser primitives for sign-in (web/src/auth.rs). The logic lives in Rust (src/oauth.rs);
// this file only reaches what Rust would otherwise need several web-sys bindings for.

export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

// SHA-256 of the text's UTF-8 bytes (for PKCE: the verifier's ASCII), as bytes.
export async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// Storage can be missing or throw (private windows, blocked site data, sandboxed previews).
// Every access is wrapped: reads fail as "nothing stored", writes report false.
function area(session) {
  try {
    return session ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function storeGet(session, key) {
  try {
    return area(session)?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storeSet(session, key, value) {
  try {
    const a = area(session);
    if (!a) return false;
    a.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storeDel(session, key) {
  try {
    area(session)?.removeItem(key);
  } catch {
    /* nothing to clear */
  }
}

// POST a form to Cognito. Resolves to [status, body]; status 0 on a network error.
// Identical requests in flight share one fetch: a burst of 401s that all refresh at once sends
// the refresh token once, and every caller gets the same answer.
// With noCors the request is sent but the answer is opaque (used for the revoke, whose answer
// is not needed and must be sent whatever Cognito's CORS headers say).
const inflight = new Map();

export function postForm(url, body, noCors) {
  const key = url + "\n" + body;
  let p = inflight.get(key);
  if (!p) {
    p = fetch(url, {
      method: "POST",
      mode: noCors ? "no-cors" : "cors",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })
      .then(async (r) => [r.status, noCors ? "" : await r.text()])
      .catch(() => [0, ""])
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

export function pageOrigin() {
  return location.origin;
}

export function queryParam(name) {
  return new URLSearchParams(location.search).get(name) ?? undefined;
}

export function pagePath() {
  return location.pathname + location.search;
}

export function go(url) {
  location.assign(url);
}
