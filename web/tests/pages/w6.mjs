// W6: the video player on the watch room's first cut (/stream/:capyId).
// Fixtures: web/fixtures/live/<id>/ (VP9 HLS, no ENDLIST, so it plays as live) and the reel
// web/fixtures/media/capytube-stream.mp4, both made by web/tests/make-hls-sample.sh.
import assert from 'node:assert/strict';

const HLS = '/vendor/hls/';
const isMedia = (p) => /\.(m3u8|m4s|mp4)$/.test(p) || p.includes('/live/') || p.includes(HLS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Record every request path from before the first navigation.
async function watch(browser, opts = {}) {
  const page = await browser.newPage(opts);
  const paths = [];
  page.on('request', (r) => paths.push(new URL(r.url()).pathname));
  return { page, paths };
}

const video = (page) => page.locator('main video');
const state = (page) => page.getAttribute('[data-testid=player]', 'data-state');
const now = (page) => video(page).evaluate((v) => v.currentTime);
async function playing(page) {
  await page.waitForFunction(() => document.querySelector('main video')?.readyState >= 2);
  const t = await now(page);
  await page.waitForFunction((t) => document.querySelector('main video').currentTime > t + 0.3, t);
}
function setHidden(page, hidden) {
  return page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

export async function check({ open, browser, settle, BASE, SHOTS }) {
  // -- hls.js stays off pages without a player ----------------------------------------
  for (const path of ['/', '/shop', '/about-us']) {
    const { page, paths } = await watch(browser);
    await page.goto(BASE + path);
    await page.waitForSelector('main h1');
    await settle();
    assert.deepEqual(paths.filter(isMedia), [], `${path}: no hls.js and no media requests`);
    await page.close();
  }

  // -- a public camera plays live through hls.js, loaded once --------------------------
  {
    const { page, paths } = await watch(browser);
    await page.goto(BASE + '/stream/magnus');
    assert.equal(await page.innerText('main h1'), 'Watch room');
    await video(page).waitFor();
    await playing(page);
    assert.equal(await state(page), 'live');
    assert.equal(paths.filter((p) => p.startsWith(HLS)).length, 1, 'hls.js requested once');
    assert.ok(paths.includes('/fixtures/live/main-cam/index.m3u8'));
    assert.equal(await video(page).evaluate((v) => [v.muted, v.controls, v.hasAttribute('playsinline')].join()), 'true,true,true');
    assert.equal(await video(page).getAttribute('aria-label'), 'Main cam');

    // hidden tab: paused, and no fetching; back: plays again, from the live edge
    await video(page).evaluate((v) => new Promise((done) => {
      v.addEventListener('seeked', done, { once: true });
      v.currentTime = v.seekable.start(0) + 0.5;
    }));
    await setHidden(page, true);
    assert.equal(await video(page).evaluate((v) => v.paused), true, 'paused while hidden');
    const before = paths.length;
    await sleep(2500); // longer than the 2 s playlist reload
    assert.deepEqual(paths.slice(before).filter(isMedia), [], 'nothing fetched while hidden');
    await setHidden(page, false);
    await playing(page);
    const edge = await video(page).evaluate((v) => [v.currentTime, v.seekable.end(0)]);
    assert.ok(edge[0] >= edge[1] - 8, `back at the live edge (${edge})`);

    // the module is shared: a second player (another capybara) imports nothing new
    await page.evaluate(() => { history.pushState(null, '', '/stream/einstein'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForFunction(() => document.querySelector('main video')?.getAttribute('aria-label') === 'Food cam');
    await playing(page);
    assert.equal(paths.filter((p) => p.startsWith(HLS)).length, 1, 'still one hls.js request');

    // navigating away destroys the player: no more playlist or segment requests
    await page.click('footer a[href="/about-us"]');
    await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'About CapyTube');
    assert.equal(await page.locator('video').count(), 0);
    const left = paths.length;
    await sleep(3000);
    assert.deepEqual(paths.slice(left).filter(isMedia), [], 'no requests after leaving');
    await page.close();
  }

  // -- a private camera: locked panel, no video, no media request ----------------------
  for (const width of [390, 1280]) {
    const { page, paths } = await watch(browser, { viewport: { width, height: width === 390 ? 844 : 800 } });
    await page.goto(BASE + '/stream/elon');
    const locked = page.locator('[data-testid=locked-camera]');
    await locked.waitFor();
    await settle();
    const text = await locked.innerText();
    assert.match(text, /Climbing wall cam/);
    assert.match(text, /1 coin per 10 seconds/);
    assert.equal(await page.locator('main video').count(), 0);
    assert.equal(await locked.locator('button, a, input').count(), 0, 'no buttons on a locked camera');
    assert.deepEqual(paths.filter(isMedia), [], 'no media request for a private camera');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal scroll at ${width}px`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/w6-private-${width}.png`, fullPage: true });
    await page.close();
  }

  // -- screenshots of a playing camera -------------------------------------------------
  for (const width of [390, 1280]) {
    const { page } = await open('/stream/magnus', { width, height: width === 390 ? 844 : 800 });
    await video(page).waitFor();
    await playing(page);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal scroll at ${width}px`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/w6-live-${width}.png`, fullPage: true });
    await page.close();
  }

  // -- the camera is down: the reel plays, and its position survives a reload ------------
  // (a raw page: the 404 is logged to the console on purpose)
  {
    const { page, paths } = await watch(browser);
    await page.route('**/fixtures/live/main-cam/index.m3u8', (r) => r.fulfill({ status: 404, body: 'gone' }));
    await page.goto(BASE + '/stream/magnus');
    await page.waitForFunction(() => document.querySelector('[data-testid=player]')?.dataset.state === 'reel');
    assert.match(await video(page).evaluate((v) => v.currentSrc), /\/fixtures\/media\/capytube-stream\.mp4$/);
    await playing(page);
    await page.waitForFunction(() => document.querySelector('main video').currentTime > 2.5);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('main video')?.readyState >= 1);
    const resumed = await now(page);
    assert.ok(resumed >= 2, `resumed at ${resumed}s, not from the start`);
    assert.ok(paths.filter((p) => p.startsWith(HLS)).length >= 1);
    await page.close();
  }

  // -- camera and reel both down: offline, poster, no video ---------------------------
  {
    const page = await browser.newPage();
    await page.route('**/fixtures/live/main-cam/index.m3u8', (r) => r.fulfill({ status: 404, body: 'gone' }));
    await page.route('**/fixtures/media/capytube-stream.mp4', (r) => r.fulfill({ status: 404, body: 'gone' }));
    await page.goto(BASE + '/stream/magnus');
    await page.waitForFunction(() => document.querySelector('[data-testid=player]')?.dataset.state === 'offline');
    assert.equal(await page.locator('main video').count(), 0);
    assert.match(await page.innerText('.player-offline'), /offline/);
    await page.close();
  }

  // -- reduced motion: no autoplay -----------------------------------------------------
  {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(BASE + '/stream/magnus');
    await page.waitForFunction(() => document.querySelector('main video')?.readyState >= 1);
    await settle();
    assert.equal(await video(page).evaluate((v) => [v.autoplay, v.paused].join()), 'false,true');
    await page.close();
  }
}
