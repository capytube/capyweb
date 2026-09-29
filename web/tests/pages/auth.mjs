// Sign-in (W11): the whole Cognito managed-login flow against a fake Cognito, served by
// intercepting https://capyapp-test.auth.example.com in the browser (nothing listens anywhere).
// The build under test is the default one, whose /config.json says {"auth": null}; the
// configured runs replace that file with page routes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const DOMAIN = 'https://capyapp-test.auth.example.com';
const CLIENT = 'testclient123';
const CONFIG = JSON.stringify({ auth: { domain: DOMAIN, client_id: CLIENT } });
const REFRESH_KEY = 'capyweb.auth.refresh';
const FLOW_KEY = 'capyweb.auth.flow';
const PAGES = ['/', '/watch', '/stream/magnus', '/play', '/shop', '/shop/capy-1234', '/profile', '/robot', '/about-us', '/privacy-policy', '/terms-of-service', '/deletion', '/auth/callback'];

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const jwt = (claims) => `${b64url('{"alg":"RS256","kid":"test"}')}.${b64url(JSON.stringify(claims))}.${b64url('sig')}`;
const sha256 = (text) => b64url(createHash('sha256').update(text, 'ascii').digest());

// A fake Cognito: authorize, token (code and refresh grants, with rotation), revoke, logout.
function fakeCognito(BASE) {
  const log = { authorize: [], token: [], revoke: [], logout: [], me: [], problems: [] };
  const state = { redirect: true, rt: null, n: 0, life: 900, access: null };
  const issue = () => {
    state.n += 1;
    const iat = 1_790_000_000 + state.n;
    state.access = jwt({ sub: 'user-sub-1', token_use: 'access', client_id: CLIENT, iat, exp: iat + state.life });
    state.rt = `rt-${state.n}`;
    return {
      access_token: state.access,
      id_token: jwt({ sub: 'user-sub-1', email: 'nok@example.com', aud: CLIENT, token_use: 'id', iat, exp: iat + state.life }),
      refresh_token: state.rt,
      expires_in: state.life,
      token_type: 'Bearer',
    };
  };
  const cors = { 'access-control-allow-origin': BASE, 'content-type': 'application/json' };
  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/oauth2/authorize') {
      const q = Object.fromEntries(url.searchParams);
      log.authorize.push(q);
      if (!state.redirect) return route.fulfill({ contentType: 'text/html', body: '<h1>Fake managed login</h1>' });
      return route.fulfill({ status: 302, headers: { location: `${q.redirect_uri}?code=code-${log.authorize.length}&state=${q.state}` } });
    }
    if (url.pathname === '/oauth2/token') {
      assert.equal(req.method(), 'POST');
      assert.equal(req.headers()['content-type'], 'application/x-www-form-urlencoded');
      const f = Object.fromEntries(new URLSearchParams(req.postData() ?? ''));
      log.token.push(f);
      assert.equal(f.client_id, CLIENT);
      assert.equal(f.client_secret, undefined, 'a public client sends no secret');
      if (f.grant_type === 'authorization_code') {
        const auth = log.authorize.at(-1);
        assert.equal(f.code, `code-${log.authorize.length}`);
        assert.equal(f.redirect_uri, auth.redirect_uri);
        assert.equal(sha256(f.code_verifier), auth.code_challenge, 'PKCE: S256(verifier) == challenge');
        return route.fulfill({ headers: cors, body: JSON.stringify(issue()) });
      }
      if (f.grant_type === 'refresh_token') {
        if (f.refresh_token !== state.rt) {
          return route.fulfill({ status: 400, headers: cors, body: '{"error":"invalid_grant"}' });
        }
        return route.fulfill({ headers: cors, body: JSON.stringify(issue()) });
      }
      return route.fulfill({ status: 400, headers: cors, body: '{"error":"unsupported_grant_type"}' });
    }
    if (url.pathname === '/oauth2/revoke') {
      log.revoke.push(Object.fromEntries(new URLSearchParams(req.postData() ?? '')));
      return route.fulfill({ status: 200, body: '' });
    }
    if (url.pathname === '/logout') {
      const q = Object.fromEntries(url.searchParams);
      log.logout.push(q);
      return route.fulfill({ status: 302, headers: { location: q.logout_uri } });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  }
  // An assertion that fails inside a route handler would leave the request hanging; record it
  // and answer 500 instead, and the test checks log.problems.
  const guarded = (fn) => async (route) => {
    try {
      await fn(route);
    } catch (e) {
      log.problems.push(e.message);
      await route.fulfill({ status: 500, body: 'fake cognito: ' + e.message });
    }
  };
  return { log, state, handle: guarded(handle), guarded };
}

async function configuredContext(browser, BASE, cognito, { width = 1280, meFirst401 = true, init } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  if (init) await context.addInitScript(init);
  await context.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: CONFIG }));
  await context.route(`${DOMAIN}/**`, cognito.handle);
  // GET /me through the fixture base: 401 on the first call (an access token the API no longer
  // accepts), then the balance for whichever token is current.
  await context.route('**/fixtures/me.json', cognito.guarded((route) => {
    const bearer = route.request().headers().authorization;
    cognito.log.me.push(bearer);
    if (meFirst401 && cognito.log.me.length === 1) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"token expired"}' });
    }
    assert.equal(bearer, `Bearer ${cognito.state.access}`, 'the API gets the current access token');
    return route.fulfill({ contentType: 'application/json', body: '{"id":"user-sub-1","display_name":"Nok","balance":42,"createdAt":"2026-09-29T00:00:00Z"}' });
  }));
  const errors = [];
  context.on('weberror', (e) => errors.push(e.error().message));
  return { context, errors };
}

const storage = (page) => page.evaluate(([r, f]) => ({ refresh: localStorage.getItem(r), flow: sessionStorage.getItem(f) }), [REFRESH_KEY, FLOW_KEY]);

export async function check({ open, browser, settle, BASE }) {
  // -- no pool configured: no sign-in control on any page, at either width ------------------
  for (const width of [390, 1280]) {
    for (const path of PAGES) {
      const { page } = await open(path, { width, height: 800 });
      await settle();
      assert.equal(await page.locator('[data-testid=sign-in], [data-testid=sign-out]').count(), 0, `${path} @${width}`);
      assert.equal(await page.getByRole('button', { name: /sign (in|out)/i }).count(), 0, `${path} @${width}`);
      await page.close();
    }
  }
  const shipped = await (await fetch(`${BASE}/config.json`)).json();
  assert.deepEqual(shipped, { auth: null }, 'the repository build ships no pool');

  const cognito = fakeCognito(BASE);
  const { context, errors } = await configuredContext(browser, BASE, cognito);
  const page = await context.newPage();

  // -- configured, signed out: a sign-in button; nothing stored --------------------------------
  await page.goto(`${BASE}/shop`);
  await page.locator('[data-testid=sign-in]').waitFor();
  assert.equal(await page.locator('.account-link').count(), 0);
  assert.deepEqual(await storage(page), { refresh: null, flow: null });

  // -- a callback whose state is not this tab's is refused, and nothing is exchanged -----------
  cognito.state.redirect = false;
  await page.click('[data-testid=sign-in]');
  await page.waitForURL(`${DOMAIN}/oauth2/authorize**`);
  const sent = cognito.log.authorize.at(-1);
  assert.equal(sent.response_type, 'code');
  assert.equal(sent.client_id, CLIENT);
  assert.equal(sent.redirect_uri, `${BASE}/auth/callback`);
  assert.equal(sent.scope, 'openid email');
  assert.equal(sent.code_challenge_method, 'S256');
  assert.match(sent.code_challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.match(sent.state, /^[A-Za-z0-9_-]{22,}$/);
  await page.goto(`${BASE}/auth/callback?code=stolen&state=${'x'.repeat(sent.state.length)}`);
  await page.getByText('did not start in this tab').waitFor();
  assert.equal(cognito.log.token.length, 0, 'no token request for a wrong state');
  // The attempt used up this tab's flow, so even the right state is now refused (no replay).
  await page.goto(`${BASE}/auth/callback?code=stolen&state=${sent.state}`);
  await page.getByText('has expired').waitFor();
  assert.equal(cognito.log.token.length, 0);
  await page.goto(`${BASE}/auth/callback?error=access_denied`);
  await page.getByText('Sign-in was cancelled.').waitFor();

  // -- the whole flow: redirect, callback, code exchange with PKCE, back where the user was ----
  cognito.state.redirect = true;
  await page.goto(`${BASE}/shop`);
  await page.click('[data-testid=sign-in]');
  await page.waitForURL(`${BASE}/shop`);
  await page.locator('[data-testid=sign-out]').waitFor();
  assert.equal(await page.evaluate(() => location.search), '', 'the code is not left in the URL');
  assert.equal(await page.getAttribute('[data-testid=sign-out]', 'title'), 'nok@example.com');
  // GET /me answered 401 once: one refresh, one retry with the new token, then the balance.
  await page.waitForFunction(() => document.querySelector('.coin-pill')?.textContent.includes('42'));
  assert.deepEqual(cognito.log.token.map((t) => t.grant_type), ['authorization_code', 'refresh_token']);
  assert.equal(cognito.log.token[1].refresh_token, 'rt-1');
  assert.equal(cognito.log.me.length, 2);
  assert.notEqual(cognito.log.me[0], cognito.log.me[1], 'the retry carries the refreshed token');
  assert.deepEqual(await storage(page), { refresh: 'rt-2', flow: null }, 'rotated refresh token stored; flow cleared');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).length), 1, 'only the refresh token is stored');
  const leaked = await page.evaluate(([a]) => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(a), [cognito.state.access]);
  assert.equal(leaked, false, 'the access token is kept in memory only');

  // -- a reload resumes the session from the refresh token, and a short-lived token refreshes
  // itself at half its life (under two minutes) without any 401 --------------------------------
  cognito.state.life = 4;
  await page.reload();
  await page.locator('[data-testid=sign-out]').waitFor();
  assert.equal(cognito.log.token.at(-1).refresh_token, 'rt-2');
  assert.equal(await page.evaluate(([k]) => localStorage.getItem(k), [REFRESH_KEY]), 'rt-3');
  await page.waitForFunction(() => document.querySelector('.coin-pill')?.textContent.includes('42'));
  // The next token lives 15 minutes again, so the page's timer is quiet for the rest.
  cognito.state.life = 900;
  const t0 = Date.now();
  await page.waitForFunction(() => localStorage.getItem('capyweb.auth.refresh') === 'rt-4', null, { timeout: 6000 });
  const waited = Date.now() - t0;
  assert.ok(waited < 4000, `scheduled refresh ran before the 4 s token expired (${waited} ms)`);
  assert.equal(cognito.log.token.at(-1).refresh_token, 'rt-3');

  // -- a refused refresh signs out and forgets the token ---------------------------------------
  const other = await context.newPage();
  await page.evaluate(([k]) => localStorage.setItem(k, 'rt-revoked'), [REFRESH_KEY]);
  await other.goto(`${BASE}/`);
  await other.locator('[data-testid=sign-in]').waitFor();
  assert.equal(await other.evaluate(([k]) => localStorage.getItem(k), [REFRESH_KEY]), null);
  await other.close();

  // -- sign out: memory and storage cleared, refresh token revoked, Cognito /logout, back home -
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [REFRESH_KEY, cognito.state.rt]);
  const rt = cognito.state.rt;
  await page.click('[data-testid=sign-out]');
  await page.waitForURL(`${BASE}/`);
  await page.locator('[data-testid=sign-in]').waitFor();
  assert.deepEqual(cognito.log.revoke, [{ token: rt, client_id: CLIENT }]);
  assert.deepEqual(cognito.log.logout, [{ client_id: CLIENT, logout_uri: `${BASE}/` }]);
  assert.deepEqual(await storage(page), { refresh: null, flow: null });
  assert.equal(await page.locator('.coin-pill').count(), 0);
  assert.deepEqual(errors, [], 'no page errors in the configured flow');
  assert.deepEqual(cognito.log.problems, [], 'every request the fake Cognito and API saw was valid');
  await context.close();

  // -- storage that throws (blocked site data): the app still runs; sign-in says why it cannot -
  const blocked = fakeCognito(BASE);
  const { context: ctx2, errors: errors2 } = await configuredContext(browser, BASE, blocked, {
    width: 390,
    init: () => {
      for (const name of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, name, { get() { throw new DOMException('blocked', 'SecurityError'); } });
      }
    },
  });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/`);
  await p2.locator('[data-testid=sign-in]').waitFor();
  assert.ok(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll with the sign-in button at 390px');
  await p2.click('[data-testid=sign-in]');
  await p2.getByText('allowed to store data').waitFor();
  assert.equal(blocked.log.authorize.length, 0, 'no redirect without somewhere to keep the verifier');
  assert.deepEqual(errors2, []);
  assert.deepEqual(blocked.log.problems, []);
  await ctx2.close();
}
