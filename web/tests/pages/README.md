# Per-page browser checks

`../smoke.mjs` imports every `*.mjs` here, in name order, and calls its `check(ctx)` after the
shell checks. One file per page, so page tasks built in parallel never edit the same file.

```js
import assert from 'node:assert/strict';
export async function check({ open, browser, settle, BASE, SHOTS, FAKE_WEBMCP }) {
  const { page } = await open('/shop');              // phone viewport; { width: 1280 } for desktop
  assert.equal(await page.innerText('main h1'), 'Passes');
}
```

`open(path, { width, height, init })` waits for `main h1` and records page and console errors;
`smoke.mjs` fails at the end if any were recorded. Serve with fixtures (the default build).
