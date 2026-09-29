// Headless browser smoke test for the WASM front end. Not a dependency of the crate.
//
//   cd web && trunk serve --release &                       # http://127.0.0.1:8791/
//   npm i --prefix /tmp/pw playwright@1 && PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers \
//     npx --no-install --prefix /tmp/pw playwright install chromium-headless-shell
//   NODE_PATH=/tmp/pw/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers node web/tests/smoke.mjs
//
// Injects a stand-in for the 2026-09-28 WebMCP draft (document.modelContext) before the app
// loads, so the tools registered from Rust can be called. Exits non-zero on the first failure.
// Set SHOTS=<dir> to save screenshots.
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8791';
const SHOTS = process.env.SHOTS;

const FAKE_WEBMCP = () => {
  const tools = new Map();
  window.__webmcpTools = tools;
  document.modelContext = {
    registerTool(tool, opts) {
      tools.set(tool.name, tool);
      opts?.signal?.addEventListener('abort', () => tools.delete(tool.name));
      return Promise.resolve();
    },
  };
};

const browser = await chromium.launch();
const errors = [];
async function open(path, { width = 390, height = 844, init } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const logs = [];
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  page.on('console', (m) => {
    logs.push(m.text());
    if (m.type() === 'error') errors.push(`${path} console: ${m.text()}`);
  });
  if (init) await page.addInitScript(init);
  await page.goto(BASE + path);
  await page.waitForSelector('main h1');
  return { page, logs };
}
const settle = () => new Promise((r) => setTimeout(r, 300));

try {
  // -- shell on a phone ------------------------------------------------------------
  const { page, logs } = await open('/', { init: FAKE_WEBMCP });
  await page.waitForSelector('[data-testid=stream-list] li');
  assert.equal(await page.title(), 'Watch Magnus. Then pick his snack. · CapyTube');
  assert.equal(await page.isVisible('.tabbar'), true, 'tab bar shows on a phone');
  assert.equal(await page.isVisible('.nav'), false, 'top nav hides on a phone');
  assert.deepEqual(await page.$$eval('.tabbar a', (as) => as.map((a) => a.textContent)), ['Home', 'Watch', 'Play', 'Shop', 'Me']);
  assert.equal(await page.getAttribute('.tabbar a[href="/"]', 'aria-current'), 'page');
  assert.equal(await page.isVisible('.beta'), true);
  assert.equal(await page.isVisible('.account-link'), false, 'phone uses the tab bar for the account');
  const gap = await page.evaluate(() => {
    window.scrollTo({ top: 1e6, behavior: 'instant' });
    return document.querySelector('.tabbar').getBoundingClientRect().top - document.querySelector('.footer').getBoundingClientRect().bottom;
  });
  assert.ok(gap >= 0, `footer clears the tab bar (gap ${gap}px)`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-phone.png`, fullPage: true });

  // cameras: three cards, private priced, each links to its capybara's watch room
  const cards = await page.$$eval('[data-testid=stream-list] li', (els) => els.map((e) => e.innerText));
  assert.equal(cards.length, 3);
  assert.ok(cards.some((c) => c.includes('Climbing wall cam') && c.includes('1 coin / 10 s')));
  const hrefs = await page.$$eval('[data-testid=stream-list] a', (as) => as.map((a) => a.getAttribute('href')).sort());
  assert.deepEqual(hrefs, ['/stream/einstein', '/stream/elon', '/stream/magnus']);

  // -- WebMCP ------------------------------------------------------------------------
  assert.deepEqual(await page.evaluate(() => [...window.__webmcpTools.keys()].sort()), ['list_streams', 'open_page']);
  await settle();
  assert.ok(logs.includes('webmcp: 2 tool(s) registered'), 'both registrations counted');
  const ann = await page.evaluate(() => ({
    list: window.__webmcpTools.get('list_streams').annotations,
    open: window.__webmcpTools.get('open_page').annotations,
    pages: window.__webmcpTools.get('open_page').inputSchema.properties.page.enum,
  }));
  assert.equal(ann.list.readOnlyHint, true);
  assert.equal(ann.open.readOnlyHint, false, 'navigation is not read-only');
  assert.equal(ann.open.consequentialHint, false);
  assert.equal(ann.pages.length, 10);
  const listed = await page.evaluate(() => window.__webmcpTools.get('list_streams').execute({}, {}));
  for (const r of JSON.parse(listed.content[0].text)) {
    assert.deepEqual(Object.keys(r).sort(), ['access', 'id', 'live', 'price_per_10_sec', 'title'], 'no playback fields');
  }
  await page.evaluate(() => window.__webmcpTools.get('open_page').execute({ page: 'shop' }, {}));
  await page.waitForURL('**/shop');
  await page.waitForSelector('.toast');
  assert.match(await page.innerText('.toasts'), /An assistant opened Shop/);
  assert.equal(await page.title(), 'Shop · CapyTube');
  const bad = await page.evaluate(async () => {
    try { await window.__webmcpTools.get('open_page').execute({ page: 'admin' }, {}); return 'accepted'; }
    catch (e) { return String(e); }
  });
  assert.match(bad, /unknown page/);

  // -- deep links and 404 ------------------------------------------------------------
  for (const [path, title] of [['/watch', 'Watch'], ['/stream/magnus', 'Watch room'], ['/terms-of-service', 'Terms of Service']]) {
    const { page: p } = await open(path);
    assert.equal(await p.innerText('main h1'), title, path);
    await p.close();
  }
  const { page: missing } = await open('/no/such/page');
  assert.equal(await missing.innerText('main h1'), 'Page not found');

  // -- desktop: top nav, no tab bar; the play-coins dialog opens and Escape closes it --
  const { page: desk } = await open('/watch', { width: 1280, height: 800 });
  assert.equal(await desk.isVisible('.nav'), true);
  assert.equal(await desk.isVisible('.tabbar'), false);
  assert.equal(await desk.isVisible('.account-link'), true);
  assert.deepEqual(await desk.$$eval('.nav a', (as) => as.map((a) => a.textContent)), ['Home', 'Watch', 'Play', 'Shop', 'Robot']);
  assert.equal(await desk.getAttribute('.nav a[href="/watch"]', 'aria-current'), 'page');
  assert.equal(await desk.getAttribute('.nav a[href="/"]', 'aria-current'), null, 'Home is not current on /watch');
  // the skip link moves keyboard focus to <main>, so the next Tab skips the header (the router
  // intercepts link clicks, which used to leave focus on the skip link)
  await desk.keyboard.press('Tab');
  assert.equal(await desk.evaluate(() => document.activeElement.className), 'skip');
  await desk.keyboard.press('Enter');
  assert.equal(await desk.evaluate(() => document.activeElement.id), 'main', 'Enter on the skip link focuses main');
  assert.equal(await desk.evaluate(() => location.pathname), '/watch', 'the skip link does not navigate');
  await desk.keyboard.press('Tab');
  assert.equal(await desk.evaluate(() => document.activeElement.closest('header.topbar')), null, 'next Tab is past the header');
  await desk.click('text=Play coins are not money');
  await desk.waitForSelector('dialog.modal[open]');
  assert.equal(await desk.evaluate(() => document.activeElement.closest('dialog') !== null), true, 'focus moves into the dialog');
  if (SHOTS) await desk.screenshot({ path: `${SHOTS}/dialog-desktop.png` });
  await desk.keyboard.press('Escape');
  await desk.waitForSelector('dialog.modal:not([open])', { state: 'attached' });
  // reopen works after an Escape close (the open signal was reset)
  await desk.click('text=Play coins are not money');
  await desk.waitForSelector('dialog.modal[open]');
  await desk.click('dialog.modal button[type=submit]');
  await desk.waitForSelector('dialog.modal:not([open])', { state: 'attached' });

  // -- a browser that refuses registration: nothing counted --------------------------
  const { logs: refusedLogs } = await open('/', {
    init: () => { document.modelContext = { registerTool: () => Promise.reject(new Error('refused')) }; },
  });
  await settle();
  assert.ok(refusedLogs.includes('webmcp: 0 tool(s) registered'), refusedLogs.join(' | '));

  // -- a private stream with no price reads "Private" --------------------------------
  const unpriced = await browser.newPage();
  await unpriced.route('**/fixtures/streams.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ items: [{ id: 'members-cam', title: 'Members cam', access_type: 'members' }], count: 1 }),
  }));
  await unpriced.goto(BASE + '/');
  await unpriced.waitForSelector('[data-testid=stream-list] li');
  const card = await unpriced.innerText('[data-testid=stream-list] li');
  assert.match(card, /Private/);
  assert.doesNotMatch(card, /0 coin/);

  // -- without WebMCP the app still works ------------------------------------------------
  const { page: plain } = await open('/');
  await plain.waitForSelector('[data-testid=stream-list] li');
  assert.equal(await plain.evaluate(() => 'modelContext' in document), false);

  // -- per-page checks: tests/pages/*.mjs, one file per page, so page tasks built in parallel
  // never edit this file. Each exports `check(ctx)` and throws on failure.
  const pagesDir = new URL('./pages/', import.meta.url);
  const pageFiles = (await readdir(pagesDir).catch(() => [])).filter((f) => f.endsWith('.mjs')).sort();
  for (const f of pageFiles) {
    const { check } = await import(new URL(f, pagesDir));
    await check({ open, browser, settle, BASE, SHOTS, FAKE_WEBMCP });
  }

  assert.deepEqual(errors, [], 'no page or console errors');
  console.log(`smoke: ok (${pageFiles.length} page file(s))`);
} finally {
  await browser.close();
}
