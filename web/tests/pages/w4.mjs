// W4: /watch cards and the watch room (camera tabs, reactions, chat).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = '/private/tmp/claude-501/-Users-nic-stacks-capyweb/6cadfc1b-e36f-48fc-a643-3b98cc52a2f1/scratchpad/shots/w4';
const DOMAIN = 'https://capyapp-test.auth.example.com';
const CLIENT = 'testclient123';
const CONFIG = JSON.stringify({ auth: { domain: DOMAIN, client_id: CLIENT } });
const XSS = '<img src=x onerror=alert(1)>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const jwt = (claims) => `${b64url('{"alg":"RS256","kid":"test"}')}.${b64url(JSON.stringify(claims))}.${b64url('sig')}`;

const EMPTY_REACTIONS = { capylove: 0, capylike: 0, capywow: 0, capyangry: 0, capyfire: 0 };
const MULTI = {
  items: [
    { id: 'main-cam', title: 'Main cam', access_type: 'public', is_live: false, capybara_ids: ['magnus'], fallback_reel: 'capytube-stream.mp4', viewer_count: 12 },
    { id: 'side-cam', title: 'Side cam', access_type: 'public', is_live: false, capybara_ids: ['magnus'], fallback_reel: 'capytube-stream.mp4' },
    { id: 'wall-cam', title: 'Climbing wall cam', access_type: 'private', is_live: false, capybara_ids: ['magnus'], price_per_10_sec: 1 },
  ],
  count: 3,
};

function setHidden(page, hidden) {
  return page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

function tokenHandler(state) {
  const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
  return async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/oauth2/token') {
      return route.fulfill({ status: 404, body: 'not found' });
    }
    const f = Object.fromEntries(new URLSearchParams(route.request().postData() ?? ''));
    if (f.grant_type !== 'refresh_token' || f.refresh_token !== state.rt || f.client_id !== CLIENT) {
      return route.fulfill({ status: 400, headers: cors, body: '{"error":"invalid_grant"}' });
    }
    state.n += 1;
    const iat = 1_790_000_000 + state.n;
    state.rt = `rt-${state.n + 1}`;
    const body = {
      access_token: jwt({ sub: 'user-sub-1', token_use: 'access', client_id: CLIENT, iat, exp: iat + 900 }),
      id_token: jwt({ sub: 'user-sub-1', email: 'nok@example.com', aud: CLIENT, token_use: 'id', iat, exp: iat + 900 }),
      refresh_token: state.rt,
      expires_in: 900,
      token_type: 'Bearer',
    };
    return route.fulfill({ headers: cors, body: JSON.stringify(body) });
  };
}

async function shot(page, name) {
  await mkdir(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
}

export async function check({ open, browser, BASE }) {
  // -- /watch: cards, private-camera counts, links --------------------------------
  {
    const { page } = await open('/watch');
    await page.waitForSelector('[data-testid=capy-card]');
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.innerText('main h1'), 'Watch');
    const cards = await page.$$eval('[data-testid=capy-card]', (els) => els.map((e) => ({
      href: e.getAttribute('href'),
      text: e.innerText,
      img: e.querySelector('img')?.getAttribute('src') ?? '',
    })));
    assert.deepEqual(cards.map((c) => c.href), ['/stream/einstein', '/stream/elon', '/stream/magnus']);
    assert.match(cards[0].text, /Einstein/);
    assert.match(cards[0].text, /No private cameras/);
    assert.equal(cards[0].img, '/assets/cast/einstein.webp');
    assert.match(cards[1].text, /Elon/);
    assert.match(cards[1].text, /1 private camera/);
    assert.equal(cards[1].img, '/assets/cast/elon.webp');
    assert.match(cards[2].text, /Magnus/);
    assert.match(cards[2].text, /No private cameras/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot(page, 'watch-390');
    await page.close();
  }
  {
    const { page } = await open('/watch', { width: 1280, height: 800 });
    await page.waitForSelector('[data-testid=capy-card]');
    assert.equal(await page.locator('h1').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot(page, 'watch-1280');
    await page.close();
  }

  // -- room, signed out, no pool: public chat is empty and calm; no write controls --
  {
    const { page } = await open('/stream/magnus');
    await page.waitForSelector('[data-testid=chat-empty]');
    assert.equal(await page.innerText('[data-testid=chat-empty]'), 'No messages yet');
    assert.equal(await page.locator('[data-testid=react], [data-testid=chat-form], [data-testid=watch-sign-in]').count(), 0);
    assert.equal(await page.locator('h1').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot(page, 'room-390');
    await page.close();
  }
  {
    const { page } = await open('/stream/magnus', { width: 1280, height: 800 });
    await page.waitForSelector('main video');
    assert.equal(await page.locator('h1').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot(page, 'room-1280');
    await page.close();
  }

  // -- tabs, deep link, bad cam, private tab makes no chat or media request ---------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const paths = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      paths.push(u.pathname + u.search);
    });
    await page.route('**/fixtures/streams.json', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify(MULTI),
    }));
    await page.route('**/chat.json*', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], count: 0, reactions: { ...EMPTY_REACTIONS, capylove: 1 } }),
    }));
    await page.goto(`${BASE}/stream/magnus?cam=not-a-cam`);
    await page.waitForSelector('[data-testid=cam-tab]');
    assert.equal(await page.getAttribute('[data-cam=main-cam]', 'aria-selected'), 'true', 'bad cam falls back to the first public camera');
    assert.match(await page.innerText('[data-testid=viewer-count]'), /12 watching/);
    // Re-selecting the shown camera must not mount a second chat (found by the phone check).
    await page.waitForSelector('[data-testid=chat-log]', { state: 'attached' });
    await page.click('[data-cam=main-cam]');
    await page.waitForURL(/cam=main-cam/);
    await sleep(500);
    assert.equal(await page.locator('[data-testid=chat-log]').count(), 1, 'one chat after re-selecting the camera');
    await page.click('[data-cam=side-cam]');
    await page.waitForURL(/cam=side-cam/);
    assert.equal(await page.getAttribute('[data-cam=side-cam]', 'aria-selected'), 'true');
    assert.equal(await page.locator('[data-testid=viewer-count]').count(), 0, 'no count when the camera has none');
    await page.reload();
    await page.waitForSelector('[data-cam=side-cam][aria-selected=true]');
    assert.match(page.url(), /cam=side-cam/);
    await page.goto(`${BASE}/stream/magnus`);
    await page.waitForSelector('[data-cam=main-cam][aria-selected=true]');
    await page.focus('[data-cam=main-cam]');
    await page.keyboard.press('ArrowRight');
    await page.waitForURL(/cam=side-cam/);
    const settled = Date.now();
    while (!paths.some((p) => p.includes('side-cam') && p.includes('chat')) && Date.now() - settled < 4000) {
      await sleep(50);
    }
    await sleep(1200);
    const mark = paths.length;
    await page.click('[data-cam=wall-cam]');
    await page.waitForSelector('[data-testid=locked-camera]');
    await sleep(800);
    const after = paths.slice(mark);
    assert.equal(await page.locator('main video').count(), 0);
    assert.equal(await page.locator('[data-testid=chat-log], [data-testid=react], [data-testid=chat-form], [data-testid=watch-sign-in]').count(), 0);
    assert.equal(await page.locator('[data-testid=locked-camera] button, [data-testid=locked-camera] a, [data-testid=locked-camera] input').count(), 0);
    assert.deepEqual(after.filter((p) => /chat|reactions|m3u8|\.mp4|\/live\/|\/media\//.test(p)), []);
    await page.close();
  }

  // -- chat poll: about every 5s while visible, none while hidden, none after leaving
  {
    const page = await browser.newPage();
    const hits = [];
    page.on('request', (r) => {
      if (r.url().includes('/chat')) hits.push(Date.now());
    });
    await page.goto(`${BASE}/stream/magnus`);
    const start = Date.now();
    while (Date.now() - start < 17000) {
      await sleep(200);
      const paced = [];
      for (let i = 1; i < hits.length; i++) if (hits[i] - hits[i - 1] >= 1000) paced.push(hits[i] - hits[i - 1]);
      if (paced.length >= 2) break;
    }
    const gaps = [];
    for (let i = 1; i < hits.length; i++) gaps.push(hits[i] - hits[i - 1]);
    const paced = gaps.filter((g) => g >= 1000);
    assert.ok(paced.length >= 2, `expected a 5s rhythm, saw ${hits.length} requests, gaps ${gaps.join(',')}`);
    for (const gap of paced) assert.ok(gap >= 4000 && gap <= 7000, `poll gap ${gap}ms`);
    const n = hits.length;
    await setHidden(page, true);
    await sleep(7000);
    assert.equal(hits.length, n, 'no chat request while the tab is hidden');
    await page.click('footer a[href="/about-us"]');
    await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'About CapyTube');
    const left = hits.length;
    await sleep(7000);
    assert.equal(hits.length, left, 'no chat request after leaving the room');
    await page.close();
  }

  // -- untrusted chat is text, and a script in it does not run ------------------------
  {
    const page = await browser.newPage();
    let dialog = false;
    page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
    await page.route('**/fixtures/streams/main-cam/chat.json*', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{ id: 'm-xss', display_name: XSS, text: XSS, createdAt: '2026-09-29T00:00:00.000Z' }],
        count: 1,
        reactions: EMPTY_REACTIONS,
      }),
    }));
    await page.goto(`${BASE}/stream/magnus`);
    await page.waitForSelector('[data-testid=chat-line]');
    assert.match(await page.innerText('[data-testid=chat-log]'), /<img src=x onerror=alert\(1\)>/);
    assert.equal(await page.locator('img[src="x"]').count(), 0);
    await sleep(300);
    assert.equal(dialog, false);
    await page.close();
  }

  // -- signed out, pool configured: one sign-in button, no reaction or chat form ------
  {
    const context = await browser.newContext();
    await context.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: CONFIG }));
    const page = await context.newPage();
    await page.goto(`${BASE}/stream/magnus`);
    await page.locator('[data-testid=watch-sign-in]').waitFor();
    assert.equal(await page.locator('[data-testid=watch-sign-in]').count(), 1);
    assert.equal(await page.innerText('[data-testid=watch-sign-in]'), 'Sign in to react and chat');
    assert.equal(await page.locator('[data-testid=react], [data-testid=chat-form]').count(), 0);
    await context.close();
  }

  // -- signed in: reactions, post, 429, display name, load earlier --------------------
  {
    const state = { rt: 'rt-1', n: 0 };
    const context = await browser.newContext();
    await context.addInitScript(() => localStorage.setItem('capyweb.auth.refresh', 'rt-1'));
    await context.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: CONFIG }));
    await context.route(`${DOMAIN}/**`, tokenHandler(state));
    await context.route('**/fixtures/me.json', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-sub-1', display_name: 'Nok', balance: 0, createdAt: '2026-09-29T00:00:00.000Z' }),
    }));
    const lines = [{ id: 'm1', stream_id: 'main-cam', display_name: 'Nok', text: 'hello', createdAt: '2026-09-29T00:00:00.000Z' }];
    const posts = [];
    await context.route('**/fixtures/streams/main-cam/chat.json*', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        posts.push({ auth: req.headers().authorization, key: req.headers()['idempotency-key'], body: JSON.parse(req.postData() ?? '{}') });
        const text = posts.at(-1).body.text;
        if (text === 'slow') {
          return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'one message every 2 seconds, please', code: 'slow_down' }) });
        }
        if (text === 'noname') {
          return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'choose a display name first (PUT /me)', code: 'display_name_required' }) });
        }
        const message = { id: `m-${lines.length}`, stream_id: 'main-cam', display_name: 'Nok', text, createdAt: '2026-09-29T00:00:01.000Z' };
        lines.unshift(message);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ message }) });
      }
      const cursor = new URL(req.url()).searchParams.get('cursor');
      if (cursor) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ id: 'm0', display_name: 'Old', text: 'earlier line', createdAt: '2026-09-28T00:00:00.000Z' }], count: 1 }),
        });
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: lines, count: lines.length, cursor: 'page-2', reactions: { ...EMPTY_REACTIONS, capylove: 3, capywow: 1 } }),
      });
    });
    await context.route('**/fixtures/streams/main-cam/reactions.json', async (route) => {
      const req = route.request();
      assert.equal(req.method(), 'POST');
      assert.match(req.headers().authorization ?? '', /^Bearer /);
      assert.match(req.headers()['idempotency-key'] ?? '', /^[A-Za-z0-9_-]{8,64}$/);
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ reaction: 'capylove', reactions: { ...EMPTY_REACTIONS, capylove: 4, capywow: 1 } }),
      });
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/stream/magnus`);
    await page.locator('[data-testid=chat-form]').waitFor();
    assert.equal(await page.locator('[data-testid=watch-sign-in]').count(), 0);
    assert.equal(await page.locator('[data-testid=react]').count(), 5);
    await page.click('[data-reaction=capylove]');
    await page.waitForFunction(() => document.querySelector('[data-reaction=capylove]')?.textContent?.includes('4'));
    await page.fill('#chat-input', 'slow');
    await page.click('[data-testid=chat-form] button[type=submit]');
    await page.waitForSelector('[data-testid=chat-notice]');
    assert.match(await page.innerText('[data-testid=chat-notice]'), /2 seconds/);
    await page.fill('#chat-input', 'noname');
    await page.click('[data-testid=chat-form] button[type=submit]');
    await page.waitForFunction(() => document.querySelector('[data-testid=chat-notice] a')?.getAttribute('href') === '/profile');
    assert.match(await page.innerText('[data-testid=chat-notice]'), /display name/i);
    await page.fill('#chat-input', 'just arrived');
    await page.click('[data-testid=chat-form] button[type=submit]');
    await page.waitForFunction(() => document.querySelector('[data-testid=chat-log]')?.textContent?.includes('just arrived'));
    assert.equal(posts.length, 3);
    assert.match(posts[0].auth, /^Bearer /);
    assert.match(posts[0].key, /^[A-Za-z0-9_-]{8,64}$/);
    await page.click('[data-testid=chat-earlier]');
    await page.waitForFunction(() => document.querySelector('[data-testid=chat-log]')?.textContent?.includes('earlier line'));
    await context.close();
  }
}
