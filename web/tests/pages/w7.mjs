import assert from 'node:assert/strict';

export async function check({ open, browser, BASE }) {
  const safePage = async (page) => {
    assert.equal(await page.locator('main h1').count(), 1);
    assert.doesNotMatch(await page.innerText('main'), /seed-user/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no page-level horizontal scroll');
    assert.equal(await page.locator('main button').count(), 0, 'no write buttons');
  };
  const { page } = await open('/shop');
  await page.waitForSelector('[data-testid="pass-list"] > li');
  assert.equal(await page.innerText('main h1'), 'Passes');
  assert.equal(await page.locator('[data-testid="pass-list"] > li').count(), 3);
  await page.getByLabel('Search by name or label').fill('cafe');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="pass-list"] > li').length === 1);
  assert.match(await page.innerText('[data-testid="pass-list"]'), /Capy #5687/);
  await page.getByLabel('Search by name or label').fill('nothing matches');
  await page.getByText('No passes match your search.').waitFor();
  await page.getByLabel('Search by name or label').fill('');
  await page.getByLabel('Sort passes').selectOption('high');
  await page.waitForFunction(() => document.querySelector('.shop-card h2')?.textContent === 'Capy #5687');
  assert.match(await page.locator('.shop-card').first().innerText(), /6 coins/);
  await safePage(page);
  await page.locator('main a[href="/shop/capy-1234"]').click();
  await page.waitForSelector('[data-testid="offers-table"] tbody tr');
  await page.waitForSelector('[data-testid="activity-table"] tbody tr');
  assert.deepEqual(await page.locator('[data-testid="offers-table"] tbody tr td:first-child').allTextContents(), ['7 coins', '4 coins']);
  assert.deepEqual(await page.locator('[data-testid="activity-table"] tbody tr td:first-child').allTextContents(), ['Listed', 'Minted']);
  await safePage(page);
  for (const id of ['capy-5687', 'nope', 'bad..id']) {
    // The local static server treats dots as file extensions; exercise the invalid
    // ID through SPA navigation so the client, rather than that server, rejects it.
    let detail;
    const missingErrors = [];
    if (id === 'nope') {
      // A real missing fixture returns 404, which Chromium also logs as an error.
      // Keep this expected response out of the shell's blanket console-error check.
      detail = await browser.newPage({ viewport: { width: 390, height: 844 } });
      detail.on('pageerror', e => missingErrors.push(e.message));
      detail.on('console', m => {
        if (m.type() === 'error' && !(m.location().url.endsWith('/fixtures/nfts/nope.json') && m.text().includes('404'))) missingErrors.push(m.text());
      });
      await detail.goto(BASE + '/shop/nope');
      await detail.getByRole('heading', { name: 'Pass not found' }).waitFor();
    } else {
      ({ page: detail } = await open(id === 'bad..id' ? '/shop' : `/shop/${id}`));
    }
    if (id === 'bad..id') {
      await detail.evaluate(() => {
        const link = document.createElement('a');
        link.href = '/shop/bad..id';
        document.querySelector('main').append(link);
        link.click();
      });
      await detail.getByRole('heading', { name: 'Pass not found' }).waitFor();
    }
    if (id === 'capy-5687') {
      await detail.getByText('No offers yet', { exact: true }).waitFor();
      await detail.getByText('No activity yet', { exact: true }).waitFor();
    } else {
      assert.equal(await detail.innerText('main h1'), 'Pass not found');
      assert.equal(await detail.locator('main a[href="/shop"]').count(), 1);
    }
    await safePage(detail);
    assert.deepEqual(missingErrors, []);
    await detail.close();
  }
  const { page: desktop } = await open('/shop', { width: 1280, height: 800 });
  await desktop.waitForSelector('.shop-card');
  await safePage(desktop);
  await desktop.close();
  await page.close();
}
