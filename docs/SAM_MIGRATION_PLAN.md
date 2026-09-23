# capyweb: Amplify Gen 2 -> AWS SAM migration plan (DRAFT, awaiting Nic's approval)

Status: plan only. Nothing is migrated until Nic approves. Regions: backend in ap-southeast-1 (the old Amplify region). CloudFront certificate in us-east-1 (CloudFront requires that).

## 1. What Amplify provides today and what it becomes

| Today (Amplify Gen 2) | Actually used by the frontend? | Under SAM |
|---|---|---|
| Cognito user pool: email, Google, Facebook, Admins/Users groups | **No.** Login is Dynamic.xyz (Solana wallet, `@dynamic-labs/sdk-react-core`). No Amplify Auth calls in `src/`. | **Drop Cognito.** API Gateway HTTP API **JWT authorizer** checks Dynamic's JWT (issuer = the Dynamic environment, keys = `https://app.dynamic.xyz/api/v0/sdk/<ENV_ID>/.well-known/jwks.json`). No Google/Facebook OAuth secrets needed. If Nic wants email/Google/Facebook login later, add Cognito then. |
| AppSync GraphQL + DynamoDB, 11 models (User, Capybara, LiveStream, Interactions, UserVotes, UserBids, TokenTransaction, ChatComments, NFT, Offers, ActivityLog), **all public API-key auth** (anyone can write) | Yes, ~45 `client.models.*` calls in `src/api/*` | **HTTP API + Lambda (Node 20) + DynamoDB.** One table per model, keeping the same GSIs (ByWalletAddress, ByEmailAddress, CapybaraInteractionIndex, by-stream/by-NFT/by-owner). Public GET for read-only catalog data (Capybara, LiveStream, Interactions, NFT list). Writes need a Dynamic JWT, and the server checks ownership (you can only edit your own User, votes and bids). Balance/TokenTransaction/NFT-transfer writes are **server-side only**, never client-set. |
| `getStream`, `getViewership` Lambdas (Livepeer) | Yes | Same code as `GET /stream/{id}` and `GET /viewership/{id}` routes. The Livepeer key moves to **SSM SecureString** `/capyweb/livepeer-api-key`, read at runtime. **Rotate both leaked keys first** (they're hardcoded in this public repo). |
| S3 `capytubeDrive`, `public/*` with **guest read/write/delete** | Yes: `StorageImage` shows capybara/NFT images (20 uses) | Private S3 bucket served read-only through the same CloudFront distribution at `/media/*` (Origin Access Control). **No guest writes.** Admin uploads go through a presigned-URL Lambda limited to an admin wallet allowlist. |
| Amplify Hosting + custom domain | n/a (currently down, no DNS records) | Private **S3 bucket + CloudFront** (OAC, SPA fallback to index.html, HTTPS via ACM us-east-1). Route 53 alias A/AAAA for `capytube.xyz` and `www`. Deploy = `vite build` -> `aws s3 sync` -> CloudFront invalidation. |
| SSM `/amplify/*` secrets (Google/FB OAuth) | n/a once Cognito is dropped | Only `/capyweb/*` SSM params (Livepeer key). |

## 2. Frontend changes this forces
- Remove `aws-amplify`, `@aws-amplify/ui-react`, `@aws-amplify/ui-react-storage`, `@aws-amplify/backend*`, `aws-cdk*`, the `amplify/` folder, `amplify.yml`, `amplify_outputs.json`.
- Replace `generateClient<Schema>()` in `src/api/*` with a small typed `fetch` client (`src/api/http.ts`) that attaches the Dynamic JWT (`getAuthToken()`). Same function names, so components barely change.
- `StorageImage` (20 places) -> plain `<img src={MEDIA_BASE + key}>`.
- `Loader`/`Placeholder` (9 places) -> small local components.
- Env: `VITE_API_BASE_URL`, `VITE_MEDIA_BASE_URL` at build time. Types move from the Amplify `Schema` to `src/domain/*.ts`.
- Nice side effect: a much smaller bundle, since the Amplify libs are heavy.

## 3. Repo layout
`infra/backend/template.yaml` (SAM: HTTP API, Lambdas, DynamoDB tables, media bucket, SSM refs), `infra/site/template.yaml` (CloudFormation, us-east-1: ACM cert DNS-validated in the capytube.xyz zone, site bucket, CloudFront, Route 53 aliases), `infra/README.md` (deploy commands). Lambdas in `backend/src/`, bundled with esbuild via SAM.

## 4. Order of work (after approval)
0. Nic: rotate both Livepeer keys, put the new one in SSM, create the IAM pieces below.
1. Read-only discovery: are any old Amplify DynamoDB tables or S3 buckets still there? If yes, export the data (needs one extra read-only statement, see 5d). Otherwise start fresh (seed Capybara/LiveStream).
2. Backend SAM stack + API, with tests against a deployed dev stage.
3. Frontend swap on a branch. tsc + build + headless test against the dev API.
4. Site stack. Deploy to CloudFront, test on the cloudfront.net URL.
5. Point capytube.xyz at CloudFront (Route 53), then test live.
6. Only after Nic confirms the old resources are unneeded: nothing gets deleted by me.

## 5. Least-privilege IAM
Pattern: the deploy user can **only** drive CloudFormation stacks named `capyweb-*` and pass **one** CloudFormation execution role. The resource-creating permissions live on that role, scoped to `capyweb-*` names. The user itself can't create IAM, Lambda, DynamoDB and so on directly.

Known values: account 360122305252 (holds capytube.xyz registration and hosted zone), hosted zone Z01748582U1VPM60UY0TW. (Account 619071347239 "capy" holds capy.life/capy.zone/capybank.ai and is not used here.)

### 5a. IAM user `capyweb-deploy`: inline policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Sid": "CfnCapywebStacks", "Effect": "Allow",
     "Action": ["cloudformation:CreateStack","cloudformation:UpdateStack","cloudformation:DeleteStack","cloudformation:DescribeStacks","cloudformation:DescribeStackEvents","cloudformation:DescribeStackResources","cloudformation:GetTemplate","cloudformation:GetTemplateSummary","cloudformation:CreateChangeSet","cloudformation:DescribeChangeSet","cloudformation:ExecuteChangeSet","cloudformation:DeleteChangeSet","cloudformation:ListStackResources"],
     "Resource": ["arn:aws:cloudformation:*:360122305252:stack/capyweb-*/*",
                  "arn:aws:cloudformation:*:aws:transform/Serverless-2016-10-31"]},
    {"Sid": "CfnValidate", "Effect": "Allow", "Action": ["cloudformation:ValidateTemplate","cloudformation:ListStacks"], "Resource": "*"},
    {"Sid": "PassExecRole", "Effect": "Allow", "Action": "iam:PassRole",
     "Resource": "arn:aws:iam::360122305252:role/capyweb-cfn-exec",
     "Condition": {"StringEquals": {"iam:PassedToService": "cloudformation.amazonaws.com"}}},
    {"Sid": "SamArtifacts", "Effect": "Allow", "Action": ["s3:PutObject","s3:GetObject","s3:ListBucket","s3:GetBucketLocation"],
     "Resource": ["arn:aws:s3:::capyweb-sam-artifacts-360122305252","arn:aws:s3:::capyweb-sam-artifacts-360122305252/*"]},
    {"Sid": "SiteAndMediaSync", "Effect": "Allow", "Action": ["s3:PutObject","s3:DeleteObject","s3:GetObject","s3:ListBucket"],
     "Resource": ["arn:aws:s3:::capyweb-site-360122305252","arn:aws:s3:::capyweb-site-360122305252/*",
                  "arn:aws:s3:::capyweb-media-360122305252","arn:aws:s3:::capyweb-media-360122305252/*"]},
    {"Sid": "Invalidate", "Effect": "Allow", "Action": ["cloudfront:CreateInvalidation","cloudfront:GetInvalidation","cloudfront:ListDistributions"], "Resource": "*"},
    {"Sid": "ReadLogsForDebug", "Effect": "Allow", "Action": ["logs:FilterLogEvents","logs:GetLogEvents","logs:DescribeLogStreams"],
     "Resource": "arn:aws:logs:ap-southeast-1:360122305252:log-group:/aws/lambda/capyweb-*"},
    {"Sid": "DnsReadOnly", "Effect": "Allow", "Action": ["route53:ListResourceRecordSets","route53:GetHostedZone","route53:GetChange"],
     "Resource": ["arn:aws:route53:::hostedzone/Z01748582U1VPM60UY0TW","arn:aws:route53:::change/*"]}
  ]
}
```
Nic creates bucket `capyweb-sam-artifacts-360122305252` (ap-southeast-1, private) once, so the user needs no CreateBucket. (`CreateInvalidation` can't be limited by resource until the distribution exists. After the site stack is up I'll give him the distribution ARN to pin it.)

### 5b. Role `capyweb-cfn-exec` (trusted by `cloudformation.amazonaws.com`): inline policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Sid": "Lambda", "Effect": "Allow", "Action": ["lambda:*"], "Resource": "arn:aws:lambda:ap-southeast-1:360122305252:function:capyweb-*"},
    {"Sid": "LambdaRoles", "Effect": "Allow",
     "Action": ["iam:CreateRole","iam:DeleteRole","iam:GetRole","iam:PassRole","iam:PutRolePolicy","iam:DeleteRolePolicy","iam:GetRolePolicy","iam:AttachRolePolicy","iam:DetachRolePolicy","iam:TagRole","iam:UntagRole","iam:UpdateAssumeRolePolicy"],
     "Resource": "arn:aws:iam::360122305252:role/capyweb-*"},
    {"Sid": "DynamoDB", "Effect": "Allow", "Action": ["dynamodb:CreateTable","dynamodb:UpdateTable","dynamodb:DeleteTable","dynamodb:DescribeTable","dynamodb:TagResource","dynamodb:UntagResource","dynamodb:ListTagsOfResource","dynamodb:UpdateContinuousBackups","dynamodb:DescribeContinuousBackups","dynamodb:UpdateTimeToLive","dynamodb:DescribeTimeToLive"],
     "Resource": ["arn:aws:dynamodb:ap-southeast-1:360122305252:table/capyweb-*"]},
    {"Sid": "HttpApi", "Effect": "Allow", "Action": ["apigateway:GET","apigateway:POST","apigateway:PUT","apigateway:PATCH","apigateway:DELETE","apigateway:TagResource"],
     "Resource": ["arn:aws:apigateway:ap-southeast-1::/apis","arn:aws:apigateway:ap-southeast-1::/apis/*","arn:aws:apigateway:ap-southeast-1::/tags/*"]},
    {"Sid": "Buckets", "Effect": "Allow", "Action": ["s3:CreateBucket","s3:DeleteBucket","s3:PutBucketPolicy","s3:GetBucketPolicy","s3:DeleteBucketPolicy","s3:PutBucketPublicAccessBlock","s3:PutEncryptionConfiguration","s3:PutBucketCORS","s3:PutBucketOwnershipControls","s3:PutBucketTagging","s3:PutBucketVersioning","s3:GetBucketLocation"],
     "Resource": ["arn:aws:s3:::capyweb-site-360122305252","arn:aws:s3:::capyweb-media-360122305252"]},
    {"Sid": "SamArtifactsRead", "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::capyweb-sam-artifacts-360122305252/*"},
    {"Sid": "SsmParamRef", "Effect": "Allow", "Action": ["ssm:GetParameters","ssm:GetParameter"], "Resource": "arn:aws:ssm:ap-southeast-1:360122305252:parameter/capyweb/*"},
    {"Sid": "LogGroups", "Effect": "Allow", "Action": ["logs:CreateLogGroup","logs:DeleteLogGroup","logs:PutRetentionPolicy","logs:DescribeLogGroups","logs:TagResource"], "Resource": "arn:aws:logs:*:360122305252:log-group:/aws/lambda/capyweb-*"},
    {"Sid": "CloudFront", "Effect": "Allow", "Action": ["cloudfront:CreateDistribution","cloudfront:UpdateDistribution","cloudfront:DeleteDistribution","cloudfront:GetDistribution","cloudfront:GetDistributionConfig","cloudfront:TagResource","cloudfront:CreateOriginAccessControl","cloudfront:UpdateOriginAccessControl","cloudfront:DeleteOriginAccessControl","cloudfront:GetOriginAccessControl","cloudfront:CreateFunction","cloudfront:UpdateFunction","cloudfront:DeleteFunction","cloudfront:DescribeFunction","cloudfront:PublishFunction","cloudfront:GetFunction"], "Resource": "*"},
    {"Sid": "Cert", "Effect": "Allow", "Action": ["acm:RequestCertificate","acm:DescribeCertificate","acm:DeleteCertificate","acm:AddTagsToCertificate"], "Resource": "*"},
    {"Sid": "Dns", "Effect": "Allow", "Action": ["route53:ChangeResourceRecordSets","route53:ListResourceRecordSets","route53:GetHostedZone","route53:GetChange"],
     "Resource": ["arn:aws:route53:::hostedzone/Z01748582U1VPM60UY0TW","arn:aws:route53:::change/*"]}
  ]
}
```
Trust policy for the role: `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"cloudformation.amazonaws.com"},"Action":"sts:AssumeRole"}]}`

The Lambda runtime roles that SAM creates get only: DynamoDB CRUD on `capyweb-*` tables, `ssm:GetParameter` on `/capyweb/livepeer-api-key`, and `s3:PutObject` presign on the media bucket (admin upload function only).

### 5c. What Nic does by hand (once)
1. Rotate both Livepeer keys. Store the new one: SSM SecureString `/capyweb/livepeer-api-key` (ap-southeast-1).
2. Create bucket `capyweb-sam-artifacts-360122305252`.
3. Create role `capyweb-cfn-exec` (5b) and user `capyweb-deploy` (5a) with an access key -> vault link.
4. Send me the Dynamic environment ID (not secret, it is in the frontend already). Account and zone IDs are known.

### 5d. Optional, only if old data matters (one-off, read-only, remove afterwards)
`dynamodb:ListTables`, `dynamodb:DescribeTable`, `dynamodb:Scan` on `arn:aws:dynamodb:ap-southeast-1:360122305252:table/*`, plus `s3:ListAllMyBuckets`, `s3:ListBucket`/`s3:GetObject` on the old Amplify storage bucket, so I can export existing capybaras/users/images.

## 6. Open calls for Nic (unchanged)
- Stream viewing public vs account-gated: current behavior kept.
- No payments / token purchases wired.
- Robot control stays a stub until the hardware API is proven.
- Drop Cognito (recommended, since the app uses Dynamic wallet login), or keep email/Google/Facebook login?
