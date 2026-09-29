## CapyTube

Watch the capybaras, then play: vote on a snack, bid to name a climbing hold, react and chat, all with
play coins, which are not money. Every camera is a recording today, and the site says so.

| Folder | What it is |
|---|---|
| `web/` | The site: a Rust/Leptos app compiled to WebAssembly with Trunk (`web/README.md`) |
| `backend/` | The API: Lambda functions in TypeScript behind an HTTP API, one DynamoDB table, a Cognito user pool (`infra/backend/template.yaml`) |
| `infra/` | CloudFormation for the site (S3 and CloudFront), DNS, alarms, cost control and the alarm relay, plus the deploy scripts (`infra/README.md`) |
| `demo/` | The first clickable prototype: a static page kept as the design reference. Its videos play the site's `/media/` copy, so they load only when it is served from the site |
| `docs/` | Plans, the data model, runbooks and the release plan |
| `scripts/` | The local checks: `guard.sh`, `web-checks.sh`, `build-release.sh`, the history scan |

**Checks.** There is no CI: these repos use no GitHub Actions. Instead, `scripts/install-hooks.sh`
installs git hooks, once per clone. The pre-commit runs the guard, and the pre-push runs the guard, the
history scan, the backend tests and, when `web/` changed, `scripts/web-checks.sh`. Run them by hand
with:

```sh
scripts/guard.sh                      # cost, security, build and release rules (seconds)
scripts/web-checks.sh                 # the web app: fmt, clippy, tests, release build, page tests (minutes)
(cd backend/src && npm test)          # the backend's tests
```

**Releases.** `scripts/build-release.sh <dev|prod> <dir>` builds and checks a stage's site.
`infra/site/deploy.sh` uploads it and changes the stacks; every stack change is a change set that is
read before it runs. Production needs its go (`docs/RELEASE_PLAN.md`).

The React app this repository started from was retired in W16 (`docs/W16_PLAN.md`). It is in the
git history.
