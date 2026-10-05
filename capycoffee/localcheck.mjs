// Serves the build like the planned CloudFront (IndexFunction + 404 page) on 127.0.0.1 and walks it headless.
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { createRequire } from 'module'; import { extname, join } from 'node:path';
const ROOT = process.argv[2] ?? `${process.env.HOME}/.cache/capycoffee/out20260908`;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
// The template's own IndexFunction decides every request, as CloudFront would.
const tpl = await readFile(new URL('infra/template.yaml', import.meta.url), 'utf8');
const fnCode = tpl.slice(tpl.indexOf('\n  IndexFunction:\n')).match(/FunctionCode: \|\n((?: {8}.*\n|\n)+)/)[1];
const edge = new Function(`${fnCode}\nreturn handler;`)();
const srv = http.createServer(async (q, s) => {
  const url = new URL(q.url, 'http://x'), qs = {};
  for (const [k, v] of url.searchParams) qs[k] = { value: v };
  const out = edge({ request: { uri: url.pathname, headers: {}, querystring: qs } });
  if (out.statusCode) { s.writeHead(out.statusCode, { location: out.headers.location.value }); return s.end(); }
  const u = decodeURIComponent(out.uri);
  try { const b = await readFile(join(ROOT, u)); s.writeHead(200, { 'content-type': T[extname(u)] ?? 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404, { 'content-type': 'text/html' }); s.end(await readFile(join(ROOT, '404.html'))); }
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const B = `http://127.0.0.1:${srv.address().port}`;
const PW = `${process.env.HOME}/.cache/capyweb/pw/`; process.env.PLAYWRIGHT_BROWSERS_PATH ??= `${PW}browsers`;
const pw = createRequire(PW)('playwright');
const b = await pw.chromium.launch(); let bad = 0;
for (const [name, opts] of [['phone', pw.devices['iPhone 15']], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
  const p = await (await b.newContext(opts)).newPage(); const errs = [], fails = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 80))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 80)));
  p.on('response', (r) => r.status() >= 400 && !r.url().includes('/nope') && fails.push(`${r.status()} ${new URL(r.url()).pathname}`));
  for (const path of ['/', '/about/', '/roast/', '/about', '/order/thanks/', '/nope']) {
    const before = errs.length;
    const r = await p.goto(B + path, { waitUntil: 'networkidle' });
    const h1 = await p.evaluate(() => document.querySelector('h1')?.innerText?.trim() ?? '');
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const ok = (path === '/nope' ? r.status() === 404 : r.status() === 200) && h1 && over <= 0;
    if (path === '/nope') errs.length = before; // the deliberate 404 logs one console error
    if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${path} -> ${new URL(p.url()).pathname} ${r.status()} h1="${h1.slice(0, 40)}" overflow=${over}`);
  }
  // Mock order: pick options, submit, land on the thanks page (nothing leaves the browser).
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  const sent = []; p.on('request', (q) => !q.url().startsWith(B) && sent.push(q.url()));
  for (const n of ['roastProfileId', 'roastLevel', 'bagSizeId']) await p.locator(`input[name=${n}]`).first().check({ force: true }).catch(() => {});
  await p.locator('form button[type=submit], form button:not([type=button])').last().click();
  await p.waitForURL(/order\/thanks/, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(800);
  const t = await p.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const ok = /order\/thanks/.test(p.url()) && sent.length === 0;
  if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} mock order -> ${new URL(p.url()).pathname}; external requests ${sent.length}; "${t.replace(/\s+/g, ' ').slice(0, 90)}"`);
  if (errs.length || fails.length) { bad++; console.log(`FAIL ${name} errors=${JSON.stringify(errs.slice(0, 3))} failed=${JSON.stringify(fails.slice(0, 3))}`); }
}
await b.close(); srv.close(); console.log(bad ? `${bad} FAIL` : 'all ok'); process.exit(bad ? 1 : 0);
