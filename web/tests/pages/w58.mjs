import assert from 'node:assert/strict';

const hasHorizontalScroll = () => document.documentElement.scrollWidth > window.innerWidth;

async function commonA11y(page, expectedTitle) {
  assert.equal(await page.title(), `${expectedTitle} · CapyTube`);
  assert.equal(await page.locator('main h1').count(), 1);
  assert.equal(await page.evaluate(hasHorizontalScroll), false, 'no horizontal scroll');
}

export async function check({ open, SHOTS }) {
  for (const width of [390, 1280]) {
    const { page: play } = await open('/play', { width, height: width === 390 ? 844 : 800 });
    await play.waitForSelector('.play-picker-btn');
    await commonA11y(play, 'Play');
    assert.equal(await play.locator('[data-testid="play-soon"]').count(), 1);
    const picker = play.locator('.play-picker-btn');
    assert.ok((await picker.count()) >= 3);
    await picker.filter({ hasText: 'Magnus' }).click();
    await play.waitForURL('**/play?capy=magnus');
    await play.waitForSelector('[data-testid="vote-card"]');
    assert.match(await play.locator('[data-testid="vote-card"]').innerText(), /Cost: 1 coin\(s\) per vote/);
    assert.match(await play.locator('[data-testid="vote-card"]').innerText(), /Custom request cost: 5 coin\(s\)/);
    assert.match(await play.locator('[data-testid="vote-card"]').innerText(), /Carrots/);
    await picker.filter({ hasText: 'Elon' }).click();
    await play.waitForURL('**/play?capy=elon');
    await play.waitForSelector('[data-testid="bid-card"]');
    assert.match(await play.locator('[data-testid="bid-card"]').innerText(), /Current top bid: 20 coin\(s\)/);
    assert.match(await play.locator('[data-testid="bid-card"]').innerText(), /Minimum next bid: 21 coin\(s\)/);
    await picker.filter({ hasText: 'Einstein' }).click();
    await play.waitForURL('**/play?capy=einstein');
    await play.waitForSelector('text=No open vote or bid cards for this capybara yet.');
    assert.equal(await play.locator('text=No open vote or bid cards for this capybara yet.').count(), 1);
    await picker.filter({ hasText: 'Elon' }).click();
    await play.waitForURL('**/play?capy=elon');
    await play.reload();
    await play.waitForURL('**/play?capy=elon');
    await play.waitForSelector('[data-testid="bid-card"]');
    assert.equal(await play.locator('.play-picker-btn.active', { hasText: 'Elon' }).count(), 1, 'reload keeps capy query selection');
    assert.equal(
      await play.locator('main button', { hasText: /vote|bid|confirm|sign in|log in/i }).count(),
      0,
      'write and sign-in buttons stay hidden',
    );
    if (SHOTS) await play.screenshot({ path: `${SHOTS}/w58-play-${width}.png`, fullPage: true });
    await play.close();

    const { page: profile } = await open('/profile', { width, height: width === 390 ? 844 : 800 });
    await commonA11y(profile, 'Profile');
    assert.match(await profile.innerText('main'), /Sign-in action \(coming soon\)/);
    assert.equal(await profile.locator('main button').count(), 0, 'signed-out profile has no sign-in button yet');
    if (SHOTS) await profile.screenshot({ path: `${SHOTS}/w58-profile-${width}.png`, fullPage: true });
    await profile.close();
  }
}
