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
- 2026-09-23: The vault only fills browser forms and never gives secrets to the shell. So cloud keys (AWS etc.) collected by vault link can't be used for CLI deploys from the sandbox. For CLI or pipeline secrets, use GitHub Actions repo secrets (or OIDC) and run deploys in CI. Check how a secret will be used BEFORE asking the user for it.
- 2026-09-23 14:55: The refilled capyreadonly password (31 chars) was still rejected by GitHub. Two vault passwords for this account have failed, so don't keep retrying web login. Ask Nic to do the GitHub UI step himself or check the password first.
- 2026-09-23: sam build with esbuild needs esbuild on PATH in CI (npm i -g esbuild). Reproduce CI failures locally with pip-installed aws-sam-cli, because Actions logs need auth but annotations are public.
- 2026-09-23: A CloudFormation service role used with SAM needs cloudformation:CreateChangeSet on arn:aws:cloudformation:<region>:aws:transform/Serverless-2016-10-31. The first dev deploy failed on this.

## Deploy: the capyapp-* deployer (2026-09-24)
- The `capy` AWS profile now points at IAM user `capyapp-macbook-pro-14`, in group `capyapp-deployers`. It is NOT an admin. Everything it touches must be named `capyapp-*`. The older `capyweb-deploy` user and the `capyweb-cfn-exec` / `capyweb-lambda-exec` roles are no longer the path.
- That group already has `cloudformation:CreateChangeSet` on `arn:aws:cloudformation:*:aws:transform/*`, so the SAM-transform problem that blocked every deploy in September does not exist on this identity. Deploy directly as the user; do NOT pass `--role-arn`.
- Lambda roles must carry the permissions boundary `arn:aws:iam::619071347239:policy/capyapp-lambda-boundary`, or `iam:CreateRole` is denied. Set it once in `Globals.Function.PermissionsBoundary` and let SAM create per-function roles.
- The deployer can only PutObject to `aws-sam-cli-managed-default-samclisourcebucket-*` under a `capyapp-*` key prefix. In ap-southeast-1 that bucket is `aws-sam-cli-managed-default-samclisourcebucket-x9uvrhw2yfp6`. It canNOT write to a bucket it creates itself: the S3 grant is on `arn:aws:s3:::capyapp-*` (bucket ARN), with no `/*` for objects.
- Allowed regions are ap-southeast-1 and us-east-1 only (`DenyOutsideTwoRegions`).
- **No `apigateway:*` anywhere in the four attached policies** - absent, not denied. `AWS::Serverless::HttpApi` fails with `apigateway:POST` denied and rolls the stack back. Using Lambda Function URLs instead (covered by `lambda:*` on `capyapp-*`, and free per request). See issue capyweb-xfp.
- Account Lambda concurrency is 400 with 336 unreserved, so `ReservedConcurrentExecutions` works fine here.

## esbuild + ESM Lambda
- Bundling `@aws-sdk/*` into an ESM Lambda produces `Dynamic require of "https" is not supported` at INIT. Fix: `External: ["@aws-sdk/*"]` in BuildProperties - the SDK ships in the nodejs22.x runtime. Bundle went from ~200 KB to 868 bytes.
- SAM's esbuild `OutExtension` needs the leading dot: `[".js=.mjs"]`, not `["js=.mjs"]`.
- `backend/src/package.json` has `"type": "module"`, so the built file must be `.mjs` (Format: esm + OutExtension) or Node refuses to load it.
- macOS has no `timeout` and no `/etc/hostname`; don't use either in permission probes - an absent source file makes `aws s3 cp` look like AccessDenied.

## CI policy: no GitHub Actions (2026-09-26)
- Standing rule from Nic, via herdr-master: **do not use GitHub Actions.** His Actions allowance is exhausted. Do not trigger, re-run or wait on workflows (`gh workflow run`, `gh run rerun`, `workflow_dispatch`), and do not add new workflow files. Reference: Villa KB `reference/no-github-actions.md`.
- A push still *queues* workflows that cannot run, so a red or pending check after a push means nothing about your change. **Test locally before pushing.**
- `.github/workflows/capyweb-aws.yml` triggers on push to main touching `infra/**` or `backend/**`. It is both against the rule and already broken: it passes `--role-arn capyweb-cfn-exec` and uploads to `capyweb-sam-artifacts-619071347239`, neither usable by the current `capyapp-macbook-pro-14` identity. Retire it (see `bd list` for the issue).
- The sanctioned deploy path is local `sam deploy` with `AWS_PROFILE=capy`, documented in `infra/README.md`. The 2026-09-24 dev deploy used it and never touched Actions.
- If automated CI is wanted, it is AWS CodeBuild / CodePipeline. Note `codebuild:*` is **not** currently granted to `capyapp-deployers`, so that needs a policy addition first.
