#!/usr/bin/env node
// The live checks: the "+5 minutes" test after the apex switch (docs/RELEASE_PLAN.md, "For G3" and
// section 5, stage 3), and the same test on dev or on the dark production distribution.
//
//   node scripts/live-checks.mjs prod                    after D2: by public DNS
//   node scripts/live-checks.mjs prod --via dxxxx.cloudfront.net
//                                                        before D2: through a resolver mapping, as the
//                                                        dark test does (curl --connect-to, Chromium
//                                                        --host-resolver-rules); the DNS checks are skipped
//   node scripts/live-checks.mjs dev                     dev.capytube.xyz by its public DNS
//   ... --alarms                                         also print the by-hand AWS checks: the stage's
//                                                        alarms, and (prod) the contact mail rule
//                                                        (printed, never run)
//
// Signed out and read-only: GET and HEAD only, no sign-in, no form submitted, no POST. It needs no
// credentials. Headless Chromium comes from $CAPYWEB_PW_DIR (default ~/.cache/capyweb/pw), as for
// scripts/web-checks.sh. One line per check (ok, FAIL or skip, what, the evidence), then the counts.
// Exit status 1 on any FAIL.
//
// What each stage should serve comes from this checkout: infra/site/stages.json (the names),
// infra/site/headers-<stage>.json (every security header, the CSP exactly, and the stage's Cognito
// origin), web/src/routes.rs and web/sitemap.xml (the routes), and web/assets (files the deployed
// build must carry, so a bucket holding an older build fails here).
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lookup, Resolver } from 'node:dns/promises';
import { connect as tlsConnect } from 'node:tls';
import { join, relative } from 'node:path';

const run = promisify(execFile);
const ROOT = new URL('..', import.meta.url).pathname;
const t0 = Date.now();

// -- Arguments --------------------------------------------------------------------------------------
const USAGE = 'usage: node scripts/live-checks.mjs <dev|prod> [--via <dxxxx.cloudfront.net>] [--alarms]';
const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); process.exit(0); }
const STAGE = argv[0];
let VIA = null; let ALARMS = false;
for (let i = 1; i < argv.length; i++) {
  if (argv[i] === '--via') VIA = argv[++i];
  else if (argv[i] === '--alarms') ALARMS = true;
  else { console.error(`live-checks: unknown argument '${argv[i]}'\n${USAGE}`); process.exit(2); }
}
const stages = JSON.parse(readFileSync(join(ROOT, 'infra/site/stages.json'), 'utf8'));
if (!stages[STAGE]) { console.error(`live-checks: no stage '${STAGE ?? ''}' in infra/site/stages.json\n${USAGE}`); process.exit(2); }
if (VIA !== null && !/^d[a-z0-9]+\.cloudfront\.net$/.test(VIA)) {
  console.error(`live-checks: --via takes a distribution's own name (dxxxx.cloudfront.net)\n${USAGE}`); process.exit(2);
}
const DOMAIN = stages[STAGE].domain;
const WWW = stages[STAGE].www || '';
const SITE = `https://${DOMAIN}`;

const headersPolicy = JSON.parse(readFileSync(join(ROOT, `infra/site/headers-${STAGE}.json`), 'utf8')).SecurityHeadersConfig;
const CSP = headersPolicy.ContentSecurityPolicy.ContentSecurityPolicy;
const COGNITO = (CSP.match(/https:\/\/[a-z0-9-]+\.auth\.[a-z0-9-]+\.amazoncognito\.com/g) ?? [])[0];
const hsts = headersPolicy.StrictTransportSecurity;
const WANT_HEADERS = {
  'content-security-policy': CSP,
  'strict-transport-security': `max-age=${hsts.AccessControlMaxAgeSec}` +
    (hsts.IncludeSubdomains ? '; includeSubDomains' : '') + (hsts.Preload ? '; preload' : ''),
  'x-content-type-options': 'nosniff',
  'x-frame-options': headersPolicy.FrameOptions.FrameOption,
  'referrer-policy': headersPolicy.ReferrerPolicy.ReferrerPolicy,
};
// The tool names only the webmcp feature compiles in; the same list as scripts/build-release.sh.
const TOOL_NAMES = ['cast_vote', 'list_streams', 'get_my_account'];

// -- Output -----------------------------------------------------------------------------------------
const counts = { ok: 0, FAIL: 0, skip: 0 };
const line = (kind, what, evidence = '') => {
  counts[kind]++;
  const tag = { ok: '\x1b[32mok  \x1b[0m', FAIL: '\x1b[31mFAIL\x1b[0m', skip: '\x1b[33mskip\x1b[0m' }[kind];
  const plain = process.stdout.isTTY ? tag : kind.padEnd(4);
  console.log(`${plain}  ${what}${evidence ? ` | ${evidence}` : ''}`);
};
const check = (cond, what, evidence) => line(cond ? 'ok' : 'FAIL', what, evidence);
const skip = (what, why) => line('skip', what, why);
const short = (s, n = 120) => { s = String(s ?? '').replace(/\s+/g, ' '); return s.length > n ? `${s.slice(0, n)}...` : s; };
// A section that throws is one FAIL, and the other sections still run.
async function section(name, fn) {
  try { await fn(); } catch (e) { line('FAIL', `${name}: stopped`, short(e.message, 200)); }
}

// -- HTTP through curl: --connect-to gives the mapping that --via needs, with the real name in TLS
// and Host. No redirects are followed, so each answer is the edge's own.
async function http(url, { head = false } = {}) {
  const host = new URL(url).hostname;
  const args = ['-sS', '--max-time', '30', '--compressed', '-D', '-', '-o', '-'];
  if (head) args.push('-I');
  if (VIA) args.push('--connect-to', `${host}:443:${VIA}:443`);
  args.push(url);
  const { stdout } = await run('curl', args, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  const split = stdout.indexOf('\r\n\r\n');
  const head_ = stdout.subarray(0, split < 0 ? stdout.length : split).toString('latin1');
  const body = split < 0 ? Buffer.alloc(0) : stdout.subarray(split + 4);
  const [statusLine, ...lines] = head_.split('\r\n');
  const h = {};
  for (const l of lines) { const i = l.indexOf(':'); if (i > 0) h[l.slice(0, i).toLowerCase()] = l.slice(i + 1).trim(); }
  return { status: Number(statusLine.split(' ')[1]), h, body, text: () => body.toString('utf8') };
}
const headerDiffs = (h) => Object.entries(WANT_HEADERS)
  .filter(([k, v]) => h[k] !== v).map(([k]) => `${k}: ${short(h[k] ?? '(missing)', 60)}`);

// -- 1. DNS and the certificate ---------------------------------------------------------------------
await section('DNS', async () => {
  const names = [DOMAIN, ...(WWW ? [WWW] : [])];
  if (VIA) {
    skip('DNS: the names resolve, with A and AAAA', `--via ${VIA} maps them instead`);
  } else {
    // Public resolvers, so a local cache or a VPN resolver does not answer for the world.
    const pub = new Resolver({ timeout: 5000, tries: 2 }); pub.setServers(['1.1.1.1', '8.8.8.8']);
    const ask = (fn, n) => fn.call(pub, n).then((a) => a, (e) => { if (['ENODATA', 'ENOTFOUND'].includes(e.code)) return []; throw e; });
    for (const n of names) {
      const sys = await lookup(n, { all: true }).then((a) => a.map((x) => x.address), () => []);
      check(sys.length > 0, `DNS: ${n} resolves on this machine`, sys.length ? `${sys.length} addresses, ${sys[0]}` : 'no answer');
      const a = await ask(pub.resolve4, n); const aaaa = await ask(pub.resolve6, n);
      check(a.length > 0, `DNS: ${n} has A records (1.1.1.1, 8.8.8.8)`, a.join(' ') || 'none');
      check(aaaa.length > 0, `DNS: ${n} has AAAA records`, aaaa.slice(0, 2).join(' ') + (aaaa.length > 2 ? ` +${aaaa.length - 2}` : '') || 'none');
    }
  }
  for (const n of names) {
    const cert = await new Promise((res, rej) => {
      const s = tlsConnect({ host: VIA ?? n, servername: n, port: 443, timeout: 15000 }, () => {
        const c = s.getPeerCertificate(); s.end(); res(c);
      });
      s.on('error', rej); s.on('timeout', () => { s.destroy(); rej(new Error(`TLS to ${n} timed out`)); });
    });
    const sans = (cert.subjectaltname ?? '').split(', ').map((x) => x.replace(/^DNS:/, ''));
    const days = Math.floor((new Date(cert.valid_to) - Date.now()) / 86400000);
    const covers = names.every((x) => sans.includes(x));
    check(covers && days > 7, `TLS: the certificate served for ${n} is trusted and names ${names.join(' and ')}`,
      `${sans.join(', ')}; ${days} days left`);
  }
});

// -- 2. Headers, redirects and the edge's answers (curl) ---------------------------------------------
let html = '';
await section('Headers', async () => {
  const home = await http(`${SITE}/`);
  html = home.text();
  check(home.status === 200 && /<html/i.test(html), `GET / is the app shell`, `${home.status} ${home.h['content-type']}`);
  const d = headerDiffs(home.h);
  check(d.length === 0, `headers on /: every one as infra/site/headers-${STAGE}.json (the CSP exactly)`,
    d.length ? d.join('; ') : `${Object.keys(WANT_HEADERS).length} headers; HSTS ${home.h['strict-transport-security']}`);
  check(/no-cache/.test(home.h['cache-control'] ?? ''), 'Cache-Control on index.html is no-cache', home.h['cache-control'] ?? '(missing)');
  const deep = await http(`${SITE}/stream/magnus`);
  const dd = headerDiffs(deep.h);
  check(deep.status === 200 && dd.length === 0, 'a deep route (/stream/magnus) is 200 with the same headers', dd.join('; ') || `${deep.status}`);

  const files = [...new Set([...html.matchAll(/(?:src|href)="\/?([^"?#:]+\.(?:js|wasm|css))"/g)].map((m) => m[1]))];
  check(files.length > 0, 'the shell names its scripts, wasm and styles', `${files.length} files`);
  const bad = [];
  let hashed = 0;
  for (const f of files) {
    const r = await http(`${SITE}/${f}`, { head: true });
    const isHashed = /-[0-9a-f]{12,16}(_bg)?\.(wasm|js|css)$/.test(f);
    if (isHashed) hashed++;
    const typeOk = f.endsWith('.wasm') ? r.h['content-type'] === 'application/wasm' : !/octet-stream/.test(r.h['content-type'] ?? '');
    if (r.status !== 200 || !typeOk || (isHashed && !/immutable/.test(r.h['cache-control'] ?? '')) || headerDiffs(r.h).length) {
      bad.push(`${f}: ${r.status} ${r.h['content-type']} ${r.h['cache-control']}${headerDiffs(r.h).length ? ' (headers differ)' : ''}`);
    }
  }
  check(bad.length === 0 && hashed > 0, 'hashed files: 200, their own Content-Type, Cache-Control immutable, the same headers',
    bad.length ? short(bad.join('; '), 300) : `${hashed} hashed of ${files.length}`);
  check(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'index.html has no inline script (the CSP forbids it)');
});

await section('Pages', async () => {
  if (WWW) {
    const r = await http(`https://${WWW}/stream/magnus?x=1`);
    check(r.status === 301 && r.h.location === `${SITE}/stream/magnus?x=1`, `${WWW} -> ${DOMAIN} is a 301 that keeps the path`,
      `${r.status} ${r.h.location ?? ''}`);
  } else {
    skip('www -> apex 301', `${STAGE} has no www name`);
  }
  const nf = await http(`${SITE}/no/such/page`);
  check(nf.status === 404, 'the edge answers 404 for a path that is not a route', `/no/such/page ${nf.status}`);

  const robots = await http(`${SITE}/robots.txt`);
  const star = robots.text().split(/\n\s*\n/).find((g) => /^User-agent: \*$/m.test(g)) ?? '';
  const closed = /^Disallow: \/\s*$/m.test(star);
  if (STAGE === 'prod') {
    check(robots.status === 200 && !closed && /^Sitemap: https:\/\/capytube\.xyz\/sitemap\.xml$/m.test(robots.text()),
      'robots.txt allows crawlers (the production policy, with the Sitemap line)', `${robots.status}, User-agent * ${closed ? 'is Disallow: /' : 'is open'}`);
  } else {
    check(robots.status === 200 && closed, `robots.txt disallows everything (${STAGE} is not for crawlers)`, `${robots.status}`);
  }
  const sm = await http(`${SITE}/sitemap.xml`);
  const locs = [...sm.text().matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check(sm.status === 200 && /xml/.test(sm.h['content-type'] ?? '') && locs.length > 0 && locs.every((u) => u.startsWith('https://capytube.xyz/')),
    'sitemap.xml is served, with apex URLs', `${sm.status} ${sm.h['content-type']}, ${locs.length} URLs`);

  // Every file this checkout ships under web/assets is on the stage: a bucket that holds an older
  // build (a renamed picture, a new font) fails here.
  const walk = (d) => readdirSync(d).flatMap((f) => statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]);
  const assets = walk(join(ROOT, 'web/assets')).filter((f) => !f.endsWith('.DS_Store')).map((f) => relative(join(ROOT, 'web'), f));
  const missing = [];
  for (let i = 0; i < assets.length; i += 8) {
    const got = await Promise.all(assets.slice(i, i + 8).map((a) => http(`${SITE}/${a}`, { head: true }).then((r) => [a, r.status])));
    for (const [a, s] of got) if (s !== 200) missing.push(`${a} ${s}`);
  }
  check(missing.length === 0, `every file of this checkout's web/assets is served (the deployed build is current)`,
    missing.length ? `${missing.length} of ${assets.length} missing: ${short(missing.join(', '), 300)}` : `${assets.length} files`);
});

// -- 3. The API through the /api/* behaviour -----------------------------------------------------------
await section('API', async () => {
  const h = await http(`${SITE}/api/health`);
  let hj = null; try { hj = JSON.parse(h.text()); } catch { /* not JSON */ }
  check(h.status === 200 && hj?.ok === true, '/api/health is 200 and ok', `${h.status} ${short(h.text(), 80)}`);
  const s = await http(`${SITE}/api/streams`);
  let sj = null; try { sj = JSON.parse(s.text()); } catch { /* not JSON */ }
  const items = Array.isArray(sj?.items) ? sj.items : [];
  check(s.status === 200 && /json/.test(s.h['content-type'] ?? '') && items.length > 0, '/api/streams gives the catalog',
    `${s.status} ${s.h['content-type']}, ${items.length} streams`);
});

// -- 4. The build: WebMCP and /config.json -----------------------------------------------------------
await section('Build', async () => {
  const cfg = await http(`${SITE}/config.json`);
  let c = null; try { c = JSON.parse(cfg.text()); } catch { /* not JSON */ }
  check(!!COGNITO && c?.auth?.domain === COGNITO && !!c?.auth?.client_id, `/config.json names ${STAGE}'s own Cognito domain`,
    `${cfg.status} ${c?.auth?.domain ?? short(cfg.text(), 60)}`);
  if (STAGE !== 'prod') { skip('no WebMCP in the deployed files', `${STAGE} builds with --features webmcp (scripts/build-release.sh)`); return; }
  // As scripts/build-release.sh --check decides: no file named for it, no import of it, the shell
  // does not name it, and the wasm holds no tool name.
  const hits = [];
  if (/webmcp/i.test(html)) hits.push('index.html names it');
  const names = [...html.matchAll(/(?:src|href)="\/?([^"?#:]+\.(?:js|wasm))"/g)].map((m) => m[1]);
  const js = names.filter((n) => n.endsWith('.js'));
  const wasm = names.filter((n) => n.endsWith('.wasm'));
  const seen = new Set();
  const queue = [...js];
  while (queue.length) {
    const f = queue.shift(); if (seen.has(f)) continue; seen.add(f);
    if (/webmcp/i.test(f)) hits.push(`file ${f}`);
    const r = await http(`${SITE}/${f}`);
    const src = r.text();
    if (/(import|from)\s*\(?\s*['"][^'"]*webmcp/.test(src)) hits.push(`${f} imports it`);
    // Follow the glue's own relative imports (snippets/), one level of the same origin.
    for (const m of src.matchAll(/(?:import|from)\s*\(?\s*['"](\.{0,2}\/[^'"]+\.js)['"]/g)) {
      queue.push(new URL(m[1], `${SITE}/${f}`).pathname.slice(1));
    }
  }
  for (const w of wasm) {
    const r = await http(`${SITE}/${w}`);
    for (const t of TOOL_NAMES) if (r.body.includes(Buffer.from(t))) hits.push(`${w} holds ${t}`);
  }
  check(hits.length === 0 && wasm.length > 0, 'no WebMCP in the deployed files (as build-release.sh --check)',
    hits.length ? hits.join('; ') : `${seen.size} JS files and ${wasm.length} wasm checked`);
});

// -- 5. The app in headless Chromium --------------------------------------------------------------
await section('Browser', async () => {
  const PW_DIR = process.env.CAPYWEB_PW_DIR || `${process.env.HOME}/.cache/capyweb/pw`;
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= `${PW_DIR}/browsers`;
  let pw;
  try { pw = createRequire(`${PW_DIR}/`)('playwright'); } catch {
    throw new Error(`no Playwright in ${PW_DIR}: see scripts/web-checks.sh (smoke step) for the one-time install`);
  }
  // Every app route: the pages of web/src/routes.rs, and the id routes from web/sitemap.xml.
  const routesRs = readFileSync(join(ROOT, 'web/src/routes.rs'), 'utf8');
  const pages = [...routesRs.matchAll(/Page::\w+ => "(\/[^"]*)",/g)].map((m) => m[1]);
  const ids = [...readFileSync(join(ROOT, 'web/sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/capytube\.xyz(\/(?:stream|shop)\/[^<]+)<\/loc>/g)].map((m) => m[1]);
  const ROUTES = [...new Set([...pages, ...ids])];
  if (pages.length < 10) throw new Error(`found ${pages.length} pages in web/src/routes.rs; the parser needs updating`);

  const args = VIA ? [`--host-resolver-rules=MAP ${DOMAIN} ${VIA}${WWW ? `, MAP ${WWW} ${VIA}` : ''}`] : [];
  const browser = await pw.chromium.launch({ args });
  try {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    const page = await ctx.newPage();
    let errs = []; let failed = [];
    const onSite = () => { try { return new URL(page.url()).origin === SITE; } catch { return false; } };
    page.on('console', (m) => { if (m.type() === 'error' && onSite()) errs.push(short(m.text(), 100)); });
    page.on('pageerror', (e) => { if (onSite()) errs.push(`pageerror ${short(e.message, 100)}`); });
    page.on('response', (r) => {
      if (r.status() >= 400 && new URL(r.url()).origin === SITE) failed.push(`${new URL(r.url()).pathname} ${r.status()}`);
    });
    page.on('requestfailed', (r) => {
      const f = r.failure()?.errorText ?? '';
      if (new URL(r.url()).origin === SITE && !/ERR_ABORTED/.test(f)) failed.push(`${new URL(r.url()).pathname} ${f}`);
    });

    const legal = { '/terms-of-service': null, '/privacy-policy': null, '/deletion': null };
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const path of ROUTES) {
        errs = []; failed = [];
        await page.goto(`${SITE}${path}`, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => document.querySelector('main h1')?.textContent?.trim(), null, { timeout: 20000 }).catch(() => {});
        // Let the pictures and the first API answers land before counting errors.
        await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(500);
        const t = await page.evaluate(() => document.querySelector('main h1')?.textContent?.trim() ?? '');
        const csp = await page.evaluate(() => window.__csp.splice(0));
        const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        const json = await page.evaluate(() => /^\s*[[{]/.test(document.body?.innerText ?? ''));
        if (path in legal && width === 1280) legal[path] = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
        const problems = [
          !t && 'no h1', t === 'Page not found' && 'the not-found view', wide && 'scrolls sideways', json && 'raw JSON on the page',
          errs.length && `${errs.length} console errors: ${errs.slice(0, 2).join(' / ')}`,
          csp.length && `${csp.length} CSP violations: ${csp.slice(0, 2).join(' / ')}`,
          failed.length && `failed: ${failed.slice(0, 3).join(', ')}`,
        ].filter(Boolean);
        check(problems.length === 0, `${width}px ${path}`, problems.length ? short(problems.join('; '), 300) : `h1 "${t}"`);
      }
    }

    for (const [path, text] of Object.entries(legal)) {
      const hits = [...(text ?? '').matchAll(/\[insert[^\]]*\]/gi)].map((m) => m[0]);
      check(text !== null && text.length > 200 && hits.length === 0, `${path} holds no [Insert ...] placeholder`,
        text === null ? 'not read' : hits.length ? `${hits.length}: ${[...new Set(hits)].join(', ')}` : `${text.length} characters`);
    }

    // A signed-out person who opens an /api URL sees a page, never the API's JSON (capyweb-loh):
    // /api/me and below land on /profile with its Sign in, any other /api URL on the home page.
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [api, want] of [['/api/me', '/profile'], ['/api/me/transactions', '/profile'], ['/api/streams', '/']]) {
      errs = []; failed = [];
      const r = await page.goto(`${SITE}${api}`, { waitUntil: 'load', timeout: 30000 }).catch(() => null);
      await page.waitForFunction(() => document.querySelector('main h1')?.textContent?.trim(), null, { timeout: 20000 }).catch(() => {});
      const at = new URL(page.url());
      const body = await page.evaluate(() => document.body?.innerText ?? '');
      const signIn = await page.locator('[data-testid=sign-in]').first().isVisible().catch(() => false);
      const ok = at.origin === SITE && at.pathname === want && !/^\s*[[{]/.test(body) && (want !== '/profile' || signIn);
      check(ok, `signed out, opening ${api} in the browser shows a page, not JSON`,
        `${r?.status() ?? 'no answer'}; at ${at.pathname}${want === '/profile' ? `; Sign in ${signIn ? 'shown' : 'missing'}` : ''}${/^\s*[[{]/.test(body) ? `; JSON: ${short(body, 60)}` : ''}`);
    }

    // Sign-in: the button leads to the stage's managed login, which loads. Nothing is typed.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${SITE}/`, { waitUntil: 'load' });
    const btn = page.locator('[data-testid=sign-in]').first();
    await btn.waitFor({ timeout: 20000 });
    const statuses = [];
    page.on('response', (r) => { if (r.request().isNavigationRequest() && new URL(r.url()).origin === COGNITO) statuses.push(r.status()); });
    await btn.click();
    const reached = await page.waitForURL((u) => u.origin === COGNITO, { timeout: 20000 }).then(() => true, () => false);
    const form = reached && await page.locator('input[type=email], input[name=username], input[type=text]').first()
      .waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false);
    check(reached && form && statuses.at(-1) === 200, `"Sign in" leads to ${STAGE}'s Cognito managed login, and it loads`,
      `${reached ? new URL(page.url()).origin + new URL(page.url()).pathname : `stayed on ${page.url()}`}; ${statuses.join(' -> ')}; ${form ? 'its form shows' : 'no form'}`);
  } finally {
    await browser.close();
  }
});

// -- The alarms: printed for a person to run, never run here ------------------------------------------
if (ALARMS) {
  const q = "--query 'MetricAlarms[].[AlarmName,StateValue,StateUpdatedTimestamp]' --output table";
  console.log(`\nThe ${STAGE} alarms, to run by hand (AWS profile capy; this script makes no AWS call):`);
  console.log(`  aws cloudwatch describe-alarms --profile capy --region ap-southeast-1 --alarm-name-prefix capyapp-capyweb-${STAGE}- ${q}`);
  console.log(`  aws cloudwatch describe-alarms --profile capy --region us-east-1 --alarm-name-prefix capyapp-capyweb-${STAGE}- ${q}`);
  if (STAGE === 'prod') {
    // docs/RUNBOOKS.md section 6: our rule lives in another project's rule set.
    console.log('\nThe contact mail rule, as an admin (the deploy user may not read receipt rules); expect');
    console.log('opensign-test-inbox, then store and capyweb-contact:');
    console.log("  aws ses describe-active-receipt-rule-set --region ap-southeast-1 --query '[Metadata.Name, Rules[].Name]' --output text");
  }
}

const secs = Math.round((Date.now() - t0) / 1000);
console.log(`\nlive-checks ${STAGE}${VIA ? ` via ${VIA}` : ''}: ${counts.ok} ok, ${counts.FAIL} FAIL, ${counts.skip} skipped, in ${secs} s`);
process.exit(counts.FAIL ? 1 : 0);
