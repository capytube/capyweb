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

  // At phone width, scrolling the video into view leaves its controls above the fixed tab bar.
  const { page: phone } = await open('/robot', { width: 390, height: 844 });
  const clip = await phone.locator('main video').evaluate(el => {
    el.scrollIntoView({ block: 'end', behavior: 'instant' }); // the site scrolls smoothly
    return { videoBottom: el.getBoundingClientRect().bottom, barTop: document.querySelector('.tabbar').getBoundingClientRect().top };
  });
  assert.ok(clip.videoBottom <= clip.barTop, `video controls under the tab bar: ${JSON.stringify(clip)}`);
  await phone.close();

  // About: the decided wording (play coins are not money), and headings in order.
  const { page: about } = await open('/about-us', { width: 1280, height: 800 });
  const text = await about.locator('main').innerText();
  assert.match(text, /Play coins are not money/);
  assert.doesNotMatch(text, /currency|tip Magnus/i, 'no money wording on About');
  assert.deepEqual(await about.locator('main :is(h1,h2,h3,h4,h5,h6)').evaluateAll(hs => hs.map(h => h.tagName)), ['H1', 'H2', 'H2']);
  await about.close();

  // Deletion: the real process (a request by email, done by staff; docs/RUNBOOKS.md section 1),
  // never the button the old page described. The contact placeholder stays until the owner fills it.
  const { page: del } = await open('/deletion', { width: 1280, height: 800 });
  assert.deepEqual(await del.locator('main h2').allInnerTexts(), [
    "Step 1: Email us from your account's address",
    'Step 2: Confirm by answering our reply',
    'Step 3: We delete your account and its data',
    'Step 4: Backups and play coins',
    'Contact Us',
  ]);
  const steps = await del.locator('main').innerText();
  assert.match(steps, /from the email address you sign in to CapyTube with/);
  assert.match(steps, /Within 30 days, we delete the account and its data/);
  assert.match(steps, /within 35 days after we delete it/);
  assert.match(steps, /Play coins have no cash value/);
  assert.equal(steps.split('[Insert contact email]').length - 1, 1, 'the contact placeholder, once, unchanged');
  assert.doesNotMatch(steps, /Delete My Account|Account Settings|24 hours|provide your password/i, 'no step the site cannot do');
  assert.equal(await del.locator('main button, main form, main input').count(), 0, 'no delete control on the page');
  await del.close();
}
