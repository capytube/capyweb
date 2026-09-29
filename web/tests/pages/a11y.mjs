// W14: accessibility. axe-core (WCAG 2.0 to 2.2, levels A and AA) on the main routes, signed out
// and signed in, at phone and desktop widths, with the dialogs open too; any serious or critical
// violation fails. Then the keyboard checks axe cannot make: dialog focus in and back out, the
// skip link on a phone, and focus never hidden under the sticky top bar.
//
// axe-core is a local test tool, like Playwright, and lives next to it (never in a package.json):
//   npm install --prefix ~/.cache/capyweb/pw axe-core
// Without it this file skips, with a note in the smoke log, rather than failing the push.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fakeCognito, configuredContext } from './auth.mjs';

const require = createRequire(import.meta.url);
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ROUTES = ['/', '/watch', '/stream/magnus', '/play?capy=magnus', '/shop', '/shop/capy-1234', '/profile', '/robot', '/about-us', '/privacy-policy', '/no/such/page', '/shop/nope', '/stream/nobody'];
const WIDTHS = [390, 1280];
// The missing pass's 404 is logged to the console on purpose (crawl.mjs): open it raw, since
// smoke.mjs's open() counts every console error.
const RAW = new Set(['/shop/nope']);
const LEDGER = JSON.stringify({ items: [{ id: 't1', type: 'signup_grant', amount: 50, createdAt: '2026-09-29T08:00:00.000Z' }], count: 1 });

/** Where axe.min.js is, found the way smoke.mjs finds Playwright (NODE_PATH), or null. */
function axePath() {
  try {
    return require.resolve('axe-core/axe.min.js');
  } catch {
    return null;
  }
}

/** Serious and critical violations on the page as it is now, one line each. axe goes in
 *  through evaluate, which the page's CSP does not govern: a script tag would be an inline
 *  script, which it blocks (and smoke.mjs counts as a violation). */
async function audit(page, AXE, label) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(`${readFileSync(AXE, 'utf8')}\n;0`);
  const found = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .flatMap((v) => v.nodes.map((n) => `${v.impact} ${v.id}: ${n.target.join(' ')} (${v.help})`));
  }, TAGS);
  return found.map((f) => `${label}: ${f}`);
}

const focused = (page) => page.evaluate(() => {
  const e = document.activeElement;
  return { testid: e?.dataset.testid ?? null, text: e?.textContent.trim() ?? '', inDialog: !!e?.closest('dialog') };
});

async function signedIn(browser, BASE, width) {
  const cognito = fakeCognito(BASE);
  const { context, errors } = await configuredContext(browser, BASE, cognito, { width, meFirst401: false });
  await context.route('**/fixtures/me/transactions.json', (route) => route.fulfill({ contentType: 'application/json', body: LEDGER }));
  const posts = [];
  context.on('request', (req) => { if (req.method() === 'POST' && req.url().includes('/interactions/')) posts.push(req.url()); });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  await page.click('[data-testid=sign-in]');
  await page.waitForURL(`${BASE}/`);
  await page.locator('[data-testid=sign-out]').waitFor();
  return { context, errors, cognito, page, posts };
}

export async function check({ open, browser, settle, BASE }) {
  const AXE = axePath();
  if (!AXE) {
    console.log('a11y: skipped, axe-core is not installed next to Playwright (npm install --prefix ~/.cache/capyweb/pw axe-core)');
    return;
  }
  const problems = [];

  // -- signed out: every main route at both widths, and the footer's play-coins dialog --------
  for (const width of WIDTHS) {
    for (const path of ROUTES) {
      let page;
      if (RAW.has(path)) {
        page = await browser.newPage({ viewport: { width, height: 844 } });
        await page.goto(BASE + path);
        await page.waitForSelector('main h1');
      } else {
        ({ page } = await open(path, { width, height: 844 }));
      }
      await settle();
      problems.push(...await audit(page, AXE, `out@${width} ${path}`));
      if (path === '/watch') {
        await page.click('text=Play coins are not money');
        await page.waitForSelector('dialog.modal[open]');
        problems.push(...await audit(page, AXE, `out@${width} play-coins dialog`));
      }
      await page.close();
    }
  }

  // -- signed in: the same routes, and Play's confirm dialog -----------------------------------
  for (const width of WIDTHS) {
    const { context, errors, cognito, page } = await signedIn(browser, BASE, width);
    for (const path of ROUTES) {
      await page.goto(BASE + path);
      await page.waitForSelector('main h1');
      await settle();
      problems.push(...await audit(page, AXE, `in@${width} ${path}`));
    }
    await page.goto(`${BASE}/play?capy=magnus`);
    const card = page.locator('[data-testid=vote-card]');
    await card.getByText('Carrots').click();
    await card.locator('[data-testid=vote]').click();
    await page.waitForSelector('dialog.modal[open] [data-testid=confirm]:not([hidden])');
    problems.push(...await audit(page, AXE, `in@${width} confirm dialog`));
    assert.deepEqual(errors, [], `no page errors signed in @${width}`);
    assert.deepEqual(cognito.log.problems, []);
    await context.close();
  }
  assert.deepEqual(problems, [], 'no serious or critical axe violations');

  // -- keyboard: the play-coins dialog opens on Enter, focus moves in, Escape returns it --------
  const { page: kb } = await open('/watch', { width: 390, height: 844 });
  await kb.keyboard.press('Tab');
  const skip = await kb.evaluate(() => {
    const r = document.activeElement.getBoundingClientRect();
    return { cls: document.activeElement.className, inView: r.top >= 0 && r.bottom <= innerHeight && r.width > 1 };
  });
  assert.deepEqual(skip, { cls: 'skip', inView: true }, 'the first Tab on a phone shows the skip link');
  await kb.keyboard.press('Enter');
  assert.equal(await kb.evaluate(() => document.activeElement.id), 'main', 'the skip link moves focus to main');
  await kb.focus('text=Play coins are not money');
  await kb.keyboard.press('Enter');
  await kb.waitForSelector('dialog.modal[open]');
  assert.deepEqual(await focused(kb), { testid: null, text: 'Close', inDialog: true }, 'focus starts on Close');
  await kb.keyboard.press('Escape');
  await kb.waitForSelector('dialog.modal:not([open])', { state: 'attached' });
  assert.equal((await focused(kb)).text, 'Play coins are not money', 'Escape returns focus to the opener');
  // The brown phone tab bar gets a light focus ring: the default dark green is 1.7:1 on it.
  await kb.focus('.tabbar a[href="/shop"]');
  assert.equal(await kb.evaluate(() => getComputedStyle(document.activeElement).outlineColor), 'rgb(255, 227, 162)');
  await kb.close();

  // -- keyboard: Play's confirm opens on Cancel, not Confirm, and Escape spends nothing ---------
  const { context, page, posts } = await signedIn(browser, BASE, 390);
  await page.goto(`${BASE}/play?capy=magnus`);
  const card = page.locator('[data-testid=vote-card]');
  await card.locator('[data-testid=vote]').waitFor();
  assert.equal(await page.getAttribute('.play-picker-btn[aria-pressed=true]', 'aria-pressed'), 'true', 'the chosen capybara reads as pressed');
  assert.equal(await page.locator('.play-picker-btn[aria-pressed=false]').count(), 2, 'the others read as not pressed');
  // An error is announced (role=alert) and stays tied to the button that caused it.
  await card.locator('[data-testid=vote]').focus();
  await page.keyboard.press('Enter');
  const err = card.locator('.play-err');
  await err.getByText('Pick a snack first.').waitFor();
  assert.equal(await card.locator('[data-testid=vote]').getAttribute('aria-describedby'), await err.getAttribute('id'));
  await card.getByText('Carrots').click();
  await card.locator('[data-testid=vote]').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog.modal[open]');
  assert.deepEqual(await focused(page), { testid: null, text: 'Cancel', inDialog: true }, 'focus starts on Cancel');
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog.modal:not([open])', { state: 'attached' });
  assert.equal((await focused(page)).testid, 'vote', 'Escape returns focus to Vote');
  assert.deepEqual(posts, [], 'nothing was spent');
  await context.close();

  // -- focus is never hidden under the sticky top bar (WCAG 2.4.11), even going backwards ------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const shop = await ctx.newPage();
  await shop.goto(`${BASE}/shop`);
  await shop.locator('.pass-link').first().focus();
  await shop.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shop.keyboard.press('Shift+Tab');
  await shop.keyboard.press('Shift+Tab');
  const gap = await shop.evaluate(() => {
    return {
      id: document.activeElement.id,
      below: document.activeElement.getBoundingClientRect().top - document.querySelector('header.topbar').getBoundingClientRect().bottom,
    };
  });
  assert.equal(gap.id, 'pass-search');
  assert.ok(gap.below >= 0, `the search field clears the top bar (${gap.below}px)`);
  await ctx.close();
}
