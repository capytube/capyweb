// Tests for the site's CloudFront functions, run from infra/site/template.yaml as written there
// (node infra/site/test_edge.mjs; scripts/guard.sh runs it). Exits 1 on the first failure.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const tpl = readFileSync(new URL('template.yaml', import.meta.url), 'utf8');
// The FunctionCode block of one function: the indented lines after "FunctionCode: |".
function code(name) {
  const at = tpl.indexOf(`\n  ${name}:\n`);
  assert.ok(at >= 0, `${name} not in template.yaml`);
  const m = tpl.slice(at).match(/FunctionCode: \|\n((?: {8}.*\n|\n)+)/);
  assert.ok(m, `${name} has no FunctionCode block`);
  return new Function(`${m[1]}\nreturn handler;`)();
}

const api = code('ApiFunction');
const req = (uri, headers = {}) => ({ request: { uri, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, { value: v }])) } });
let n = 0;
const t = (name, fn) => { fn(); n++; };

// What the app itself sends passes through, with the prefix stripped.
t('fetch from the app', () => assert.equal(api(req('/api/me', { 'sec-fetch-mode': 'cors', accept: '*/*' })).uri, '/me'));
t('same-origin fetch', () => assert.equal(api(req('/api/streams', { 'sec-fetch-mode': 'same-origin' })).uri, '/streams'));
t('video element', () => assert.equal(api(req('/api/playback/wall-cam', { 'sec-fetch-mode': 'no-cors', accept: '*/*' })).uri, '/playback/wall-cam'));
t('no headers at all (curl, monitors)', () => assert.equal(api(req('/api/streams')).uri, '/streams'));
t('JSON accept without Sec-Fetch', () => assert.equal(api(req('/api/me', { accept: 'application/json' })).uri, '/me'));
t('bare /api', () => assert.equal(api(req('/api', { 'sec-fetch-mode': 'cors' })).uri, '/'));

// A person opening an /api URL gets a page instead of JSON.
const go = (uri, headers) => { const r = api(req(uri, headers)); assert.equal(r.statusCode, 302, `${uri} not redirected`); assert.equal(r.headers['cache-control'].value, 'no-store'); return r.headers.location.value; };
const nav = { 'sec-fetch-mode': 'navigate', accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };
t('/api/me -> /profile', () => assert.equal(go('/api/me', nav), '/profile'));
t('/api/me/ -> /profile', () => assert.equal(go('/api/me/', nav), '/profile'));
t('/api/me/transactions -> /profile', () => assert.equal(go('/api/me/transactions', nav), '/profile'));
t('/api/media is not /api/me', () => assert.equal(go('/api/media', nav), '/'));
t('/api/streams -> /', () => assert.equal(go('/api/streams', nav), '/'));
t('/api/playback/x -> /', () => assert.equal(go('/api/playback/wall-cam', nav), '/'));
t('old browser without Sec-Fetch, asks for HTML', () => assert.equal(go('/api/me', { accept: 'text/html,*/*' }), '/profile'));

console.log(`edge functions: ${n} tests ok`);
