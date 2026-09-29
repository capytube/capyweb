import assert from 'node:assert/strict';

const routes = [
  ['/robot', 'Watch now. Drive when your hour begins.'],
  ['/about-us', 'About CapyTube'],
  ['/privacy-policy', 'Privacy policy'],
  ['/terms-of-service', 'Terms of Service'],
  ['/deletion', 'Account Deletion Instructions'],
];

export async function check({ open, browser, settle, BASE }) {
  for (const width of [390, 1280]) {
    for (const [path, title] of routes) {
      const { page } = await open(path, { width, height: width === 390 ? 844 : 800 });
      assert.equal(await page.locator('main h1').count(), 1, path);
      assert.equal(await page.innerText('main h1'), title, path);
      assert.equal(await page.title(), `${title} · CapyTube`, path);
      const dates = page.locator('mark.todo-date');
      assert.equal(await dates.count(), /privacy|terms/.test(path) ? 2 : 0, path);
      for (const date of await dates.allTextContents()) assert.equal(date, '[Insert Date]');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path}: no horizontal scroll at ${width}px`);
      if (path === '/robot') {
        assert.equal(await page.locator('main button').count(), 0, 'booking and driving buttons are not rendered');
        assert.equal(await page.locator('[data-slot]').count(), 3);
      }
      await page.close();
    }
  }

  // Attach before navigation so even a request during initial rendering is caught.
  const page = await browser.newPage();
  const media = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/media/')) media.push(request.url());
  });
  await page.goto(`${BASE}/robot`);
  const video = page.locator('main video');
  await video.waitFor();
  await settle();
  assert.equal(await video.getAttribute('preload'), 'none');
  assert.equal(await video.getAttribute('playsinline'), '');
  assert.notEqual(await video.getAttribute('controls'), null);
  assert.equal(await video.locator('source').getAttribute('src'), '/media/capytube-stream.mp4');
  assert.equal(await video.locator('source').getAttribute('type'), 'video/mp4');
  assert.ok(await video.getAttribute('poster'));
  assert.deepEqual(media, [], 'no media request before pressing play');
  assert.equal(await video.evaluate(el => el.networkState), 1, 'video stays idle');
  await page.close();
}
