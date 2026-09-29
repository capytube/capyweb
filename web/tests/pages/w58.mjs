import assert from 'node:assert/strict';

const hasHorizontalScroll = () => document.documentElement.scrollWidth > window.innerWidth;
const bannedCopy = /\blane\b|\bfixture\b|\broute\b|\bpreview\b/i;

async function commonA11y(page, expectedTitle) {
  assert.equal(await page.title(), `${expectedTitle} · CapyTube`);
  assert.equal(await page.locator('main h1').count(), 1);
  assert.equal(await page.evaluate(hasHorizontalScroll), false, 'no horizontal scroll');
  assert.doesNotMatch(await page.innerText('main'), bannedCopy, 'no developer copy');
}

export async function check({ open, SHOTS }) {
  for (const width of [390, 1280]) {
    const { page: play } = await open('/play?capy=elon', { width, height: width === 390 ? 844 : 800 });
    await play.waitForSelector('.play-picker-btn');
    await commonA11y(play, 'Play');
    assert.equal(await play.locator('[data-testid="play-soon"]').count(), 1);
    await play.waitForSelector('[data-testid="bid-card"]');
    const picker = play.locator('.play-picker-btn');
    assert.ok((await picker.count()) >= 3);
    await picker.filter({ hasText: 'Magnus' }).click();
    await play.waitForURL('**/play?capy=magnus');
    await play.waitForSelector('[data-testid="vote-card"]');
    assert.match(await play.locator('[data-testid="vote-card"]').innerText(), /Cost: 1 play coin per vote/);
    assert.match(await play.locator('[data-testid="vote-card"]').innerText(), /Custom request: 5 play coins/);
    assert.match(await play.locator('[data-testid="vote-card"]').innerText(), /Carrots/);
    await picker.filter({ hasText: 'Elon' }).click();
    await play.waitForURL('**/play?capy=elon');
    await play.waitForSelector('[data-testid="bid-card"]');
    assert.match(await play.locator('[data-testid="bid-card"]').innerText(), /Current top bid: 20 play coins/);
    assert.match(await play.locator('[data-testid="bid-card"]').innerText(), /Minimum next bid: 21 play coins/);
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
    await play.goto(new URL('/play?capy=unknown-id', play.url()).toString());
    await play.waitForSelector('.play-picker-btn');
    assert.equal(await play.locator('.play-picker-btn.active', { hasText: 'Einstein' }).count(), 1, 'bad capy query falls back to first by name');
    assert.equal(
      await play.locator('main button', { hasText: /vote|bid|confirm|sign in|log in/i }).count(),
      0,
      'write and sign-in buttons stay hidden',
    );
    if (SHOTS) await play.screenshot({ path: `${SHOTS}/w58-play-${width}.png`, fullPage: true });
    await play.close();

    const { page: profile } = await open('/profile', { width, height: width === 390 ? 844 : 800 });
    await commonA11y(profile, 'Profile');
    assert.equal(await profile.locator('[data-slot="sign-in"]').count(), 1);
    assert.equal(await profile.locator('main button').count(), 0, 'no sign-in button while no user pool is configured');
    if (SHOTS) await profile.screenshot({ path: `${SHOTS}/w58-profile-${width}.png`, fullPage: true });
    await profile.close();
  }

  const { page: missingCost } = await open('/play?capy=magnus');
  await missingCost.route('**/fixtures/capybaras/magnus/interactions.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'vote-missing',
            capybara_id: 'magnus',
            interaction_type: 'vote',
            title: 'Pick a snack',
            options: [{ id: 'o1', title: 'Carrots' }],
          },
          {
            id: 'bid-missing',
            capybara_id: 'magnus',
            interaction_type: 'bid',
            title: 'Camera car',
          },
        ],
        count: 2,
      }),
    }),
  );
  await missingCost.reload();
  await missingCost.waitForSelector('[data-testid="vote-card"]');
  const voteText = await missingCost.locator('[data-testid="vote-card"]').innerText();
  const bidText = await missingCost.locator('[data-testid="bid-card"]').innerText();
  assert.match(voteText, /Cost: Price not set/);
  assert.doesNotMatch(voteText, /Custom request:/);
  assert.match(bidText, /Current top bid: No bids yet/);
  assert.doesNotMatch(bidText, /Minimum next bid:/);
  await missingCost.close();
}
