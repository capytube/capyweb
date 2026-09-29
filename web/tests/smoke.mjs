// Headless browser smoke test for the WASM prototype. Not a dependency of the crate.
//
//   cd web && trunk serve --release &                       # http://127.0.0.1:8791/
//   npm i --prefix /tmp/pw playwright@1 && PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers \
//     npx --no-install --prefix /tmp/pw playwright install chromium-headless-shell
//   NODE_PATH=/tmp/pw/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers node web/tests/smoke.mjs
//
// Injects a stand-in for the 2026-09-28 WebMCP draft (document.modelContext) before the app
// loads, so the tools registered from Rust can be called. Exits non-zero on the first failure.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8791';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const logs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  await page.addInitScript(() => {
    const tools = new Map();
    window.__webmcpTools = tools;
    document.modelContext = {
      registerTool(tool, opts) {
        tools.set(tool.name, tool);
        opts?.signal?.addEventListener('abort', () => tools.delete(tool.name));
        return Promise.resolve();
      },
    };
  });

  await page.goto(BASE + '/');
  await page.waitForSelector('[data-testid=stream-list] li');
  const cards = await page.$$eval('[data-testid=stream-list] li', (els) => els.map((e) => e.innerText));
  assert.equal(cards.length, 3, 'three cameras listed');
  assert.ok(cards.some((c) => c.includes('Climbing wall cam') && c.includes('1 coin / 10 s')), 'private stream shows its price');

  const names = await page.evaluate(() => [...window.__webmcpTools.keys()].sort());
  assert.deepEqual(names, ['list_streams', 'open_stream']);
  const annotations = await page.evaluate(() => window.__webmcpTools.get('list_streams').annotations);
  assert.equal(annotations.readOnlyHint, true);
  const nav = await page.evaluate(() => window.__webmcpTools.get('open_stream').annotations);
  assert.equal(nav.readOnlyHint, false, 'navigation is not read-only');
  assert.equal(nav.consequentialHint, false);
  await page.waitForFunction(() => true);
  assert.ok(logs.includes('webmcp: 2 tool(s) registered'), 'both registrations counted');

  const listed = await page.evaluate(() => window.__webmcpTools.get('list_streams').execute({}, {}));
  const rows = JSON.parse(listed.content[0].text);
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.deepEqual(Object.keys(r).sort(), ['access', 'id', 'live', 'price_per_10_sec', 'title'], 'tool output carries no playback fields');
  }

  await page.evaluate(() => window.__webmcpTools.get('open_stream').execute({ id: 'wall-cam' }, {}));
  await page.waitForURL('**/streams/wall-cam');
  await page.waitForSelector('main h1');
  assert.match(await page.innerText('main'), /Sign in and pay to watch this camera/);

  const bad = await page.evaluate(async () => {
    try { await window.__webmcpTools.get('open_stream').execute({ id: '../admin' }, {}); return 'accepted'; }
    catch (e) { return String(e); }
  });
  assert.match(bad, /invalid stream id/);

  // A browser that refuses registration: nothing may be counted as registered.
  const refusing = await browser.newPage();
  const refusedLogs = [];
  refusing.on('console', (m) => refusedLogs.push(m.text()));
  await refusing.addInitScript(() => {
    document.modelContext = { registerTool: () => Promise.reject(new Error('refused')) };
  });
  await refusing.goto(BASE + '/');
  await refusing.waitForSelector('[data-testid=stream-list] li');
  await refusing.waitForFunction(() => true);
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(refusedLogs.includes('webmcp: 0 tool(s) registered'), 'rejected registrations are not counted: ' + refusedLogs.join(' | '));

  // A private stream with no price reads "Private", never "0 coin".
  const unpriced = await browser.newPage();
  await unpriced.route('**/fixtures/streams.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ items: [{ id: 'members-cam', title: 'Members cam', access_type: 'members' }], count: 1 }),
  }));
  await unpriced.goto(BASE + '/');
  await unpriced.waitForSelector('[data-testid=stream-list] li');
  const unpricedCard = await unpriced.innerText('[data-testid=stream-list] li');
  assert.match(unpricedCard, /Private/);
  assert.doesNotMatch(unpricedCard, /0 coin/);

  const plain = await browser.newPage();
  await plain.goto(BASE + '/');
  await plain.waitForSelector('[data-testid=stream-list] li');
  assert.equal(await plain.evaluate(() => 'modelContext' in document), false, 'no WebMCP host, app still works');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('smoke: ok');
} finally {
  await browser.close();
}
