import assert from 'node:assert/strict';
import { fakeCognito, configuredContext } from './auth.mjs';

const PUBLIC_TOOLS = [
  'get_capybara',
  'get_interactions',
  'list_capybaras',
  'list_passes',
  'list_streams',
  'open_page',
  'open_stream',
  'read_chat',
];

const FORBIDDEN_TEXT = ['/paid/', '/live/', '/media/', 'CloudFront', 'token', 'cookie', 'Bearer'];
const FORBIDDEN_KEYS = new Set(['user_id', 'userId', 'sub']);

const sortedKeys = (value) => Object.keys(value).sort();

function walk(value, each) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, each);
    return;
  }
  if (!value || typeof value !== 'object') return;
  each(value);
  for (const item of Object.values(value)) walk(item, each);
}

function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) {
    for (const item of value) allStrings(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) allStrings(item, out);
  }
  return out;
}

function assertNoSensitiveFields(value) {
  walk(value, (obj) => {
    for (const key of Object.keys(obj)) {
      assert.equal(FORBIDDEN_KEYS.has(key), false, `forbidden field ${key}`);
    }
  });
}

function assertNoForbiddenText(value) {
  for (const text of allStrings(value)) {
    for (const bad of FORBIDDEN_TEXT) {
      assert.equal(text.includes(bad), false, `forbidden text ${bad} in "${text}"`);
    }
  }
}

async function executeText(page, name, input = {}) {
  const text = await page.evaluate(async ({ name, input }) => {
    const tool = window.__webmcpTools.get(name);
    if (!tool) throw new Error(`missing tool: ${name}`);
    const out = await tool.execute(input, {});
    return out.content?.[0]?.text ?? '';
  }, { name, input });
  return JSON.parse(text);
}

async function executeError(page, name, input = {}) {
  return page.evaluate(async ({ name, input }) => {
    try {
      const tool = window.__webmcpTools.get(name);
      if (!tool) throw new Error(`missing tool: ${name}`);
      await tool.execute(input, {});
      return null;
    } catch (error) {
      return String(error);
    }
  }, { name, input });
}

export async function check({ open, browser, BASE, FAKE_WEBMCP }) {
  const { page } = await open('/', { init: FAKE_WEBMCP });
  await page.waitForFunction(() => window.__webmcpTools && window.__webmcpTools.size >= 8);

  const names = await page.evaluate(() => [...window.__webmcpTools.keys()].sort());
  assert.deepEqual(names, PUBLIC_TOOLS, 'public tools at load while signed out');

  const annotations = await page.evaluate(() => Object.fromEntries(
    [...window.__webmcpTools.entries()].map(([name, tool]) => [name, tool.annotations]),
  ));
  assert.equal(annotations.read_chat.readOnlyHint, true);
  assert.equal(annotations.read_chat.untrustedContentHint, true);
  assert.equal(annotations.open_page.readOnlyHint, false);
  assert.equal(annotations.open_stream.readOnlyHint, false);
  for (const [name, ann] of Object.entries(annotations)) {
    assert.equal(ann.consequentialHint, false, `${name} consequentialHint should be false`);
  }

  const capybaras = await executeText(page, 'list_capybaras');
  assert.ok(capybaras.length >= 1);
  assert.deepEqual(sortedKeys(capybaras[0]), [
    'awake_from',
    'awake_to',
    'bio',
    'favorite_activities',
    'fun_fact',
    'id',
    'name',
    'personality',
  ]);

  const oneCapy = await executeText(page, 'get_capybara', { id: 'magnus' });
  assert.deepEqual(sortedKeys(oneCapy), [
    'awake_from',
    'awake_to',
    'bio',
    'favorite_activities',
    'fun_fact',
    'id',
    'name',
    'personality',
  ]);

  const voteInteractions = await executeText(page, 'get_interactions', { capybara: 'magnus' });
  assert.equal(voteInteractions.length, 1);
  assert.deepEqual(sortedKeys(voteInteractions[0]), [
    'capybara_id',
    'closing_time',
    'custom_request_cost',
    'id',
    'options',
    'status',
    'title',
    'type',
    'vote_cost',
  ]);
  assert.deepEqual(sortedKeys(voteInteractions[0].options[0]), ['id', 'label']);

  const bidInteractions = await executeText(page, 'get_interactions', { capybara: 'elon' });
  assert.equal(bidInteractions.length, 1);
  assert.deepEqual(sortedKeys(bidInteractions[0]), [
    'capybara_id',
    'closing_time',
    'current_bid',
    'id',
    'min_next_bid',
    'status',
    'title',
    'type',
  ]);

  const passes = await executeText(page, 'list_passes');
  assert.deepEqual(sortedKeys(passes), ['note', 'passes']);
  assert.match(passes.note, /browse-only/i);
  assert.ok(passes.passes.length >= 1);
  assert.deepEqual(sortedKeys(passes.passes[0]), ['for_sale', 'id', 'name', 'price']);

  await page.route('**/fixtures/streams/main-cam/chat.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      items: [
        {
          id: 'msg-1',
          stream_id: 'main-cam',
          user_id: 'seed-user-1',
          sub: 'user-sub-1',
          display_name: 'Capy Fan',
          text: 'hello from the wall',
          createdAt: '2026-09-29T00:00:00Z',
        },
      ],
      count: 1,
    }),
  }));
  const chat = await executeText(page, 'read_chat', { stream: 'main-cam' });
  assert.equal(chat.length, 1);
  assert.deepEqual(sortedKeys(chat[0]), ['createdAt', 'display_name', 'text']);

  for (const output of [capybaras, oneCapy, voteInteractions, bidInteractions, passes, chat]) {
    assertNoSensitiveFields(output);
    assertNoForbiddenText(output);
  }

  for (const [name, key] of [
    ['open_stream', 'capybara'],
    ['get_capybara', 'id'],
    ['get_interactions', 'capybara'],
    ['read_chat', 'stream'],
  ]) {
    const bad = await executeError(page, name, { [key]: '../x' });
    assert.match(bad, /invalid id/i);
    const empty = await executeError(page, name, { [key]: '' });
    assert.match(empty, /invalid id/i);
  }
  await page.close();

  const cognito = fakeCognito(BASE);
  const { context, errors } = await configuredContext(browser, BASE, cognito, { init: FAKE_WEBMCP });
  const signed = await context.newPage();
  const paths = [];
  signed.on('request', (request) => paths.push(new URL(request.url()).pathname));

  await signed.goto(`${BASE}/shop`);
  await signed.waitForFunction(() => window.__webmcpTools && window.__webmcpTools.size >= 8);
  assert.deepEqual(
    await signed.evaluate(() => [...window.__webmcpTools.keys()].sort()),
    PUBLIC_TOOLS,
    'signed-out configured context has public tools only',
  );

  await signed.evaluate(() => window.__webmcpTools.get('open_stream').execute({ capybara: 'elon' }, {}));
  await signed.waitForURL(`${BASE}/stream/elon`);
  await signed.locator('[data-testid=paid-sign-in], [data-testid=paid-watch]').first().waitFor();
  assert.equal(paths.some((path) => path.includes('/playback') || path.includes('/paid/')), false);

  await signed.click('[data-testid=paid-sign-in]');
  await signed.waitForURL(`${BASE}/stream/elon`);
  await signed.locator('[data-testid=sign-out]').waitFor();
  await signed.waitForFunction(() => window.__webmcpTools.has('get_my_account'));
  const withAccount = await signed.evaluate(() => [...window.__webmcpTools.keys()].sort());
  assert.equal(withAccount.includes('get_my_account'), true);

  const account = await executeText(signed, 'get_my_account');
  assert.deepEqual(sortedKeys(account), ['balance', 'display_name']);
  assertNoSensitiveFields(account);
  assertNoForbiddenText(account);

  await signed.click('[data-testid=sign-out]');
  await signed.waitForURL(`${BASE}/`);
  await signed.locator('[data-testid=sign-in]').waitFor();
  await signed.waitForFunction(() => !window.__webmcpTools.has('get_my_account'));
  assert.deepEqual(
    await signed.evaluate(() => [...window.__webmcpTools.keys()].sort()),
    PUBLIC_TOOLS,
    'public tools remain after sign-out',
  );
  assert.deepEqual(errors, [], 'no page errors while exercising tools');
  await context.close();
}
