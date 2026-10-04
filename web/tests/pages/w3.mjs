import assert from 'node:assert/strict';

export async function check({ open, browser, BASE, SHOTS }) {
  for (const [width, height] of [[390, 844], [1000, 800], [1280, 800]]) {
    const { page } = await open('/', { width, height });
    await page.waitForSelector('[data-testid="gang-list"] li');
    assert.equal(await page.locator('main h1').count(), 1);
    for (const id of ['now-title', 'how-title', 'cast-title']) {
      assert.equal(await page.locator(`#${id}`).count(), 1);
    }
    assert.equal(await page.locator('.home-steps li').count(), 3);
    const cards = page.locator('[data-testid="gang-list"] > li');
    assert.deepEqual(await cards.locator('h3').allTextContents(), ['Einstein', 'Magnus', 'Mochi']);
    assert.deepEqual(await cards.locator('a').evaluateAll(as => as.map(a => a.getAttribute('href'))),
      ['/stream/einstein', '/stream/magnus', '/stream/elon']);
    for (const card of await cards.all()) assert.equal(await card.locator('img').count(), 1);
    assert.match(await cards.nth(1).innerText(), /Awake 08:00–11:00/);
    for (const label of ['Personality', 'Fun fact', 'Favourite activities']) {
      assert.equal(await cards.locator('dt').filter({ hasText: label }).count(), 3);
    }
    assert.equal(await page.locator('.home-now a').getAttribute('href'), '/stream/einstein');
    assert.equal(await page.locator('.home-now h3').innerText(), 'Food cam');
    // The picture is the featured room's own capybara (review rv-1790679953-48717).
    const now = page.locator('.home-now > img');
    assert.equal(await now.getAttribute('src'), '/assets/home/einstein.webp');
    assert.equal(await now.getAttribute('alt'), 'Einstein standing on a bed');
    assert.equal(await now.getAttribute('loading'), null, 'not lazy: it is near the top of the page');
    assert.equal(await page.locator('main video, main button').count(), 0);
    assert.equal(await page.locator('.home-film a[href="/watch"]').count(), 3);
    for (const img of await page.locator('main img').all()) {
      assert.notEqual(await img.getAttribute('alt'), null);
      assert.ok(Number(await img.getAttribute('width')) > 0);
      assert.ok(Number(await img.getAttribute('height')) > 0);
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(el => el.decode());
      assert.equal(await img.evaluate(el => el.naturalWidth > 0), true);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width === 390) {
      const strip = page.locator('.home-film');
      assert.ok(await strip.evaluate(el => el.scrollWidth > el.clientWidth));
      await strip.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
      await page.waitForFunction(() => document.querySelector('.home-film').scrollLeft > 0);
      await strip.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }));
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/w3-${width}.png`, fullPage: true });
    await page.close();
  }

  // While the list loads, the cameras and the Now showing photo keep their places: nothing below
  // jumps when they come (review rv-1790682691-81087 measured 0.31 before).
  for (const [width, height] of [[390, 844], [1000, 800], [1280, 800]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.addInitScript(() => {
      window.__shift = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shift += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
    });
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route('**/fixtures/streams.json', async (route) => { await held; await route.continue(); });
    await page.goto(BASE + '/');
    await page.locator('.home-now-slot').waitFor();
    assert.equal(await page.locator('.cam-slot').count(), 3);
    assert.equal(await page.getByRole('status').filter({ hasText: 'Loading cameras…' }).count(), 1);
    await page.evaluate(() => document.fonts.ready);
    const before = await page.locator('.home-now').evaluate((e) => e.getBoundingClientRect().height);
    const headingTop = await page.locator('#now-title').evaluate((e) => e.getBoundingClientRect().top);
    const lineTop = await page.locator('.home-now [role=status]').evaluate((e) => e.getBoundingClientRect().top);
    const photoBox = await page.locator('.home-now-slot').boundingBox();
    await page.waitForTimeout(300); // let the first layout settle before measuring the arrival
    const early = await page.evaluate(() => window.__shift);
    release();
    await page.locator('.home-now > img').waitFor();
    await page.locator('.home-now > img').evaluate((el) => el.decode());
    assert.equal(await page.locator('.home-now').evaluate((e) => e.getBoundingClientRect().height), before);
    assert.equal(await page.locator('#now-title').evaluate((e) => e.getBoundingClientRect().top), headingTop,
      `Now showing heading stays put at ${width}px`);
    assert.equal(await page.locator('.home-now h3').evaluate((e) => e.getBoundingClientRect().top), lineTop,
      `the room title replaces the loading line at the same top at ${width}px`);
    assert.deepEqual(await page.locator('.home-now > img').boundingBox(), photoBox,
      `the photo keeps its loading box at ${width}px`);
    // The arrival moves nothing; the whole load stays well inside a good CLS (0.1). The first
    // settle, before any data, is about 0.05 between 700 and 1000 px.
    const shift = await page.evaluate(() => window.__shift);
    assert.ok(shift - early < 0.02, `layout shift ${(shift - early).toFixed(3)} when the list arrives at ${width}px`);
    assert.ok(shift < 0.1, `layout shift ${shift.toFixed(3)} for the whole load at ${width}px`);
    await page.close();
  }

  // A resolved empty or failed list needs only its text, not the phone's loading reserve.
  for (const status of [200, 500]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/fixtures/streams.json', route => route.fulfill({
      status, json: status === 200 ? { items: [], count: 0 } : { error: 'unavailable' },
    }));
    await page.goto(BASE + '/');
    const now = page.locator('.home-now.home-now-text');
    await now.waitFor();
    await now.getByText(status === 200
      ? 'No public room is available right now.'
      : 'Could not load the public room. Please try again later.').waitFor();
    if (status === 200) {
      await page.getByRole('status').filter({ hasText: 'No cameras are available right now.' }).waitFor();
      assert.equal(await page.locator('[aria-labelledby=cams-heading] ul').count(), 0);
    }
    assert.equal(await now.locator('img, .home-now-slot').count(), 0);
    const height = await now.evaluate(e => {
      const style = getComputedStyle(e);
      const text = e.querySelector(':scope > div');
      const content = text.lastElementChild.getBoundingClientRect().bottom - text.getBoundingClientRect().top;
      return {
        actual: e.getBoundingClientRect().height,
        needed: content + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
          + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth),
      };
    });
    assert.ok(Math.abs(height.actual - height.needed) <= 1,
      `HTTP ${status}: card uses ${height.actual}px for ${height.needed}px of content and padding`);
    await page.close();
  }

  // Missing data must not invent a photo, awake hours, or a public room.
  const page = await browser.newPage();
  await page.route('**/fixtures/streams.json', route => route.fulfill({
    json: { items: [{ id: 'private', title: 'Private room', access_type: 'private' }], count: 1 },
  }));
  await page.route('**/fixtures/capybaras.json', route => route.fulfill({
    json: { items: [{ id: 'new-friend', name: 'New friend' }], count: 1 },
  }));
  await page.goto(BASE + '/');
  await page.waitForSelector('[data-testid="gang-list"] li');
  assert.equal(await page.locator('.home-capy img, .home-awake, .home-now a, .home-now img').count(), 0);
  assert.match(await page.locator('.home-now').innerText(), /No public room/);
  // A public room whose capybara has no photo gets no stand-in picture, and one column.
  await page.route('**/fixtures/streams.json', route => route.fulfill({
    json: { items: [{ id: 'new-cam', title: 'New cam', access_type: 'public', capybara_ids: ['new-friend'] }], count: 1 },
  }));
  await page.reload();
  await page.locator('.home-now h3').filter({ hasText: 'New cam' }).waitFor();
  assert.equal(await page.locator('.home-now img').count(), 0);
  assert.equal(await page.locator('.home-now.home-now-text').count(), 1);
  await page.route('**/fixtures/capybaras.json', route => route.fulfill({ json: { items: [], count: 0 } }));
  await page.reload();
  await page.getByText('The gang will be here soon.').waitFor();
  // A malformed successful response exercises the error branch without a browser 500 log.
  await page.route('**/fixtures/capybaras.json', route => route.fulfill({ json: { invalid: true } }));
  await page.reload();
  await page.getByRole('alert').filter({ hasText: 'Could not load the gang' }).waitFor();
  await page.close();
}
