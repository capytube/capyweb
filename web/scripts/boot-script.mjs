// Trunk post_build hook (web/Trunk.toml): moves Trunk's inline boot script into a hashed file, so
// the CSP's `script-src 'self'` allows it without a per-release hash in the headers policy
// (docs/RELEASE_PLAN.md 1a item 3).
//
//   node web/scripts/boot-script.mjs                as the hook: works on $TRUNK_STAGING_DIR
//   node web/scripts/boot-script.mjs --check <dir>  checks a built dir only (scripts/build-release.sh)
//
// The hook writes `boot-<first 16 hex of the script's sha256>.js` next to index.html, a name
// that matches the deploy's immutable pattern `*-<16 hex>.js`, and loads it with
// `<script type="module" src="…/boot-<hash>.js" integrity="sha384-…">`. Both modes then fail
// when index.html still has an inline script, or when an `integrity` attribute does not match
// the file it names. One exception, in hook mode only: `trunk serve` adds its live-reload script
// before this hook runs (it carries the `{{__TRUNK_ADDRESS__}}` placeholder, filled in when the
// page is served). A release build never has it, and --check allows nothing.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const hasSrc = (attrs) => /\ssrc\s*=/i.test(attrs);

function die(msg) {
  console.error(`boot-script: ${msg}`);
  process.exit(1);
}

// The one inline module that imports the wasm-bindgen glue and starts the app.
function externalize(dir, publicUrl) {
  const file = join(dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const boots = [...html.matchAll(SCRIPT)].filter(
    ([, attrs, body]) => !hasSrc(attrs) && /type\s*=\s*["']?module/i.test(attrs) && /\bimport\s+init\b/.test(body),
  );
  if (boots.length !== 1) die(`expected one inline boot script in ${file}, found ${boots.length}`);
  const [tag, , body] = boots[0];
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);
  const name = `boot-${hash}.js`;
  const sri = 'sha384-' + createHash('sha384').update(body).digest('base64');
  writeFileSync(join(dir, name), body);
  const base = publicUrl.endsWith('/') ? publicUrl : publicUrl + '/';
  const external = `<script type="module" src="${base}${name}" integrity="${sri}"></script>`;
  writeFileSync(file, html.replace(tag, () => external));
  console.log(`boot-script: moved the boot script into ${name}`);
}

const liveReload = (body) => body.includes('{{__TRUNK_ADDRESS__}}');

// No inline script (but the dev server's live reload, when allowed), and every integrity
// attribute matches its file.
export function check(dir, { allowLiveReload = false } = {}) {
  const file = join(dir, 'index.html');
  if (!existsSync(file)) die(`no ${file}`);
  const html = readFileSync(file, 'utf8');
  const all = [...html.matchAll(SCRIPT)].filter(([, attrs]) => !hasSrc(attrs));
  const inline = all.filter(([, , body]) => !(allowLiveReload && liveReload(body)));
  if (inline.length) die(`${file} has ${inline.length} inline script(s), which the CSP blocks: ${inline[0][0].slice(0, 80)}…`);
  let checked = 0;
  for (const [tag] of html.matchAll(/<(?:link|script)\b[^>]*\bintegrity\s*=\s*"[^"]*"[^>]*>/gi)) {
    const url = /\s(?:href|src)\s*=\s*"([^"]+)"/i.exec(tag)?.[1];
    const [, algo, want] = /\bintegrity\s*=\s*"(sha256|sha384|sha512)-([^"]+)"/i.exec(tag) ?? [];
    if (!url || !algo) die(`cannot read the integrity of: ${tag}`);
    const path = join(dir, decodeURIComponent(new URL(url, 'http://x/').pathname));
    if (!existsSync(path)) die(`${url} (integrity checked) is not in ${dir}`);
    const got = createHash(algo).update(readFileSync(path)).digest('base64');
    if (got !== want) die(`${url}: integrity ${algo}-${want} does not match the file (${algo}-${got})`);
    checked += 1;
  }
  console.log(`boot-script: ${file} has no inline script${all.length > inline.length ? " but trunk serve's live reload" : ''}; ${checked} integrity attribute(s) match`);
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  if (!args[1]) die('usage: boot-script.mjs --check <dir>');
  check(args[1]);
} else {
  const dir = process.env.TRUNK_STAGING_DIR;
  if (!dir) die('TRUNK_STAGING_DIR is not set (run as a Trunk post_build hook, or use --check <dir>)');
  externalize(dir, process.env.TRUNK_PUBLIC_URL || '/');
  check(dir, { allowLiveReload: true });
}
