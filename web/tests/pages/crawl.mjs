// Crawlers (capyweb-1w5, docs/CRAWLERS_NOTES.md): robots.txt, noindex on the views that stand for
// a page that does not exist, and the two edge functions of infra/site/template.yaml, run here on
// sample paths (on dev they answer 404 for anything that is not a route of the app).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const TEMPLATE = new URL('../../../infra/site/template.yaml', import.meta.url);

// The FunctionCode block of one AWS::CloudFront::Function resource, as a callable handler.
function edgeFunction(template, name) {
  const start = template.indexOf(`  ${name}:`);
  const code = template.indexOf('FunctionCode: |', start);
  const lines = [];
  for (const line of template.slice(code).split('\n').slice(1)) {
    if (line.trim() && !line.startsWith('        ')) break;
    lines.push(line.slice(8));
  }
  const box = {};
  vm.runInNewContext(`${lines.join('\n')}\nthis.handler = handler;`, box);
  return box.handler;
}

function edgeChecks() {
  const template = readFileSync(TEMPLATE, 'utf8');
  const spa = edgeFunction(template, 'SpaFunction');
  const notFound = edgeFunction(template, 'NotFoundFunction');
  const answer = (path, seen) => {
    const request = spa({ request: { uri: path, headers: {} } });
    // On dev the viewer-response function sees the request as SpaFunction left it (the marker
    // fires); the path check covers the other case, the viewer's original request.
    const shown = seen === 'original' ? { uri: path, headers: {} } : request;
    const res = notFound({ request: shown, response: { statusCode: 200, headers: {} } });
    return [request.uri, res.statusCode];
  };
  for (const seen of ['rewritten', 'original']) {
    for (const path of ['/', '/watch', '/watch/', '/play', '/deletion', '/stream/magnus', '/stream/magnus/', '/shop/pass-1', '/auth/callback']) {
      assert.deepEqual(answer(path, seen), ['/index.html', 200], `${path} is a page (${seen})`);
    }
    // An encoded spelling of a route (/%77atch) is not a route either: the browser sends it as is
    // and the app's router shows "Page not found" for it too, so the status and the page agree
    // (review rv-1790689952-88135; docs/CRAWLERS_NOTES.md).
    for (const path of ['/garbage', '/no/such/page', '/stream/a/b', '/admin', '/watch//', '/%77atch']) {
      assert.deepEqual(answer(path, seen), ['/index.html', 404], `${path} is not a page (${seen})`);
    }
    for (const path of ['/assets/cast/magnus.jpg', '/robots.txt', '/index.html', '/config.json']) {
      assert.deepEqual(answer(path, seen), [path, 200], `${path} is a file, left alone (${seen})`);
    }
  }
  // Only a 200 is turned into a 404; anything else passes through untouched.
  const res = notFound({ request: { uri: '/x', headers: { 'x-capyweb-route': { value: 'unknown' } } }, response: { statusCode: 304, headers: {} } });
  assert.equal(res.statusCode, 304);
}

export async function check({ open, browser, BASE }) {
  edgeChecks();

  // robots.txt: the policy of docs/CRAWLERS_NOTES.md (the dev upload replaces it with Disallow: /).
  const robots = await fetch(`${BASE}/robots.txt`).then((r) => r.text());
  const groups = robots.split(/\n\s*\n/).filter((g) => /User-agent/i.test(g));
  const training = groups.find((g) => g.includes('GPTBot'));
  for (const bot of ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Applebot-Extended']) {
    assert.match(training, new RegExp(`^User-agent: ${bot}$`, 'm'), `${bot} opted out`);
  }
  assert.match(training, /^Disallow: \/$/m);
  const all = groups.find((g) => /^User-agent: \*$/m.test(g));
  for (const path of ['/api/', '/paid/', '/media/', '/auth/']) assert.match(all, new RegExp(`^Disallow: ${path}$`, 'm'));
  assert.doesNotMatch(all, /^Disallow: \/$/m, 'search and answer engines are welcome');
  for (const bot of ['Googlebot', 'bingbot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot']) {
    assert.doesNotMatch(robots, new RegExp(bot), `${bot} falls under * and is allowed`);
  }

  // The shell never carries noindex: Google may not see JavaScript remove one.
  const shell = await fetch(`${BASE}/`).then((r) => r.text());
  assert.doesNotMatch(shell, /noindex/);
  assert.doesNotMatch(shell, /\blive\b/i, 'every camera is a recording');

  // noindex while a not-found view shows, gone once a real page shows. Raw pages: the missing
  // pass's 404 is logged to the console on purpose.
  const noindex = (page) => page.locator('meta[name=robots][content=noindex]').count();
  for (const [path, h1] of [['/no/such/page', 'Page not found'], ['/%77atch', 'Page not found'], ['/shop/nope', 'Pass not found']]) {
    const page = await browser.newPage();
    await page.goto(BASE + path);
    await page.waitForFunction((h) => document.querySelector('main h1')?.textContent === h, h1);
    await page.waitForFunction(() => document.querySelectorAll('meta[name=robots]').length === 1);
    await page.click('footer a[href="/about-us"]');
    await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'About CapyTube');
    assert.equal(await noindex(page), 0, `${path}: noindex removed after leaving`);
    await page.close();
  }
  const { page: room } = await open('/stream/nobody');
  await room.getByText('No camera watches this capybara yet.').waitFor();
  assert.equal(await noindex(room), 1, 'a capybara with no camera is not a page to index');
  await room.close();
  for (const path of ['/', '/watch', '/stream/magnus']) {
    const { page } = await open(path);
    await page.waitForTimeout(300);
    assert.equal(await noindex(page), 0, `${path} is indexable`);
    await page.close();
  }
}
