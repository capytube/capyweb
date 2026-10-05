// Screenshot test for capyweb-z9w: serves a build through the template's own IndexFunction on
// 127.0.0.1 and, at five widths, checks that the home page's hero picture covers no text, that
// "Learn more" is visible and clickable, and that nothing scrolls sideways; saves a screenshot of
// the hero card per width.   node hero_test.mjs <build dir> [screenshot dir]
import http from 'node:http'; import { readFile, mkdir } from 'node:fs/promises'; import { createRequire } from 'module'; import { extname, join } from 'node:path';
const ROOT = process.argv[2], SHOTS = process.argv[3];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const tpl = await readFile(new URL('infra/template.yaml', import.meta.url), 'utf8');
const edge = new Function(`${tpl.slice(tpl.indexOf('\n  IndexFunction:\n')).match(/FunctionCode: \|\n((?: {8}.*\n|\n)+)/)[1]}\nreturn handler;`)();
const srv = http.createServer(async (q, s) => {
  const out = edge({ request: { uri: new URL(q.url, 'http://x').pathname, headers: {}, querystring: {} } });
  if (out.statusCode) { s.writeHead(out.statusCode, { location: out.headers.location.value }); return s.end(); }
  try { const b = await readFile(join(ROOT, decodeURIComponent(out.uri))); s.writeHead(200, { 'content-type': T[extname(out.uri)] ?? 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404, { 'content-type': 'text/html' }); s.end(await readFile(join(ROOT, '404.html'))); }
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const B = `http://127.0.0.1:${srv.address().port}`;
const PW = `${process.env.HOME}/.cache/capyweb/pw/`; process.env.PLAYWRIGHT_BROWSERS_PATH ??= `${PW}browsers`;
const pw = createRequire(PW)('playwright');
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const b = await pw.chromium.launch(); let bad = 0;
for (const [n, o] of [['iphone-se', pw.devices['iPhone SE']], ['iphone-15', pw.devices['iPhone 15']], ['tablet-768', { viewport: { width: 768, height: 1024 } }], ['desktop-1280', { viewport: { width: 1280, height: 800 } }], ['wide-1920', { viewport: { width: 1920, height: 1080 } }]]) {
  const p = await (await b.newContext(o)).newPage(); await p.goto(B + '/', { waitUntil: 'networkidle' });
  const d = await p.evaluate(() => {
    const card = document.querySelector('h1').closest('div.relative.isolate'); const img = card.lastElementChild; const ib = img.getBoundingClientRect();
    let worst = 0;
    for (const t of card.querySelectorAll('h1,p,a,span')) {
      if (img.contains(t) || !t.textContent.trim()) continue;
      const r = t.getBoundingClientRect(); const v = Math.min(r.bottom, ib.bottom) - Math.max(r.top, ib.top), h = Math.min(r.right, ib.right) - Math.max(r.left, ib.left);
      if (v > 0 && h > 0) worst = Math.max(worst, Math.round(v));
    }
    // "Learn more" must be the topmost element at its own centre once scrolled into view.
    const a = [...card.querySelectorAll('a')].find((x) => /learn more/i.test(x.textContent)); a.scrollIntoView({ block: 'center', behavior: 'instant' });
    const ar = a.getBoundingClientRect(); const top = document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2);
    return { worst, imgShown: ib.height > 100, learnClickable: !!top && a.contains(top), over: document.documentElement.scrollWidth - innerWidth };
  });
  const ok = d.worst === 0 && d.imgShown && d.learnClickable && d.over <= 0; if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n} overlap=${d.worst}px picture=${d.imgShown} learn-more-clickable=${d.learnClickable} sideways=${d.over}px`);
  if (SHOTS) await p.locator('h1').evaluate((h) => h.closest('div.relative.isolate').scrollIntoView()).then(() => p.locator('div.relative.isolate').first().screenshot({ path: join(SHOTS, `hero-${n}.png`) }));
}
await b.close(); srv.close(); console.log(bad ? `${bad} FAIL` : 'all ok'); process.exit(bad ? 1 : 0);
