# CapyTube front end in Rust/WebAssembly: plan

Status: **approved by capyweb-manager on 2026-09-29** (see "Decisions" below). Reviewed twice: Cursor
rv-1790656808-53577 (findings applied) and Kimi rv-1790657924-75648 (PASS). The build runs locally on
`feat/wasm-frontend`, tracked as beads epic `capyweb-b6e` (W1–W16 = `capyweb-b6e.1`–`.16`). No AWS calls
and no deploy until a deploy identity exists.
Author: capyweb-wasm-lead (Claude), 2026-09-29, on mac-pro-japan-16.
Asked by nic on 2026-09-29: "i want the web rewritten as webassembly." herdr-master scoped it to a plan
plus, at most, a local prototype. The HTTP API stays as it is. Only the front end is rewritten.

Read with: `docs/PLAN.md` (architecture, cost model, epics), `docs/DATA_MODEL.md`, `docs/AGENT_LEARNINGS.md`.

## Decisions (capyweb-manager, 2026-09-29)

nic asked not to be consulted ("make your own decision with as little interference as possible"), so
these are the manager's decisions.

- **Q1 wallet features:** play coins only in v1. No Dynamic, Solana, NFT-trading or airdrop code in the
  WASM app. A wallet link can come later as its own reviewed module.
- **Q2 sign-in:** Cognito managed login with PKCE and passwordless email OTP.
- **Q3 deploy identity:** an access decision, so it is with herdr-master. Until it exists: nothing that
  needs AWS. The lent Mac's key stays **deactivated**; the master chose not to delete it.
- **Cognito grant:** in place, but not tag-scoped (details in section 6).
- **Beads:** rebuilt on this Mac with the 25 known ids, marked `reconstructed`. **No remote, and never
  push beads to the public repo.**
- **Build:** start now, locally, in the order of section 7. Push only to `plan/wasm-rewrite` or
  `feat/wasm-frontend`, never to main. Each unit is reviewed before it counts as done. Write buttons stay
  hidden until their routes exist.

## Summary

- **Framework: Leptos 0.8 in client-side-rendering mode, built with Trunk.** The result is a folder of
  static files that the existing S3 + CloudFront site serves. No server, no new AWS service, no cost change.
- **A working prototype is in `web/`** (section 8). It renders the stream list and a stream page from
  API-shaped data, reuses the React app's Tailwind theme unchanged, and registers two WebMCP tools from
  Rust. First-load size: **117 KB brotli of WASM + 8 KB of JS** (glue plus the WebMCP shim). Today's
  React entry bundle is **777 KB brotli** (4.46 MB raw).
- **The API stays the same.** One infrastructure gap blocks any front end on dev today, whatever it is
  written in. The API's CORS list does not include `https://dev.capytube.xyz`, and CloudFront has no
  `/api/*` route. Task W12 fixes that.
- **Sign-in is still blocked on the missing Cognito grant (`capyweb-w26`).** Write features (votes, bids,
  chat, coins) can be built against the auth seam, but cannot be tested end to end until the grant exists.
- **The beads database for capyweb exists only on the lent MacBook Pro.** The clone on this Mac has an
  empty, uninitialised database, and origin has no Dolt data. Section 6 lists what can be recovered and
  the access nic needs to grant.

---

## 1. Framework

### Recommendation: Leptos 0.8 (CSR) + Trunk

| | Leptos 0.8 | Dioxus 0.7 | Yew 0.23 |
|---|---|---|---|
| Rendering model | Fine-grained signals, no virtual DOM | Virtual DOM, React-like hooks | Virtual DOM, component structs |
| Bundle (CSR, release) | Smallest of the three. Measured here: 117 KB brotli for two routes + router + fetch + serde | Larger runtime; its own CLI (`dx`) | Largest; slower release cadence |
| Routing | `leptos_router`: nested routes, params, `<A>`, history API | Built-in router | `yew-router` |
| CSS | Plain `class="…"` strings, so Tailwind classes carry over verbatim | Same | Same |
| JS interop | Standard `wasm-bindgen` / `web-sys` | Same, plus its own eval bridge | Same |
| Maturity (crates.io today) | 0.8.21 stable; 0.9 in beta | 0.7.10 stable; 0.8 in alpha | 0.23 stable |
| Fit with today's code | jotai atoms map one-to-one onto signals | React hooks map onto hooks | Least familiar shape |

Why Leptos:

1. **First load.** Fine-grained reactivity has no virtual-DOM diff engine to ship. The prototype measured
   342 KB raw, 141 KB gzip and **117 KB brotli** of WASM, plus 51 KB raw / 8 KB brotli of JS (glue and the
   WebMCP shim) and 14 KB raw / 3.5 KB brotli of CSS. The full app should stay under a **300 KB brotli budget** for WASM
   plus JS, which a local hook enforces (section 5).
2. **State.** Today's state is about 10 jotai atoms that the API layer writes and components read. Leptos
   signals and `LocalResource` are the same idea, so the data flow does not need redesigning.
3. **CSS reuse.** Classes are plain strings. Trunk runs the Tailwind CLI over the `.rs` files, and
   `web/tailwind.config.cjs` spreads the root `tailwind.config.js`. The prototype renders with the
   existing palette, fonts and shadows unchanged (screenshots checked).
4. **Interop.** The video player, WebMCP and anything else in JS go through small ES modules bound with
   `#[wasm_bindgen(module = "/js/…")]`. The prototype does this for WebMCP.

Dioxus is a reasonable second choice. It would matter if nic later wanted native desktop or mobile apps
from the same code, but `docs/PLAN.md` D3 already chose a PWA over native. Yew has the least momentum.

**What does not change: server-side rendering.** Leptos SSR would need a server (a Lambda) in front of
every page. That means cost, cold starts, and a new moving part. The site stays client-rendered like the
React app, with static `<title>` and meta tags in `index.html`.

### The honest trade-off

Most of the first-load win comes from dropping Amplify, Dynamic.xyz and Solana. A React rewrite without
them would also be much smaller. What WASM adds on top is a smaller runtime, one typed language across
domain and UI, and nic's stated preference. The costs are slower UI iteration than React and a smaller
pool of people who know Leptos. Section 7 prices the rewrite with that in mind.

### How much of today's code carries over

| Kept as is | Ported (same behaviour, new language) | Dropped |
|---|---|---|
| Tailwind config, palette, fonts, shadows | `src/api/http.ts` → `web/src/api.rs` (done in the prototype: same envelope, same errors, 404 = `None`) | Amplify client, `StorageImage`, Amplify UI and its global CSS |
| All images and SVGs in `src/assets/` | `src/domain/catalog.ts` → `web/src/domain.rs` (streams done; other entities to do) | Dynamic.xyz widget and shadow-DOM style hack |
| `demo/` as the UX reference | 23 CSS modules (1,702 lines) → one component stylesheet with prefixed class names | `@tanstack/react-query` (provider only, unused) |
| The backend and its tests (untouched) | Tailwind-styled JSX (~326 lines of utility classes) → the same classes in `view!` | Dead code (the list below) |
| Guards and hooks (`scripts/`) | Page logic from each component (section 2) | `swiper` → CSS scroll-snap; `react-hot-toast` → a 40-line toast signal |

Dead code in the React app that is **not** ported: `WhatCapytube`, `ComingSoonRibbon`, `NotPremiumPage`
(unreachable), the top-up modal (never opens), watch-to-earn (`isCoinUpdateEnabled=false`), and
`src/utils/mockData.ts` (imported by nothing).

---

## 2. Scope: every page and feature, and where it goes

Routes keep their URLs so shared links still work. One route is added: `/auth/callback` for Cognito.
"Needs write API" means the feature needs an authenticated backend route that does not exist yet
(`capyweb-7hj`, which is itself blocked on Cognito, `capyweb-w26`).

| Today | Feature | In the WASM app | Needs |
|---|---|---|---|
| Header | Logo, Beta ribbon, coin balance, "Hi {name}", wallet snippet, first-login profile modal | Same header with a coin pill (as in `demo/`). Name modal on first sign-in | Cognito (W11); `GET/PUT /me` |
| Navbar / FooterNavbar | 4 icons; tab bar under 500 px | One responsive nav using CSS media queries, not 10 resize listeners | — |
| Footer, Modal, toasts | Static links; overlay; hot-toast | Ported. The modal gets Escape and focus trapping, which it lacks today | — |
| `/` Home | Public stream (S3 MP4), premium card (disabled), capybara cards, gallery | Stream player (W6) with the reel fallback (`capyweb-0c8`), capybara cards, scroll-snap gallery. Premium card dropped | `GET /streams?access=public`, `/capybaras` (live) |
| `/watch` | Capybara cards with a count of private streams each | Same | live routes |
| `/stream/:capyId` | Camera tabs, S3 video, emoji ratings, chat (no polling), watch-time counter | Camera tabs from `/streams` filtered by capybara, loaded by id so deep links work (broken today). Reactions and chat with 5 s polling while visible (the `docs/PLAN.md` cost model). Private cameras show title and price only until the viewer is signed in and has paid (`capyweb-0m7`) | Write API for chat and reactions; private playback with the video source (W6) |
| `/play` | Capybara picker, vote card, bid card, rules, CAPYL on-chain payment, thanks | Same flow, paid in **play coins from the server ledger** (`docs/PLAN.md` B6), with the cost shown before confirming. No on-chain transfer (Q1) | `/capybaras/{id}/interactions` (live); write API for votes and bids |
| `/shop`, `/shop/:id` | NFT list, search, sort; details, offers, activity; buy/offer buttons do nothing | Read-only "passes" list and details from the live routes. Claiming with play coins once the write API exists | `/nfts…` (live) |
| `/profile` | Signed-out marketing; name, CAPYL transactions from Solana, wallet, NFT link | Signed out: the same pitch plus a sign-in button. Signed in: name, coin balance, transactions from the ledger | `GET /me`, `GET /me/transactions` |
| `/robot` | Static scaffold: robots, slots, disabled controls, video that needs sign-in | Static port. The video plays for signed-out users, as the page copy promises (it does not today) | none until the hardware API exists |
| `/about-us`, `/privacy-policy`, `/terms-of-service`, `/deletion` | Static text | Static port. The "[Insert Date]" placeholders (two in Privacy, two in Terms) are flagged to nic, not invented | — |
| Wallet features | Dynamic login, CAPYL balance sync that overwrites the DB balance, SPL transfers, solscan links | **Not in v1** (Q1). If wanted later: a separately reviewed JS module | nic's decision |
| Watch-time counter | 1 s display timer; writes watch time every 60 s for a future "airdrop" | **Not in v1**: tied to the CAPYL airdrop story (Q1), and it adds a write per viewer per minute | nic's decision |
| Media | 5 direct S3 video URLs in `src/` (3 files), plus 2 in `demo/`; all 7 baselined in the guard (`capyweb-c24`) | Media only through CloudFront `/media/*` (`capyweb-2gx`). The Rust app contains no S3 URLs, and the guard scans `web/` (section 5) | `capyweb-2gx` |

The admin console (`docs/PLAN.md` Epic E) is out of scope here. It can reuse this crate's components
when it is built.

---

## 3. API and sign-in

### Calling the API

- **Same origin, through CloudFront.** Add a `/api/*` behaviour to the site distribution that forwards to
  the HTTP API. A CloudFront Function strips `/api` and the origin path adds `/dev`. The cache policy
  honours the origin's `Cache-Control`, so `s-maxage=300` on catalog reads is finally absorbed at the
  edge, as `backend/src/lib/http.ts` intends. Authenticated responses are `no-store` already.
  `Authorization` is part of the cache key, so anonymous catalog reads share one cache entry and signed-in
  calls are never shared. This removes CORS preflights entirely.
  - **Why it is needed:** today the API's CORS list (template default) is `capytube.xyz`, `www` and
    `localhost:5173`. A page on `dev.capytube.xyz` cannot call it from the browser at all. Nothing
    noticed yet because the live dev site is `demo/`, which makes no API calls.
  - **Cost:** CloudFront Functions and requests stay inside the always-free allowances at this volume.
- **Client:** `web/src/api.rs` is a port of `src/api/http.ts`, with the same contract: the `{items,
  count, cursor, truncated, hint}` envelope, `ApiError { status, url, message }` built from the API's
  `{error}` body, 404 on a single item returned as `Ok(None)`, and an HTML 200 reported as "expected JSON"
  (the SPA fallback answering a missing path). The base URL is fixed at build time:
  `fixtures` → static JSON, `/api` → same origin, `https://…` → direct. A request takes an optional
  `AbortSignal`, so a cancelled WebMCP call cancels its fetch. It is tested natively with `cargo test`.
- **Contract with the backend:** `web/src/domain.rs` mirrors `src/domain/catalog.ts`. A contract test
  parses fixtures produced from the backend's own seed data. The domain types have **no field that can
  hold a playback locator**, and a guard rule keeps it that way (section 5). An unknown `access_type`
  deserialises to `Unknown`, which is treated as private: never offer playback.
  - **One free-text field the name rule cannot see into:** `fallback_reel`. The backend's filter works on
    field *names*, so a locator stored in that field's *value* would pass. The app accepts it only as a
    bare media key (`LiveStream::reel_key`: letters, digits, `-_.`, no leading dot, played from
    `/media/<key>`). A URL, a path or a query string is refused and tested. The backend should decide
    whether a private stream exposes a reel at all.
- **Private streams (`capyweb-0m7`):** the catalog shows title and price only; a private stream with no
  price reads "Private", never "0 coins". There is no playback route yet: it comes with the video
  source in W6. The app will request playback for a private stream **only** with a token, and only after
  the server says the viewer has paid. The real protection must be server-side: the playback route has to
  require the JWT and check entitlement, whatever the front end does.
- **Write routes the app will call** (proposed names that follow `docs/DATA_MODEL.md`; the backend owner
  decides them in `capyweb-7hj`): `GET/PUT /me`, `GET /me/transactions`, `GET/POST /streams/{id}/chat`,
  `POST /streams/{id}/reactions`, `POST /interactions/{id}/votes`, `POST /interactions/{id}/bids`,
  `POST /nfts/{id}/claim`. Every one is authorised server-side from the JWT. The client never sends a
  balance or a user id it expects to be trusted.

### Cognito sign-in from WASM

**Recommended: Cognito managed login with the authorization-code flow and PKCE**, with passwordless
email OTP as the sign-in method. Both are in the Essentials plan, which is free up to 10,000 MAU.
`docs/PLAN.md` B3 said "email OTP, no Hosted UI". The brief asks for the hosted UI with PKCE. This choice
is Q2.

Flow:

1. The user taps "Sign in" (or tries to spend while signed out). The app saves the pending action, for
   example "vote for watermelon ×2", in `sessionStorage`. It builds the PKCE pair as RFC 7636 requires:
   the **verifier** is 32 bytes from `crypto.getRandomValues`, base64url-encoded without padding (43
   ASCII characters). The **challenge** is base64url(SHA-256(the verifier's ASCII bytes)), no padding,
   computed with `crypto.subtle.digest` through `web-sys`. A separate random `state` goes with it. Hashing
   the raw bytes instead of the encoded string would make the token exchange fail. No crypto crate is
   needed.
2. The app redirects to `https://<domain>/oauth2/authorize?response_type=code&client_id=…&redirect_uri=
   https://dev.capytube.xyz/auth/callback&code_challenge=…&code_challenge_method=S256&state=…&scope=openid+email`.
3. `/auth/callback` checks `state`, then POSTs the code and verifier to `/oauth2/token` (a public client
   with no secret). It receives ID, access and refresh tokens, replays the pending action, and returns to
   the page the user came from.
4. **Token storage:** access and ID tokens live in memory only (a Leptos signal). The refresh token goes in
   `localStorage`, so a returning visitor stays signed in, with **refresh-token rotation** switched on in
   the app client. The XSS exposure is limited by a strict CSP (`script-src 'self' 'wasm-unsafe-eval'` +
   the hash of Trunk's inline loader), no third-party scripts, and hls.js self-hosted.
5. **Refresh:** refresh one minute before `exp` (read from the JWT payload; the server verifies the
   signature, the client only schedules), and once on a 401 followed by a retry. If refresh fails, the app
   is signed out.
6. **Sign-out:** clear memory and storage, and POST the refresh token to `https://<domain>/oauth2/revoke`.
   Then redirect to Cognito's `https://<domain>/logout?client_id=…&logout_uri=https://dev.capytube.xyz/`,
   which ends the managed-login session and returns to the app's `/`. That return URL must be listed in
   the app client's sign-out URLs. The signed-in-only WebMCP tools are unregistered at the same moment
   (section 4).
7. **Seam (to build in W11):** `http.ts` has an `authenticated` flag and a token provider; the Rust port
   does not have them yet. W11 adds them to `api::request`, pulling the token from the auth module. Pages
   are written to work signed out and call write routes only through that flag, so nothing else waits on
   Cognito.

Needs checking when the pool is created: whether email OTP requires the pool to send mail through Amazon
SES. If it does, that adds a verified SES domain (TXT/DKIM records the `capytube-dns` role can already
write) and an SES sandbox-exit request. For dev, the free prefix domain
(`capyapp-capyweb-dev.auth.ap-southeast-1.amazoncognito.com`) avoids a certificate. For production,
`auth.capytube.xyz` with an ACM certificate in us-east-1 (already allowed).

---

## 4. WebMCP from WASM

**The spec has moved.** The WebMCP Community Group draft of **28 September 2026** exposes
`document.modelContext`. It provides `registerTool(tool, { signal, exposedTo })`, which returns a Promise;
a tool is unregistered by aborting the signal. Tools carry `annotations { readOnlyHint,
untrustedContentHint, consequentialHint }`. Earlier drafts and Chrome's early preview used
`navigator.modelContext`, as in the brief. The explainer says no browser ships it by default.
`web/js/webmcp.js` supports both shapes and does nothing where neither exists.

**How tools are registered.** Rust builds each tool (name, description, JSON Schema, annotations) and
passes it with a `Closure` to `registerTool` in the JS shim. The closure returns a Promise made with
`wasm_bindgen_futures::future_to_promise` that calls **the same Rust function the button calls**. It
passes the draft's `signal` on to `fetch`, so a cancelled tool call cancels its request. There is no
tool-only API route, so nothing new becomes public. A tool counts as registered only once the browser's
`registerTool` promise fulfils; a refusal is not counted. Tools that need sign-in are registered when the
user signs in and unregistered (`AbortController.abort()`) when they sign out. The server checks the JWT
on every call either way. This is the "same login and permissions as the UI" rule.

The prototype proves the mechanism:
- the tools registered;
- `list_streams` returned the catalog;
- `open_stream` navigated the SPA;
- an id like `../admin` was rejected;
- a browser that refuses registration leaves 0 tools counted.

**Annotations follow the draft's meaning.** `readOnlyHint` means the tool changes nothing, so a
navigation tool is not read-only. `consequentialHint` marks actions that spend coins or post as the user.

| Tool | Sign-in | Annotations | What it does |
|---|---|---|---|
| `list_streams` | no | readOnly | Stream id, title, live or not, public/private, price. **Built in the prototype** |
| `open_stream` / `open_page` | no | none (changes the page, not the server) | Navigate the SPA to a stream or a named page (fixed list). `open_stream` is built |
| `list_capybaras`, `get_capybara` | no | readOnly | Cast, bios, and when each capybara is usually awake |
| `get_interactions` | no | readOnly | Today's snack vote and bid: options, costs, current bid, rules |
| `list_passes` | no | readOnly | Shop passes and prices |
| `read_chat` | no | readOnly, **untrustedContent** | Recent chat on a stream. Other users wrote it, so the agent must not treat it as instructions |
| `get_my_account` | yes | readOnly | Name, coin balance, recent transactions |
| `cast_vote`, `place_bid` | yes | **consequential** | Spend play coins. The tool opens the page's own confirm dialog, showing the cost, and resolves only after **the user** confirms on the page. An agent cannot spend without a human click |
| `send_chat`, `react` | yes | consequential | Post as the user. `send_chat` shows the text for confirmation |
| `claim_pass` | yes | consequential | Same confirm step as a vote |

No admin tools, and no tool that the UI does not already offer.

**Review before it ships:** the tools sit behind a build-time `webmcp` feature, off in production until a
reviewer has checked the list above against the running app. The checks: each tool's server route
enforces the same permission as the button; consequential tools cannot resolve without the on-page
confirm; no tool output contains a playback locator or token. Then nic says yes.

---

## 5. Build and release

- **Layout:** the new crate lives in `web/` next to the React `src/` until cutover. Toolchain pinned in
  `web/rust-toolchain.toml` (Rust 1.98.1 + `wasm32-unknown-unknown`) and `web/Trunk.toml` (Trunk 0.21,
  Tailwind 3.4.17, binaryen `version_133`).
  - **Found while building:** Trunk's default binaryen (123) rejects Rust 1.98's output ("memory.copy
    operations require bulk memory"), so the newer version and the explicit `--enable-*` flags in
    `web/index.html` are required.
  - A cold release build takes ~46 s on this Mac.
  - Trunk 0.21.14 fails with "invalid value '1' for '--no-color'" when the environment sets `NO_COLOR=1`.
    Run it with `NO_COLOR` unset (or `NO_COLOR=true`).
- **Local dev:** `cd web && trunk serve` listens on **127.0.0.1:8791 only**, set in `Trunk.toml`. It uses
  the fixtures by default, or the real API through Trunk's proxy:
  `CAPYWEB_API_BASE=/api trunk serve --proxy-backend <ApiUrl> --proxy-rewrite /api`.
  - `vite.config.ts` had `host: true`, which binds 0.0.0.0. W13 changed it to `host: '127.0.0.1'`
    (the React app's local dev server only; nothing deployed changes), and rule 5 below keeps it there.
- **Release:** `trunk build --release` writes `web/dist/`. **`infra/site/deploy.sh` cannot ship it as
  written.** It syncs `$SRC/assets/`, and Trunk's output has no `assets/` directory: the hashed
  `.wasm/.js/.css` sit at the root, next to `snippets/`. It then re-stamps every other object with
  `max-age=300`, which would undo immutable caching. W12 adds a **web mode**
  (`infra/site/deploy.sh dev web/dist --web`) that:
  1. Uploads hashed files (`*-<16 hex>.wasm|js|css`, `snippets/`) with
     `Cache-Control: public,max-age=31536000,immutable`, and leaves them out of the `max-age=300`
     re-stamp. `index.html` stays `no-cache`. Anything else, such as `favicon`, keeps `max-age=300`.
  2. `.wasm` is uploaded with an explicit `--content-type application/wasm`. Streaming compilation needs
     it, and the CLI's type guess is not relied on.
  3. **Do not `--delete` hashed assets on deploy.** A visitor who loaded the previous `index.html` still
     requests the previous `.wasm`. With the SPA fallback, a deleted file comes back as `index.html` with
     status 200, and WebAssembly fails to compile it. Keep the previous release's hashed files and prune
     older ones on the next deploy.
  4. Check once after the first deploy that CloudFront compresses `application/wasm`
     (`curl -sI -H 'accept-encoding: br' …_bg.wasm` shows `content-encoding`). If it does not, upload a
     pre-compressed copy.
- **Site stack changes** (`infra/site/template.yaml`):
  - the `/api/*` behaviour and CloudFront Function (section 3);
  - a custom response-headers policy that adds the CSP to the managed security headers;
  - the deploy identity must be able to create both. `cloudfront:CreateResponseHeadersPolicy` and
    `cloudfront:CreateFunction` are not known to be granted, so probe them first.
- **Checks as local hooks, no GitHub Actions.** `scripts/guard.sh` needs to learn these rules, each with
  a case in `scripts/guard-selftest.sh` that proves it fires:
  - **As built (W13):**
    - Rules 3-8 are in `scripts/guard.sh`, which runs on every commit and push.
    - Rules 1-2 and a headless browser smoke test are in `scripts/web-checks.sh`. The pre-push hook
      runs it when a pushed ref changes `web/`, and it counts a new branch as changed.
    - The hook reads git's ref lines before anything else in its block. If they are gone (the beads
      block runs first and could consume them), it compares HEAD with `<remote>/<branch>` instead,
      and runs the checks when there is no such branch.
    - `guard-selftest.sh` has a failing and a passing case for each rule.
    - How to run the checks by hand, and where Playwright lives: `web/README.md`.
  1. `web/` changed → `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` (**twice**:
     for `wasm32-unknown-unknown` and for the host, since each lints only its own cfg-gated code)
     and `cargo test` in pre-push. Then `trunk build --release` and the smoke test
     (`web/tests/smoke.mjs` against `web/dist`, served by `web/tests/serve.mjs` on 127.0.0.1:8792).
     About 20 s after a source change and 2.5 min cold on this Mac.
  2. **Size budget:** release WASM + all first-load JS (glue and snippets) ≤ **300,000 bytes brotli**
     (`brotli -q 11`), measured on `web/dist` in pre-push. The prototype is 125,284 bytes. The W1 shell
     is 144,907: 136,754 of `.wasm`, 7,477 of glue and 676 of snippet. "KB" in this document means
     1,000 bytes.
  3. **Scan `web/`.** Today neither content scan reads it, so adding extensions alone would leave the
     crate unscanned.
     - The S3-URL scan reads `.ts/.tsx/.js/.html/.css` under `backend/src src demo amplify`.
     - The secret-literal scan reads `.ts/.tsx/.js/.json/.yaml/.yml/.sh/.html/.md` under
       `SECRET_SCAN_DIRS` (`backend infra src demo amplify docs scripts`).
     - Only the `AKIA` key-id scan covers the whole tree.
     - Fix: add `web` to both directory lists, and `*.rs` and `*.toml` to both extension lists.
     - Build output (`target/`, `dist/`) is excluded from every scan.
  4. **No playback-locator field** in `web/src/domain.rs`: field names checked against the same regex as
     `PLAYBACK_NAME` in `backend/src/lib/ddb.ts`.
     - The regex is read from `ddb.ts` at run time, so there is no copy to drift, and the rule fails if
       it cannot find it.
     - Names are normalised from camelCase first. `#[serde(rename/alias = "…")]` strings are checked too.
  5. **Loopback only:** no `0.0.0.0` or `host: true` in `web/Trunk.toml` or `vite.config.ts`.
     - As built, the rule also catches `'::'` and a bare `--host` in `package.json`.
     - `[serve] addresses` must be set, and list only `127.0.0.1` or `::1`.
  6. `deploy.sh` keeps the `application/wasm` content type and the immutable caching for hashed files.
     - Checked once `deploy.sh` has a `--web` mode; until then it prints a `skipped:` line naming W12.
     - It checks the upload commands, not which branch runs them:
       - `application/wasm` must be present;
       - a `max-age=31536000,immutable` upload must be present, with no `--delete`;
       - every other bulk command on the bucket root (`s3 sync`, or `--recursive`) that deletes or sets
         Cache-Control must `--exclude` `*.wasm` (or `*`). This covers the demo mode's `sync --delete`
         and its `max-age=300` re-stamp.
     - W12's pruning of old releases still needs a human review.
  7. No GitHub Actions workflow (already checked).
  8. The CSP in the site template allows `'wasm-unsafe-eval'`. Without it the app is a blank page.
     - Checked once `infra/site/template.yaml` defines a CSP; until then it prints a `skipped:` line.
- **Cost:** unchanged. Same S3 + CloudFront, plus one CloudFront Function inside the free tier. The
  first-load payload drops from ~0.8 MB to ~0.13 MB brotli, which lowers CloudFront egress, already
  modelled at $0. `docs/PLAN.md` section 3 stands at ≈ $2.30/month. If a builder is ever needed, it is
  CodeBuild, and `codebuild:*` is not granted today.
- **Synthetic check:** `healthcheck.ts` looks for the body marker `CapyTube` on the site. The WASM
  `index.html` contains it in `<title>`, so the check keeps working.

---

## 6. Moving the capyweb lead off the lent MacBook Pro

Checked on this Mac (mac-pro-japan-16) on 2026-09-29. The lent Mac was not contacted.

### What is only on the lent Mac

| What | Evidence | Recoverable here? |
|---|---|---|
| **The beads database** | Here `.beads/` holds an embedded Dolt DB with **0 issues**. `bd create` fails with "issue_prefix config is missing". `git ls-remote origin` shows **no `refs/dolt/data`**, and no commit ever contained `.beads/issues.jsonl` | **Partly.** 25 ids are known:<br>• 23 named in tracked files on `feat/serverless-capyapp-backend` (before this plan): `083 0c8 0v3 19a 1iz 1nh 1td 1w5 2gx 2pj 3ge 7hj 962 c24 eh4 py9 qu7 s6d umh w26 x7w xfp zlb`<br>• `sz5`, until this plan only in a commit message ("Closes capyweb-sz5.", 113796b)<br>• `0m7`, only in the brief<br>Each has a line of context. Descriptions, status, dependencies and comments are lost until the Mac returns |
| capyweb-lead's notes under `~/.cache/herdr-manager/` | This Mac's copy has only this brief and unrelated projects' files | No |
| AWS profile `capy` (IAM user `capyapp-macbook-pro-14`; key deactivated while lent) | `docs/PLAN.md` §8, `infra/README.md` | Replaced by a new identity (below) |
| AWS profile `capytube-dns` (assumes `capyapp-capytube-dns` in autonomous-lab) and the admin `al` profile | `docs/PLAN.md` §8 | Needs a trust change (below). `al` is nic's own admin; not needed for this work |
| The live API base URL (`ApiUrl` output of `capyapp-capyweb-backend-dev`) | Not in the repo, the KB, or local notes. `infra/README.md` lists only the older Function URLs | Readable by the new identity with one `describe-stacks`. It is needed to point the app at the API |
| Anything unpushed in its clone (branches, stashes, untracked files) | Unknown | When it is back |

### Done on this Mac today

- `git config core.hooksPath .beads/hooks`. The clone had **no active hooks**, so commits here ran no
  guard. `scripts/guard.sh` passes.
- GitHub over SSH works (`ssh -T` authenticates as `thanakijwanavit`). Pushing by SSH URL needs no new
  credential.
- Rust 1.98.1 (rustup), Trunk 0.21.14, and the `wasm32-unknown-unknown` target, all from Homebrew/rustup.

### Steps to carry on without it

1. **Beads: done on 2026-09-29.**
   - `bd init --reinit-local --prefix capyweb` (the local DB was empty).
   - The 25 known ids were recreated with their original ids and the label `reconstructed`. 16 are open
     and 9 closed; each closed one cites its commit.
   - The rewrite's tasks are epic `capyweb-b6e`.
   - When the lent Mac is back, `bd export` there and merge issue by issue here. The two Dolt histories
     are unrelated, so JSONL is the merge path.
   - **No remote.** The code repo is public, and these issues describe live leaked keys and attack
     surface (`capyweb-962`, `capyweb-s6d`).
   - **A trap found while doing this:** the tracked `.beads/config.yaml` set `sync.remote` to
     `github.com/capytube/capyweb`, from the first `bd init` on the lent Mac. `bd init` on a new clone
     wires that up as a Dolt remote. `bd init` and `bd dolt remote remove` also each made their own git
     commit. Those two commits were reset before anything was pushed. The Dolt remote is removed,
     `sync.remote` is commented out, `no-push: true` is committed, and origin has no `refs/dolt/*`.
   - A private remote needs a private repo. Ask capyweb-manager when one is wanted.
2. **Done:** `npm ci` in `backend/src`. Without it, pre-push skips the backend tests and the behavioural
   playback-locator check.
3. `brew install aws-sam-cli` and `npm i -g esbuild@0.21` for backend deploys (only once there is an
   identity).
4. **New deploy identity for this Mac: an access decision, now with herdr-master (Q3).** The request:
   - **IAM user `capyapp-mac-pro-japan-16`** in account 619071347239, member of the group
     **`capyapp-deployers`** and nothing else. It inherits exactly what `capyapp-macbook-pro-14` had: the
     group's five policies, including `capyapp-deploy-core` and `capyapp-deploy-apigw`, scoped to
     `capyapp-*`, ap-southeast-1 + us-east-1, with EC2/NAT/Bedrock etc. denied. No inline policy, no
     billing, no admin. One access key, stored as profile `capy` in `~/.aws/credentials` (mode 600) on
     this Mac only.
   - **DNS:** add `arn:aws:iam::619071347239:user/capyapp-mac-pro-japan-16` to the trust policy of role
     `capyapp-capytube-dns` in autonomous-lab. The user needs `sts:AssumeRole` on that role, if the group
     does not already grant it. This is only needed for new records or certificates, not for re-deploying
     the dev site's content.
   - **Grants added on 2026-09-29** in policy `capyapp-deploy-auth-billing-alarms` (v3, 12:24):
     - **Cognito:** `cognito-idp:*` on user pools in ap-southeast-1, and `CreateUserPool` in
       ap-southeast-1 only.
     - The grant has an **explicit deny on the 13 existing Amplify pools** of other projects.
     - It is **not tag-scoped**, as this plan first proposed: IAM Access Analyzer reports that Cognito
       does not support `aws:ResourceTag`, so a tag condition would allow nothing.
     - When capyweb's own pool exists, report its id to capyweb-manager so the grant can be pinned to it
       (`capyweb-w26`).
     - **Also in:** billing read (`ce`, `budgets`; `capyweb-0v3`) and SNS on `capyapp-*` topics
       (`capyweb-19a`).
     - The S3 object grant was never needed: `capyapp-*` already matches objects (`capyweb-083`, closed).
   - **Still to probe once there is an identity:** the CloudFront response-headers-policy and function
     actions from section 5.
   - **The old key:** `capyapp-macbook-pro-14`'s key stays **deactivated** (herdr-master's choice), not
     deleted.
5. Once the identity exists: read `ApiUrl`, set it as the app's proxy backend, and record it in
   `infra/README.md`.

### Needs the lent Mac (when it is back)

- Export its beads DB and merge it here (step 1). Push to the private remote.
- Copy capyweb-lead's `~/.cache/herdr-manager/` notes and any capyweb memory into the repo docs or the
  KB.
- In its capyweb clone, check `git log --branches --not --remotes`, `git stash list` and untracked
  files. Push anything real.
- Remove the AWS profiles (`capy`, `capytube-dns`, `al`) and any capyweb SSH key from it.

---

## 7. Tasks

Percentages are shares of the whole rewrite and sum to 100. No dates. "Blocked" names what it waits on;
everything else can start now.

| # | Task | Share | Blocked on |
|---|---|---:|---|
| W1 | Foundation: crate, router shell, header/nav/footer, responsive layout, CSS-module conversion, fonts, assets, toast, modal. *Prototype has the crate, router, Tailwind reuse* | 12% | — |
| W2 | API client and domain types for every entity, contract tests against backend fixtures. *Prototype has the client and `LiveStream`* | 5% | — |
| W3 | Home: stream reel, capybara cards, gallery | 6% | W6 for video |
| W4 | Watch + watch room: camera tabs, deep links, reel fallback, viewer count, reactions, chat with polling | 12% | writes: `capyweb-7hj` |
| W5 | Play: capybara picker, vote and bid cards, rules, cost confirm, thanks | 9% | writes: `capyweb-7hj` |
| W6 | Video player and a new video source (options and a recommendation in `docs/VIDEO_OPTIONS.md`): the playback route, resume position, pause when the tab is hidden | 9% | private playback: `capyweb-0m7` (backend) |
| W7 | Shop and pass details: list, search, sort, offers, activity | 6% | claiming: write API |
| W8 | Profile: signed-out pitch, name, balance, ledger history | 5% | `/me` routes |
| W9 | Robot page and the four static pages | 4% | — |
| W10 | WebMCP: shim, tool registry, sign-in-gated registration, consequential confirm, review | 5% | signed-in tools: W11 |
| W11 | Cognito sign-in: managed login + PKCE, callback, token store, refresh, sign-out, auth seam | 8% | `capyweb-w26` grant |
| W12 | Release: `/api/*` behaviour + CloudFront Function, CSP headers policy, `deploy.sh` web mode (immutable hashed files, wasm content type, keep the previous release) | 5% | new deploy identity (Q3) |
| W13 | Guards and tests: the 8 new guard rules + self-tests, pre-push cargo checks, size budget, a headless browser smoke test | 5% | — |
| W14 | Accessibility and performance pass, parity check against `demo/` and React, QA of dev by Instinct | 5% | W12 |
| W15 | Carry-over: rebuild beads here, private Dolt remote, backend `npm ci`, record `ApiUrl`, lent-Mac clean-up when it returns | 3% | identity (Q3); the Mac |
| W16 | Retire React after cutover: remove `src/`, `vite.config.ts`, `amplify/`, `amplify.yml` and the npm dependencies; update the guard baseline | 1% | W14 |
| | **Total** | **100%** | |

The prototype covers roughly 4 points of this: most of W2's client, part of W1, and part of W10.

Suggested order: W1 → W2 → W13 (gates first) → W3, W9, W7 (read-only pages, unblocked) → W6 → W4, W5,
W8 against the auth seam → W10 → W12 and W11 as the grants land → W14 → cutover on dev → W16.

### Risks

1. **Value for money.** Most of the size win is from dropping Amplify, Dynamic and Solana, which a React
   cleanup would also get (section 1). Leptos iteration is slower than React, and fewer people can
   maintain it. *Mitigation:* keep domain logic in plain Rust modules with native tests, and keep
   components thin.
2. **Leptos churn.** 0.9 is in beta, and 0.7 → 0.8 broke APIs. *Mitigation:* pin 0.8; do the upgrade as
   one separate task.
3. **Sign-in blocked.** All write features wait on `capyweb-w26`, then `capyweb-7hj`. *Mitigation:* build
   against the auth seam and fixtures; do not ship half-working write buttons (hide them until the routes
   exist).
4. **Private playback depends on the backend.** There is no playback route until W6. The front end can
   avoid requesting private playback, but only the server can enforce payment (`capyweb-0m7`).
5. **WebMCP is a moving draft.** It has already moved from `navigator` to `document`, and no browser
   ships it. *Mitigation:* the shim handles both; a feature flag keeps it off until reviewed.
6. **Stale-asset crash after a deploy.** A deleted hashed `.wasm` comes back as HTML. *Mitigation:*
   section 5 item 3.
7. **Video.** The video source and the player are chosen in W6 (options in `docs/VIDEO_OPTIONS.md`). If
   the player uses hls.js, it adds ~150 KB gzip, loaded lazily on video pages only; iOS uses native HLS.
   *Mitigation:* test on a real iPhone and Android phone before cutover.
8. **Tokens in `localStorage`.** Readable by any XSS. *Mitigation:* strict CSP, no third-party scripts,
   refresh-token rotation, short-lived access tokens kept in memory.
9. **Lent Mac.** If it does not come back, the beads history and capyweb-lead's notes are gone. The ids
   and context in the repo are the floor.
10. **The size budget, measured per page (W7, 2026-09-29).** Each Leptos page costs more than the
    prototype suggested. The typed views compile to their own code, so the release `.wasm` grows by
    ~20 KB brotli for the Shop list and ~17 KB for pass details. The W1 shell plus W2 was 145,552 bytes;
    with W7 it is 178,926 of the 300,000-byte budget. At ~15–25 KB for each page still to build (Home,
    the watch room, Play, Profile, the Robot and static pages, sign-in, the WebMCP tools), the total
    lands at about 300–330 KB. Leptos's `erase_components` saves only ~3 KB.
    *Mitigation:* keep pages lean. Branch views end in `.into_any()`. Avoid pulling in Unicode tables
    (`to_ascii_lowercase` saved ~4 KB in W7). Share components rather than repeat markup, and put long
    static text in plain data rendered by one component. If that is not enough, split the routes
    (Leptos lazy routes with `wasm-split`; Trunk has no support, so this may need cargo-leptos for the
    release build), or raise the budget with a reason. The guard fails the push first, so this cannot
    drift unseen. W14 owns the decision.

### Open questions (decided by capyweb-manager on 2026-09-29; see "Decisions" at the top)

| # | Question | Recommendation → decision |
|---|---|---|
| Q1 | Do the wallet features (Dynamic login, Solana CAPYL balance and transfers, NFT trading, the watch-time "airdrop" counter) carry over into the WASM app, or does v1 run on server-side play coins only, as `demo/` and `docs/PLAN.md` B6 describe? | **Play coins only in v1.** It removes the largest dependencies and the client-side balance overwrite (the app currently writes the on-chain balance into the DB from the browser). A wallet link can come later as a separately reviewed module if it is still wanted. **Decided: yes** |
| Q2 | Sign-in: Cognito managed login (redirect, PKCE), or sign-in inside the page with email OTP and no hosted UI, as `docs/PLAN.md` B3 said? | **Managed login with PKCE and email OTP.** Least auth code in the app, standard token refresh, social sign-in later by configuration, and the same flow for the admin console. The redirect happens at the first spend and then only when the refresh token expires, and the pending action resumes afterwards. **Decided: yes** |
| Q3 | Approve a deploy identity for mac-pro-japan-16: IAM user `capyapp-mac-pro-japan-16` in group `capyapp-deployers`, trusted by `capyapp-capytube-dns`, plus the Cognito grant for `capyweb-w26`? Delete the lent Mac's deactivated key? | **Yes to all.** It is the same scope as before, on a Mac that is ours. **Decided:** the identity is with herdr-master; the Cognito grant is already in (section 6); the old key stays deactivated, not deleted |

---

## 8. Prototype (in this branch)

`web/`: Leptos 0.8.21, leptos_router 0.8.16, gloo-net 0.7, Trunk 0.21.14, Rust 1.98.1.

```sh
cd web
cargo test                      # 10 native tests: envelope, errors, encoding, fixture contract, access, reel keys
trunk serve --release           # http://127.0.0.1:8791/  (loopback only, fixtures)
node tests/smoke.mjs            # headless browser check; setup in the file's header
```

- **Pages:** `/` lists the cameras from `GET /streams` (fixture generated from
  `backend/src/scripts/seed-dev.ts`, in the shape `clean()` returns). `/streams/:id` shows one stream: a
  public stream shows where the player goes; a private one shows only "Sign in and pay to watch", with no
  playback request. The prototype's `/streams/:id` is illustrative; the real app keeps
  `/stream/:capyId` (section 2).
- **WebMCP:** `list_streams` (readOnly) and `open_stream` (navigation, not readOnly) are registered from
  Rust through `web/js/webmcp.js`.
- **Measured** (release build, headless Chromium 390×844, a stand-in WebMCP host injected before load;
  all of it is asserted in `web/tests/smoke.mjs`):
  - the list rendered in ~190–280 ms after navigation on loopback;
  - 3 cards, the private one priced "1 coin / 10 s";
  - a private stream without a price shows "Private";
  - `list_streams` returned the 3 streams as JSON text with no playback fields;
  - `open_stream({id:"wall-cam"})` navigated to `/streams/wall-cam`;
  - `open_stream({id:"../admin"})` was rejected;
  - a host that rejects `registerTool` leaves 0 tools counted;
  - without WebMCP the page worked and registered nothing;
  - `trunk serve` bound `127.0.0.1:8791` only (checked with `lsof`).
- **Sizes** (after the review fixes): WASM 341,840 B raw / 140,906 gzip / 117,442 brotli; JS glue
  49,243 / 8,461 / 7,166; WebMCP shim snippet 1,891 / 834 / 676; CSS 13,981 / 4,130 / 3,514. brotli
  1.2.0 at `-q 11`; another brotli build differed by ~25 bytes. React today (`vite build` of `feat/serverless-capyapp-backend`): entry JS
  4,462,565 B raw / 1,129,129 gzip / 776,540 brotli; CSS 373,631 / 43,969 / 35,822.
- **Known prototype gaps:** a missing fixture comes back as the SPA shell and reads as "expected JSON, got
  something else". That is the correct client behaviour; the real API returns a JSON 404, which the
  client maps to "No such stream". There is no player, no sign-in and no CSP yet.
