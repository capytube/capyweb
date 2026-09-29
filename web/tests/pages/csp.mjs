// W12: the app under the site's Content Security Policy (docs/RELEASE_PLAN.md 1a item 3).
// smoke.mjs fails the run on any violation in any test; this file checks that the policy is
// really being sent, and what the app changed to live with it: the boot script is a file, not
// inline, and the fonts are our own, so a page load asks nothing of any other origin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export async function check({ open, BASE }) {
  // The test server sends the dev policy with only the managed-login origin swapped for the
  // fake one; without it every page test would pass for the wrong reason.
  const res = await fetch(`${BASE}/watch`);
  const policy = JSON.parse(readFileSync(new URL('../../../infra/site/headers-dev.json', import.meta.url), 'utf8'));
  const want = policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy
    .replace(/https:\/\/[^ ;]+\.amazoncognito\.com/, 'https://capyapp-test.auth.example.com');
  assert.equal(res.headers.get('content-security-policy'), want);
  assert.match(want, /script-src 'self' 'wasm-unsafe-eval';/);

  // One boot script, a hashed file whose name the deploy treats as immutable.
  const shell = await res.text();
  const scripts = [...shell.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'one script tag');
  const src = /\ssrc="([^"]+)"/.exec(scripts[0][1])?.[1];
  assert.match(src ?? '', /^\/boot-[0-9a-f]{16}\.js$/, 'the boot script is a hashed file');
  assert.equal(scripts[0][2].trim(), '', 'and not inline');
  const boot = await fetch(BASE + src);
  assert.equal(boot.status, 200);
  assert.match(boot.headers.get('content-type'), /javascript/);
  assert.doesNotMatch(shell, /fonts\.googleapis|fonts\.gstatic/);

  // Nothing leaves the site on a page load, and the three typefaces load from /assets/fonts.
  for (const width of [390, 1280]) {
    const requests = [];
    const { page } = await open('/', { width });
    page.on('request', (r) => requests.push(r.url()));
    await page.reload(); // the first load, now with every request recorded
    await page.waitForSelector('[data-testid=stream-list] li');
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replaceAll('"', '')));
    for (const family of ['Commissioner', 'DynaPuff', 'Hanalei Fill']) {
      assert.ok(loaded.includes(family), `${family} loaded @${width} (${loaded.join(', ')})`);
    }
    const origin = new URL(BASE).origin;
    assert.deepEqual(requests.filter((u) => new URL(u).origin !== origin), [], `@${width}: every request stays on the site`);
    assert.ok(requests.some((u) => /\/assets\/fonts\/[a-z]+-v\d+-latin\.woff2$/.test(u)), `@${width}: fonts come from /assets/fonts`);
    await page.close();
  }
}
