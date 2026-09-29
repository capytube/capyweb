// W10: the WebMCP tools that spend or post (web/src/webmcp/act.rs). Each hands its action to the
// page's own confirm step, and its call settles only with the person's answer there: nothing is
// sent before their click (capyweb-manager's review hm-auue, condition 7). A stand-in
// modelContext host (smoke.mjs) records the tools; the fake Cognito is auth.mjs, and the write
// API is page routes, as in w58b.mjs and w4.mjs.
import assert from 'node:assert/strict';
import { fakeCognito, configuredContext } from './auth.mjs';

const ACT = ['cast_vote', 'place_bid', 'react', 'send_chat'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dialog = (page) => page.locator('dialog.modal[open]');

async function fakeWrites(context, cognito) {
  const api = { spends: [], chats: [], reactions: [] };
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await context.route('**/fixtures/interactions/*/*.json', cognito.guarded(async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    assert.equal(req.headers().authorization, `Bearer ${cognito.state.access}`);
    const body = JSON.parse(req.postData());
    api.spends.push({ path: new URL(req.url()).pathname, body });
    return json(route, 201, { charged: body.amount ?? body.number_of_votes, transaction_id: `tx-${api.spends.length}` });
  }));
  await context.route('**/fixtures/streams/main-cam/chat.json*', cognito.guarded(async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    const text = JSON.parse(req.postData()).text;
    api.chats.push(text);
    return json(route, 201, { message: { id: `m-${api.chats.length}`, stream_id: 'main-cam', display_name: 'Nok', text, createdAt: '2026-09-29T00:00:01.000Z' } });
  }));
  await context.route('**/fixtures/streams/main-cam/reactions.json', cognito.guarded(async (route) => {
    api.reactions.push(JSON.parse(route.request().postData()).reaction);
    return json(route, 200, { reaction: 'capylove', reactions: {} });
  }));
  return api;
}

// Start a call; its outcome lands in window.__done[name]: 'pending' until it settles.
const start = (page, name, input, abortable = false) => page.evaluate(([name, input, abortable]) => {
  window.__done ??= {};
  window.__abort ??= {};
  const opts = {};
  if (abortable) {
    window.__abort[name] = new AbortController();
    opts.signal = window.__abort[name].signal;
  }
  window.__done[name] = 'pending';
  window.__webmcpTools.get(name).execute(input, opts).then(
    (r) => { window.__done[name] = { ok: r.content[0].text }; },
    (e) => { window.__done[name] = { err: String(e) }; },
  );
}, [name, input, abortable]);
const outcome = (page, name) => page.evaluate((n) => window.__done[n], name);
const settled = async (page, name) => {
  await page.waitForFunction((n) => window.__done?.[n] !== 'pending', name, { timeout: 15000 });
  return outcome(page, name);
};
const tools = (page) => page.evaluate(() => [...window.__webmcpTools.keys()].sort());

export async function check({ browser, BASE, FAKE_WEBMCP }) {
  const cognito = fakeCognito(BASE);
  const { context, errors } = await configuredContext(browser, BASE, cognito, { meFirst401: false, init: FAKE_WEBMCP });
  const api = await fakeWrites(context, cognito);
  const page = await context.newPage();

  // -- signed out: none of them; signed in: all four, consequential ---------------------------
  await page.goto(`${BASE}/`);
  await page.locator('[data-testid=sign-in]').waitFor();
  await page.waitForFunction(() => window.__webmcpTools?.has('list_streams'));
  assert.deepEqual((await tools(page)).filter((t) => ACT.includes(t)), [], 'no spending tool signed out');
  await page.click('[data-testid=sign-in]');
  await page.waitForURL(`${BASE}/auth/callback**`);
  await page.waitForURL(`${BASE}/`);
  await page.waitForFunction((act) => act.every((t) => window.__webmcpTools?.has(t)), ACT);
  for (const name of ACT) {
    const a = await page.evaluate((n) => window.__webmcpTools.get(n).annotations, name);
    assert.deepEqual([a.consequentialHint, a.readOnlyHint], [true, false], `${name} is consequential`);
  }

  // -- a vote: Play's own dialog opens (and it alone: another open dialog is closed first,
  //    review rv-1790688216-35710); nothing is sent until Confirm ----------------------------------
  await page.click('footer button:has-text("Play coins are not money")');
  await dialog(page).waitFor();
  await start(page, 'cast_vote', { capybara: 'magnus', interaction: 'snack-vote-1', option: 'carrots', votes: 2 });
  await page.waitForURL(`${BASE}/play?capy=magnus`);
  await page.locator('#play-confirm[open]').waitFor();
  assert.equal(await page.locator('dialog[open]').count(), 1, 'one dialog at a time');
  assert.equal(await page.innerText('[data-testid=confirm-what]'), '2 votes for Carrots in “Pick Magnus\'s snack”.');
  await sleep(2000);
  assert.equal(await outcome(page, 'cast_vote'), 'pending', 'the call waits for the person');
  assert.equal(api.spends.length, 0, 'nothing is sent before Confirm');
  await page.click('[data-testid=confirm]');
  const voted = await settled(page, 'cast_vote');
  assert.match(voted.ok ?? '', /^The person pressed Confirm\. Thank you for your vote! 2 play coins spent\./);
  assert.deepEqual(api.spends, [{ path: '/fixtures/interactions/snack-vote-1/votes.json', body: { option_id: 'carrots', number_of_votes: 2 } }]);

  // -- Cancel: the call fails, nothing is sent -------------------------------------------------
  await start(page, 'cast_vote', { capybara: 'magnus', interaction: 'snack-vote-1', idea: 'mango', votes: 1 });
  await dialog(page).waitFor();
  assert.match(await page.innerText('[data-testid=confirm-what]'), /mango/);
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  assert.match((await settled(page, 'cast_vote')).err ?? '', /closed the confirm step without confirming\. Nothing was spent/);
  assert.equal(api.spends.length, 1);

  // -- withdrawn by the assistant: its dialog closes, nothing is sent --------------------------
  await start(page, 'cast_vote', { capybara: 'magnus', interaction: 'snack-vote-1', option: 'pandan', votes: 1 }, true);
  await dialog(page).waitFor();
  await page.evaluate(() => window.__abort.cast_vote.abort());
  assert.match((await settled(page, 'cast_vote')).err ?? '', /withdrew/);
  await dialog(page).waitFor({ state: 'detached' });
  assert.equal(api.spends.length, 1);

  // -- a bid on another capybara: the page moves there, then the same confirm ------------------
  await start(page, 'place_bid', { capybara: 'elon', interaction: 'wall-bid-1', amount: 25 });
  await page.waitForURL(`${BASE}/play?capy=elon`);
  await dialog(page).waitFor();
  assert.equal(api.spends.length, 1, 'nothing is sent before Confirm');
  await page.click('[data-testid=confirm]');
  assert.match((await settled(page, 'place_bid')).ok ?? '', /^The person pressed Confirm\. Thank you for your bid! 25 play coins spent\./);
  assert.deepEqual(api.spends.at(-1), { path: '/fixtures/interactions/wall-bid-1/bids.json', body: { amount: 25 } });

  // -- bad input is refused at once, and nothing moves -----------------------------------------
  const here = page.url();
  for (const [name, input, why] of [
    ['cast_vote', { capybara: 'magnus', interaction: 'snack-vote-1', option: 'carrots', votes: 11 }, /votes: 1 to 10/],
    ['cast_vote', { capybara: 'magnus', interaction: 'snack-vote-1', option: 'carrots', idea: 'x', votes: 1 }, /not both/],
    ['cast_vote', { capybara: '../admin', interaction: 'snack-vote-1', option: 'carrots', votes: 1 }, /capybara: not a valid id/],
    ['place_bid', { capybara: 'elon', interaction: 'wall-bid-1', amount: 1.5 }, /amount/],
    ['send_chat', { stream: 'main-cam', text: ' ' }, /text: 1 to 280/],
    ['react', { stream: 'main-cam', reaction: 'capyhate' }, /reaction/],
    ['send_chat', { stream: 'wall-cam', text: 'hi' }, /not a public camera/],
  ]) {
    await start(page, name, input);
    assert.match((await settled(page, name)).err ?? '', why, `${name} ${JSON.stringify(input)}`);
  }
  assert.equal(page.url(), here, 'a refused call does not move the page');
  assert.equal(await dialog(page).count(), 0);

  // -- chat: the exact text above the chat; posted only on Post --------------------------------
  const line = 'Hello from an assistant 🦫';
  await page.click('footer button:has-text("Play coins are not money")');
  await dialog(page).waitFor();
  await start(page, 'send_chat', { stream: 'main-cam', text: line });
  await page.waitForURL(`${BASE}/stream/magnus?cam=main-cam`);
  await page.locator('[data-testid=agent-ask]').waitFor();
  assert.equal(await page.locator('dialog[open]').count(), 0, 'no dialog left over the page, so Post can be pressed');
  assert.equal(await page.innerText('[data-testid=agent-ask-text]'), line);
  await sleep(2000);
  assert.equal(await outcome(page, 'send_chat'), 'pending');
  assert.deepEqual(api.chats, [], 'nothing is posted before Post');
  await page.click('[data-testid=agent-post]');
  assert.match((await settled(page, 'send_chat')).ok ?? '', /pressed Post/);
  assert.deepEqual(api.chats, [line]);
  assert.equal(await page.locator('[data-testid=agent-ask]').count(), 0);

  // -- a reaction, cancelled: nothing is sent ---------------------------------------------------
  await start(page, 'react', { stream: 'main-cam', reaction: 'capylove' });
  await page.locator('[data-testid=agent-ask]').waitFor();
  assert.equal(await page.innerText('[data-testid=agent-ask-text]'), 'capylove');
  await page.click('[data-testid=agent-cancel]');
  assert.match((await settled(page, 'react')).err ?? '', /cancelled\. Nothing was sent/);
  assert.deepEqual(api.reactions, []);

  // -- leaving the page answers a waiting call ---------------------------------------------------
  await start(page, 'react', { stream: 'main-cam', reaction: 'capywow' });
  await page.locator('[data-testid=agent-ask]').waitFor();
  await page.click('footer a[href="/about-us"]');
  assert.match((await settled(page, 'react')).err ?? '', /page was left/);
  assert.deepEqual(api.reactions, []);

  // -- sign-out drops the four (the logout redirect is held so this page stays) ------------------
  await page.route('**/logout**', () => {}); // never answered
  await page.click('[data-testid=sign-out]');
  await page.waitForFunction((act) => act.every((t) => !window.__webmcpTools.has(t)), ACT);
  assert.ok((await tools(page)).includes('list_streams'), 'the public tools stay');

  assert.deepEqual(errors, [], 'no page errors');
  assert.deepEqual(cognito.log.problems, [], 'every request the fakes saw was valid');
  await context.close();
}
