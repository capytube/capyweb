// W6 follow-ups (W14): a paid camera whose media misbehaves, from review rv-1790683988-53300.
// Nothing is bought while the picture is not moving; media that stops coming is failed by the
// player's 15 s watchdog and gets one fresh start, on the same cookies while they last (the W14 dev
// check found a late stall paid a second minute for it); a slow server that is still answering is
// not a hang; a fresh start rescues a hang that clears; and a refused autoplay costs nothing more
// until the viewer presses play. Each case has its own context and fake API (w6paid.mjs), and
// the cases run at the same time. The paid playlist is 4 segments of 2 s (fixtures/paid/wall-cam).
import assert from 'node:assert/strict';
import { fakeCognito, configuredContext } from './auth.mjs';
import { fakeApi } from './w6paid.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MEDIA = '**/fixtures/paid/wall-cam/**';
const VIDEO = '[data-testid=locked-camera] video';
const GAVE_UP = 'The recording would not play, so nothing more will be charged.';

async function until(cond, what, ms) {
  for (let t = 0; !cond(); t += 50) {
    assert.ok(t < ms, `timed out waiting for ${what}`);
    await sleep(50);
  }
}

async function signedIn(browser, BASE) {
  const cognito = fakeCognito(BASE);
  const { context, errors } = await configuredContext(browser, BASE, cognito, { meFirst401: false });
  const api = await fakeApi(context, cognito);
  const page = await context.newPage();
  await page.goto(`${BASE}/stream/elon`);
  await page.click('[data-testid=paid-sign-in]');
  await page.waitForURL(`${BASE}/auth/callback**`);
  await page.waitForURL(`${BASE}/stream/elon`);
  await page.locator('[data-testid=paid-watch]').waitFor();
  const gaveUp = () => page.getByText(GAVE_UP).count();
  const start = async () => {
    await page.click('[data-testid=paid-watch]');
    await page.click('[data-testid=paid-start]');
    await page.locator(VIDEO).waitFor();
  };
  const moved = (timeout = 15000) => page.waitForFunction((sel) => document.querySelector(sel)?.currentTime > 0.5, VIDEO, { timeout });
  const done = async (held = []) => {
    await Promise.all(held.map((route) => route.abort().catch(() => {})));
    assert.deepEqual(errors, [], 'no page errors');
    assert.deepEqual(cognito.log.problems, [], 'every request the fakes saw was valid');
    await context.close();
  };
  return { api, page, context, gaveUp, start, moved, done };
}

// Plays the first segment, then every later one hangs: the picture stalls at 2 s. The 5 s renewal
// falls inside the stall and waits; the watchdog fails the player; the fresh start buys nothing and
// resumes where the picture stopped, which still hangs, so it gives up. One minute in all.
async function stall(browser, BASE) {
  const s = await signedIn(browser, BASE);
  const held = [];
  await s.context.route(MEDIA, (route) => {
    if (!/seg00[1-9]/.test(route.request().url())) return route.fallback();
    held.push(route);
  });
  await s.start();
  await s.moved();
  await s.page.waitForFunction((sel) => {
    const v = document.querySelector(sel);
    return v && v.currentTime >= 1.5 && v.readyState < 3 && !v.paused;
  }, VIDEO, { timeout: 10000 });
  const atStall = s.api.posts.length;
  await s.page.locator(VIDEO).evaluate((v) => { v.dataset.old = '1'; }); // tells the fresh start's apart
  await sleep(8000); // past the 5 s renewal
  assert.equal(s.api.posts.length, atStall, 'nothing bought while the picture is stalled');
  // Not an hls.js quirk: the fresh start resumes at the saved position, where the media hangs.
  const fresh = `${VIDEO}:not([data-old])`;
  await s.page.locator(fresh).waitFor({ timeout: 20000 });
  assert.equal(s.api.posts.length, atStall, 'the fresh start reuses the cookies: nothing bought');
  await s.page.waitForFunction((sel) => {
    const v = document.querySelector(sel);
    return v && v.readyState >= 1 && v.currentTime >= 1.5;
  }, fresh, { timeout: 10000 });
  assert.equal(await s.page.locator(fresh).evaluate((v) => v.played.length > 0 && v.played.start(0) < 1), false,
    'the fresh start resumed where the picture stopped, not from the beginning');
  await s.page.getByText(GAVE_UP).waitFor({ timeout: 30000 });
  assert.equal(s.api.posts.length, atStall, 'then no more buying');
  await sleep(6000);
  assert.equal(s.api.posts.length, atStall, 'nothing bought after giving up');
  await s.done(held);
}

// Every media request hangs until the fresh start's player appears; then the media answers
// (what was held included). The fresh start plays, the renewals carry on, and nothing gives up.
async function rescue(browser, BASE) {
  const s = await signedIn(browser, BASE);
  let held = [];
  await s.context.route(MEDIA, (route) => (held ? held.push(route) : route.fallback()));
  await s.start();
  await s.page.locator(VIDEO).evaluate((v) => { v.dataset.old = '1'; });
  await s.page.locator(`${VIDEO}:not([data-old])`).waitFor({ timeout: 25000 });
  assert.equal(s.api.posts.length, 1, 'the fresh start reuses the cookies: nothing bought');
  const waiting = held;
  held = null;
  await Promise.all(waiting.map((route) => route.fallback().catch(() => {})));
  await s.moved(15000);
  await until(() => s.api.posts.length === 2, 'the next minute once the picture moves', 10000);
  assert.equal(await s.gaveUp(), 0, 'the fresh start rescued it');
  await s.page.click('[data-testid=paid-stop]');
  await s.done();
}

// Every media request takes 6 s: the first picture comes after about 24 s (playlist, rendition,
// init, first segment), past the watchdog's 15 s, but media kept arriving, so nothing fails.
async function slow(browser, BASE) {
  const s = await signedIn(browser, BASE);
  let open = true;
  await s.context.route(MEDIA, async (route) => {
    await sleep(6000);
    if (open) await route.fallback().catch(() => {});
  });
  const t0 = Date.now();
  await s.start();
  await s.moved(40000);
  const took = Date.now() - t0;
  assert.ok(took > 16000, `the first picture came after the watchdog's 15 s (${took} ms)`);
  assert.equal(await s.gaveUp(), 0, 'a slow server is not a hang');
  assert.equal(s.api.posts.length, 1, 'no fresh start was needed');
  await until(() => s.api.posts.length === 2, 'the next minute once the picture moves', 10000);
  await s.page.click('[data-testid=paid-stop]');
  open = false;
  await s.done();
}

// A browser that refuses autoplay: the autoplay attribute does nothing (in Chromium overriding
// play() alone is not enough, it has its own path) and play() without a gesture rejects with
// NotAllowedError and fires no play event. The picture waits, paused, costing nothing more and
// never failed; the viewer's play buys the next minute.
async function refused(browser, BASE) {
  const s = await signedIn(browser, BASE);
  await s.page.evaluate(() => {
    const P = HTMLMediaElement.prototype;
    window.__play = P.play;
    Object.defineProperty(P, 'autoplay', { configurable: true, get: () => true, set: () => {} });
    P.play = () => Promise.reject(new DOMException('play() needs a user gesture', 'NotAllowedError'));
  });
  await s.start();
  await s.page.waitForFunction((sel) => document.querySelector(sel)?.readyState >= 1, VIDEO);
  await sleep(17000); // past the 5 s renewal and the 15 s watchdog
  assert.equal(s.api.posts.length, 1, 'no renewal while the picture waits for play');
  assert.equal(await s.page.locator(VIDEO).evaluate((v) => v.paused), true);
  assert.equal(await s.gaveUp(), 0, 'a refused autoplay is not a failure');
  await s.page.locator(VIDEO).evaluate((v) => window.__play.call(v));
  await until(() => s.api.posts.length === 2, 'the next minute once it plays', 8000);
  assert.equal(await s.gaveUp(), 0);
  await s.page.click('[data-testid=paid-stop]');
  await s.done();
}

export async function check({ browser, BASE }) {
  const cases = { stall, rescue, slow, refused };
  const results = await Promise.allSettled(Object.values(cases).map((c) => c(browser, BASE)));
  const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [`${Object.keys(cases)[i]}: ${r.reason?.stack ?? r.reason}`] : []));
  assert.deepEqual(failed, [], 'every media case passes');
}
