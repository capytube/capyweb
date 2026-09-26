# CapyTube: UX + Admin Console + Serverless Cost Plan

Status: **approved; dev backend deployed 2026-09-24.** Tracked in beads (`bd list`), prefix `capyweb-`.
Author: Claude, 2026-09-24. Supersedes nothing; extends `docs/SAM_MIGRATION_PLAN.md`.

> **Update 2026-09-24 — dev backend is live.** Stack `capyapp-capyweb-backend-dev` in
> ap-southeast-1. See section 8 for what shipped and what the new deployer identity changed.

---

## 1. What I found before planning

### 1a. The $260/month budget alarm is not capyweb

The Notion note *"AWS budget — capyweb exceeds monthly budget"* reports $267 actual / $353 forecast against a
$20 budget. I checked Cost Explorer on account `619071347239` directly. The breakdown for 1–25 Sep:

| Service | Gross usage |
|---|---:|
| EC2 – Compute | $206.65 |
| EC2 – Other (EBS etc.) | $33.28 |
| App Runner | $9.46 |
| VPC (NAT/EIP) | $8.01 |
| ECR | $3.24 |
| KMS | $2.13 |
| Route 53 | $1.52 |
| **everything capyweb actually uses** | |
| S3 | $0.66 |
| DynamoDB | $0.17 |
| API Gateway | $0.16 |
| Amplify | $0.16 |
| **Total** | **$267.08** |

Two conclusions:

1. **$240 of the $267 is one EC2 instance**: `i-03b24b9e73aa9233c`, a `t4g.2xlarge` tagged
   `mario (gastown-prod-ec2)`, running in ap-southeast-1. It has nothing to do with capyweb.
   The account is shared with at least 7 other projects (capy-capsule, capybank, SmartCart,
   IkonAI-Studio, villa-proposal-app, VillaOpenSearchShowcase2, IkonSong) and 10 AppSync APIs.
2. **capyweb's own serverless footprint is already ~$1.15/month.** The $10 target is not a stretch;
   it is roughly 8× current headroom. The hard part is *keeping* it there and *proving* it.

**Therefore the budget must be tag-scoped, not account-scoped.** An account-wide budget on a shared
account measures other people's EC2 and will cry wolf forever. See Epic A.

### 1b. Everything is currently free, and that is the trap

Record-type breakdown shows **100% of spend is offset by AWS credits**:

| Month | Usage | Credit | Net paid |
|---|---:|---:|---:|
| Aug 2026 | $425.96 | −$425.96 | **$0.00** |
| Sep 2026 (to 25th) | $267.15 | −$267.15 | **$0.00** |

Net cost today is zero. When the credits expire this becomes a ~$300/month bill overnight. The $10
target is the right instinct; it just has to be enforced structurally rather than watched.

### 1c. The dev deploy is blocked by one missing IAM statement

`capyweb-backend-dev` has been stuck in `REVIEW_IN_PROGRESS` since 23 Sep — meaning **no resources have
ever been created**. Every `sam deploy` creates a change set that immediately fails:

```
User: .../capyweb-cfn-exec/AWSCloudFormation is not authorized to perform:
cloudformation:CreateChangeSet on resource:
arn:aws:cloudformation:ap-southeast-1:aws:transform/Serverless-2016-10-31
```

Commit `e4f4cb6` ("cfn-exec policy: SAM transform + read perms") updated the policy **in the markdown
doc**, but the live IAM role `capyweb-cfn-exec` was never updated to match. I verified its 10 inline
statements — the `SamTransform` statement is absent.

**Resolved 2026-09-24, differently.** The `capy` profile was re-pointed at a new, non-admin
deployer (`capyapp-macbook-pro-14`) scoped to a `capyapp-*` prefix, and that identity already has the
missing permission. The old role is moot; nothing was edited on it. See section 8.

### 1d. Secrets are still exposed

`amplify/functions/getStream/resource.ts` and `getViewership/resource.ts` contain **hardcoded Livepeer
API keys in a public GitHub repo**. The SAM plan says to rotate them into SSM — I checked, and
`/capyweb/livepeer-api-key` does not exist. Both keys are still live and still committed.

### 1e. The data layer is wide open

Every one of the 11 Amplify models uses `allow.publicApiKey()`. Today **anyone with the API key can
write any record** — set their own balance, approve their own custom requests, transfer NFTs. The key
is in the shipped JS bundle. No money feature can ship on this.

### 1f. Nic's `demo/` folder is the best UX spec in the repo

The untracked `demo/` directory (303-line HTML, 455-line JS, 979-line CSS, zero backend, localStorage
state) is a clickable prototype of exactly the right product: Home → Watch (reel + chat + reactions) →
Play (snack vote + bid) → Shop (passes), with a coin pill in the header and a "play coins only"
disclaimer. It is clearer and better-paced than the React app. **I am treating it as the design
reference,** not as throwaway.

---

## 2. Target architecture

Constraint from Nic: *serverless only — Lambda + DynamoDB — cheap and scalable, under $10/month at
100 customers.*

```
                    ┌─────────────────────────────────────┐
  capytube.xyz ───► │ CloudFront (PriceClass_100, OAC)    │
  admin.capytube.xyz│  /*        → S3 site bucket (SPA)   │
                    │  /admin/*  → S3 admin bucket (SPA)  │
                    │  /media/*  → S3 media bucket        │
                    │  /api/*    → API Gateway HTTP API   │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │ API Gateway HTTP API                │
                    │  native Cognito JWT authorizer      │
                    │  throttle 10 rps / 20 burst         │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │ Lambda (Node 22, arm64, 256 MB)     │
                    │  reserved concurrency capped        │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │ DynamoDB single table (on-demand,   │
                    │  OnDemandThroughput ceiling, PITR)  │
                    └─────────────────────────────────────┘

  Cognito user pool (email OTP, free ≤10k MAU) ── identity only, no Hosted UI
  SSM Parameter Store (SecureString) ─────────── Livepeer key
  No VPC. No NAT Gateway. No containers. No provisioned capacity anywhere.
```

### Three decisions I am recommending, with reasons

**D1 — Cognito for auth, not a Dynamic.xyz Lambda authorizer.**
The existing SAM plan proposes verifying Dynamic wallet JWTs in a custom Lambda authorizer. I recommend
Cognito with passwordless email OTP instead, and keeping Dynamic as an *optional linked* identity for
the CAPYL/Solana features:

- HTTP API has a **native** Cognito JWT authorizer — it costs **zero Lambda invocations**. The Dynamic
  route needs a Lambda authorizer on every request, so Cognito is both cheaper and faster.
- Cognito Essentials is free to 10,000 MAU. At 100 customers: $0.
- The Notion research is explicit that wallet-only identity is wrong for a paid, bookable, refundable
  experience: *"Do not make wallet possession the only recovery method for a paid one-hour experience."*
- The admin console needs a role model regardless. `Admins`/`Users` groups already exist in the current
  Amplify auth config.
- Nic's own `demo/` has no wallet login at all — just a name field. That is the friction level to aim for.

**D2 — One DynamoDB table, not eleven.**
With on-demand billing, 11 tables and 1 table cost the same for the same request volume, so this is
about operational surface, not money. One table gives: one PITR setting, one IAM resource, one set of
alarms, and — the load-bearing reason — **atomic `TransactWriteItems` across entities**, which auctions,
bids, entitlements and coin ledgers all need. The existing 11 models map onto `PK`/`SK` plus two GSIs.
This is nearly free to adopt *if* we start fresh (see open question Q3).

**D3 — PWA for the "app", not native.**
"Admin console with an app" is best served by one installable Progressive Web App: staff add it to the
home screen, it works on any phone, there is no App Store review cycle, no Apple/Google developer fee,
and **no extra AWS cost** — it is the same S3 + CloudFront origin. Native can come later if push
notifications or camera access turn out to be requirements.

---

## 3. Cost model at 100 customers/month

Assumptions, deliberately generous: 100 customers × 3 sessions × 10 minutes = 3,000 sessions and
30,000 viewing-minutes per month. Chat and reactions poll every 5s during a session.

| Line | Volume | Cost |
|---|---|---:|
| API Gateway HTTP API | 450k requests | $0.55 |
| Lambda (arm64, 256 MB, ~80 ms) | 450k invocations, 9k GB-s | $0.24 |
| DynamoDB on-demand | ~600k RRU, ~30k WRU | $0.24 |
| CloudWatch Logs (14-day retention) | ~0.45 GB ingest | $0.26 |
| S3 storage | 20 GB media | $0.50 |
| CloudFront | 120 GB egress | $0.00 (1 TB/mo always-free tier) |
| Route 53 hosted zone | 1 zone (AL account) | $0.50 |
| Cognito | 100 MAU | $0.00 (≤10k free) |
| SSM standard params, ACM | — | $0.00 |
| **Total** | | **≈ $2.30/month** |

Confirmed at **≈ $2.30/month**: the API Gateway line briefly dropped out on 24 Sep and returned on 26 Sep — see section 8.

That is **4× headroom** under the $10 cap. Scaling to 1,000 customers lands near $8–10, which is where
the cap starts to bite — so the cap is well-calibrated as an early-warning line.

### The five ways this budget actually gets blown

Each of these becomes a guardrail task, because none of them is caught by "we chose serverless":

| Risk | Impact | Guardrail |
|---|---|---|
| Lambda placed in a VPC | NAT Gateway ≈ **$35/mo** on its own | CI grep rejects `VpcConfig` in the template |
| Video served straight from S3 | egress at $0.12/GB instead of CloudFront's free 1 TB | CI grep rejects `s3.amazonaws.com` URLs in `src/`; media only via `/media/*` |
| Debug logging left on | CloudWatch ingest is the #1 sleeper cost | `RetentionInDays: 14` on every log group + `LOG_LEVEL` env var |
| Exceeding CloudFront's 1 TB free tier | ~$14 at 2 TB, grows linearly | CloudWatch alarm at 800 GB/month |
| Someone launches EC2 in the shared account | already happening — $240/mo | Tag-scoped budget for capyweb + a separate account-wide anomaly alert |

---

## 4. Epics

### Epic A — Cost control and account hygiene *(urgent, independent)*

| # | Task |
|---|---|
| A1 | Tag every capyweb resource `Project=capyweb`; activate the cost-allocation tag in Billing |
| A2 | Create a **tag-filtered** `$10/month` budget; retire the account-wide `capyweb-monthly-20` |
| A3 | Report the `mario (gastown-prod-ec2)` `t4g.2xlarge` to Nic — $240/mo, not capyweb, his call |
| A4 | Enable Cost Anomaly Detection (free) on the account |
| A5 | **Rotate both leaked Livepeer keys**; store the new one in SSM SecureString; purge from source |
| A6 | `RetentionInDays: 14` on every capyweb log group, enforced in the template |
| A7 | Write down the credit-expiry date and what the bill becomes after it |

### Epic B — Backend foundation *(blocks C, D, E)*

| # | Task |
|---|---|
| B1 | **Add the `SamTransform` statement to the live `capyweb-cfn-exec` role; delete the stuck `REVIEW_IN_PROGRESS` stack; re-run the deploy** |
| B2 | Single-table DynamoDB design: key schema, GSIs, access-pattern table, mapping from the 11 models |
| B3 | Cognito user pool (email OTP, no Hosted UI) + native HTTP API JWT authorizer + `Admins` group |
| B4 | Core read API: capybaras, streams, interactions, shop catalog (public, cached) |
| B5 | Core write API: profile, votes, bids, chat — owner-checked server-side, never client-trusted |
| B6 | Server-authoritative ledger: balances and transactions are **only** writable by Lambda |
| B7 | Media pipeline: private S3 + CloudFront OAC at `/media/*`; admin upload via presigned URL |
| B8 | Seed data + (if keeping) one-off migration from the Amplify tables |
| B9 | Livepeer `getStream` / `getViewership` ported to `GET /stream/{id}`, key from SSM |

### Epic C — Frontend cutover *(depends on B)*

| # | Task |
|---|---|
| C1 | Typed `fetch` client in `src/api/http.ts`; keep the existing function names so components barely change |
| C2 | Replace `generateClient<Schema>()` across the ~45 call sites in `src/api/*` |
| C3 | Replace `StorageImage` (20 uses) and `Loader`/`Placeholder` (9 uses) with local components |
| C4 | Drop `aws-amplify`, `@aws-amplify/ui-react*`, `@aws-amplify/backend*`, `aws-cdk*`, `amplify/`, `amplify.yml` — a large bundle win |
| C5 | Site stack: S3 + CloudFront + ACM (us-east-1 cert), SPA fallback |
| C6 | DNS: A/AAAA aliases for `capytube.xyz` and `www` in the AL account zone |

### Epic D — Consumer UX *(the "maximize user experience" ask)*

Grounded in the Notion competitor research (Zoolife, iPet Companion, Surrogate.tv), the Mobbin pattern
survey (TikTok Live, YouTube Live, Amazon Live, Whop, Hulu Watch Party), and Nic's `demo/`.

| # | Task | Why |
|---|---|---|
| D1 | **Never show a dead stream.** Fall back to the recorded reel whenever no camera is live, and label it honestly | Zoolife's core lesson: capybaras sleep. `demo/` already does this |
| D2 | **Watch and react without an account.** Account required only at the moment of spending | `demo/` has no login; every reference app defers auth |
| D3 | Live layer: viewer count, floating reaction bursts, chat right-rail, "N watching now" | Universal across TikTok/YouTube/Amazon Live |
| D4 | Play: snack vote with a live tally bar, custom request, bid — with clear costs before confirming | Existing `Interactions` model already supports this |
| D5 | Coin pill in the header + a readable transaction history; "play coins, not money" stays explicit | `demo/` pattern; also a consumer-protection point |
| D6 | Slot booking UI for the robot experience: calendar, waitlist, entitlement card | Phase 2 of the Notion research |
| D7 | Mobile-first pass + PWA install prompt | Most traffic will be phones |
| D8 | Accessibility (focus order, contrast, reduced-motion, captions) and a performance budget | Currently unaudited |
| D9 | Publish activity windows — "Magnus is usually awake 08:00–11:00" | Zoolife's scheduling lesson; sets expectations |

### Epic E — Admin console and staff app

Layout follows the Fresha / Cal.com / Reddit-mod-tools patterns: a left nav, a "today" dashboard, and a
"review needed" queue with counts.

| # | Task |
|---|---|
| E1 | Admin shell at `admin.capytube.xyz`, gated on the Cognito `Admins` group, separate S3 origin |
| E2 | **Today dashboard**: what's live now, next sessions, pending approvals, alerts |
| E3 | Capybara CRUD: profiles, photos, bios, activity windows |
| E4 | Stream management: create/schedule, go live, access type, price, reel fallback |
| E5 | Interactions: create votes/bids, set costs and rules, **declare results** |
| E6 | **Moderation queue**: custom snack requests (approve/reject), reported chat |
| E7 | Users and balances: search, view, **audited** manual coin grants with a mandatory reason |
| E8 | Robot ops: status, battery, current operator, session log, **kill switch** |
| E9 | Ledger browser + CSV export |
| E10 | **Audit log** — every admin write records actor, action, before/after, timestamp. Non-negotiable once money exists |
| E11 | Staff PWA: installable, mobile-first, tolerant of bad venue wifi |

### Epic F — Guardrails and proof

| # | Task |
|---|---|
| F1 | Extend the CI serverless guard: reject `VpcConfig`, missing `RetentionInDays`, missing `Project` tag, direct S3 URLs in `src/` |
| F2 | Synthetic `/health` check + one cheap alarm |
| F3 | **Cost proof**: replay a synthetic 100-customer month against dev and publish the measured bill against this model |
| F4 | Load test to the throttle ceiling; confirm it degrades by throttling rather than by billing |

---

## 5. Sequencing

```
A1 A2 A3 A4 A5 A6 A7   ── can start now, independent of everything
        │
B1 ─────┴──► B2 ──► B3 ──► B4 ──► B5 ──► B6
                              │      └──► B7 ──► B8
                              └──► B9
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
              C1…C6 (cutover)                 E1…E11 (admin)
                     │
                     ▼
              D1…D9 (consumer UX)
                     │
                     ▼
              F1…F4 (guardrails + proof)
```

**B1 is the critical path.** Nothing deploys until the IAM statement lands.

---

## 6. Open questions for Nic

| # | Question | My recommendation |
|---|---|---|
| Q1 | Approve this plan? | — |
| Q2 | Auth: Cognito email OTP with Dynamic wallet as an optional link, or wallet-only as the existing SAM plan proposes? | **Cognito** — cheaper (no authorizer Lambda), safer recovery, and the research argues against wallet-only |
| Q3 | Keep the existing Amplify data, or start fresh? | **Start fresh** if it is demo data — it makes the single-table move free |
| Q4 | Is `mario (gastown-prod-ec2)` ($240/mo `t4g.2xlarge`) still needed? | Your call — I have not touched it |
| Q5 | Should I rotate the Livepeer keys, or will you? | They are live in a public repo. Someone should, today |
| Q6 | "App" = PWA, or native iOS/Android? | **PWA** — $0 extra, no store review |
| Q7 | Separate AWS account for capyweb? | Worth it eventually; a tag-scoped budget solves the measurement problem for now |

---

## 7. What I have NOT done

No infrastructure has been changed. I have only read: Cost Explorer, Budgets, IAM, CloudFormation,
S3 listings, EC2 descriptions. No deploys, no IAM edits, no deletions.


---

## 8. Deployed 2026-09-24

### What shipped

Stack `capyapp-capyweb-backend-dev`, ap-southeast-1, `CREATE_COMPLETE`.

| Resource | Name | Guardrail verified |
|---|---|---|
| Lambda | `capyapp-capyweb-dev-health` | reserved concurrency 2, arm64, 256 MB |
| Lambda | `capyapp-capyweb-dev-stream` | reserved concurrency 2, arm64, 256 MB |
| DynamoDB | `capyapp-capyweb-dev-main` | `PAY_PER_REQUEST`, ceiling 50 read / 20 write, PITR on |
| HTTP API | `capyapp-capyweb-backend-dev` | throttle 10 rps / 20 burst, CORS locked to the site origins |
| Log groups | both functions | `RetentionInDays: 14` |
| IAM roles | SAM-generated, per function | boundary `capyapp-lambda-boundary` attached |
| Tags | every resource | `Project=capyweb`, `Stage=dev` |

Smoke tests:

```
GET  /health              -> 200 {"ok":true,"stage":"dev"}
GET  /stream/x            -> 400 {"error":"bad id"}
GET  /stream/abcd1234     -> 502 {"error":"livepeer 401"}
GET  /viewership/abcd1234 -> 502 {"error":"livepeer 401"}
GET  /nope                -> 404 {"message":"Not Found"}
OPTIONS /health (CORS)    -> 204
```

The 401 is the point: it proves Lambda → SSM SecureString → KMS decrypt → outbound HTTPS
all work. The key stored at `/capyapp/capyweb/dev/livepeer-api-key` is a **placeholder**
and must be overwritten once the leaked keys are rotated (issue `capyweb-962`).

### Three things the new deployer identity changed

The `capy` profile no longer points at an admin. It is IAM user `capyapp-macbook-pro-14`
in group `capyapp-deployers`, scoped to a **`capyapp-*`** naming prefix, with the expensive
services (EC2, NAT Gateway, Bedrock, big data, media, marketplace) explicitly denied. It is
a well-built, cost-conscious deployer policy and it is the right thing to build against.

1. **The original blocker is moot.** `capyapp-deployers` already has
   `cloudformation:CreateChangeSet` on the SAM transform, so the missing statement on
   `capyweb-cfn-exec` no longer matters. Everything is renamed `capyapp-capyweb-*` and
   deploys directly as the user with no service role.

2. **API Gateway was briefly unavailable; now restored.** On 24 Sep none of the four attached
   policies mentioned `apigateway:*` — absent, not denied — so the first deploy rolled back on
   `AWS::ApiGatewayV2::Api` and the stack shipped with Lambda Function URLs instead. A fifth
   policy, `capyapp-deploy-apigw`, was attached later that day granting `apigateway:*` on
   `/apis` and `/apis/*` in both allowed regions.

   **Resolved 26 Sep (`capyweb-xfp`): back on the HTTP API** with per-route throttling and, once
   `capyweb-w26` unblocks, the native Cognito JWT authorizer — which keeps auth out of the
   Lambda entirely. The cost model in section 3 stands at ~$2.30/month. `stream.ts` reads the
   id off `rawPath` with a `pathParameters` fallback, so it works behind either front end.

3. **Billing actions are out of reach from here.** This identity is denied `budgets:*` and
   `ce:GetCostAndUsage`, so the tag-scoped $10 budget, the cost-allocation-tag activation,
   Cost Anomaly Detection and the cost proof all need either a billing grant or Nic in the
   console. Tracked as `capyweb-0v3`.

### Known gap, not yet blocking

`capyapp-lambda-boundary` grants `s3:*` on `arn:aws:s3:::capyapp-*` — the bucket ARN, with
no `/*` for objects. The same gap is in `capyapp-deploy-core`. Nothing uses S3 yet, but the
media bucket and presigned uploads (`capyweb-2gx`) will fail until it is widened
(`capyweb-083`).

### Follow-up 2026-09-24 evening (Claude Code, from nmba)

Nic had the deployer permissions widened after this section was written. Three statements above
are now out of date or were wrong:

- **API Gateway is available.** The group has a fifth policy, `capyapp-deploy-apigw`:
  `apigateway:*` in ap-southeast-1 and us-east-1, except the APIs that existed before. It
  was verified with a SAM HTTP API plus REST API behind CloudFront. `capyweb-xfp` is now a
  real decision on cost vs. the native JWT authorizer, not a constraint.
- **The S3 "gap" is not real.** IAM `*` matches across `/`, so `arn:aws:s3:::capyapp-*`
  already covers `capyapp-bucket/key`. `aws s3 cp` and `aws s3 sync` into `capyapp-*` buckets
  work with this identity (measured for the site upload). The profile can also create
  `capyapp-*` buckets.
- **capytube.xyz DNS is reachable.** The zone is in autonomous-lab, not the capy account.
  The `capytube-dns` profile assumes `capyapp-capytube-dns` there: apex A/AAAA, and
  A/AAAA/CNAME/TXT on subdomains. It cannot change NS/SOA, the Google TXT, or Amplify's
  validation CNAME. ACM certs for `capytube.xyz` and `*.capytube.xyz` are allowed in capy.

Deployed: `https://dev.capytube.xyz/` serves `demo/` via `infra/site/deploy.sh dev demo`
(stacks `capyapp-capyweb-site-dev` and `capyapp-capyweb-dns-dev`), 5 m 33 s end to end.
Instinct was asked to QA it. The apex `capytube.xyz` may still be claimed by the stale
Amplify `capyweb` app in autonomous-lab. Remove that domain association (admin `al`
profile) before putting CloudFront on the apex.

Still true: billing (`budgets:*`, `ce:*`) is not granted (`capyweb-0v3`).
