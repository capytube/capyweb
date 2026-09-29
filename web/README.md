# CapyTube front end (Rust/WebAssembly)

Leptos 0.8, client-side only, built with Trunk. The plan and its reasons are in
`docs/WASM_PLAN.md`. Local dev: `cd web && trunk serve` (127.0.0.1:8791, fixtures by default).
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
  `snippets/`, `brotli -q 11`, at most 300,000 bytes; each file and the total are printed),
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
