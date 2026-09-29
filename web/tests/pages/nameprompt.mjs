// First-sign-in name prompt, using the same managed-login fake as the other page checks.
import assert from 'node:assert/strict';
import { fakeCognito, configuredContext } from './auth.mjs';

const prompt = (page) => page.locator('#name-prompt[open]');
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function setup(browser, BASE, name) {
  const cognito = fakeCognito(BASE);
  const { context, errors } = await configuredContext(browser, BASE, cognito, { meFirst401: false });
  const api = { name, gets: 0, puts: [], gate: null, fail: false };
  await context.route('**/fixtures/me.json', cognito.guarded(async (route) => {
    const req = route.request();
    assert.equal(req.headers().authorization, `Bearer ${cognito.state.access}`);
    if (req.method() === 'GET') {
      api.gets += 1;
      if (api.gate) await api.gate;
    } else {
      assert.equal(req.method(), 'PUT');
      const body = req.postDataJSON();
      assert.deepEqual(Object.keys(body), ['display_name']);
      api.puts.push(body);
      if (body.display_name === 'admin') return json(route, 400, { error: 'that display_name is reserved' });
      if (api.fail) return json(route, 500, { error: 'unavailable' });
      api.name = body.display_name;
    }
    // An undefined name is omitted, as it is for a new account.
    return json(route, 200, { id: 'user-sub-1', display_name: api.name, balance: 50 });
  }));
  await context.route('**/fixtures/me/transactions.json', (route) => json(route, 200, { items: [], count: 0 }));
  // Watch every opening, including the brief callback route that the app replaces.
  await context.addInitScript(() => {
    window.namePromptPaths = [];
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      if (this.id === 'name-prompt') window.namePromptPaths.push(location.pathname);
      return show.call(this);
    };
  });
  const page = await context.newPage();
  const finish = async () => {
    assert.deepEqual(errors, [], 'no page errors');
    assert.deepEqual(cognito.log.problems, [], 'the fake API and Cognito received valid requests');
    assert.equal(await page.evaluate(() => window.namePromptPaths.some((p) => p.startsWith('/auth/callback'))), false,
      'the prompt never opens on the callback route');
    await context.close();
  };
  return { page, context, api, cognito, finish };
}

async function signIn(page, BASE) {
  await page.locator('[data-testid=sign-in]').click();
  await page.waitForURL(`${BASE}/auth/callback**`);
  await page.waitForURL(`${BASE}/`);
  await page.locator('[data-testid=sign-out]').waitFor();
}

export async function check({ browser, BASE, settle, SHOTS }) {
  // Signed out, then a new account: focus, local validation, server errors and a saved name.
  {
    const { page, api, finish } = await setup(browser, BASE);
    await page.goto(`${BASE}/`);
    await page.locator('[data-testid=sign-in]').waitFor();
    await settle();
    assert.equal(await prompt(page).count(), 0, 'signed out: no name prompt');
    assert.equal(api.gets, 0, 'signed out: no account request');
    await signIn(page, BASE);
    await prompt(page).waitFor();
    const input = page.locator('[data-testid=name-prompt-input]');
    const save = page.locator('[data-testid=name-prompt-save]');
    const note = page.locator('[data-testid=name-prompt-note]');
    assert.equal(await input.evaluate((el) => el === document.activeElement), true, 'the name input gets focus');
    assert.equal(await input.getAttribute('maxlength'), '32');
    assert.equal(await input.getAttribute('autocomplete'), 'nickname');
    assert.equal(await note.getAttribute('role'), 'status');
    assert.equal(await prompt(page).getByRole('heading').innerText(), 'Pick a display name');
    assert.equal(api.gets, 1, 'the prompt shares the sign-in account request');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'fits a phone');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nameprompt-390.png`, fullPage: true });

    await input.fill('a');
    await save.click();
    await note.getByText('Use 2 to 32 characters.', { exact: true }).waitFor();
    assert.equal(api.puts.length, 0, 'one character sends no PUT');
    await input.fill('admin');
    await save.click();
    await note.getByText('That name is reserved. Please pick another.', { exact: true }).waitFor();
    assert.equal(await prompt(page).count(), 1, 'a reserved name keeps the dialog open');
    api.fail = true;
    await input.fill('Capy Fan');
    await save.click();
    await note.getByText('Could not save right now. Please try again.', { exact: true }).waitFor();
    assert.equal(await prompt(page).count(), 1, 'a server failure keeps the dialog open');
    api.fail = false;
    const beforeSave = api.puts.length;
    await save.click();
    await prompt(page).waitFor({ state: 'detached' });
    await page.locator('.toast').getByText('Display name saved.', { exact: true }).waitFor();
    assert.deepEqual(api.puts.slice(beforeSave), [{ display_name: 'Capy Fan' }], 'a good name sends one PUT');
    assert.equal(api.gets, 1, 'saving does not add a GET');
    await page.locator('.coin-pill').click();
    await page.waitForURL(`${BASE}/profile`);
    await page.getByText('Others see you as Capy Fan.', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-testid=name-input]').inputValue(), 'Capy Fan');
    assert.equal(api.gets, 2, 'profile loads the saved name itself');
    await finish();
  }

  // Either dismissal survives a reload, and a fresh sign-in gets another chance to ask.
  for (const close of ['Later', 'Escape']) {
    const { page, api, finish } = await setup(browser, BASE, null);
    await page.goto(`${BASE}/`);
    await signIn(page, BASE);
    await prompt(page).waitFor();
    if (close === 'Escape') await page.keyboard.press('Escape');
    else await prompt(page).getByRole('button', { name: 'Later', exact: true }).click();
    await prompt(page).waitFor({ state: 'detached' });
    await settle();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.coin-pill')?.textContent.includes('50'));
    await settle();
    assert.equal(await prompt(page).count(), 0, `${close}: no prompt after a reload in the same tab`);
    assert.equal(api.puts.length, 0, `${close}: no PUT`);
    await page.locator('[data-testid=sign-out]').click();
    await page.locator('[data-testid=sign-in]').waitFor();
    assert.equal(await prompt(page).count(), 0, 'sign-out clears the prompt');
    await signIn(page, BASE);
    await prompt(page).waitFor();
    await finish();
  }

  {
    const { page, api, finish } = await setup(browser, BASE, 'Nok');
    await page.goto(`${BASE}/`);
    await signIn(page, BASE);
    await page.waitForFunction(() => document.querySelector('.coin-pill')?.textContent.includes('50'));
    await settle();
    assert.equal(await prompt(page).count(), 0, 'an account with a name needs no prompt');
    assert.equal(api.gets, 1);
    await finish();
  }

  // A vote resumes at its confirmation; a late /me must not put another dialog on top.
  {
    const { page, api, finish } = await setup(browser, BASE);
    let release;
    api.gate = new Promise((r) => { release = r; });
    await page.goto(`${BASE}/play?capy=magnus`);
    const card = page.locator('[data-testid=vote-card]');
    await card.getByText('Watermelon').click();
    await card.locator('[data-testid=vote]').click();
    const confirm = page.locator('#play-confirm[open]');
    await confirm.waitFor();
    release();
    await page.waitForFunction(() => document.querySelector('[data-testid=confirm-sum]')?.innerText.includes('After'));
    await settle();
    assert.equal(await prompt(page).count(), 0, 'the existing confirmation keeps focus');
    assert.equal(await page.locator('dialog[open]').count(), 1);
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    await settle();
    assert.equal(await prompt(page).count(), 0, 'the skipped prompt does not reopen after confirmation closes');
    await finish();
  }

  // Refresh uses localStorage, so a returning account can still load with sessionStorage blocked.
  {
    const { page, context, finish } = await setup(browser, BASE);
    await page.goto(`${BASE}/`);
    await signIn(page, BASE);
    await prompt(page).waitFor();
    await context.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    });
    await page.reload();
    await prompt(page).waitFor();
    await prompt(page).getByRole('button', { name: 'Later', exact: true }).click();
    await prompt(page).waitFor({ state: 'detached' });
    await page.locator('.coin-pill').click();
    await page.getByText('Pick a name others will see.', { exact: true }).waitFor();
    await settle();
    assert.equal(await prompt(page).count(), 0, 'with storage blocked, dismissal still lasts for this page session');
    await finish();
  }
}
