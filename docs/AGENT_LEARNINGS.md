# Agent learnings and mistakes log

Read this before each work session on capyweb. Add a line whenever something fails or works in a non-obvious way. Newest entries at the bottom of each section.

## Environment and tooling
- 2026-09-23: `npm ci` stalls and times out in the 2 GB agent sandbox. What works: `pnpm import` (builds a pnpm lockfile from package-lock.json, same versions), then `pnpm install --frozen-lockfile --ignore-scripts --prefer-offline`. Don't commit pnpm-lock.yaml.
- 2026-09-23: Full `tsc` and `vite build` need a bigger Node heap. Use `NODE_OPTIONS=--max-old-space-size=1400` for tsc and 1600 for vite build. Both pass that way (build takes about 22s, 4,998 modules).
- 2026-09-23: `vite-plugin-node-polyfills@0.23.1` shows as "broken" on npm, but it builds fine when installed through pnpm. Don't remove it just to get a build through.
- 2026-09-23: For browser tests, run `vite preview` plus headless `google-chrome --screenshot`/`--dump-dom`. Screenshots taken while the Vite dev server had a React-refresh transform error were invalid, so test the production build instead.
- 2026-09-23: The sandbox git remote can't be changed. Push by URL instead: `git push git@github.com:capytube/capyweb.git <ref>:refs/heads/<branch>`. SSH key: ~/.ssh/capyweb_ed25519 (sandbox only, can be lost if the sandbox is rebuilt).

## GitHub access
- 2026-09-23: GitHub web login through the cloud browser was a dead end (2FA on the main account, wrong vault password on the alternate). SSH key push works.
- 2026-09-23: Sending patches instead of pushing caused back-and-forth. Push branches directly.
- 2026-09-23: The first key was added to the `capyreadonly` account, which had no write access ("Permission denied to capyreadonly"). Check write access before pushing.
- 2026-09-23: The connected GitHub integration acts as `thanakijwanavit`, so PRs opened through it show that author. It has no merge action. Merging = fast-forward push to main over SSH, and GitHub marks the PR merged.

## Deploy and hosting
- 2026-09-23: capytube.xyz has no DNS A records (Route 53 zone exists, but it's empty). amplify_outputs.json is `{}`. Pushing to main triggered no Amplify build or status. Deploying needs AWS/Amplify access, which hasn't been granted yet.

## Product rules (from Nic)
- Public vs account-gated stream viewing is Nic's call. Keep the current behavior until he decides.
- No payments work without Nic.
- Robot control stays a labeled stub until the hardware API is proven.
- Marketplace writes must not use the current public API-key auth.
