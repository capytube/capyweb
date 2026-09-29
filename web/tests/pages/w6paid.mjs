// W6: a paid camera with sign-in (/stream/elon, wall-cam). Runs against the fake Cognito of
// auth.mjs and a fake playback route with the server's rules (backend/src/playback.ts): an
// Idempotency-Key per purchase, a replay for a key seen before, refusals by code. The paid
// playlist is web/fixtures/paid/wall-cam/ (VP9 HLS, VOD), made by web/tests/make-hls-sample.sh.
import assert from 'node:assert/strict';
import { fakeCognito, configuredContext } from './auth.mjs';

const KEY = /^[A-Za-z0-9_-]{8,64}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isPaidMedia = (p) => p.includes('/paid/');

function setHidden(page, hidden) {
  return page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

async function until(cond, what, ms = 15000) {
  for (let t = 0; !cond(); t += 50) {
    assert.ok(t < ms, `timed out waiting for ${what}`);
    await sleep(50);
  }
}

export async function fakeApi(context, cognito) {
  const api = { balance: 42, posts: [], seen: new Map(), loseNext: false, refuse: null, src: '/paid/wall-cam/index.m3u8' };
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await context.route('**/fixtures/me.json', cognito.guarded((route) => {
    assert.equal(route.request().headers().authorization, `Bearer ${cognito.state.access}`);
    return json(route, 200, { id: 'user-sub-1', display_name: 'Nok', balance: api.balance, createdAt: '2026-09-29T00:00:00Z' });
  }));
  await context.route('**/fixtures/playback/*.json', cognito.guarded(async (route) => {
    const req = route.request();
    assert.equal(req.method(), 'POST');
    assert.equal(req.headers().authorization, `Bearer ${cognito.state.access}`, 'the route gets the current access token');
    const key = req.headers()['idempotency-key'];
    assert.match(key ?? '', KEY, 'every purchase carries an Idempotency-Key');
    assert.ok(!req.postData(), 'the client sends no body: no price, no duration');
    api.posts.push({ key, at: Date.now(), path: new URL(req.url()).pathname });
    if (api.refuse) {
      const r = api.refuse;
      api.refuse = null;
      return json(route, 409, r);
    }
    if (api.seen.has(key)) return json(route, 200, { ...api.seen.get(key), replayed: true });
    api.balance -= 6;
    const answer = { src: api.src, paid_until: Math.floor(Date.now() / 1000) + 60, renew_after_s: 5, charged: 6 };
    api.seen.set(key, answer);
    if (api.loseNext) {
      api.loseNext = false;
      return route.abort('failed');
    }
    return json(route, 201, answer);
  }));
  return api;
}

export async function check({ browser, BASE, SHOTS }) {
  const cognito = fakeCognito(BASE);
  const { context, errors } = await configuredContext(browser, BASE, cognito, { meFirst401: false });
  const api = await fakeApi(context, cognito);
  const page = await context.newPage();
  const paths = [];
  page.on('request', (r) => paths.push(new URL(r.url()).pathname));
  const panel = page.locator('[data-testid=locked-camera]');
  const note = page.locator('[data-testid=paid-note]');
  const video = page.locator('[data-testid=locked-camera] video');

  // -- signed out, sign-in available: one Sign in button, nothing bought or played ----------
  await page.goto(`${BASE}/stream/elon`);
  await page.locator('[data-testid=paid-sign-in]').waitFor();
  assert.equal(await panel.locator('button').count(), 1);
  assert.equal(await page.innerText('[data-testid=paid-price]'), '6 play coins a minute');
  assert.deepEqual(paths.filter((p) => isPaidMedia(p) || p.includes('playback')), []);
  await page.click('[data-testid=paid-sign-in]');
  await page.waitForURL(`${BASE}/auth/callback**`);
  await page.waitForURL(`${BASE}/stream/elon`);
  await page.locator('[data-testid=paid-watch]').waitFor();
  assert.equal(api.posts.length, 0, 'signing in buys nothing');

  // -- Watch asks first; Cancel buys nothing -------------------------------------------------
  await page.click('[data-testid=paid-watch]');
  await page.locator('[data-testid=paid-confirm]').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid=paid-confirm]')?.innerText.includes('You have 42 play coins'));
  assert.match(await page.innerText('[data-testid=paid-confirm]'), /You pay 6 play coins a minute: the first minute now, then each minute while you watch\./);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.locator('[data-testid=paid-watch]').waitFor();
  assert.equal(api.posts.length, 0, 'Cancel buys nothing');

  // -- Start: one purchase, the paid recording plays, badged Recorded ------------------------
  await page.click('[data-testid=paid-watch]');
  await page.click('[data-testid=paid-start]');
  await video.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid=locked-camera] video')?.readyState >= 2);
  assert.equal(api.posts.length, 1);
  assert.equal(api.posts[0].path, '/fixtures/playback/wall-cam.json');
  assert.ok(paths.includes('/fixtures/paid/wall-cam/index.m3u8'), 'plays the route\'s answer');
  assert.ok(paths.includes('/fixtures/paid/wall-cam/a/index.m3u8'));
  assert.equal(await page.getAttribute('[data-testid=player]', 'data-state'), 'recording');
  assert.equal(await page.innerText('[data-testid=recorded-badge]'), 'Recorded');
  await page.waitForFunction(() => document.querySelector('.coin-pill')?.textContent.includes('36'));
  await page.waitForFunction(() => document.activeElement?.dataset.testid === 'paid-stop');
  // (Start unmounted with focus on it: focus moved to Stop, not to the page body.)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w6-paid-watching.png`, fullPage: true });

  // -- the next minute: a new key; a lost answer is asked again with the same key -----------
  api.loseNext = true;
  await until(() => api.posts.length >= 3, 'the renewal and its retry');
  assert.notEqual(api.posts[1].key, api.posts[0].key, 'each minute has its own key');
  assert.equal(api.posts[2].key, api.posts[1].key, 'a lost answer is retried with the same key');
  assert.equal(api.balance, 30, 'two minutes paid, the retried one once');
  assert.equal(await video.count(), 1, 'the picture carries on');

  // -- hidden: nothing bought; back: the next minute is bought ------------------------------
  await setHidden(page, true);
  const hiddenAt = api.posts.length;
  await sleep(7000); // past the 5 s renewal
  assert.equal(api.posts.length, hiddenAt, 'nothing bought while the tab is hidden');
  await setHidden(page, false);
  await until(() => api.posts.length === hiddenAt + 1, 'a purchase once visible again', 4000);

  // -- Stop: the player goes and nothing more is bought -------------------------------------
  await page.click('[data-testid=paid-stop]');
  await note.getByText('Stopped. Nothing more will be charged.').waitFor();
  assert.equal(await video.count(), 0);
  const stoppedAt = api.posts.length;
  await sleep(6000);
  assert.equal(api.posts.length, stoppedAt, 'nothing bought after Stop');

  // -- two activations of Start in one tick start one viewing (review rv-1790679222-35297) ----
  await page.click('[data-testid=paid-watch]');
  await page.locator('[data-testid=paid-start]').waitFor();
  const twice = api.posts.length;
  await page.evaluate(() => { const b = document.querySelector('[data-testid=paid-start]'); b.click(); b.click(); });
  await video.waitFor();
  await sleep(1500);
  assert.equal(api.posts.length, twice + 1, 'one purchase for a same-tick double Start');
  await page.click('[data-testid=paid-stop]');

  // -- a picture that will not play: one fresh start on the same cookies, then a message -------
  await page.route('**/fixtures/paid/wall-cam/**', (r) => r.fulfill({ status: 403, body: 'no' }));
  const dead = api.posts.length;
  await page.click('[data-testid=paid-watch]');
  await page.click('[data-testid=paid-start]');
  await note.getByText('The recording would not play, so nothing more will be charged.').waitFor({ timeout: 30000 });
  assert.equal(api.posts.length - dead, 1, 'the purchase only: the fresh start reuses the cookies');
  assert.equal(await video.count(), 0);
  const gaveUp = api.posts.length;
  await sleep(6000);
  assert.equal(api.posts.length, gaveUp, 'nothing bought after giving up');
  await page.unroute('**/fixtures/paid/wall-cam/**');

  // -- a picture that never comes (the server takes the request and never answers): no error,
  //    so the player's 15 s watchdog fails it; one fresh start on the same cookies, then no
  //    more buying, even at the fake's 5 s cadence (review rv-1790680891-72131) ---------------
  const hung = [];
  await page.route('**/fixtures/paid/wall-cam/**', (r) => { hung.push(r); }); // never answered
  const hang = api.posts.length;
  await page.click('[data-testid=paid-watch]');
  await page.click('[data-testid=paid-start]');
  await video.waitFor();
  await sleep(8000); // past the 5 s renewal: nothing has played, so nothing more is bought
  assert.equal(api.posts.length - hang, 1, 'no renewal for a picture that has not played');
  await note.getByText('The recording would not play, so nothing more will be charged.').waitFor({ timeout: 40000 });
  assert.equal(api.posts.length - hang, 1, 'the purchase only: the fresh start reuses the cookies');
  assert.equal(await video.count(), 0);
  await sleep(6000);
  assert.equal(api.posts.length - hang, 1, 'nothing bought after giving up');
  await page.unroute('**/fixtures/paid/wall-cam/**');
  await Promise.all(hung.map((r) => r.abort().catch(() => {})));

  // -- no autoplay (reduced motion): nothing more is bought until the viewer presses play ------
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const still = api.posts.length;
  await page.click('[data-testid=paid-watch]');
  await page.click('[data-testid=paid-start]');
  await page.waitForFunction(() => document.querySelector('[data-testid=locked-camera] video')?.readyState >= 1);
  await sleep(7000);
  assert.equal(api.posts.length - still, 1, 'no renewal while the picture waits for play');
  assert.equal(await video.evaluate((v) => v.paused), true);
  await video.evaluate((v) => v.play());
  await until(() => api.posts.length - still === 2, 'the next minute once it plays', 8000);
  await page.click('[data-testid=paid-stop]');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // -- a refusal: a plain message, no player -------------------------------------------------
  api.refuse = { error: 'not enough coins', code: 'insufficient_coins' };
  api.balance = 4; // what the server would see when it refuses a 6-coin minute
  await page.click('[data-testid=paid-watch]');
  await page.click('[data-testid=paid-start]');
  await note.getByText('Not enough play coins: a minute costs 6 play coins and you have 4 play coins. Nothing more was spent.').waitFor();
  api.balance = 42;
  assert.equal(await video.count(), 0);
  await page.locator('[data-testid=paid-watch]').waitFor();

  // -- an answer naming another camera's files is never played --------------------------------
  api.src = '/paid/main-cam/index.m3u8';
  await page.click('[data-testid=paid-watch]');
  await page.click('[data-testid=paid-start]');
  await note.getByText(/did not look right/).waitFor();
  assert.equal(await video.count(), 0);
  assert.deepEqual(paths.filter((p) => p.includes('/paid/main-cam')), [], 'no request for a foreign playlist');
  api.src = '/paid/wall-cam/index.m3u8';

  // -- leaving the camera ends the viewing -----------------------------------------------------
  await page.click('[data-testid=paid-watch]');
  await page.click('[data-testid=paid-start]');
  await video.waitFor();
  await page.click('footer a[href="/about-us"]'); // in-app: the panel unmounts, the page stays
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'About CapyTube');
  const leftAt = api.posts.length;
  await sleep(6000);
  assert.equal(api.posts.length, leftAt, 'nothing bought after leaving');

  // -- phone width ----------------------------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/stream/elon`);
  await page.locator('[data-testid=paid-watch]').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll at 390px');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w6-paid-390.png`, fullPage: true });

  assert.deepEqual(errors, [], 'no page errors');
  assert.deepEqual(cognito.log.problems, [], 'every request the fakes saw was valid');
  await context.close();
}
