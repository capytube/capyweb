# capyweb infra

Deploy identity is the `capy` AWS profile: IAM user `capyapp-macbook-pro-14`, group
`capyapp-deployers`. It is scoped to the **`capyapp-*`** naming prefix and to the regions
ap-southeast-1 and us-east-1. Read `docs/AGENT_LEARNINGS.md` before changing anything here.

- `backend/template.yaml`: SAM stack `capyapp-capyweb-backend-<stage>` in ap-southeast-1.
  On-demand only. Lambda Function URLs, not API Gateway (see `docs/PLAN.md` section 8).
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
  --parameter-overrides Stage=dev \
  --no-confirm-changeset --no-fail-on-empty-changeset
```

Requires `esbuild` on PATH (`npm i -g --allow-scripts=esbuild esbuild@0.21`) and
`aws-sam-cli` (`brew install aws-sam-cli`).

Do **not** pass `--role-arn`: this identity deploys as itself. Artifacts can go under the shared
SAM bucket's `capyapp-*` prefix, as above, or into any bucket you create named `capyapp-*`
(`aws s3 mb s3://capyapp-...` works).

## Site

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
| stream / viewership | https://bf5uorawbts5pzedofuxye5o3u0hogcv.lambda-url.ap-southeast-1.on.aws/ |

`/capyapp/capyweb/dev/livepeer-api-key` currently holds a placeholder. Overwrite it after
rotating the leaked keys (`bd show capyweb-962`).
