# CapyTube front end (Rust/WebAssembly)

Leptos 0.8, client-side only, built with Trunk. The plan and its reasons are in
`docs/WASM_PLAN.md`. Local dev: `cd web && trunk serve --features webmcp` (127.0.0.1:8791, fixtures by
default). The `webmcp` feature turns the WebMCP tools on; production builds leave it off until W12.
Set `NO_COLOR` to anything but `1`, or unset it: Trunk 0.21.14 rejects `NO_COLOR=1`.

## Checks

There is no CI (the GitHub Actions allowance is used up), so the checks are local hooks.

- **Every commit and push** runs `scripts/guard.sh`, which holds the static rules, including
  the WASM ones: `web/` is covered by the S3-URL and secret scans; `src/domain.rs` has no
  playback-locator field (the pattern is read from `backend/src/lib/ddb.ts`); dev servers bind
  loopback only; and the `deploy.sh` web mode and the site CSP rules print a `skipped:` line
  until W12 adds them.
- **A push that changes `web/`**, or the backend files the fixtures come from (`seed-data.ts`,
  `ddb.ts`, `keys.ts`), also runs `scripts/web-checks.sh`: `cargo fmt --check`,
  `cargo clippy --all-targets -- -D warnings` for `wasm32-unknown-unknown` and for the host,
  `cargo test`, the fixtures check (`tests/fixtures.mjs --check`: every file in `fixtures/`
  still equals what the API would return for the backend's seed), `trunk build --release`, the size budget (release `.wasm` + root `.js` +
  `snippets/`, `brotli -q 11`, at most 350,000 bytes; each file and the total are printed),
  and the browser smoke test (`tests/smoke.mjs` against `dist/`, served by `tests/serve.mjs`
  on 127.0.0.1:8792). A push that touches none of those skips all of it. Timings on this Mac:
  about 20 s after a source change (the release rebuild is 10 s of that), about 50 s when the
  release dependencies are not built yet, and about 2.5 minutes from nothing.
- **By hand:** `scripts/web-checks.sh` runs every step; `--steps fmt,clippy-wasm,clippy,test,fixtures,build,size,smoke`
  picks some, for example `scripts/web-checks.sh --steps build,size`. `scripts/guard.sh` runs
  the static rules, and `scripts/guard-selftest.sh` proves that each rule fires on a bad
  input and passes on a good one.
- **Playwright** is local tooling, not a dependency of the repo. The smoke step looks in
  `$CAPYWEB_PW_DIR` (default `~/.cache/capyweb/pw`) for `node_modules/playwright` and
  `browsers/`. If they are missing, it prints a `skipped:` line with the install command:

  ```bash
  npm i --prefix ~/.cache/capyweb/pw playwright@1
  PLAYWRIGHT_BROWSERS_PATH=~/.cache/capyweb/pw/browsers \
    ~/.cache/capyweb/pw/node_modules/.bin/playwright install chromium-headless-shell
  ```

  `CAPYWEB_SMOKE_PORT` changes the port. A busy port fails the step; it does not reuse
  another server.

## Sign-in (W11)

Cognito managed login with PKCE; the flow and its reasons are in `docs/WASM_PLAN.md` section 3.

- **Configuration is read at run time** from `/config.json` (`web/config.json`, copied into
  `dist/`): `{"auth": {"domain": "https://<ManagedLoginDomain output>", "client_id": "<UserPoolClientId output>"}}`.
  The repository ships `{"auth": null}` and keeps it that way (no pool values are committed), and
  then **no sign-in control renders anywhere**. One build serves every stage; W12's deploy
  writes each stage's `config.json`. The redirect URI is not
  configured: it is `<page origin>/auth/callback`, which must be in the app client's callback
  URLs (the template lists the dev site plus `http://127.0.0.1:8791` and `http://localhost:8791`).
  To try a deployed pool locally, put its values in `web/config.json` and do not commit them.
  `api::get_me` reads `balance` and `display_name` from `GET /me` (`{id, display_name, balance, createdAt}`).
- **The seam** (`src/auth.rs`, pure logic in `src/oauth.rs`):
  - `auth::use_auth()` returns `Auth`: `ready()` (a pool is configured and a stored session
    was tried), `signed_in()`, `user()` (`User { sub, email }`, for display only), all reactive;
  - `sign_in(return_to)`, or `sign_in_then(return_to, PendingAction { kind, data })` when the
    user tried to spend while signed out; after the callback, the page calls
    `take_pending(kind)` once to replay it;
  - `sign_out()`;
  - `api::request_authed(auth, Method::…, path, json_body, signal)` sends the access token as
    `Authorization: Bearer …`, refreshes once on a 401 and retries once. `api::get_me(auth)`
    is the first user (the header's coin balance).
- **Tokens:** access and ID tokens in memory only; the refresh token in localStorage
  (`capyweb.auth.refresh`); the PKCE verifier, `state` and pending action in sessionStorage for
  one redirect. Every storage access is wrapped (`js/auth.js`). Refresh runs a minute before
  expiry, counted from when the token arrived, not from the device clock.
- **CSP for W12:** `connect-src 'self' https://<ManagedLoginDomain>` (token and revoke calls
  from the page; `/config.json` and the API are same-origin). Sign-in and `/logout` are
  top-level navigations, which CSP does not restrict. The app posts no forms, so
  `form-action 'self'` holds; the managed-login pages carry Cognito's own CSP on their origin.
- **Test:** `tests/pages/auth.mjs` walks the flow against a fake Cognito intercepted in the
  browser, and checks that the default build shows no sign-in control on any page.

## Play coins: votes, bids and the profile (W5, W8)

Routes and error codes are in `docs/DATA_MODEL.md` section 6. Pages: `src/pages/play.rs`,
`src/pages/profile.rs`; API: `api::vote`, `api::bid`, `api::put_me`, `api::list_transactions`
(failures are `api::CodedError`, carrying the server's `code`).

- **Buttons follow `auth.ready()`.** Without a configured pool, Play shows read-only cards and no
  vote, bid, confirm or sign-in button. Signed out, Vote and Bid call
  `sign_in_then("/play?capy=…", PendingAction { kind: "vote" | "bid", data })`; the page takes the
  action back once (`take_pending`) and opens its confirm step. Nothing is charged without Confirm.
- **Prices come from the interaction the server sent** (`vote_cost`, `custom_request_cost`,
  `current_bid`) and are shown in the confirm dialog with the balance before and after. A vote
  sends only the option (or the snack idea) and the number of votes; a bid sends the amount typed,
  checked here against the minimum and the balance, and the server decides.
- **One `Idempotency-Key` per action** (`auth::random_key`, 128 bits from `getRandomValues`), made
  when the dialog opens. A retry after no answer (network error or 5xx) reuses it, even if the
  dialog was closed and the same action opened again; a new action gets a new key. Confirm is
  disabled while a request is out, so a double click sends one request.
- After a charge the balance (`GET /me`, into `Session.coins`) and the cards are reloaded; a
  refusal (`insufficient_coins`, `interaction_closed`, `bid_too_low`, `conflict`) shows one plain
  sentence ending "Nothing was spent." and no Confirm.
- **Test:** `tests/pages/w58b.mjs`, against the fake Cognito of `auth.mjs` and a fake write API
  made of page routes. In fixture mode the query string is dropped, so the fake ledger answers by
  call order.

## Video (W6)

Design: `docs/VIDEO_DESIGN.md`. The player is `src/components/player.rs` (`VideoPlayer`) over the
shim `js/player.js`; the first page to use it is the watch room's first cut, `/stream/:capyId`.

- **hls.js is vendored, pinned and lazy.** `vendor/hls/1.7.3/hls.light.min.mjs` (the ESM light
  build) and its `LICENSE` (Apache-2.0) are copied into `dist/vendor/` by Trunk (`copy-dir`). The
  shim imports it on first need only, so it is not first-load code: the size step prints its brotli
  size (about 97,300 bytes) as "lazy, not counted". Never loaded from a CDN.

  | | |
  |---|---|
  | Package | `hls.js@1.7.3`, from the npm registry (`npm pack hls.js@1.7.3`) |
  | `dist.integrity` (tarball) | `sha512-MsPlx6yVW4Qv4C7mEVou4/gk/5cN2dVxOTnrNjPSmyH2f0Ln+/UkG10Ax1PE6OvrmTVPKgQYozTtBaPOuCzq7A==` |
  | sha256 of `dist/hls.light.min.mjs` | `c60e98c83e5b2ce6875ea6ca27e51f63b7a6f00e9d9b64b588c92261bd69d439` |

  The file is byte-for-byte the package's. Its last line names a source map that is not vendored,
  so browser dev tools report one 404 for it; nothing else asks for it. To upgrade: `npm pack` the
  new exact version into a scratch directory, compare its integrity with
  `npm view hls.js@<version> dist.integrity`, copy the two files into `vendor/hls/<version>/`, change
  `HLS_URL` in `js/player.js`, remove the old directory, and update this table.
- **Local video fixtures.** `tests/make-hls-sample.sh` (ffmpeg) writes a short synthetic HLS stream
  for each public camera in `fixtures/streams.json` under `fixtures/live/<id>/`, and the reel they
  name under `fixtures/media/`. The output (about 200 KB) is committed, so the checks need no
  ffmpeg. It is VP9: Playwright's Chromium headless shell cannot decode H.264.
- **Tests.** `tests/pages/w6.mjs`: hls.js is not requested on pages without a player and is
  requested once on the watch room; the live video plays; a hidden tab pauses it and stops fetching,
  and it resumes at the live edge; the reel's position survives a reload; a private camera renders
  no `<video>` and makes no media request; leaving the page stops all video requests.
  `tests/serve.mjs` answers byte ranges (as S3 and CloudFront do), which the resume test needs.

## Release build, CSP and crawler tags (W12)

The plan is `docs/RELEASE_PLAN.md` section 1a, items 3, 5, 6 and 7.

- **Build a stage:** `scripts/build-release.sh <dev|prod> <out-dir>`.
  - It deletes `target/wasm-bindgen` first. wasm-bindgen never removes stale snippets, and a
    build without the feature once shipped `js/webmcp.js` from an earlier dev build.
  - It builds with `CAPYWEB_API_BASE=/api` and `--release`; `dev` adds `--features webmcp`.
  - It removes `fixtures/` from the output and leaves `config.json` as built (the deploy writes
    the stage's own).
  - It then checks the output and prints the size step of `scripts/web-checks.sh` for it.
  - Measured on 2026-09-29: prod 266,287 bytes brotli (the `.wasm` 251,987), dev 289,423, of
    the 350,000 budget. About 20 s each after a warm build.
- **The checks** (`scripts/build-release.sh --check <dir> <dev|prod>` runs them alone):
  - both stages: no `fixtures/`; no inline script in `index.html`; every `integrity` attribute
    matches its file;
  - prod: no file with `webmcp` in its name or path, no `.js` that imports it, `index.html`
    does not name it, and the `.wasm` holds none of `cast_vote`, `list_streams` or
    `get_my_account`.
  - `scripts/build-release-selftest.sh [<prod-out-dir>]` plants each fault in a copy (of a
    real prod output when given one, otherwise a small stand-in) and expects the check to fail.
- **The boot script.** Trunk starts the app with an inline `<script type="module">`, which the
  CSP's `script-src 'self'` blocks. A `post_build` hook in `Trunk.toml` (`scripts/boot-script.mjs`)
  moves it into `boot-<first 16 hex of its sha256>.js`, a name the deploy treats as immutable, and
  loads it with an `integrity` attribute. The hook fails the build if any other inline script is
  left or an `integrity` does not match. `trunk serve` still works: its live-reload script is the
  one exception, and only in the hook (release builds never have it).
- **The fonts are self-hosted** in `assets/fonts/`: Commissioner, DynaPuff and Hanalei Fill, latin
  subset only, from the Google Fonts CSS2 API on 2026-09-29. They total 98,356 bytes, and the
  licences (OFL 1.1) sit next to them. `style/fonts.css` mirrors Google's `@font-face` rules, one per weight
  (Commissioner and DynaPuff are one variable file each), with `font-display: swap`, and
  `index.html` preloads the three files. Screenshots of `/`, `/watch` and `/play` at 390 and 1280
  px were pixel-identical before and after. The app's copy needs no other subset. To update,
  fetch the CSS with a current browser's user agent, take the `/* latin */` URLs, and bump the
  version in the file names.
- **Same-origin API.** Every API call, the chat panel's included (`js/chat.js`), is built from the
  base, so `/api` keeps it on the site. A paid camera's purchase is always `/api/playback/<id>`,
  whatever the base, so its cookies land on the site. `api::tests::relative_api_base_stays_on_this_site`
  covers both.
- **The CSP in the tests.** `tests/serve.mjs` sends the headers of `infra/site/headers-dev.json` on
  every response. The CSP is sent as is, except that the managed-login origin becomes the fake
  Cognito of `tests/pages/auth.mjs`. `tests/smoke.mjs` gives every browser context, including the
  ones page files make, a `securitypolicyviolation` listener plus a watch on Chromium's console,
  and fails on any violation. The `smoke:` line of `web-checks.sh` prints the count.
  `tests/pages/csp.mjs` checks that the header is really sent, the boot script is a file, and a
  page load touches no other origin. axe-core goes in through `page.evaluate`, which the page's
  CSP does not govern (a script tag would be inline).
- **Crawler tags.**
  - `sitemap.xml` lists the pages, each capybara a camera watches and every pass, with absolute
    `https://capytube.xyz` URLs. Not `/profile` or `/auth/callback`.
  - `robots.txt` ends with its `Sitemap:` line.
  - The shell has `og:image` (`/assets/share/capytube-1200x630.jpg`, 151 KB, made from
    `assets/pages/aboutOne.webp` and the logo), its size and alt text, and `twitter:card`.
  - The shell has **no** canonical and no `og:url`: it is served for every route. `App` sets
    `<link rel="canonical">` per route instead (`show_canonical` in `src/lib.rs`): the origin
    `routes::SITE_ORIGIN` plus the path, with no query and no trailing slash. It removes the link
    while a view with `noindex` shows.
  - `routes::tests::sitemap_matches_the_app_and_the_seed` fails if a sitemap URL is not a route,
    or if the rooms and passes differ from the seed. `tests/pages/crawl.mjs` checks the tags in a
    browser.

