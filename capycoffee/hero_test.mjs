// Hero test for the Capy Roast redesign (nic order #4097; was the capyweb-z9w test): serves a build through the
// template's own IndexFunction on 127.0.0.1 and, at five widths, checks that the hero is edge to edge with the headline
// on the picture, that the gallery layer sits exactly on the card with its GENERATED CONCEPT IMAGE label, that nothing
// shifted while the page loaded (CLS 0), that "Learn more" and the order button are visible and clickable, and that
// nothing scrolls sideways, and that the picture still fills the card after a scroll. Then: reduced motion never advances the picture, in-site navigation away removes the
// gallery and back home brings exactly one, and no page logs an error. Saves a screenshot of the hero per width.
//   node hero_test.mjs <build dir | https URL of a deployed site> [screenshot dir]
import http from 'node:http'; import { readFile, mkdir } from 'node:fs/promises'; import { createRequire } from 'module'; import { extname, join } from 'node:path';
const ROOT = process.argv[2], SHOTS = process.argv[3], LIVE = /^https:\/\//.test(ROOT);
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const tpl = await readFile(new URL('infra/template.yaml', import.meta.url), 'utf8');
const edge = new Function(`${tpl.slice(tpl.indexOf('\n  IndexFunction:\n')).match(/FunctionCode: \|\n((?: {8}.*\n|\n)+)/)[1]}\nreturn handler;`)();
const srv = http.createServer(async (q, s) => {
  const out = edge({ request: { uri: new URL(q.url, 'http://x').pathname, headers: {}, querystring: {} } });
  if (out.statusCode) { s.writeHead(out.statusCode, { location: out.headers.location.value }); return s.end(); }
  try { const b = await readFile(join(ROOT, decodeURIComponent(out.uri))); s.writeHead(200, { 'content-type': T[extname(out.uri)] ?? 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404, { 'content-type': 'text/html' }); s.end(await readFile(join(ROOT, '404.html'))); }
});
if (!LIVE) { srv.listen(0, '127.0.0.1'); await new Promise((r) => srv.on('listening', r)); }
const B = LIVE ? ROOT.replace(/\/$/, '') : `http://127.0.0.1:${srv.address().port}`;
const PW = `${process.env.HOME}/.cache/capyweb/pw/`; process.env.PLAYWRIGHT_BROWSERS_PATH ??= `${PW}browsers`;
const pw = createRequire(PW)('playwright');
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const b = await pw.chromium.launch(); let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`); };
const watch = (p) => { const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 90))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 90))); return errs; };
// Mean brightness (0-255) of a band of the hero card, 55%-75% down, as the viewport shows it now. The whole viewport is
// captured (a clipped capture re-renders the region and can hide a painting fault) and decoded in the page.
const band = async (p) => {
  const png = (await p.screenshot()).toString('base64');
  return p.evaluate(async (src) => {
    const c0 = document.querySelector('main h1').closest('div.relative.isolate').getBoundingClientRect(), k = devicePixelRatio;
    const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(Math.round(c0.x * k), Math.round((c0.y + c0.height * 0.55) * k), Math.round(c0.width * k), Math.round(c0.height * 0.2 * k)).data;
    let t = 0; for (let n = 0; n < d.length; n += 4) t += (d[n] + d[n + 1] + d[n + 2]) / 3; return Math.round(t / (d.length / 4)); }, `data:image/png;base64,${png}`);
};
const CLS = () => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); };

for (const [n, o] of [['iphone-se', pw.devices['iPhone SE']], ['iphone-15', pw.devices['iPhone 15']], ['tablet-768', { viewport: { width: 768, height: 1024 } }], ['desktop-1280', { viewport: { width: 1280, height: 800 } }], ['wide-1920', { viewport: { width: 1920, height: 1080 } }]]) {
  const ctx = await b.newContext(o); await ctx.addInitScript(CLS); const p = await ctx.newPage(); const errs = watch(p);
  await p.goto(B + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  if (SHOTS) await p.screenshot({ path: join(SHOTS, `hero-${n}.png`) });   // before anything scrolls
  const d = await p.evaluate(() => {
    const card = document.querySelector('h1').closest('div.relative.isolate'), cr = card.getBoundingClientRect(), hr = document.querySelector('h1').getBoundingClientRect();
    const layers = document.querySelectorAll('body > .rr-gallery'), lr = layers[0]?.getBoundingClientRect();
    const label = layers[0]?.querySelector('.render-label'), lab = label?.getBoundingClientRect();
    const a = [...card.querySelectorAll('a')].find((x) => /learn more/i.test(x.textContent)); a.scrollIntoView({ block: 'center', behavior: 'instant' }); const ar = a.getBoundingClientRect();
    const top = document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2);
    const near = (x, y) => Math.abs(x - y) <= 1;
    return { edge: near(cr.left, 0) && near(cr.width, document.documentElement.clientWidth), height: Math.round(cr.height),
      onPicture: hr.top >= cr.top && hr.bottom <= cr.bottom, layers: layers.length,
      onCard: !!lr && near(lr.top, cr.top) && near(lr.left, cr.left) && near(lr.width, cr.width) && near(lr.height, cr.height),
      label: label?.textContent === 'GENERATED CONCEPT IMAGE' && lab.width > 0 && lab.top >= cr.top && lab.bottom <= cr.bottom,
      learn: !!top && a.contains(top), cls: Math.round(window.__cls * 1e4) / 1e4, over: document.documentElement.scrollWidth - innerWidth };
  });
  say(d.edge && d.height >= 480 && d.onPicture && d.layers === 1 && d.onCard && d.label && d.learn && d.cls === 0 && d.over <= 0,
    `${n} edge=${d.edge} height=${d.height}px headline-on-picture=${d.onPicture} gallery=${d.layers} on-card=${d.onCard} label=${d.label} learn-more-clickable=${d.learn} cls=${d.cls} sideways=${d.over}px`);
  // The picture still fills the card after a scroll (b520838: WebGL left the lower hero dark).
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); const lit = await band(p);
  await p.evaluate(() => scrollTo(0, 200)); await p.waitForTimeout(600); const lit2 = await band(p);
  say(lit2 >= lit * 0.7, `${n} hero picture after a 200px scroll: brightness ${lit} -> ${lit2}`);
  const btn = p.locator('#order button[type=submit]'); await btn.scrollIntoViewIfNeeded();
  const o2 = await btn.evaluate((x) => { const r = x.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { click: !!t && x.contains(t), text: x.textContent.trim(), top: t ? `${t.tagName}.${String(t.className).slice(0, 60)}` : 'none' }; });
  say(o2.click && /^Order whole beans/.test(o2.text), `${n} order button clickable="${o2.click}" text="${o2.text}"${o2.click ? '' : ` covered-by=${o2.top}`}`);
  if (SHOTS) await p.screenshot({ path: join(SHOTS, `order-${n}.png`) });
  say(errs.length === 0, `${n} console errors ${JSON.stringify(errs.slice(0, 3))}`);
  await ctx.close();
}

// Reduced motion: the picture never changes by itself.
{ const ctx = await b.newContext({ ...pw.devices['iPhone 15'], reducedMotion: 'reduce' }); const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' }); const a = await p.evaluate(() => document.querySelector('.rr-gallery .morph-slide.is-active')?.alt);
  await p.waitForTimeout(7500); const z = await p.evaluate(() => document.querySelector('.rr-gallery .morph-slide.is-active')?.alt);
  say(!!a && a === z, `reduced motion: picture stays ("${(z || '').slice(0, 50)}")`); await ctx.close(); }

// In-site navigation: About (no gallery, its picture band), back home (one gallery on the card), Roast, home again.
{ const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); const errs = watch(p);
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  const count = () => p.evaluate(() => document.querySelectorAll('body > .rr-gallery').length);
  const steps = [['header nav a[href="/about/"]', /\/about\/$/, 0], ['header nav a[href="/"]', /\/$/, 1], ['header nav a[href="/roast/"]', /\/roast\/$/, 0], ['header nav a[href="/"]', /\/$/, 1]];
  for (const [sel, url, want] of steps) {
    await p.locator(sel).first().click(); await p.waitForURL(url); await p.waitForTimeout(700);
    const c = await count(); say(c === want, `navigate to ${new URL(p.url()).pathname}: galleries=${c} (want ${want})`);
  }
  say(errs.length === 0, `navigation console errors ${JSON.stringify(errs.slice(0, 3))}`); await ctx.close(); }

await b.close(); srv.close?.(); console.log(bad ? `${bad} FAIL` : 'all ok'); process.exit(bad ? 1 : 0);
