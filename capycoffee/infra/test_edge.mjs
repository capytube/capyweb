// Runs IndexFunction from template.yaml as written there, against every page and asset of the build.
//   node test_edge.mjs [build dir]   (default ../out20260908)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const tpl = readFileSync(new URL('template.yaml', import.meta.url), 'utf8');
const m = tpl.slice(tpl.indexOf('\n  IndexFunction:\n')).match(/FunctionCode: \|\n((?: {8}.*\n|\n)+)/);
const fn = new Function(`${m[1]}\nreturn handler;`)();
const run = (uri) => fn({ request: { uri, headers: {} } });
const BUILD = process.argv[2] ?? new URL('../out20260908', import.meta.url).pathname;
let n = 0;

// Every directory with an index.html is reachable as /dir/ and /dir.
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? [join(d, f), ...walk(join(d, f))] : []));
for (const dir of ['', ...walk(BUILD).map((d) => d.slice(BUILD.length))].filter((d) => existsSync(join(BUILD, d, 'index.html')))) {
  const r = run(`${dir}/`);
  assert.equal(r.uri, `${dir}/index.html`); assert.ok(existsSync(join(BUILD, r.uri)), `${r.uri} missing`); n++;
  if (dir) { const x = run(dir); assert.equal(x.statusCode, 301); assert.equal(x.headers.location.value, `${dir}/`); n++; }
}
// Files pass through unchanged.
for (const f of ['/favicon.ico', '/404.html', '/roasts/young-capy.webp', '/about/__next._tree.txt', '/_next/static/chunks/x.js']) { assert.equal(run(f).uri, f); n++; }
// A redirect never names another host (hm-zxnj3 tester): such paths go home.
for (const evil of ['//evil.com/x', '//evil.com', '/\\evil.com/x', '/a\\b', '///x', '/\t/evil', '/\n/evil', '/\r/evil', '/a b', '/\u007f/x', '/\u0000/x']) {
  const r = run(evil); assert.equal(r.statusCode, 301, evil); assert.equal(r.headers.location.value, '/', evil); n++;
}
// The query string survives the slash redirect; ordinary double slashes later in a path are harmless.
const q = fn({ request: { uri: '/about', headers: {}, querystring: { x: { value: '1' }, y: { value: '' }, t: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] } } } });
assert.equal(q.headers.location.value, '/about/?x=1&y&t=a&t=b'); n++;
assert.equal(run('/about//x').headers.location.value, '/about//x/'); n++;
for (const v of ['a\r\nSet-Cookie: x=1', 'a\nb', 'a b', 'a\tb']) {
  const r = fn({ request: { uri: '/about', headers: {}, querystring: { x: { value: v } } } });
  assert.equal(r.headers.location.value, '/about/', JSON.stringify(v)); n++;
}
// Fuzz: no Location ever resolves to another host, whatever the path or query (WHATWG URL parser).
const chars = ['/', '\\', '.', '%', '2', 'F', 'e', 'v', 'i', 'l', ':', '@', '?', '#', '\t', '\n', '\r', ' ', '\u0000', '\u007f', 'é'];
let seed = 7; const rnd = (k) => (seed = (seed * 1103515245 + 12345) % 2147483648) % k;
for (let i = 0; i < 200000; i++) {
  let u = '/'; for (let j = 0, L = 1 + rnd(12); j < L; j++) u += chars[rnd(chars.length)];
  const qv = rnd(3) ? undefined : { k: { value: Array.from({ length: rnd(6) }, () => chars[rnd(chars.length)]).join('') } };
  const r = fn({ request: { uri: u, headers: {}, querystring: qv } });
  if (r.statusCode) assert.equal(new URL(r.headers.location.value, 'https://roast.capy.life/').host, 'roast.capy.life', JSON.stringify([u, qv]));
}
n++;
for (const r of [run('/about'), run('/roast')]) { assert.ok(r.headers.location.value.startsWith('/') && !r.headers.location.value.startsWith('//')); n++; }

console.log(`IndexFunction: ${n} cases ok against ${BUILD}`);
