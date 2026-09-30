# capyweb infra

Deploy identity is the `capy` AWS profile. On mac-pro-japan-16 it is IAM user `capyapp-mac-pro-japan-16`
(on the lent MacBook Pro it was `capyapp-macbook-pro-14`, whose key is deactivated), group
`capyapp-deployers`. Dev stack only until capyweb-manager gives the go for production. It is scoped to
the **`capyapp-*`** naming prefix and to the regions ap-southeast-1 and us-east-1. Read `docs/AGENT_LEARNINGS.md` before changing anything here.

- `backend/template.yaml`: SAM stack `capyapp-capyweb-backend-<stage>` in ap-southeast-1.
  On-demand only. API Gateway HTTP API (see `docs/PLAN.md` section 8).
- `site/template.yaml` + `site/dns.yaml` + `site/deploy.sh`: site stack
  `capyapp-capyweb-site-<stage>` (private S3 + CloudFront OAC) on `dev.capytube.xyz` or, for
  prod, `capytube.xyz` and `www.capytube.xyz`, and its DNS stack `capyapp-capyweb-dns-<stage>` in the **autonomous-lab**
  account, where the `capytube.xyz` zone lives. The DNS stack is deployed through the `capytube-dns` profile.
- `mail/`: contact@capytube.xyz, received by SES and forwarded to a private address (stacks `capyapp-capyweb-contact-mail`
  and, in the DNS account, `capyapp-capyweb-mail-dns`). Deployed by an admin; steps and the proof in `mail/README.md`.
- Plan and cost model: `docs/PLAN.md`. Issue tracker: `bd list`.

## Deploy

```sh
export AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 SAM_CLI_TELEMETRY=0

sam build --template-file infra/backend/template.yaml --build-dir .aws-sam/build

sam deploy --template-file .aws-sam/build/template.yaml \
  --stack-name capyapp-capyweb-backend-dev \
  --s3-bucket aws-sam-cli-managed-default-samclisourcebucket-x9uvrhw2yfp6 \
  --s3-prefix capyapp-capyweb-backend-dev \
  --capabilities CAPABILITY_IAM \
  --tags Project=capyweb Stage=dev \
  --parameter-overrides Stage=dev AllowedOrigins=https://dev.capytube.xyz,http://127.0.0.1:8791,http://localhost:8791 \
      PlaybackKeyPairId=KD0MHU27L6GFD \
  --no-confirm-changeset --no-fail-on-empty-changeset
```

Sign-in (W11) adds a Cognito user pool, its managed-login domain, a public web client and the
HTTP API's `CognitoJwt` authorizer to this stack. The deploy identity needs `cognito-idp` on
them. Outputs `UserPoolId`, `UserPoolClientId`, `ManagedLoginDomain` and `AuthIssuer`; the web
app takes the domain and client id in its `/config.json` (`web/README.md`). Passwordless email
OTP needs `--parameter-overrides SesIdentityArn=<verified SES identity ARN> SesFromAddress=<from>`;
without them the pool offers password sign-in only (`docs/WASM_PLAN.md` section 3, "The user
pool as written"). The pool has deletion protection and is retained if the stack is deleted.
The signed-in write routes (lane 4: `/me`, votes, bids, chat, reactions) use that authorizer;
reading chat is public. Details and examples: `docs/DATA_MODEL.md` section 6.

Dev stack outputs (deployed 2026-09-29): `ApiUrl` https://geqi0or5tl.execute-api.ap-southeast-1.amazonaws.com/dev,
user pool `ap-southeast-1_DofVgMjLl`, client `4hp9maame83ah6op5leebnturc`, managed login
`capyapp-capyweb-dev.auth.ap-southeast-1.amazoncognito.com` (password sign-in until SES, `capyweb-c6e`). None of
these is a secret. Build into a directory outside the repo (`.aws-sam` is not gitignored) and create the change
set with `--no-execute-changeset` first, so a replacement of `MainTable` or the pool is seen before it runs.

Requires `esbuild` on PATH (`npm i -g --allow-scripts=esbuild esbuild@0.21`) and
`aws-sam-cli` (`brew install aws-sam-cli`).

Do **not** pass `--role-arn`: this identity deploys as itself. Artifacts can go under the shared
SAM bucket's `capyapp-*` prefix, as above, or into any bucket you create named `capyapp-*`
(`aws s3 mb s3://capyapp-...` works).

## Alerts and the budget (capyweb-19a, capyweb-m52)

Every alert goes to an SNS topic. Alarms can only notify a topic in their own region, so there is one
topic per place, and **all five go to the capyweb room** through the alarm relay (herdr-master,
2026-09-30: no email, so nobody has a confirmation link to click):

| Topic | Region | Stack | What notifies it |
|---|---|---|---|
| `capyapp-capyweb-<stage>-alarms` | ap-southeast-1 | backend | api-down, site-down, table-throttled, signups-refused |
| `capyapp-capyweb-<stage>-egress-alarm` | us-east-1 | `capyapp-capyweb-alarms-<stage>` (`site/alarms-use1.yaml`) | CloudFront egress over ~800 GB/month |
| `capyapp-capyweb-alerts` | ap-southeast-1 | `capyapp-capyweb-ops` (`ops/template.yaml`, one per account) | the tag-scoped monthly budget `capyapp-capyweb-monthly` (A2); A4 is skipped in v1 |

**The relay** (`ops/alarm-relay.yaml`, stack `capyapp-capyweb-alarm-relay`, deployed by capyweb-manager with
the admin profile):
- The five topics deliver to one SQS queue.
- Every 5 minutes, a job on Mac mini 3 (`ops/alarm-relay-job.sh`) assumes the reader role and runs
  `ops/alarm_relay.py` from a pinned commit.
- The reader posts one line per alarm that went to ALARM, or came back to OK from ALARM. It sends all of
  a run's lines in one `herdr-ask --project capyweb --post`, then deletes the messages.
- Lines are sanitised: no account id, ARN, hostname, e-mail, IP or URL. Anything that is not an alarm is
  a one-line notice with no body.
- Every alarm has `AlarmActions` and `OKActions`.
- `docs/RUNBOOKS.md` section 5 covers reading the queue by hand and pausing the job.

The budget also emails one person directly: the address the account-wide budget `capyweb-monthly-20`
already uses (capyweb-manager, 2026-09-29). Budgets need no confirmation, so that stays.
`capyweb-monthly-20` itself stays too, since it is the only account-wide budget.

The backend alarms:

| Alarm | Fires when |
|---|---|
| `capyapp-capyweb-<stage>-api-down` | the synthetic check has had no healthy `/health` for 15 minutes (`capyweb/Synthetic` `Healthy`, dimensions `Target=api` and `Stage`) |
| `capyapp-capyweb-<stage>-site-down` | the same for the stage's site: the `StageSite` origin, the apex for prod (`Target=site`, `Stage`) |
| `capyapp-capyweb-<stage>-table-throttled` | DynamoDB throttled more than 10 requests in 5 minutes: the table's on-demand ceiling is being hit |
| `capyapp-capyweb-<stage>-signups-refused` | the sign-up cap (`capyweb-kbq`, 40 self sign-ups a UTC day, 10 an hour) refused at least one sign-up in 5 minutes, or its function failed or was throttled and refused to be safe. `AWS/Lambda` `Errors` plus `Throttles` of `capyapp-capyweb-<stage>-signup-cap`; its log says which (`"reason": "day_cap"`, `"hour_cap"` or `"error"`; a throttled call leaves no line) |

The synthetic metrics carry a `Stage` dimension because dev and prod publish to the same namespace in
one account: with `Target` alone, each stage's alarms would read the other's probes. The deploy that
adds it moves dev's two alarms to the new series; until the first run publishes to it (5 minutes), they
see missing data, which counts as breaching, so each may go into ALARM once.

The ops stack (budget names must start with `capyapp-`: the deploy identity may only write those):

```sh
infra/ops/deploy.sh <change-set-name>   # reads the address without printing it; shows the change set
# read the change set, then run the execute-change-set line it prints
```

The budget measures **gross** cost (credits and refunds left out, `docs/PLAN.md` section 1b) of resources
tagged `Project=capyweb`, which counts only once that cost-allocation tag is active in Billing (A1). It
was switched on 2026-09-29 21:47 by capyweb-manager; Billing can take up to 24 hours to show it, so the
budget may read $0 at first.

## Ledger integration tests (DynamoDB Local)

The unit suite (`cd backend/src && npm test`) needs no network. The ledger and write-API suite,
`backend/src/ledger.integration.test.ts`, runs only when `DDB_LOCAL_ENDPOINT` is set, against
DynamoDB Local in Docker, bound to loopback. It sets dummy credentials (`local`/`local`) in its own
process and refuses any endpoint that is not loopback, so it cannot reach AWS or read `~/.aws`.

```sh
colima start --cpu 2 --memory 2
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
docker run -d --name capyweb-ddb-local -p 127.0.0.1:8010:8000 \
  amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory -sharedDb
# The suite also waits up to 30 s for the container, but a manual run is clearer with this:
until curl -s -o /dev/null http://127.0.0.1:8010; do sleep 1; done

cd backend/src
env -u AWS_PROFILE AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null \
  DDB_LOCAL_ENDPOINT=http://127.0.0.1:8010 \
  node --test --experimental-strip-types --no-warnings ledger.integration.test.ts

docker rm -f capyweb-ddb-local && colima stop
```

It creates a fresh table (the template's key schema) per run and deletes it afterwards. DynamoDB
Local serialises transactions, so it never returns `TransactionConflict`; the retry path for that is
covered by unit tests (`classify`) only.

## Site

### Deploying the site: `infra/site/deploy.sh` (W12)

One step at a time, each naming the account it touches (`docs/RELEASE_PLAN.md` section 1). Stack
changes are change sets: the script shows them and prints the execute line, and a person runs it after
reading. The DNS-account steps (`cert`, `dns`) run only when named. Per-stage names and the ids an admin
made (key group, headers policy) are in `infra/site/stages.json`. Production also needs
`CAPYWEB_PROD_GO=1`, set only with herdr-master's go.

```sh
scripts/build-release.sh dev /tmp/capyweb-dev-dist            # dev: with WebMCP; prod: without, and checked
infra/site/deploy.sh dev content /tmp/capyweb-dev-dist --web  # upload, then invalidate
infra/site/deploy.sh dev stack <change-set>     # the site stack (capy account); read it, then execute
infra/site/deploy.sh dev alarms <change-set>    # the us-east-1 egress alarm stack
infra/site/deploy.sh dev cert                   # the certificate; validation records via capytube-dns
infra/site/deploy.sh dev dns <change-set>       # the DNS stack via capytube-dns (for prod: the apex switch)
infra/site/deploy.sh dev prune <live dist>      # lists old hashed files and the commands to delete them
```

`content --web` writes every object from the local file with its Content-Type (an S3-to-S3 re-stamp
without one turned everything into `binary/octet-stream`, and browsers refused the module scripts), and:
- root files whose names carry Trunk's content hash get `max-age=31536000,immutable`, and one that is
  already in the bucket is skipped;
- `index.html` and `snippets/` get `no-cache`. wasm-bindgen keeps a snippet folder's name when its files
  change (two different `chat.js` under one name, checked 2026-09-29), so they are revalidated;
- `assets/` and `vendor/` get a day, and everything else five minutes;
- nothing is deleted, so a visitor holding the previous `index.html` still loads the previous release;
  `prune` lists what could go, for a person to review;
- `config.json` is written from the backend stack's outputs (managed-login domain and client id);
- every stage except prod gets `Disallow: /` in `robots.txt`;
- `scripts/build-release.sh --check` runs first: no inline script (the CSP), and for prod no WebMCP.

The app calls the API same-origin, through the site's `/api/*` behaviour, so no CORS is involved. The
dev backend's `AllowedOrigins` (`https://dev.capytube.xyz,http://127.0.0.1:8791,http://localhost:8791`)
still serves the local dev server; keep it in `--parameter-overrides` on every dev backend deploy.

**The way back on dev:** `git archive main demo | tar -x -C /tmp && infra/site/deploy.sh dev content /tmp/demo`
(a plain static upload, without `--web`).

### The site stack

`infra/site/template.yaml` is private S3 plus CloudFront with OAC: `MediaBucket`, `/media/*`, `/paid/*`
(signed cookies), `/api/*` (the HTTP API, same-origin), and CloudFront Functions for the `/api` prefix,
the SPA fallback (which also sends `www.` names to the apex) and the edge 404. Its parameters come from
`deploy.sh stack`:
- `ResponseHeadersPolicyId`: the CSP and security headers. **No stack may create, update or delete a
  response headers policy** (the right reaches every project's in the account; capyweb-manager,
  2026-09-29). An admin creates `capyapp-capyweb-<stage>-headers` from `infra/site/headers-<stage>.json`,
  and its id goes into `stages.json`; the stack only attaches it. Changes to the headers go through
  capyweb-manager. `web/tests/serve.mjs` sends dev's CSP to every page test.
- `WwwDomain` (prod: `www.capytube.xyz`) and `PriceClass` (prod: `PriceClass_200`, which adds Asia's
  edges; dev stays on `PriceClass_100`).
- `PlaybackKeyGroupId`: the key group and its public key are made by an admin, not by any stack; the
  private key is only in SSM.

The recordings: `infra/media/make-recordings.sh <capytube-stream.mp4> <dir>` (about 11 min on this
Mac), then `infra/media/upload-media.sh <stage> <dir>`; the pass pictures:
`infra/media/upload-pass-images.sh <stage>`. Alarms reach the capyweb room through the relay (above);
there are no alarm emails.

## Current dev endpoints

| Route | URL |
|---|---|
| site (demo) | https://dev.capytube.xyz/ |
| health | https://6aav3mczmingsx7oooetnvu2c40ilton.lambda-url.ap-southeast-1.on.aws/ |
