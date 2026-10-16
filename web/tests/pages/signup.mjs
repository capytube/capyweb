// Our own sign-up (hm-nuhjd): managed login's sign-up always asks a password, so a new account is
// made here with the email and a code (Cognito SignUp + ConfirmSignUp, no password), then signs
// in on managed login with the email filled in and goes on to add a passkey. Against the fake
// Cognito of auth.mjs plus a fake user-pool API, both intercepted in the browser.
import assert from 'node:assert/strict';
import { fakeCognito } from './auth.mjs';

const DOMAIN = 'https://capyapp-test.auth.example.com';
const IDP = 'https://cognito-idp.ap-southeast-1.amazonaws.com';
const CLIENT = 'testclient123';
const CONFIG = JSON.stringify({ auth: { domain: DOMAIN, client_id: CLIENT, idp: IDP } });
const EMAIL = 'new.user+capy@example.com';
// An address whose earlier sign-up was never confirmed.
const PENDING = 'half.done@example.com';

export async function check({ browser, BASE }) {
  const cognito = fakeCognito(BASE);
  const idp = [];
  const passkeys = [];
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const errors = [];
    context.on('weberror', (e) => errors.push(e.error().message));
    await context.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: CONFIG }));
    await context.route('**/fixtures/me.json', (route) => route.fulfill({ contentType: 'application/json', body: '{"id":"user-sub-1","display_name":"Nok","balance":42,"createdAt":"2026-09-29T00:00:00Z"}' }));
    await context.route(`${DOMAIN}/**`, cognito.handle);
    // Managed login's add-a-passkey page: back to redirect_uri, with no code.
    await context.route(`${DOMAIN}/passkeys/add**`, (route) => {
      const q = Object.fromEntries(new URL(route.request().url()).searchParams);
      passkeys.push(q);
      return route.fulfill({ status: 302, headers: { location: q.redirect_uri } });
    });
    await context.route(`${IDP}/**`, cognito.guarded((route) => {
      const req = route.request();
      const action = req.headers()['x-amz-target'];
      const body = JSON.parse(req.postData() ?? '{}');
      idp.push({ action, body });
      assert.equal(req.headers()['content-type'], 'application/x-amz-json-1.1');
      assert.equal(body.ClientId, CLIENT);
      const cors = { 'access-control-allow-origin': BASE, 'content-type': 'application/x-amz-json-1.1' };
      if (action === 'AWSCognitoIdentityProviderService.SignUp') {
        assert.equal(body.Password, undefined, 'sign-up sends no password');
        if (body.Username === PENDING) {
          return route.fulfill({ status: 400, headers: cors, body: '{"__type":"UsernameExistsException","message":"exists"}' });
        }
        assert.deepEqual(body.UserAttributes, [{ Name: 'email', Value: body.Username }]);
        return route.fulfill({ headers: cors, body: '{"UserConfirmed":false,"UserSub":"user-sub-1"}' });
      }
      if (action === 'AWSCognitoIdentityProviderService.ConfirmSignUp') {
        if (body.ConfirmationCode !== '123456') {
          return route.fulfill({ status: 400, headers: cors, body: '{"__type":"CodeMismatchException","message":"Invalid code"}' });
        }
        return route.fulfill({ headers: cors, body: '{}' });
      }
      if (action === 'AWSCognitoIdentityProviderService.ResendConfirmationCode') {
        return route.fulfill({ headers: cors, body: '{"CodeDeliveryDetails":{}}' });
      }
      throw new Error(`unexpected action ${action}`);
    }));
    const page = await context.newPage();
    const authorizeBefore = cognito.log.authorize.length;

    // -- "Sign in" opens the chooser; its "Sign in" is plain managed login, no hint ----------------
    await page.goto(`${BASE}/shop`);
    await page.click('[data-testid=sign-in]');
    await page.locator('[data-testid=signin-choose]').waitFor();
    assert.equal(cognito.log.authorize.length, authorizeBefore, 'the chooser opens before any redirect');
    if (width === 390) {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll with the chooser at 390px');
      await page.click('[data-testid=choose-sign-in]');
      await page.waitForURL(`${BASE}/shop`);
      await page.locator('[data-testid=sign-out]').waitFor();
      assert.equal(cognito.log.authorize.at(-1).login_hint, undefined);
      assert.equal(passkeys.length, 0, 'a plain sign-in does not go to the add-a-passkey page by itself');
      // ...it offers one, once per account and device: "Add a passkey" goes there and back here.
      const offer = page.locator('#passkey-offer[open]');
      await offer.waitFor();
      assert.equal(await offer.getByRole('heading').innerText(), 'Sign in faster next time');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the offer fits a phone');
      await offer.locator('[data-testid=passkey-offer-add]').click();
      for (let t = 0; passkeys.length === 0; t += 1) {
        assert.ok(t < 300, 'the add-a-passkey page within 30 s');
        await page.waitForTimeout(100);
      }
      await page.waitForURL(`${BASE}/shop`);
      await page.locator('[data-testid=sign-out]').waitFor();
      assert.deepEqual(passkeys, [{ client_id: CLIENT, redirect_uri: `${BASE}/auth/callback` }]);
      const plainSignIn = async () => {
        await page.click('[data-testid=sign-out]');
        await page.locator('[data-testid=sign-in]').waitFor();
        await page.click('[data-testid=sign-in]');
        await page.click('[data-testid=choose-sign-in]');
        await page.locator('[data-testid=sign-out]').waitFor();
        await page.waitForTimeout(500);
      };
      await plainSignIn();
      assert.equal(await offer.count(), 0, 'not offered again once a passkey was added here');
      // Another account on this device (its flag cleared): "Not now" is remembered too.
      await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('capyweb.auth.passkey-offered.')).forEach((k) => localStorage.removeItem(k)));
      await plainSignIn();
      await offer.waitFor();
      await offer.getByRole('button', { name: 'Not now', exact: true }).click();
      await offer.waitFor({ state: 'detached' });
      await plainSignIn();
      assert.equal(await offer.count(), 0, '"Not now": not offered again on this device');
      assert.equal(passkeys.length, 1, '"Not now" opens no passkey page');
      passkeys.length = 0;
      await context.close();
      assert.deepEqual(errors, []);
      continue;
    }

    // -- "Create account": email, code, then managed login with the email, then add a passkey ----
    await page.click('[data-testid=choose-sign-up]');
    await page.fill('#signup-email', 'not-an-email');
    await page.click('[data-testid=signup-email] button[type=submit]');
    await page.getByText('Please enter your email address.').waitFor();
    assert.equal(idp.length, 0, 'nothing sent for a malformed email');
    // Back to the choice and forward again; an unconfirmed address gets its code again.
    await page.click('[data-testid=signup-back]');
    await page.locator('[data-testid=signin-choose]:not([hidden])').waitFor();
    await page.click('[data-testid=choose-sign-up]');
    await page.fill('#signup-email', PENDING);
    await page.click('[data-testid=signup-email] button[type=submit]');
    await page.locator('[data-testid=signup-code]:not([hidden])').waitFor();
    assert.deepEqual(idp.map((c) => c.action.split('.')[1]), ['SignUp', 'ResendConfirmationCode']);
    idp.length = 0;
    await page.click('[data-testid=signup-change-email]');
    await page.locator('[data-testid=signup-email]:not([hidden])').waitFor();
    await page.fill('#signup-email', ` ${EMAIL.toUpperCase()} `);
    await page.click('[data-testid=signup-email] button[type=submit]');
    await page.locator('[data-testid=signup-code]:not([hidden])').waitFor();
    assert.equal(idp.at(-1).body.Username, EMAIL, 'trimmed and lower-cased');
    await page.getByText('Send a new code').click();
    await page.getByText('We sent a 6-digit code').waitFor();
    assert.equal(idp.at(-1).action, 'AWSCognitoIdentityProviderService.ResendConfirmationCode');
    await page.fill('#signup-code', '000000');
    await page.click('[data-testid=signup-code] button[type=submit]');
    await page.getByText('That code is not right.').waitFor();
    await page.fill('#signup-code', '123 456');
    await page.click('[data-testid=signup-code] button[type=submit]');
    // Managed login, the code exchange, the add-a-passkey page, then back here signed in.
    for (let t = 0; passkeys.length === 0; t += 1) {
      assert.ok(t < 300, 'the add-a-passkey page within 30 s');
      await page.waitForTimeout(100);
    }
    await page.waitForURL(`${BASE}/shop`);
    await page.locator('[data-testid=sign-out]').waitFor();
    assert.equal(cognito.log.authorize.at(-1).login_hint, EMAIL, 'managed login gets the email');
    assert.deepEqual(passkeys, [{ client_id: CLIENT, redirect_uri: `${BASE}/auth/callback` }], 'then the add-a-passkey page, once');
    assert.equal(await page.evaluate(() => location.search), '');
    assert.deepEqual(idp.map((c) => c.action.split('.')[1]), ['SignUp', 'ResendConfirmationCode', 'ConfirmSignUp', 'ConfirmSignUp']);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#passkey-offer[open]').count(), 0, 'after sign-up and its passkey page, no offer on top');

    // -- signed in: the profile page offers another passkey and comes back to itself --------------
    await page.goto(`${BASE}/profile`);
    await page.click('[data-testid=add-passkey]');
    for (let t = 0; passkeys.length === 1; t += 1) {
      assert.ok(t < 300, 'the add-a-passkey page within 30 s');
      await page.waitForTimeout(100);
    }
    await page.waitForURL(`${BASE}/profile`);
    assert.equal(passkeys.length, 2);
    await page.locator('[data-testid=sign-out]').waitFor();
    assert.deepEqual(errors, [], 'no page errors in the sign-up flow');
    await context.close();
  }
  assert.deepEqual(cognito.log.problems, [], 'every request the fake Cognito saw was valid');
}
