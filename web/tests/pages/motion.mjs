// Camera list motion (hm-f78ea): the live badge, the springing cards, the pointer light, the
// loading shimmer, and none of it moving under prefers-reduced-motion.
import assert from 'node:assert/strict';

const liveFirst = async (page) => page.route('**/fixtures/streams.json', async (route) => {
  const body = await (await route.fetch()).json();
  body.items[0].is_live = true; body.items[0].video_mode = 'live';
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
});
const anims = (page, sel) => page.$$eval(sel, (els) => els.flatMap((e) => e.getAnimations().map((a) => a.animationName)));

export async function check({ browser, BASE, SHOTS }) {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width === 390 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await liveFirst(page);
    await page.goto(`${BASE}/`);
    const cards = page.locator('[data-testid=stream-list] .cam-card');
    await cards.first().waitFor();
    const n = await cards.count();
    assert.ok(n >= 2, 'at least two camera cards');
    // The live camera keeps its words and gains the glowing badge; the others stay calm.
    const first = cards.first().locator('[data-testid=stream-state]');
    assert.equal((await first.innerText()).trim(), 'Live now');
    assert.equal(await first.locator('.live-badge .live-dot[aria-hidden=true]').count(), 1);
    assert.equal(await cards.nth(1).locator('.live-badge').count(), 0, 'only the live camera pulses');
    assert.ok((await anims(page, '.live-badge')).includes('live-glow'), 'the badge glows');
    // Cards spring in one after another, without fading (contrast).
    const delays = await cards.evaluateAll((els) => els.slice(0, 3).map((e) => getComputedStyle(e).animationDelay));
    assert.deepEqual(delays, ['0s', '0.07s', '0.14s']);
    assert.equal(await cards.first().evaluate((e) => getComputedStyle(e).opacity), '1');
    if (width === 1280) {
      // The pointer light follows the mouse on the card under it.
      await page.waitForFunction(() => document.getAnimations().every((a) => a.animationName !== 'cam-in' || a.playState === 'finished'));
      const box = await cards.nth(1).boundingBox();
      await page.mouse.move(box.x + 30, box.y + 10);
      await page.mouse.move(box.x + 40, box.y + 20, { steps: 4 });
      await page.waitForFunction(() => document.querySelectorAll('.cam-card')[1].style.getPropertyValue('--mx') !== '');
      const at = await cards.nth(1).evaluate((e) => [e.style.getPropertyValue('--mx'), e.style.getPropertyValue('--my')].map(parseFloat));
      assert.ok(Math.abs(at[0] - 40) <= 2 && Math.abs(at[1] - 20) <= 2, `light at the pointer: ${at}`);
      await page.waitForFunction(() => getComputedStyle(document.querySelectorAll('.cam-card')[1], '::before').opacity === '1');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll at ${width}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/motion-${width}.png` });
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // The loading places shimmer while the list is on its way.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route('**/fixtures/streams.json', async (route) => { await held; await route.continue(); });
    await page.goto(`${BASE}/`);
    await page.locator('.cam-slot').first().waitFor();
    assert.ok((await anims(page, '.cam-slot')).includes('cam-shimmer'), 'loading places shimmer');
    release();
    await ctx.close();
  }
  // Reduced motion: nothing on the list moves, and everything still reads.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await liveFirst(page);
    await page.goto(`${BASE}/`);
    await page.locator('[data-testid=stream-list] .cam-card').first().waitFor();
    assert.deepEqual(await anims(page, '.cam-card, .cam-card *'), [], 'no animation with reduced motion');
    assert.equal((await page.locator('[data-testid=stream-state]').first().innerText()).trim(), 'Live now');
    await ctx.close();
  }
}
