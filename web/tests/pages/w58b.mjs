// W5 and W8 with sign-in: voting and bidding with play coins on /play, and the signed-in
// /profile. Runs against the fake Cognito of auth.mjs and a fake write API made of page routes
// (fixture mode maps /me to /fixtures/me.json and drops the query string).
import assert from 'node:assert/strict';
import { fakeCognito, configuredContext } from './auth.mjs';

const KEY = /^[A-Za-z0-9_-]{8,64}$/;
const hasHorizontalScroll = () => document.documentElement.scrollWidth > window.innerWidth;

// The write API as DATA_MODEL section 6 describes it, with switches for the failure cases.
async function fakeApi(context, cognito) {
  const api = {
    balance: 50,
    name: null,
    posts: [],
    puts: [],
    seen: new Map(),
    abortNext: false,
    refuse: null,
    txCalls: 0,
  };
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const me = () => ({ id: 'user-sub-1', display_name: api.name, balance: api.balance, createdAt: '2026-09-29T08:00:00.000Z' });
  const bearer = (req) => assert.equal(req.headers().authorization, `Bearer ${cognito.state.access}`, 'the API gets the current access token');
  await context.route('**/fixtures/me.json', cognito.guarded(async (route) => {
    const req = route.request();
    bearer(req);
    if (req.method() === 'GET') return json(route, 200, me());
    assert.equal(req.method(), 'PUT');
    const body = JSON.parse(req.postData());
    assert.deepEqual(Object.keys(body), ['display_name'], 'PUT /me sends only the name');
    api.puts.push(body.display_name);
    if (body.display_name.toLowerCase() === 'admin') return json(route, 400, { error: 'that display_name is reserved' });
    api.name = body.display_name;
    return json(route, 200, me());
  }));
  await context.route('**/fixtures/me/transactions.json', cognito.guarded(async (route) => {
    bearer(route.request());
    api.txCalls += 1;
    if (api.txCalls === 1) {
      return json(route, 200, {
        items: [
          { id: 't3', type: 'vote', amount: -2, related_type: 'vote', related_id: 'v1', createdAt: '2026-09-29T09:00:00.000Z' },
          { id: 't2', type: 'bid_refund', amount: 21, related_type: 'bid', related_id: 'b1', createdAt: '2026-09-29T08:30:00.000Z' },
        ],
        count: 2,
        cursor: 'older',
      });
    }
    return json(route, 200, {
      items: [{ id: 't1', type: 'signup_grant', amount: 50, createdAt: '2026-09-29T08:00:00.000Z' }],
      count: 1,
    });
  }));
  await context.route('**/fixtures/interactions/*/*.json', cognito.guarded(async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    bearer(req);
    const kind = req.url().endsWith('/votes.json') ? 'vote' : 'bid';
    const key = req.headers()['idempotency-key'];
    const body = JSON.parse(req.postData());
    api.posts.push({ kind, key, body, path: new URL(req.url()).pathname });
    assert.match(key ?? '', KEY, 'every spend carries an Idempotency-Key');
    for (const banned of ['cost', 'price', 'user_id', 'balance']) assert.equal(body[banned], undefined, `no ${banned} in the body`);
    if (api.abortNext) {
      api.abortNext = false;
      return route.abort('failed');
    }
    if (api.refuse) {
      const r = api.refuse;
      api.refuse = null;
      return json(route, 409, r);
    }
    if (api.seen.has(key)) return json(route, 200, { ...api.seen.get(key), replayed: true });
    const cost = kind === 'vote'
      ? body.number_of_votes * 1 + (body.custom_request ? 5 : 0)
      : body.amount;
    if (cost > api.balance) return json(route, 409, { error: 'not enough coins', code: 'insufficient_coins' });
    api.balance -= cost;
    const answer = { charged: cost, transaction_id: `tx-${api.posts.length}` };
    api.seen.set(key, answer);
    return json(route, 201, answer);
  }));
  return api;
}

const dialog = (page) => page.locator('dialog.modal[open]');

async function openVote(page, option, votes) {
  const card = page.locator('[data-testid=vote-card]');
  await card.getByText(option, { exact: false }).first().click();
  await card.locator('input[type=number]').fill(String(votes));
  await card.locator('[data-testid=vote]').click();
  await dialog(page).waitFor();
}

async function layout(page, label) {
  assert.equal(await page.locator('main h1').count(), 1, `${label}: one h1`);
  assert.equal(await page.evaluate(hasHorizontalScroll), false, `${label}: no horizontal scroll`);
}

export async function check({ browser, BASE, SHOTS }) {
  const cognito = fakeCognito(BASE);
  const { context, errors } = await configuredContext(browser, BASE, cognito, { meFirst401: false });
  const api = await fakeApi(context, cognito);
  const page = await context.newPage();
  const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/w58b-${name}.png`, fullPage: true });

  // -- signed out, pool configured: the buttons show; Vote signs in first -------------------
  await page.goto(`${BASE}/play?capy=magnus`);
  await page.locator('[data-testid=vote]').waitFor();
  assert.equal(await page.isVisible('[data-testid=play-soon]'), false, 'no "open soon" note once sign-in exists');
  assert.equal(await page.isVisible('[data-testid=thanks]'), false, 'no empty thank-you box');
  assert.match(await page.innerText('[data-testid=vote-card]'), /sign in first/);
  const voteCard = page.locator('[data-testid=vote-card]');
  await voteCard.getByText('Watermelon').click();
  await voteCard.locator('input[type=number]').fill('3');
  await voteCard.locator('[data-testid=vote]').click();
  await page.waitForURL(`${BASE}/auth/callback**`);
  await page.waitForURL(`${BASE}/play?capy=magnus`);
  await dialog(page).waitFor();
  assert.equal(cognito.log.authorize.length, 1, 'Vote went through sign-in');
  assert.equal(await page.innerText('[data-testid=confirm-what]'), '3 votes for Watermelon in “Pick Magnus\'s snack”.');
  await page.waitForFunction(() => document.querySelector('[data-testid=confirm-sum]')?.innerText.includes('After'));
  assert.equal(await page.innerText('[data-testid=confirm-sum]'), 'Cost: 3 play coins\nYour balance: 50 play coins\nAfter: 47 play coins');
  assert.equal(api.posts.length, 0, 'back from sign-in: nothing charged before Confirm');
  await layout(page, 'confirm @1280');
  await shot('confirm-1280');

  // -- Cancel charges nothing ----------------------------------------------------------------
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await dialog(page).waitFor({ state: 'detached' });
  assert.equal(api.posts.length, 0, 'Cancel sends no POST');

  // -- Confirm: one POST, even on a double click; thanks with the new balance ----------------
  await openVote(page, 'Carrots', 2);
  await page.locator('[data-testid=confirm]').dblclick();
  await page.locator('[data-testid=thanks]').getByText('Thank you for your vote!').waitFor();
  assert.equal(api.posts.length, 1, 'a double click sends one POST');
  assert.deepEqual(api.posts[0].body, { option_id: 'carrots', number_of_votes: 2 });
  assert.equal(api.posts[0].path, '/fixtures/interactions/snack-vote-1/votes.json');
  assert.equal(await page.innerText('[data-testid=thanks]'), 'Thank you for your vote! 2 play coins spent. You have 48 play coins now.');
  await page.waitForFunction(() => document.querySelector('.coin-pill')?.textContent.includes('48'));
  assert.equal(await dialog(page).count(), 0, 'the dialog closes after a charge');
  await shot('thanks-1280');

  // -- a retry after a network error reuses the key; a separate vote gets a new one -----------
  await voteCard.getByText('Your own snack idea').click();
  await voteCard.locator('input[type=number]').fill('1');
  await voteCard.locator('[data-testid=vote]').click();
  await voteCard.getByText('Write your snack idea first.').waitFor();
  assert.equal(await dialog(page).count(), 0);
  await voteCard.locator('.play-idea').fill('Mango please');
  await voteCard.locator('[data-testid=vote]').click();
  await dialog(page).waitFor();
  assert.equal(await page.innerText('[data-testid=confirm-what]'), '1 vote for your snack idea “Mango please” in “Pick Magnus\'s snack”.');
  await page.waitForFunction(() => document.querySelector('[data-testid=confirm-sum]')?.innerText.includes('Cost: 6 play coins\nYour balance: 48'));
  api.abortNext = true;
  await page.locator('[data-testid=confirm]').click();
  await dialog(page).getByText('No answer from CapyTube').waitFor();
  await page.locator('[data-testid=confirm]', { hasText: 'Try again' }).click();
  await page.locator('[data-testid=thanks]').getByText('6 play coins spent').waitFor();
  assert.equal(api.posts.length, 3);
  assert.equal(api.posts[1].key, api.posts[2].key, 'the retry reuses the key');
  assert.notEqual(api.posts[1].key, api.posts[0].key, 'a separate vote uses a new key');
  assert.deepEqual(api.posts[2].body, { custom_request: 'Mango please', number_of_votes: 1 });
  assert.equal(api.balance, 42, 'charged once for the retried vote');

  // -- refusals: plain messages, nothing charged ------------------------------------------------
  const before = api.balance;
  api.refuse = { error: 'not enough coins', code: 'insufficient_coins' };
  await openVote(page, 'Pandan', 1);
  await page.locator('[data-testid=confirm]').click();
  await dialog(page).getByText('Not enough play coins: this costs 1 play coin and you have 42 play coins. Nothing was spent.').waitFor();
  assert.equal(await page.isVisible('[data-testid=confirm]'), false, 'no Confirm after a refusal');
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  api.refuse = { error: 'this interaction is closed', code: 'interaction_closed' };
  await openVote(page, 'Pandan', 1);
  await page.locator('[data-testid=confirm]').click();
  await dialog(page).getByText('This has closed. Nothing was spent.').waitFor();
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  // Known to be short before sending: no Confirm at all, and no POST.
  api.balance = 3;
  await page.reload();
  await openVote(page, 'Pandan', 5);
  await page.waitForFunction(() => document.querySelector('[data-testid=confirm-sum]')?.innerText.includes('After: not enough play coins'));
  assert.equal(await page.isVisible('[data-testid=confirm]'), false);
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  api.balance = before;
  const posted = api.posts.length;

  // -- bids: the minimum is checked here, then by the server ----------------------------------
  await page.goto(`${BASE}/play?capy=elon`);
  const bidCard = page.locator('[data-testid=bid-card]');
  await bidCard.locator('[data-testid=bid]').waitFor();
  assert.equal(await bidCard.locator('input[type=number]').inputValue(), '21', 'the bid starts at the minimum');
  await bidCard.locator('input[type=number]').fill('20');
  await bidCard.locator('[data-testid=bid]').click();
  await bidCard.getByText('Bid at least 21 play coins.').waitFor();
  assert.equal(await dialog(page).count(), 0);
  await bidCard.locator('input[type=number]').fill('21');
  await bidCard.locator('[data-testid=bid]').click();
  await dialog(page).waitFor();
  assert.equal(await page.innerText('[data-testid=confirm-what]'), 'Bid 21 play coins on “Name the next climbing hold”.');
  assert.match(await dialog(page).innerText(), /come back to you/);
  api.refuse = { error: 'a bid must be at least 25', code: 'bid_too_low' };
  await page.locator('[data-testid=confirm]').click();
  await dialog(page).getByText('Someone bid higher. The minimum is now 25 play coins. Nothing was spent.').waitFor();
  assert.equal(api.balance, before, 'refusals charge nothing');
  assert.equal(api.posts.length, posted + 1);
  assert.deepEqual(api.posts.at(-1).body, { amount: 21 });
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();

  // -- phone width: the confirm dialog fits ----------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/play?capy=magnus`);
  await openVote(page, 'Carrots', 1);
  await page.waitForFunction(() => document.querySelector('[data-testid=confirm-sum]')?.innerText.includes('After'));
  await layout(page, 'confirm @390');
  const box = await dialog(page).boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390, 'the dialog fits a phone');
  await shot('confirm-390');
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await shot('play-390');

  // -- profile: name, balance, ledger ----------------------------------------------------------
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    api.txCalls = 0;
    await page.goto(`${BASE}/profile`);
    const ledger = page.locator('[data-testid=ledger] li');
    await ledger.first().waitFor();
    await layout(page, `profile @${width}`);
    assert.equal(await page.isVisible('.profile-pitch'), false, 'no signed-out pitch when signed in');
    assert.equal(await page.innerText('[data-testid=balance]'), `${api.balance} play coins`);
    assert.deepEqual(await ledger.allInnerTexts(), [
      'Snack vote: -2 play coins, 2026-09-29',
      'Bid returned (outbid): +21 play coins, 2026-09-29',
    ]);
    await page.locator('[data-testid=load-more]').click();
    await page.getByText('Welcome grant: +50 play coins, 2026-09-29').waitFor();
    assert.equal(await ledger.count(), 3);
    assert.equal(await page.isVisible('[data-testid=load-more]'), false, 'no Load more after the last page');
    await shot(`profile-${width}`);
  }
  const name = page.locator('[data-testid=name-input]');
  const note = page.locator('[data-testid=name-note]');
  if (!api.name) await page.getByText('Pick a name others will see.').waitFor();
  await name.fill('a');
  await name.press('Enter');
  await note.getByText('Use 2 to 32 characters.').waitFor();
  assert.equal(api.puts.length, 0, 'too short: nothing sent');
  await name.fill('admin');
  await page.getByRole('button', { name: 'Save' }).click();
  await note.getByText('That name is reserved. Please pick another.').waitFor();
  await name.fill('Capy Fan');
  await page.getByRole('button', { name: 'Save' }).click();
  await note.getByText('Saved.').waitFor();
  await page.getByText('Others see you as Capy Fan.').waitFor();
  assert.deepEqual(api.puts, ['admin', 'Capy Fan']);

  assert.deepEqual(errors, [], 'no page errors');
  assert.deepEqual(cognito.log.problems, [], 'every request the fakes saw was valid');
  await context.close();
}
