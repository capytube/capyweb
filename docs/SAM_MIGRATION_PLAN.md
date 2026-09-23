# capyweb: Amplify Gen 2 -> AWS SAM migration plan (DRAFT, awaiting Nic's approval)

Status: plan only. Nothing is migrated until Nic approves.

Accounts and regions:
- **Capy account 619071347239**: everything runs here (Lambda, DynamoDB, API Gateway, S3, CloudFront, ACM). Backend in ap-southeast-1. The CloudFront certificate has to be in us-east-1 (CloudFront requirement).
- **AL account 360122305252**: touched ONLY for DNS records in the capytube.xyz hosted zone Z01748582U1VPM60UY0TW (the domain is registered there too).

Allowed services (Nic): Lambda, DynamoDB, API Gateway, CloudFront, Route 53 (capytube.xyz zone only). S3 (capyweb-* buckets, public access always blocked) and ACM (capytube.xyz/www only) are included only because CloudFront needs an origin bucket and a certificate. Nic can veto that. No other services, and no IAM creation by the pipeline.

## 1. What Amplify provides today and what it becomes

| Today (Amplify Gen 2) | Actually used by the frontend? | Under SAM |
|---|---|---|
| Cognito user pool: email, Google, Facebook, Admins/Users groups | **No.** Login is Dynamic.xyz (Solana wallet, `@dynamic-labs/sdk-react-core`). No Amplify Auth calls in `src/`. | **Drop Cognito.** API Gateway HTTP API **JWT authorizer** checks Dynamic's JWT (issuer = the Dynamic environment, keys = `https://app.dynamic.xyz/api/v0/sdk/<ENV_ID>/.well-known/jwks.json`). No Google/Facebook OAuth secrets needed. If Nic wants email/Google/Facebook login later, add Cognito then. |
| AppSync GraphQL + DynamoDB, 11 models (User, Capybara, LiveStream, Interactions, UserVotes, UserBids, TokenTransaction, ChatComments, NFT, Offers, ActivityLog), **all public API-key auth** (anyone can write) | Yes, ~45 `client.models.*` calls in `src/api/*` | **HTTP API + Lambda (Node 20) + DynamoDB.** One table per model, keeping the same GSIs (ByWalletAddress, ByEmailAddress, CapybaraInteractionIndex, by-stream/by-NFT/by-owner). Public GET for read-only catalog data (Capybara, LiveStream, Interactions, NFT list). Writes need a Dynamic JWT, and the server checks ownership (you can only edit your own User, votes and bids). Balance/TokenTransaction/NFT-transfer writes are **server-side only**, never client-set. |
| `getStream`, `getViewership` Lambdas (Livepeer) | Yes | Same code as `GET /stream/{id}` and `GET /viewership/{id}` routes. The Livepeer key moves to **SSM SecureString** `/capyweb/livepeer-api-key`, read at runtime. **Rotate both leaked keys first** (they're hardcoded in this public repo). |
| S3 `capytubeDrive`, `public/*` with **guest read/write/delete** | Yes: `StorageImage` shows capybara/NFT images (20 uses) | Private S3 bucket served read-only through the same CloudFront distribution at `/media/*` (Origin Access Control). **No guest writes.** Admin uploads go through a presigned-URL Lambda limited to an admin wallet allowlist. |
| Amplify Hosting + custom domain | n/a (currently down, no DNS records) | Private **S3 bucket + CloudFront** in the Capy account (OAC, SPA fallback to index.html, HTTPS via ACM us-east-1). DNS: A/AAAA alias records for `capytube.xyz` and `www`, plus the ACM validation CNAME, written in the AL account's zone by a separate DNS-only user. Deploy = `vite build` -> `aws s3 sync` -> CloudFront invalidation. |
| SSM `/amplify/*` secrets (Google/FB OAuth) | n/a once Cognito is dropped | One SSM SecureString `/capyweb/livepeer-api-key`, created by the admin by hand and read by Lambda at runtime. The pipeline gets no SSM permissions. |

## 2. Frontend changes this forces
- Remove `aws-amplify`, `@aws-amplify/ui-react`, `@aws-amplify/ui-react-storage`, `@aws-amplify/backend*`, `aws-cdk*`, the `amplify/` folder, `amplify.yml`, `amplify_outputs.json`.
- Replace `generateClient<Schema>()` in `src/api/*` with a small typed `fetch` client (`src/api/http.ts`) that attaches the Dynamic JWT (`getAuthToken()`). Same function names, so components barely change.
- `StorageImage` (20 places) -> plain `<img src={MEDIA_BASE + key}>`.
- `Loader`/`Placeholder` (9 places) -> small local components.
- Env: `VITE_API_BASE_URL`, `VITE_MEDIA_BASE_URL` at build time. Types move from the Amplify `Schema` to `src/domain/*.ts`.
- Nice side effect: a much smaller bundle, since the Amplify libs are heavy.

## 2a. Implementation notes (found during build)
- **Auth:** Dynamic has no OIDC discovery document. Only the JWKS exists: `https://app.dynamic.xyz/api/v0/sdk/066bc44d-7c4b-44f5-95a4-5ce8b41b1d33/.well-known/jwks` returns keys, so the env ID is live. The API Gateway built-in JWT authorizer needs discovery, so write routes use a small **Lambda authorizer** that verifies against that JWKS, with results cached for 5 minutes. It's still serverless and needs no new IAM.
- **Where deploys run:** secrets in the vault can only be filled into web forms, never given to a shell. So deploys run in **GitHub Actions** (`.github/workflows/capyweb-aws.yml`), with the keys stored as repo secrets `CAPY_AWS_ACCESS_KEY_ID`, `CAPY_AWS_SECRET_ACCESS_KEY`, `AL_DNS_AWS_ACCESS_KEY_ID`, `AL_DNS_AWS_SECRET_ACCESS_KEY`. It triggers only on push to main or by hand, never on PRs. Each run first checks both keys' identity and scope (it expects denials for IAM, EC2, list-all-buckets, list-hosted-zones and domains), then refuses to deploy if any provisioned capacity shows up in the template.

## 3. Repo layout
- `infra/backend/template.yaml` (SAM, Capy account, ap-southeast-1): HTTP API, Lambdas, DynamoDB tables, media bucket.
- `infra/site/template.yaml` (CloudFormation, Capy account, us-east-1): ACM cert (DNS validation), site bucket, CloudFront.
- `infra/README.md`: deploy commands.
- Lambdas live in `backend/src/`, bundled with esbuild.

DNS records are NOT in any stack, because the zone lives in a different account. I write them with the AL DNS-only key via `aws route53 change-resource-record-sets`.

## 4. Order of work (after approval)
0. Admin does the one-time steps in section 7.
1. Read-only check for old Amplify data (only if Nic wants it kept, see section 5e).
2. Backend stack on a dev stage, with API tests.
3. Frontend swap on a branch: tsc + build + headless test against the dev API.
4. Site stack: request the cert, then add its validation CNAME in the AL zone. Once the cert is issued, create CloudFront and test on the cloudfront.net URL.
5. Add the capytube.xyz and www alias records in the AL zone, then test live.
6. I delete nothing outside what I created.

## 5. Least-privilege IAM

### 5a. Capy account 619071347239: user `capyweb-deploy` (inline policy)
Can: run CloudFormation stacks named `capyweb-*` (ap-southeast-1 and us-east-1), hand them only the role `capyweb-cfn-exec`, upload to the artifacts/site/media buckets, invalidate CloudFront, read `capyweb-*` Lambda logs.
Can't: create anything directly, touch IAM, or touch other stacks, buckets or services.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CfnCapywebStacksOnly",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResources",
        "cloudformation:ListStackResources",
        "cloudformation:GetTemplate",
        "cloudformation:GetTemplateSummary",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet"
      ],
      "Resource": [
        "arn:aws:cloudformation:ap-southeast-1:619071347239:stack/capyweb-*/*",
        "arn:aws:cloudformation:us-east-1:619071347239:stack/capyweb-*/*",
        "arn:aws:cloudformation:ap-southeast-1:aws:transform/Serverless-2016-10-31"
      ]
    },
    {
      "Sid": "CfnValidate",
      "Effect": "Allow",
      "Action": [
        "cloudformation:ValidateTemplate"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassOnlyCfnExecRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::619071347239:role/capyweb-cfn-exec",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "cloudformation.amazonaws.com"
        }
      }
    },
    {
      "Sid": "SamArtifactsBucket",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::capyweb-sam-artifacts-619071347239",
        "arn:aws:s3:::capyweb-sam-artifacts-619071347239/*"
      ]
    },
    {
      "Sid": "SiteAndMediaFiles",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::capyweb-site-619071347239",
        "arn:aws:s3:::capyweb-site-619071347239/*",
        "arn:aws:s3:::capyweb-media-619071347239",
        "arn:aws:s3:::capyweb-media-619071347239/*"
      ]
    },
    {
      "Sid": "CacheInvalidate",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::619071347239:distribution/*"
    },
    {
      "Sid": "ReadCapywebLambdaLogs",
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents",
        "logs:GetLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:ap-southeast-1:619071347239:log-group:/aws/lambda/capyweb-*"
    }
  ]
}
```

### 5b. Capy account: role `capyweb-cfn-exec` (only CloudFormation can assume it)
Creates only the allowed services, each limited to `capyweb-*` names:
- Lambda
- DynamoDB
- HTTP API in ap-southeast-1
- two buckets, with an explicit Deny on ever weakening Block Public Access or using ACLs
- CloudFront in this account
- ACM certs only for capytube.xyz/www

It passes only the pre-made `capyweb-lambda-exec` role and cannot create IAM roles.
Trust policy: `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"cloudformation.amazonaws.com"},"Action":"sts:AssumeRole"}]}`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LambdaCapywebOnly",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:PutFunctionConcurrency",
        "lambda:DeleteFunctionConcurrency",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:ListTags",
        "lambda:PublishVersion",
        "lambda:ListVersionsByFunction"
      ],
      "Resource": "arn:aws:lambda:ap-southeast-1:619071347239:function:capyweb-*"
    },
    {
      "Sid": "PassOnlyLambdaExecRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::619071347239:role/capyweb-lambda-exec",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "lambda.amazonaws.com"
        }
      }
    },
    {
      "Sid": "ReadLambdaCodeFromArtifacts",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::capyweb-sam-artifacts-619071347239/*"
    },
    {
      "Sid": "DynamoDBCapywebTablesOnly",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:UpdateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:TagResource",
        "dynamodb:UntagResource",
        "dynamodb:ListTagsOfResource",
        "dynamodb:UpdateContinuousBackups",
        "dynamodb:DescribeContinuousBackups"
      ],
      "Resource": "arn:aws:dynamodb:ap-southeast-1:619071347239:table/capyweb-*"
    },
    {
      "Sid": "HttpApiSingapore",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:PATCH",
        "apigateway:DELETE",
        "apigateway:TagResource"
      ],
      "Resource": [
        "arn:aws:apigateway:ap-southeast-1::/apis",
        "arn:aws:apigateway:ap-southeast-1::/apis/*",
        "arn:aws:apigateway:ap-southeast-1::/tags/*"
      ]
    },
    {
      "Sid": "S3CapywebBucketsOnly",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:GetBucketLocation",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:PutEncryptionConfiguration",
        "s3:PutBucketOwnershipControls",
        "s3:PutBucketTagging",
        "s3:PutBucketCORS",
        "s3:GetBucketPublicAccessBlock"
      ],
      "Resource": [
        "arn:aws:s3:::capyweb-site-619071347239",
        "arn:aws:s3:::capyweb-media-619071347239"
      ]
    },
    {
      "Sid": "NeverWeakenPublicAccessBlock",
      "Effect": "Deny",
      "Action": [
        "s3:PutBucketPublicAccessBlock",
        "s3:DeleteBucketPublicAccessBlock",
        "s3:PutBucketAcl",
        "s3:PutObjectAcl",
        "s3:PutAccountPublicAccessBlock"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudFrontThisAccount",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:TagResource",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:GetOriginAccessControlConfig",
        "cloudfront:CreateFunction",
        "cloudfront:UpdateFunction",
        "cloudfront:DeleteFunction",
        "cloudfront:DescribeFunction",
        "cloudfront:PublishFunction",
        "cloudfront:GetFunction"
      ],
      "Resource": [
        "arn:aws:cloudfront::619071347239:distribution/*",
        "arn:aws:cloudfront::619071347239:origin-access-control/*",
        "arn:aws:cloudfront::619071347239:function/capyweb-*"
      ]
    },
    {
      "Sid": "AcmCapytubeDomainsOnly",
      "Effect": "Allow",
      "Action": [
        "acm:RequestCertificate",
        "acm:AddTagsToCertificate"
      ],
      "Resource": "*",
      "Condition": {
        "ForAllValues:StringEquals": {
          "acm:DomainNames": [
            "capytube.xyz",
            "www.capytube.xyz"
          ]
        }
      }
    },
    {
      "Sid": "AcmManageOwnCerts",
      "Effect": "Allow",
      "Action": [
        "acm:DescribeCertificate",
        "acm:DeleteCertificate",
        "acm:ListTagsForCertificate"
      ],
      "Resource": "arn:aws:acm:us-east-1:619071347239:certificate/*"
    }
  ]
}
```

### 5c. Capy account: role `capyweb-lambda-exec` (runtime role for every function, made by the admin, so the pipeline never creates IAM)
Allows: write own logs, CRUD on `capyweb-*` tables, read the one Livepeer SSM param, and PutObject under `media/` (admin image upload presign only).
Trust policy: `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WriteOwnLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:ap-southeast-1:619071347239:log-group:/aws/lambda/capyweb-*"
    },
    {
      "Sid": "CapywebTablesCrud",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:BatchGetItem",
        "dynamodb:ConditionCheckItem",
        "dynamodb:TransactWriteItems"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-southeast-1:619071347239:table/capyweb-*",
        "arn:aws:dynamodb:ap-southeast-1:619071347239:table/capyweb-*/index/*"
      ]
    },
    {
      "Sid": "ReadLivepeerKey",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter"
      ],
      "Resource": "arn:aws:ssm:ap-southeast-1:619071347239:parameter/capyweb/livepeer-api-key"
    },
    {
      "Sid": "AdminImageUploadPresign",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::capyweb-media-619071347239/media/*"
    }
  ]
}
```

### 5d. AL account 360122305252: user `capyweb-dns` (inline policy)
Only zone Z01748582U1VPM60UY0TW. Only A/AAAA/CNAME records. Only the names `capytube.xyz`, `www.capytube.xyz` and ACM validation names (`_*.capytube.xyz`). It can't touch MX/TXT/NS, other zones, the domain registration, or anything else in that account. I chose a plain user over a cross-account role because it's fewer steps for the admin.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CapytubeRecordsOnly",
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets"
      ],
      "Resource": "arn:aws:route53:::hostedzone/Z01748582U1VPM60UY0TW",
      "Condition": {
        "ForAllValues:StringEquals": {
          "route53:ChangeResourceRecordSetsRecordTypes": [
            "A",
            "AAAA",
            "CNAME"
          ]
        },
        "ForAllValues:StringLike": {
          "route53:ChangeResourceRecordSetsNormalizedRecordNames": [
            "capytube.xyz",
            "www.capytube.xyz",
            "_*.capytube.xyz",
            "_*.www.capytube.xyz"
          ]
        }
      }
    },
    {
      "Sid": "ReadThisZone",
      "Effect": "Allow",
      "Action": [
        "route53:GetHostedZone",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "arn:aws:route53:::hostedzone/Z01748582U1VPM60UY0TW"
    },
    {
      "Sid": "CheckChangeStatus",
      "Effect": "Allow",
      "Action": [
        "route53:GetChange"
      ],
      "Resource": "arn:aws:route53:::change/*"
    }
  ]
}
```

### 5e. Optional, only if old Amplify data should be kept
This is a one-off, read-only grant added to `capyweb-deploy` and removed afterwards: `dynamodb:ListTables`, `dynamodb:DescribeTable`, `dynamodb:Scan` on the old tables, and `s3:ListBucket`/`s3:GetObject` on the old storage bucket. (Whichever account they were in: if it's the AL account, the grant goes there instead.)

## 6. Hard usage limits (built into the stacks)
- **Lambda:** `ReservedConcurrentExecutions` 5 on API functions and 2 on the Livepeer/upload functions, so the whole backend can never run more than about 20 at once. Timeout 10s, memory 256 MB. Caveat: AWS requires 10 unreserved concurrency to stay in the account. If the Capy account still has the new-account limit of 10 total, reserved caps can't be set, and the admin must request a concurrency limit increase (Service Quotas, Lambda concurrent executions -> 100, free).
- **API Gateway (HTTP API):** stage default throttling 10 req/s steady, 20 burst. Stricter per-route limits on writes (votes/bids/chat: 2 req/s, burst 5). CORS limited to https://capytube.xyz and www. HTTP APIs have no usage plans or API keys (those are REST-API only). Throttling plus the Dynamic JWT on writes plus the Lambda caps do that job. If Nic wants per-client quotas, it has to be a REST API with a Lambda authorizer, which costs more and is slower.
- **DynamoDB:** on-demand with a hard `OnDemandThroughput` ceiling per table (MaxReadRequestUnits 50, MaxWriteRequestUnits 20). Past that, requests throttle instead of costing more. No autoscaling, so no extra IAM. Point-in-time recovery on for the User and TokenTransaction tables.
- **CloudFront:** PriceClass_100 (cheapest edge locations), long cache on hashed assets, compressed. No Lambda@Edge.
- **Budget (admin, manual, both accounts):** AWS Budgets monthly cost budget of $20 on the Capy account, with email alerts at 50% and 80% actual and 100% forecast. Enable Cost Anomaly Detection (free). Optionally a $5 budget on the AL account. The pipeline has no billing permissions.


### 6a. Serverless / on-demand guarantee (nothing provisioned)
The templates aren't written yet. When they are, they must meet these rules, and each deploy checks them with grep:
- DynamoDB: every table has `BillingMode: PAY_PER_REQUEST` plus an `OnDemandThroughput` ceiling. No `ProvisionedThroughput`, no Application Auto Scaling.
- Lambda: plain on-demand functions. No `ProvisionedConcurrencyConfig` and no `AutoPublishAlias`-based provisioned concurrency. `ReservedConcurrentExecutions` is only a free upper cap: it reserves no capacity, costs nothing and bills nothing when idle. Nic can have it removed, but then the only cap left is the API throttle.
- API Gateway: an HTTP API (pay per request), with no REST API caching cluster.
- CloudFront + S3: pay per use by default. No reserved capacity or savings plans.

## 7. One-time admin steps
(These are the same steps that went out as the admin message.)

**Capy account 619071347239 (region Asia Pacific (Singapore) ap-southeast-1 unless noted)**
1. Rotate the two leaked Livepeer keys in Livepeer Studio. Create SSM Parameter Store SecureString `/capyweb/livepeer-api-key` with the new key.
2. S3: create bucket `capyweb-sam-artifacts-619071347239` (ap-southeast-1, Block all public access ON).
3. IAM role `capyweb-lambda-exec`: trusted entity Lambda, inline policy = capyweb-lambda-exec-role-policy.txt.
4. IAM role `capyweb-cfn-exec`: trusted entity CloudFormation, inline policy = capyweb-cfn-exec-role-policy.txt.
5. IAM user `capyweb-deploy`: no console access, inline policy = capyweb-deploy-user-policy.txt, then create a CLI access key and put it in vault link 1.
6. Service Quotas (ap-southeast-1) > Lambda > Concurrent executions: if it shows 10, request 100.
7. Billing > Budgets: $20/month cost budget with alerts at 50/80% actual and 100% forecast. Enable Cost Anomaly Detection.

**AL account 360122305252**
8. IAM user `capyweb-dns`: no console access, inline policy = capyweb-dns-user-policy.txt, then create a CLI access key and put it in vault link 2.
9. (Optional) $5/month budget alert.

## 8. Open calls for Nic
- Approve this plan.
- Drop Cognito (recommended, since the app uses Dynamic wallet login), or keep email/Google/Facebook login?
- Keep old data (users, capybaras, images), or start fresh?
- Unchanged: stream viewing public vs gated, no payments, robot control stays a stub.
- Dynamic environment ID found in code: `066bc44d-7c4b-44f5-95a4-5ce8b41b1d33` (src/Web3Provider.tsx). Nic should confirm this is the Live environment.
