# capyweb infra

Deploy identity is the `capy` AWS profile. On mac-pro-japan-16 it is IAM user `capyapp-mac-pro-japan-16`
(on the lent MacBook Pro it was `capyapp-macbook-pro-14`, whose key is deactivated), group
`capyapp-deployers`. Dev stack only until capyweb-manager gives the go for production. It is scoped to
the **`capyapp-*`** naming prefix and to the regions ap-southeast-1 and us-east-1. Read `docs/AGENT_LEARNINGS.md` before changing anything here.

- `backend/template.yaml`: SAM stack `capyapp-capyweb-backend-<stage>` in ap-southeast-1.
  On-demand only. API Gateway HTTP API (see `docs/PLAN.md` section 8).
- `site/template.yaml` + `site/dns.yaml` + `site/deploy.sh`: site stack
  `capyapp-capyweb-site-<stage>` (private S3 + CloudFront OAC, PriceClass_100) on
  `<stage>.capytube.xyz`, and its DNS stack `capyapp-capyweb-dns-<stage>` in the **autonomous-lab**
  account, where the `capytube.xyz` zone lives. The DNS stack is deployed through the `capytube-dns` profile.
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

### The WASM app on dev (content only, 2026-09-29)

`dev.capytube.xyz` serves the WASM build, uploaded with `infra/site/upload-content.sh`: content only,
profile `capy`, no stack, certificate or DNS step. `deploy.sh` stays for W12, and its S3-to-S3 re-stamp
drops Content-Type, which breaks module scripts (`capyweb-b6e.12`).

```sh
cd web && CAPYWEB_API_BASE=https://geqi0or5tl.execute-api.ap-southeast-1.amazonaws.com/dev \
  trunk build --release --dist /tmp/capyweb-dev-dist && rm -rf /tmp/capyweb-dev-dist/fixtures
printf '{"auth": {"domain": "https://capyapp-capyweb-dev.auth.ap-southeast-1.amazoncognito.com", "client_id": "4hp9maame83ah6op5leebnturc"}}\n' \
  > /tmp/capyweb-dev-dist/config.json
cd .. && infra/site/upload-content.sh dev /tmp/capyweb-dev-dist
```

The API is called directly (CORS), so the dev backend is deployed with
`AllowedOrigins=https://dev.capytube.xyz,http://127.0.0.1:8791,http://localhost:8791`; add it to
`--parameter-overrides` on every dev backend deploy, or the dev site loses the API. **The way back:**
`git archive main demo | tar -x -C /tmp && infra/site/upload-content.sh dev /tmp/demo`.

### Video on dev (W6, recorded mode, 2026-09-29)

`docs/VIDEO_DESIGN.md` section 8. The site stack now also has `MediaBucket`, `/media/*`, `/paid/*`
(signed cookies), `/api/*` (the HTTP API, same-origin) and two CloudFront Functions (the `/api`
prefix and the SPA fallback). Update it on its own, **not** with `deploy.sh`, which would also run
the certificate and DNS steps:

```sh
aws cloudformation create-change-set --stack-name capyapp-capyweb-site-dev --change-set-name <name> \
  --template-body file://infra/site/template.yaml \
  --parameters ParameterKey=Stage,UsePreviousValue=true ParameterKey=DomainName,UsePreviousValue=true \
    ParameterKey=CertArn,UsePreviousValue=true \
    ParameterKey=PlaybackKeyGroupId,ParameterValue=fa62f0aa-b698-4a69-9c9d-baa777362153 \
    ParameterKey=ApiDomain,ParameterValue=geqi0or5tl.execute-api.ap-southeast-1.amazonaws.com \
    ParameterKey=ApiOriginPath,ParameterValue=/dev \
  --tags Key=Project,Value=capyweb Key=Stage,Value=dev Key=capy-scope,Value=capyapp
# read it (the distribution must say Replacement False), then execute-change-set
```

The key group and its public key are made by an admin, not by any stack; the private key is only in
SSM. The recordings: `infra/media/make-recordings.sh <capytube-stream.mp4> <dir>` (about 11 min on
this Mac), then `infra/media/upload-media.sh <dir>`.

### Stacks and first deploy


```sh
infra/site/deploy.sh dev demo    # stage, source dir; ~5.5 min the first time (cert + CloudFront)
```

The script requests and validates the us-east-1 certificate, writing the validation CNAME
through `--profile capytube-dns`, because the zone is in another account. It then deploys
the site stack, then the DNS stack, then runs `s3 sync` and an invalidation. It is
safe to re-run: it reuses the issued certificate and skips empty changesets. Until the
React cutover (Epic C), the source is Nic's `demo/`. For the React SPA, change the
403 error response to `ResponseCode: 200`.

## Current dev endpoints

| Route | URL |
|---|---|
| site (demo) | https://dev.capytube.xyz/ |
| health | https://6aav3mczmingsx7oooetnvu2c40ilton.lambda-url.ap-southeast-1.on.aws/ |
