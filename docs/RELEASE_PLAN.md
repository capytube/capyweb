# CapyTube production release plan (W12)

Status: **draft for capyweb-manager**, to take to herdr-master as one package. Written 2026-09-29 by
capyweb-lead on mac-pro-japan-16. **This is a document only.** Nothing in it has been run against
production, the DNS account or the apex. Where it says "checked", the fact was read on 2026-09-29 from
the repo, from public DNS or HTTP, or with a test browser against dev. No AWS call was made for it.

**Amended 2026-09-29 ~23:50** after capyweb-manager's decisions (23:10) and the review of the first draft
(rv-1790697825-47957, Cursor). Section "Since the draft" says what changed; the sections below are
corrected where the draft was wrong or out of date.

Read with: `docs/WASM_PLAN.md` (the W12 row, sections 4 and 5), `docs/PLAN.md` (sections 2, 3 and 8),
`docs/VIDEO_DESIGN.md` section 8, `docs/CRAWLERS_NOTES.md` and `infra/README.md`. Beads: W12 is
`capyweb-b6e.12`; going public is `capyweb-xqg`.

## Summary

- **Three gos, not one:**
  - **G1 (manager):** the W12 code on dev.
  - **G2 (master):** the production stacks, built "dark". They carry the apex name, but no DNS record
    points at them.
  - **G3 (master):** the apex switch, a single DNS stack.

  G2 lets every production resource be tested at its real name before the public can reach it (section 5).
- **The apex serves nothing today (checked).** `capytube.xyz` and `www.capytube.xyz` have no A, AAAA or
  CNAME record in the zone. There is no React site on the apex to put back. Rolling back means taking
  the two names off again, which is quick (section 4).
- **Still blocking going public:**
  - `bpk` (the legal pages), which is wider than its title: the pages also have contact and address
    placeholders, and the deletion page describes a button that does not exist;
  - `kbq` (sign-up abuse);
  - a test on a real phone.

  For `c6e` I recommend launching with password sign-in, as dev runs, and moving to email codes after the
  launch (section 3).
- **Found while writing this plan, and fixed in W12's G1 code** (commits 43cd083, 0728b28, b954782 on
  `feat/wasm-frontend`; in the first draft they were only planned, as the review pointed out):
  - The production health check would probe `prod.capytube.xyz`, and it shares its metric with dev.
  - A canonical tag in the shell would point every page at the home page.
  - Trunk's inline boot script is blocked by a strict CSP.
  - `PriceClass_100` serves Asia from Europe. This Mac is served from Marseille.
- **Cost:**
  - Production is about **$1.32 to $2.92 a month**.
  - Dev and production together are about **$1.40 to $4.60**, against the $10 budget.
  - `docs/PLAN.md`'s "~$14 at 2 TB" of CloudFront is wrong. It is about $87 (section 6).

## Since the draft

**capyweb-manager's decisions (2026-09-29, 23:10):**
- **G1: go** on dev (below). **G2: a go from herdr-master** once W14 and G1 pass review, built dark.
  The manager does G2's admin parts: the production pool permission (row 1), the production key group
  (P1), the DNS-role trust if missing, and the Amplify association (D0).
- `PriceClass_200` for production. `c6e`: launch on password sign-in, email codes right after, and the
  announcement exception goes to the master. `kbq`: the pre-sign-up cap, 40 a day and 10 an hour, with
  an alarm. Deletion: the email process, 30 days, an admin runbook and a data sheet for the legal reader;
  the dates, mailbox, address and legal reader go to nic through the master, and the placeholders stay.
  Phones: a WebKit pass now; who tests on real phones goes to the master. Chat: a runbook is enough.
- **No stack creates, updates or deletes a response headers policy** (the right reaches every project's
  in the account). The admin makes them from `infra/site/headers-<stage>.json`; the stack attaches by id.

**G1 as built** (on `feat/wasm-frontend`; section 1a's items):
- **Site** (43cd083): `infra/site/deploy.sh <stage> content|stack|alarms|cert|dns|prune`. Stack changes
  are change sets shown and run by hand; `cert` and `dns` are the only steps that touch the DNS account.
  Per-stage values are in `infra/site/stages.json` (prod: `capytube.xyz`, `www.capytube.xyz`,
  `PriceClass_200`; its key group and headers-policy ids are filled in at G2). The site template takes
  `ResponseHeadersPolicyId`, `WwwDomain` (a 301 to the apex) and `PriceClass`. The media scripts take the
  stage, and production needs `CAPYWEB_PROD_GO=1`. (An email subscription script was built here and
  retired on 2026-09-30: alarms go to the capyweb room instead, see P10.)
- **Backend** (0728b28): the health check per stage, and the sign-up cap (`backend/src/signupcap.ts`).
  **Deployed to dev and checked** (23:3x).
- **Web** (b954782): the app passes the CSP (0 violations across the page tests), the boot script is a
  hashed file, the fonts are self-hosted, `scripts/build-release.sh` builds and checks a stage's release
  (no WebMCP in prod), the API is same-origin, and the sitemap, `og:image` and per-route canonical exist.
- **Docs** (de23381): the Deletion page tells the real process; `docs/RUNBOOKS.md` and
  `docs/DATA_SHEET.md`.

**So section 1b's steps become:**
- P5: `deploy.sh prod cert`.
- P6: `deploy.sh prod stack <name>`, after the ids from P1 and the headers policy are in `stages.json`.
- P7: `upload-media.sh prod` and `upload-pass-images.sh prod`.
- P8: `build-release.sh prod <dist>`, then `deploy.sh prod content <dist> --web`.
- P9: `deploy.sh prod alarms <name>`.
- P10: the alarm relay to the capyweb room (`infra/ops/alarm-relay.yaml`, deployed by capyweb-manager;
  `capyweb-b6e.12.6`). There is no email, so nobody clicks anything.
- D1 is part of P5.
- D2 (G3) is `deploy.sh prod dns <name>`.

Every one of them needs `CAPYWEB_PROD_GO=1`.

**The going-public blockers now:**
- `kbq` is built (on dev).
- `bpk`: the owner answered (nic, Q197): no company, no postal address, run like a web3 interface. Terms
  and Privacy are rewritten to that, name the operator "CapyTube" (`web/src/pages/legal.rs`), and are
  checked by an AI legal read (not a lawyer). The Deletion part is done.
- `c6e` comes after launch, and is not needed for it: there is no announcement (herdr-master,
  2026-09-30).
- Real phones: the phone check (`docs/PHONE_CHECK.md`, being written), with the tester the master
  names. The WebKit pass on dev found one WebKit-only bug: a chat poll failing CORS from WebKit's cache,
  fixed by the same-origin API.
- The chat and deletion runbooks are written.

**G2 as built (2026-09-30, dark; the master's go through capyweb-manager at 00:35):**

| Step | What exists | Id |
|---|---|---|
| P1 | Signing key: private half only in SSM `/capyapp/capyweb/prod/playback-signing-key` (generated in memory, never on disk); public key and key group made by the admin | key `KGBQPIJ6ONM0G`, key group `f2658315-4100-41ab-ad29-c4ba5d3497a7` |
| P2 | `capyapp-capyweb-backend-prod` (54 resources; Cognito window 00:37-00:39, then pinned to the dev and prod pools) | pool `ap-southeast-1_UHQr4ASjX`, client `6n2q1kh61ekjttfl4uguv5if40`, API `zw8fiyexsd` stage `prod` |
| P4 | Catalog seed, `seedItems(…, { catalogOnly })`: 11 items, no seed users' offers, activity or owned pass | — |
| P5, D1 | Certificate for the apex and www, both names validated by DNS in the DNS account | `6466ad50-cf5c-4cf7-a31a-779caa9c0f3f` |
| — | Headers policy `capyapp-capyweb-prod-headers`, made by the admin from `headers-prod.json` | `8ccf1cd4-d623-4458-944a-4ac780f92e96` |
| D0 | The Amplify `capytube.xyz` association, found and removed by the admin (01:31) | — |
| P6 | `capyapp-capyweb-site-prod`: the distribution holds the apex and www; no DNS record names it | distribution `E1S7HVWZHIVWAA` (`d3jz2uh04tmtrh.cloudfront.net`), OAC `EV4LTLE0U8KCS` |
| P7 | Recordings, reel and pass pictures: 1,570 objects, 1,187,639,792 bytes, the same as dev's | — |
| P8 | The production release: 38 files, no WebMCP, no inline script | — |
| P9 | `capyapp-capyweb-alarms-prod` (us-east-1): the egress alarm at 26 GB a day | — |
| P10 | First done as email subscriptions (01:38). The master then chose the capyweb room instead (01:50), so they were dropped: made through the SNS API, they cannot be unsubscribed while pending, and they lapse unclicked. Alarms now go through the relay (`capyweb-b6e.12.6`), with `OKActions` added so a recovery is posted too | — |

**The dark test (P11) passed:** every item of section 5, stage 2, through the resolver rule. That
includes the paid camera on the production key group, the callbacks at the apex, the www redirect, the
edge 404s and every header, with 0 CSP violations and 0 page errors. The only other hosts contacted were
Cognito's own managed-login page loading its files; the site's pages contacted none.

**Cleanup:** the test user was removed by the runbook (section 1 of `docs/RUNBOOKS.md`: disabled, signed
out everywhere, 15 minutes, then its 13 items and the account). The catalog was re-seeded, so production
opens with the 11 catalog items only.

**For G3:**
- `deploy.sh prod dns <name>` (D2);
- about 5 minutes later, **`node scripts/live-checks.mjs prod`** (the +5-minute check, below), then the
  alarms watched for an hour;
- ~~the alarm relay deployed and its synthetic test passed~~ **Done 2026-09-30:**
  - `capyapp-capyweb-alarm-relay` CREATE_COMPLETE at 02:34, with all five topics on SQS;
  - the job `capyweb-alarm-relay` runs on Mac mini 3 every 300 s, pinned to 37b70c0;
  - the two synthetic alarms were posted as expected at 02:38, and the queue was left empty
    (`capyweb-b6e.12.6`; no clicks for anyone);
- the `xqg` blockers above, and the open items below.

The site-down alarm stays in ALARM until the apex resolves.

**Still open for G3:**

| Item | State |
|---|---|
| The contact mail: stacks `capyapp-capyweb-contact-mail` and `capyapp-capyweb-mail-dns` deployed, and proven by a test mail forwarded, with a delivery event. The mail records are their own DNS stack, apart from the apex stack `capyapp-capyweb-dns-prod`, so R3 never takes mail down | **Done** (capyweb-manager, 2026-09-30 10:05): contact-mail (e8eb8f9) CREATE_COMPLETE 10:02, rule order `store` then `capyweb-contact`; mail-dns CREATE_COMPLETE 10:04, the MX public, DKIM SUCCESS. Test mail at 10:04:57: in S3, forwarded (spam and virus PASS), Email Sent and Email Delivered in the events log |
| The phone check passed on a real iPhone and a real Android phone (`docs/PHONE_CHECK.md`; sent to the master for the tester, 2026-09-30) | Open |
| The final production build uploaded dark, with the filled legal pages (`bpk`). `node scripts/live-checks.mjs prod --via d3jz2uh04tmtrh.cloudfront.net` then has no FAIL | **Done** (2026-09-30 10:3x): the build of 0767d07 (the legal pages for the owner's answer, z14) uploaded dark with `CAPYWEB_PROD_GO=1`; live-checks via the dark distribution 54 ok, 0 FAIL, 1 skipped (DNS, mapped); every route at 390 and 1280 px in Chromium: 0 CSP violations, 0 page errors, no host but capytube.xyz |
| No confirmation clicks: alarms reach the capyweb room through the alarm relay, SES is out of the sandbox, and nobody has to click a subscription or verification link for launch | **Done:** the relay posts to the room (P10), and SES in ap-southeast-1 is out of the sandbox (capyweb-manager, 2026-09-30), so the contact forward needs no verification click |

**The +5-minute check** (`scripts/live-checks.mjs`) is one command, signed out and read-only. It needs
no credentials and takes under 3 minutes. It checks:
- **DNS:** the apex and `www` resolve, with A and AAAA records (asked of 1.1.1.1 and 8.8.8.8), and the
  certificate names both;
- **pages:** every app route at 390 and 1280 px in headless Chromium, each with its h1, no console
  error, no CSP violation and no failed request; the `www` 301; the edge 404; `robots.txt` and
  `sitemap.xml`; every file of the checkout's `web/assets` served;
- **headers:** each as `infra/site/headers-prod.json` (the CSP exactly), HSTS, `no-cache` on
  `index.html` and `immutable` on hashed files;
- **the API:** `/api/health` and `/api/streams` through the `/api/*` behaviour;
- **the legal pages:** no `[Insert` placeholder on Terms, Privacy or Deletion;
- **sign-in:** the "Sign in" button reaches production's managed-login page, and it loads (nothing
  is typed);
- **the build:** no WebMCP in the deployed files, and `/config.json` names production's Cognito domain.

`--via <d….cloudfront.net>` runs the same checks through the resolver rule before D2, `dev` checks dev,
and `--alarms` prints the `aws cloudwatch describe-alarms` commands to run by hand. One line per check;
exit status 1 on any FAIL.

**Run on 2026-09-30:**
- **Dev:** 51 ok, 3 FAIL. The three legal pages hold their placeholders, as the source does (`bpk`).
  Later that day, with the filled pages on dev: 53 ok, 1 FAIL (Privacy's company address, until the
  owner's answer took it out).
- **Production, dark:** 50 ok, 4 FAIL. The same three legal pages, and the cast pictures: the
  production bucket still has the G2 build, from before z14 made them WebP. The final build clears both.

## 1. What changes, in order

### 1a. Code on the branch (W12; no AWS)

Each item is a commit on `feat/wasm-frontend`, reviewed, then proven on dev (section 5, stage 1).

1. **Health check (bug, found here).** `infra/backend/template.yaml` gives the site target as
   `https://${Stage}.capytube.xyz/`, so production would probe `prod.capytube.xyz`, a name that does not
   exist. Its `Healthy` and `LatencyMs` metrics carry only a `Target` dimension, so dev's and
   production's probes would land in the same series and each stage's alarms would read the other's.
   - **Fix:** take the site from the `StageSite` mapping (the apex for prod).
   - Add a `Stage` dimension in `backend/src/healthcheck.ts` and in the alarms.
   - Dev's alarms move to the new series in the same deploy.
2. **Site stack (`infra/site/template.yaml`):**
   - `www.capytube.xyz` as a second alias, redirected with a 301 to the apex by `SpaFunction`. The
     Cognito callback names only the apex, so a sign-in started on `www` would fail without the redirect.
   - A **response headers policy** `capyapp-capyweb-<stage>-headers`, in place of the managed
     SecurityHeadersPolicy. It keeps that policy's headers and adds the CSP (item 3).
     - HSTS stays `max-age=31536000`, as today.
     - It has no `includeSubDomains` and no `preload`: preload is close to irreversible (section 4).
   - A `PriceClass` parameter. `PriceClass_100` covers North America and Europe only; this Mac is served
     from Marseille (`x-amz-cf-pop: MRS53-P1`, 0.26 s to connect). `PriceClass_200` adds Asia (Singapore,
     Japan, Thailand and others) at no cost inside the free 1 TB. Past the 1 TB, it costs $0.120/GB
     instead of $0.085 for viewers in Asia. **Decision for the manager** (my recommendation: 200 for
     production). The same-origin API makes this matter more, because every API call also goes through
     the edge (item 6).
3. **CSP.** Enforced, after a report-only run on dev:
   ```
   default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self';
   img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:;
   connect-src 'self' https://capyapp-capyweb-<stage>.auth.ap-southeast-1.amazoncognito.com;
   object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
   ```
   It needs three changes to the app first:
   - **Trunk writes an inline `<script type="module">`** to start the app (checked in `web/dist/index.html`).
     `script-src 'self'` blocks it. A post-build step moves it into a hashed file, so the policy never
     changes per release. The alternative, a per-build hash in the headers policy, would mean a stack
     update on every release.
   - **Self-host the three fonts** (Commissioner, DynaPuff, Hanalei Fill; the `b6e.12` note). This drops
     the Google Fonts origins from the policy.
   - **The report-only run** shows whether the app needs `style-src 'unsafe-inline'` or any other
     exception. Guard rule 8 then stops printing `skipped` and checks `'wasm-unsafe-eval'`.
4. **`infra/site/deploy.sh`:**
   - **The Content-Type bug.** The S3-to-S3 re-stamp (`--metadata-directive REPLACE` without
     `--content-type`) resets every object to `binary/octet-stream`, and browsers then refuse the module
     scripts. Every object is written from the local file with its type, as the old
     `upload-content.sh` did; that script is now `deploy.sh <stage> content`, and the re-stamp is gone.
   - **`--web` mode:**
     - root files named with Trunk's content hash (`*-<12 to 16 hex>.wasm|js|css|…`) get
       `public,max-age=31536000,immutable`. **Not `snippets/`** (correction): wasm-bindgen keeps a snippet
       folder's name when its files change (two different `chat.js` under one name, checked), so
       `snippets/` gets `no-cache` and is revalidated on every load;
     - `index.html` gets `no-cache,must-revalidate`, and everything else `max-age=300`;
     - hashed files are never deleted in the same run, so the previous release stays loadable.
     - Pruning releases older than the last three is a separate command, reviewed by a person
       (WASM_PLAN rule 6). Guard rule 6 then stops printing `skipped`.
   - **Stage to domain.** Production is `capytube.xyz` with `www` as a second name on the certificate,
     not `prod.capytube.xyz`.
   - **DNS only when asked.** The certificate and DNS steps run only with `--dns`, so a content deploy
     can never touch the other account.
   - **`unset NO_COLOR`** before Trunk (Trunk 0.21.14 refuses `NO_COLOR=1`).
5. **The production build and its WebMCP guard.**
   - Build with `rm -rf web/target/wasm-bindgen`, then `trunk build --release` **without**
     `--features webmcp`.
   - The release fails if:
     - the dist has `webmcp.js` anywhere;
     - the glue imports it;
     - the wasm contains a tool name (`cast_vote`, `list_streams`, `get_my_account`).
   - The switch stays off in production until the master says otherwise, and no origin-trial token is
     added (the hm-auue conditions).
6. **Same-origin API.** Both stages build with `CAPYWEB_API_BASE=/api`, so the app calls the API
   through the site's `/api/*` behaviour. That behaviour is already on dev, and the playback route
   already uses it.
   - No CORS, and `connect-src 'self'`.
   - The same wasm serves dev and production, and `/config.json` carries only the stage's
     managed-login domain and client id.
   - Dev switches first (stage 1).
7. **Sitemap, canonical and `og:` tags.**
   - `web/sitemap.xml`: the static routes, the capybara rooms and the passes, with absolute apex URLs.
   - A `Sitemap: https://capytube.xyz/sitemap.xml` line in `web/robots.txt`.
   - `og:image`: a 1200×630 capybara picture under `/assets`, with an absolute URL in the shell.
   - **Correction to CRAWLERS_NOTES (e):** no canonical and no `og:url` in the shell. The shell is served
     for every route, so a root canonical there would tell search engines that every page is a copy of
     the home page. The client sets a self-referencing canonical per route instead (built in G1:
     `sync_canonical` in `web/src/lib.rs`), and removes it on the not-found views that set `noindex`.
8. **robots.txt**, as the manager's policy already built (`web/robots.txt`). Production keeps the file as
   built. Dev keeps `Disallow: /`, written by the upload script.
9. **Scripts with `STAGE=dev` hard-coded.** `infra/media/upload-media.sh`,
   `infra/media/upload-pass-images.sh` and the content upload (`infra/site/deploy.sh`) each take the stage as an
   argument. Production is refused unless `CAPYWEB_PROD_GO=1` is set, as a written reminder of the go.
10. **Alarm recipients.** As built at G2 (herdr-master, 2026-09-30): no email.
    - All five capyweb topics deliver to one SQS queue.
    - A job on Mac mini 3 posts one sanitised line per alarm to the capyweb room
      (`infra/ops/alarm-relay.yaml`, `alarm_relay.py`, `alarm-relay-job.sh`; `docs/RUNBOOKS.md`
      section 5).
    - SNS email would have needed a click on a confirmation link. The budget's direct email needs none,
      and stays.
11. **Sign-up cap (`kbq`, if the manager chooses it; section 3).** A Cognito pre-sign-up Lambda that
    refuses new sign-ups past a daily and an hourly cap, with a counter item in the main table and a TTL.
    An alarm on the refusals goes to the stage's alarm topic.

### 1b. The capy account (<account-id>), profile `capy`, after G2

| # | Step | Region | Notes |
|---|---|---|---|
| P1 | Production signing key | ap-southeast-1 | I make the key pair here and put the private half only in SSM `/capyapp/capyweb/prod/playback-signing-key` (SecureString), then shred the local copy. The public PEM goes to the manager, who makes public key `capyapp-capyweb-prod-media-1` and key group `capyapp-capyweb-prod-media` with the admin profile (as for dev). Separate from dev's, so a dev key can never open production's paid files. |
| P2 | Backend stack `capyapp-capyweb-backend-prod` | ap-southeast-1 | Change set first, read before it runs. Parameters: `Stage=prod`, `AllowedOrigins=https://capytube.xyz`, and `PlaybackKeyPairId=<P1 key id>`. SES stays empty (password sign-in, section 3). It creates: table `capyapp-capyweb-prod-main` (PITR on, the same read and write ceilings); pool `capyapp-capyweb-prod-users` with domain `capyapp-capyweb-prod` and its client; the functions and the HTTP API; topic `capyapp-capyweb-prod-alarms` with its three alarms; and the health check. |
| P3 | Pin the Cognito grant | — | The manager pins `cognito-idp:*` to the new pool id, as for dev (policy v4). |
| P4 | Catalog seed | ap-southeast-1 | `seed-dev.ts` with `TABLE_MAIN=capyapp-capyweb-prod-main`: the capybaras, cameras and passes only. No users and no coins. |
| P5 | Certificate for `capytube.xyz` and `www.capytube.xyz` | us-east-1 | ACM request in this account. Its two validation CNAMEs are written in the DNS account (D1). |
| P6 | Site stack `capyapp-capyweb-site-prod` | ap-southeast-1 (CloudFront is global) | Change set first. Parameters: `DomainName=capytube.xyz` plus `www`, the P5 certificate, the key group from P1, and `ApiDomain=<prod API>.execute-api.ap-southeast-1.amazonaws.com` with `ApiOriginPath=/prod`. **The aliases are claimed here, before any DNS change.** If the stale Amplify `capyweb` app still holds `capytube.xyz` (`docs/PLAN.md` section 8), this is where it fails (`CNAMEAlreadyExists`), with no public effect. A first distribution took about 5.5 minutes on 24 Sep. |
| P7 | Media | ap-southeast-1 | The recordings (1.19 GB) and the pass pictures go to the production media bucket (item 9). |
| P8 | Content | ap-southeast-1 | `deploy.sh prod <dist> --web`. The dist is the production-mode build from item 5, with production's `config.json`. |
| P9 | Egress alarm stack `capyapp-capyweb-alarms-prod` | us-east-1 | Topic `capyapp-capyweb-prod-egress-alarm` and the 800 GB alarm. |
| P10 | Alarm subscriptions | both | After the dark alarms have gone to ALARM (the site probe fails until the switch), so the recipient's first email is a real alarm. The recipient confirms each one. |
| P11 | The dark test | — | Section 5, stage 2. |

### 1c. The DNS account (autonomous-lab), profile `capytube-dns`

| # | Step | Visible to the public? |
|---|---|---|
| D0 | **Before P6, done by an admin (profile `al`, not on this Mac):** check whether the Amplify `capyweb` app still has a domain association for `capytube.xyz`, and remove it if it does. | No: the apex has no records today |
| D1 | With P5: the two ACM validation CNAMEs (`_<token>.capytube.xyz` and `_<token>.www.capytube.xyz`). | No |
| D2 | **The apex switch (G3):** stack `capyapp-capyweb-dns-prod`, with A and AAAA alias records for `capytube.xyz` and `www.capytube.xyz` pointing at the production distribution. `infra/site/dns.yaml` takes one name today; it gets a second. | **Yes.** This is the only public step |

The zone's other records do not change: the NS and SOA, and the Google site-verification TXT, which the
role cannot change anyway. The contact mail's records are their own stack, `capyapp-capyweb-mail-dns`,
never part of D2.

### 1d. After the switch

- Smoke test from outside, by public DNS: `node scripts/live-checks.mjs prod` about 5 minutes after D2,
  then the alarms watched for an hour (`--alarms` prints the command).
- W16 (`b6e.16`): retire React. That unblocks `c24` and `c8m` (making the public source video private),
  both through the manager.
- `c6e` (email codes) as its own change with its own go, rehearsed on dev (section 3).
- `pus` (code-split routes), P3.

## 2. Permissions and gos

### The three gos

| Go | Who | Covers | Public effect |
|---|---|---|---|
| G1 | capyweb-manager | Section 1a on dev: the headers policy on the dev distribution, the dev app on `/api`, `deploy.sh --web` on dev, and the health-check fix on the dev backend | None (dev is `Disallow: /`) |
| G2 | herdr-master | P1 to P11 and D0, D1: the production stacks, dark | None: no record names them |
| G3 | herdr-master, after xqg's blockers close | D2 | The site goes public |

### Each permission, with its action and resource

"Covered" means an existing grant already matches, from the grants recorded in `docs/WASM_PLAN.md`
section 6, the manager's messages and today's dev deploys. I have not probed anything for this document.
A simulator check of each row at the go is the manager's call.

| # | Action | Resource | For | State |
|---|---|---|---|---|
| 1 | `cognito-idp:CreateUserPool` (one time, removed after P2), then `cognito-idp:*` pinned | `arn:aws:cognito-idp:ap-southeast-1:<account-id>:userpool/*` for the create (the 13 other projects' pools stay denied), then `userpool/<prod pool id>` | P2, P3 | **Needed.** Since policy v4 (15:55) `cognito-idp:*` is pinned to the dev pool and `CreateUserPool` is gone; v5 (21:55) kept that. The manager does this admin part at G2 |
| 2 | `cloudfront:CreatePublicKey`, `cloudfront:CreateKeyGroup` | `*` (these actions have no resource type) | P1 | **Done by the admin**, as for dev; not granted to the deploy user |
| 3 | `ssm:PutParameter`, `ssm:GetParameter` | `arn:aws:ssm:ap-southeast-1:<account-id>:parameter/capyapp/capyweb/prod/playback-signing-key` | P1, the playback Lambda | Covered (`/capyapp/*`) |
| 4 | `cloudfront:CreateResponseHeadersPolicy`, `UpdateResponseHeadersPolicy`, `DeleteResponseHeadersPolicy`, `GetResponseHeadersPolicy` | `arn:aws:cloudfront::<account-id>:response-headers-policy/*` (AWS makes the id, so a name cannot scope it) | Item 2 | **Changed (manager, 23:10):** no stack creates, updates or deletes a headers policy, because the right reaches every project's in the account. The admin creates `capyapp-capyweb-<stage>-headers` from `infra/site/headers-<stage>.json`; the site stack takes its id (`ResponseHeadersPolicyId`) and only attaches it, which is part of UpdateDistribution |
| 5 | `cloudfront:CreateDistribution`, `CreateDistributionWithTags`, `UpdateDistribution`, `TagResource`, `CreateInvalidation` | `arn:aws:cloudfront::<account-id>:distribution/*`, tagged `capy-scope=capyapp` | P6, P8 | Covered (manager's simulator check, 23:10): CreateDistribution with the tag is allowed; CreateDistributionWithTags is not, but the stack path works, as for dev on 24 Sep |
| 6 | `cloudfront:CreateFunction`; `Update`, `Publish`, `DeleteFunction` | `*`; `function/capyapp-*` | P6 (`capyapp-capyweb-prod-*` functions) | Covered (`capyapp-deploy-edge` v5) |
| 7 | `acm:RequestCertificate`, `DescribeCertificate`, `AddTagsToCertificate` | us-east-1, for `capytube.xyz` and `www.capytube.xyz` | P5 | Covered (manager's simulator check, 23:10: the condition lists `capytube.xyz` and `*.capytube.xyz`) |
| 8 | `sts:AssumeRole`, and this Mac's user in the role's trust policy | role `capyapp-capytube-dns` in autonomous-lab; principal `arn:aws:iam::<account-id>:user/capyapp-mac-pro-japan-16` | D1, D2 | **Works** (checked 23:1x with the one allowed call, `aws sts get-caller-identity --profile capytube-dns`: the role is assumed as this Mac's user). Nothing else was run with that profile |
| 9 | The role's own rights: `route53:ChangeResourceRecordSets` (apex A and AAAA; CNAME on subdomains) and CloudFormation on `capyapp-capyweb-dns-*` | zone `capytube.xyz` | D1, D2 | Covered: the dev DNS stack was made this way on 24 Sep |
| 10 | `amplify:ListDomainAssociations`, `amplify:DeleteDomainAssociation` | the Amplify `capyweb` app in autonomous-lab | D0 | **Admin only** (profile `al`) |
| 11 | `sns:*` (topics and subscriptions) | `capyapp-*` topics in ap-southeast-1 and us-east-1 | P2, P9, P10 | Covered (v5). Reading the recipient uses budgets read, which is account-wide |
| 12 | Lambda, DynamoDB, API Gateway, Logs, the EventBridge rule, IAM roles with `capyapp-lambda-boundary`, and CloudWatch alarms | `capyapp-capyweb-prod-*` | P2 | Covered. **The IAM policy does not tell dev from prod.** The master's "dev stack only" is a rule, not a policy limit; only Cognito (row 1) is pinned |
| 13 | Only with `c6e`: `ses:CreateEmailIdentity`, `GetEmailIdentity`, `PutEmailIdentityDkimAttributes`; `iam:CreateServiceLinkedRole` for `email.cognito-idp.amazonaws.com`; three DKIM CNAMEs and a `_dmarc` TXT in the zone; **SES production access for the account in ap-southeast-1** | `arn:aws:ses:ap-southeast-1:<account-id>:identity/capytube.xyz`; the role in the zone | c6e | Needed then. The production-access request covers the whole shared account, so it is the master's decision |
| 14 | Only with the sign-up cap: `cognito-idp:UpdateUserPool` (the trigger), `lambda:AddPermission` | the production pool; `capyapp-*` functions | kbq | Covered once row 1 is pinned |

## 3. What blocks going public (`capyweb-xqg`)

| Blocker | State | What it needs | From whom | My recommendation |
|---|---|---|---|---|
| `0m7` private streams | **Closed** | — | — | — |
| `bpk` legal pages | Open, and **wider than its title** (checked in `web/src/pages/`) | Terms and Privacy have **four** `[Insert Date]` placeholders. There are also **four** `[insert contact email]` (Terms, Privacy twice, Deletion) and **one** `[insert company address]` (Privacy). The **Deletion page describes a "Delete My Account" button in "Account Settings", with a confirmation email, and none of it exists.** Then a legal read against what the site collects: email, display name, chat messages, the play-coin ledger, the paid-camera cookies, Cognito, and AWS in Singapore. | The dates, address, contact mailbox and legal reader: nic or whoever he names, through the manager. The wording: me. | For launch, **rewrite the Deletion page to the real process** ("write to the contact address from your account's email; we delete the account and its data within N days"), backed by a written admin runbook: `AdminDeleteUser` on the production pool, plus the user's items. Self-service deletion (`DELETE /me`) comes later as its own spec, with the manager's yes. I can write a one-page data sheet for the legal reader from `docs/DATA_MODEL.md`. |
| `c6e` email codes (SES) | Open, and **not needed for launch** (herdr-master, 2026-09-30): there is no announcement, so the exception at the end of this row does not apply | See permission row 13: the domain identity, DKIM records in the other account, SES production access for the shared account (since granted: SES in ap-southeast-1 is out of the sandbox, capyweb-manager 2026-09-30), IAM, and a dev test. | The master (the account-wide SES change), then me | **Launch with password sign-in on Cognito's default sender, as dev runs, and do `c6e` right after the launch as its own change.** Reasons: it is tested end to end on dev; it keeps three outside dependencies (AWS's review, a new account-wide SES setting, new DNS records) off the launch path; and the later switch is in place (`EmailConfiguration` and the sign-in policy update the pool without replacing it, and existing users keep their passwords). The cost of waiting: the default sender allows 50 emails a day per account, shared with any other project's pool on it, and its sender address lands in spam more often. **Exception:** if the launch will be announced to an audience that could bring more than about 40 sign-ups in a day, do `c6e` first. |
| `kbq` sign-up abuse | Open | Open sign-up, each account gets 50 play coins, and the default sender caps email at 50 a day, so a script can use up the sign-up emails for everyone. The grant already needs a confirmed email (Cognito issues no tokens before confirmation), and chat is rate-limited per user, but many accounts get around both. | The manager decides the option; I build it | **Minimum before the switch:** the pre-sign-up cap (1a item 11), for example 40 a day and 10 an hour, below what the sender can deliver, with an alarm when it refuses. It costs $0. **Not now:** Cognito Plus ($0.020 per MAU with no free tier; its threat protection targets risky sign-ins and leaked passwords more than bot sign-ups) and AWS WAF with CAPTCHA ($5 a month per web ACL, $1 per rule and $0.40 per 1,000 CAPTCHA attempts, over 60% of the budget before any traffic). Revisit if the cap's alarm fires. |
| Real phones | Planned: the phone check, `docs/PHONE_CHECK.md` (being written). The WebKit pass on dev is done | WASM_PLAN risk mitigation: "test on a real iPhone and Android phone before cutover". The W14 QA ran headless Chromium only; iOS Safari uses the native HLS path. The WebKit pass found one WebKit-only bug, fixed by the same-origin API, but it is not iOS. | The tester the master names, with the phones | One real iPhone and one Android phone through `docs/PHONE_CHECK.md`, on the dark production stack if the tester can map the name; otherwise on dev. Both passing is a G3 item ("Still open for G3"). |
| Chat moderation | No tool | Public chat on a public site, and the admin beads (`2pj`, `x7w`, `zlb`, `jji`) wait until after cutover. Today a message can be removed only by an admin in DynamoDB. | The manager: is a runbook enough for launch? | A written runbook for launch: remove a chat item, and disable a user with `AdminDisableUser`. A moderation route follows with the admin beads, spec first. |
| The Amplify domain association | Unknown | D0 | An admin in autonomous-lab | Check it before G2 |
| Alarm route | **Done** (`capyweb-b6e.12.6`): deployed 02:34, synthetic test passed 02:38 | P10: the relay stack, the Mac mini 3 job and a synthetic alarm posted to the room | — | — |

Not blockers for play coins, and already on the "Before real money" list in `docs/WASM_PLAN.md`:
- `c8m`: the paid footage is public elsewhere;
- the VOD-cookie note (`1by.1`);
- the 15-minute access token after sign-out (`1by.2`).

All three are children of `capyweb-1by`, with a short spec each; none is built before real money.

## 4. Rollback

**What the apex serves today (checked 2026-09-29 22:5x, asking the zone's own name server,
`ns-1093.awsdns-08.org`):** no A, AAAA or CNAME for `capytube.xyz` or `www.capytube.xyz`. The only
apex record besides NS and SOA is the Google site-verification TXT. So there is **no React site on the
apex to put back**. The React app is not served by any of our stacks: dev served `demo/` until the WASM
build.

| Level | What | How | How fast |
|---|---|---|---|
| R1 | Content: back to the previous release | `deploy.sh --web` keeps the previous release's hashed files. Upload that release's `index.html` and invalidate. | Minutes (dev's invalidations today finished within a few minutes) |
| R2 | Stack settings, such as the headers policy | A change set from the previous template | Minutes, plus 5 to 15 minutes for CloudFront to spread the change |
| R3 | **Take the apex off (back to today)** | Delete `capyapp-capyweb-dns-prod`, or update it with no records. It leaves the mail records alone: they are in their own stack, `capyapp-capyweb-mail-dns` | Route 53 applies it in about a minute. Resolvers keep the alias answer for its 60 s TTL, so most visitors see it gone within about 2 minutes |
| R4 | A React fallback on the apex | Not recommended. The React app needs the Amplify backend, whose data API is open to anyone with its public key (`docs/PLAN.md` 1e). The static `demo/` prototype could be uploaded to the production bucket in minutes (`deploy.sh prod content demo`), but it has no sign-in. | — |

The switch itself shows up slowly: the SOA's negative-caching TTL is 900 s. A resolver that asked for
the apex shortly before the switch keeps "no such record" for up to **15 minutes**.

**What cannot go back:**
- **Accounts and their data stay.** The production pool and table are kept with `Retain` and deletion
  protection, so a rollback deletes nothing. Deleting users after an abandoned launch would be its own
  deliberate step, under whatever the Deletion page promised.
- **Sign-up emails** that were sent.
- **Public chat lines** that were seen, and **pages search engines indexed.** Those drop out over days to
  weeks once the names stop answering.
- **HSTS:** browsers that visited insist on HTTPS for `capytube.xyz` for a year. That is harmless while
  anything later on the apex is HTTPS. This is why the policy has no `includeSubDomains` and no
  `preload`: preload takes months to undo.
- **The Amplify domain association,** once removed (D0), needs Amplify's own domain verification to come
  back. Whoever owns that app would have to redo it.

## 5. Dress rehearsal

### Stage 1: dev (G1; nothing in production)

Every code item of section 1a, deployed to dev and proven there:
- **CSP:** enforced from the start: the test server sends dev's exact CSP to every page test, so the
  admin creates the policy once, with no report-only round. The full page-test suite and the dev end-to-end scripts
  (sign-in, name prompt, vote, bid, chat, react, free and paid cameras, sign-out) run while every
  `securitypolicyviolation` event is collected. It passes with zero violations.
- **`deploy.sh dev content <dist> --web`** (it replaces `upload-content.sh`):
  - `curl -I` shows the right Content-Type per file type, `immutable` on hashed files and `no-cache` on
    `index.html`;
  - the previous release's files are still there after a deploy.
- **The same-origin API (`/api`)** on dev, with the end-to-end run repeated.
- **The production-mode build** (no `webmcp`), put through the guard; the dist scan fails a planted
  `webmcp.js`. That build is uploaded to dev for one end-to-end run, then the dev build goes back.
- **The health-check fix:** dev's alarms read the new `Stage=dev` series and stay OK.
- **A rollback drill:** R1 on dev, back and forward, timed.
- **Sitemap, robots and `og:`:** file contents checked, and the `og:` card checked with a preview
  validator on the dev URL.

### Stage 2: production, dark (G2; no public DNS change)

Build P1 to P10. The distribution holds `capytube.xyz` and `www`, and no record points at it. The test
browser reaches it with a **resolver rule instead of DNS**:
- Chromium: `--host-resolver-rules="MAP capytube.xyz <d….cloudfront.net>, MAP www.capytube.xyz <d….cloudfront.net>"`.
- curl: `--connect-to capytube.xyz:443:<d….cloudfront.net>:443`.

TLS and the Host header keep the real name, so the certificate, the aliases, the Cognito callbacks, the
cookies on the apex, the CSP and the `/api/*` and `/paid/*` behaviours are all exercised as the public
will meet them.

**Checked on dev today:** the rule works. Chromium, mapped to one of dev's edge addresses, loaded
`https://dev.capytube.xyz/about-us` (200, h1 "About CapyTube"). A name the distribution does not carry
failed TLS (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH`), which is why the dark distribution must already hold
the apex alias and certificate.

The checklist:
- every route at phone and desktop widths;
- one fresh test user (it counts against the 50 emails a day), with the 50-coin grant;
- a vote, a bid, one chat line, one reaction and the name prompt;
- the free camera, and the paid camera for one minute;
- sign-out;
- the `www` to apex redirect, the edge 404s, `robots.txt` and `sitemap.xml`, and every header;
- a scan of the deployed files for WebMCP.

Afterwards the test user is deleted and its chat line removed, so production opens clean.

What stage 2 proves that dev cannot:
- **the alias claim** (D0's question), and the production certificate;
- **the production pool's callbacks** at the apex;
- **the production key group** on `/paid/*`.

The site-down alarm is in ALARM throughout, as expected, because the probe cannot resolve the name
until G3.

### Stage 3: the switch (G3)

- D2 only.
- About 5 minutes later, the smoke test by public DNS: `node scripts/live-checks.mjs prod`. Every line
  should be ok. A resolver that asked for the apex just before D2 can keep "no such record" for up to
  15 minutes (section 4), so if only the DNS lines fail, run it again after that.
- Then the alarms, watched for an hour. They go OK within about 15 minutes, once the probe resolves the
  name.
- An admin checks that the contact mail rule is still in the shared rule set: `capyweb-contact` after
  `store` in `opensign-test-inbox` (`--alarms` prints the command; `docs/RUNBOOKS.md` section 6).
- R3 stays ready.

### Why not a `staging` stage

It would need its own pool, stacks, certificate and name, and the backend template allows only `dev`
and `prod`. The dark production stack proves the same things on the real resources at the real name,
and costs nothing extra. A staging stage may be worth adding later, as a place to try changes once
production has users.

## 6. Cost

**Production**, at `docs/PLAN.md`'s 100 customers: 3,000 sessions and about 500 viewer-hours a month.
List prices; today AWS credits offset every dollar, and the budget measures gross cost.

| Line | Volume | Per month |
|---|---|---:|
| API Gateway HTTP API | ~450k requests | $0.55 |
| Lambda | ~450k invocations, plus 8,640 health checks | $0.24 |
| DynamoDB on-demand, PITR | ~600k reads, ~30k writes, under 1 GB | $0.24 |
| CloudWatch Logs | ~0.45 GB, kept 14 days | $0.26 |
| S3 | site ~3 MB, recordings 1.19 GB, pass pictures | $0.03 |
| CloudFront egress | ~400 GB (500 viewer-hours × ~0.8 GB at 720p) | $0.00, inside the account's always-free 1 TB |
| CloudFront requests and Functions | ~1M requests, ~1.5M function runs | $0.00 (10M and 2M free) |
| Cognito Essentials | 100 MAU | $0.00 (free to 10,000 MAU per account) |
| ACM, SSM standard parameters, KMS `aws/ssm`, the budget | — | $0.00 |
| CloudWatch alarms (4) and custom metrics (4) | — | $0.00 inside the account's free 10 alarms and 10 metrics, which other projects share. Up to ~$1.60 at list. |
| Route 53 | the zone is in autonomous-lab | not in this account (its $0.50 is paid there already) |
| **Production** | | **≈ $1.32 to $2.92** |

**Dev** adds its light traffic (cents) and the same alarm and metric question: about **$0.05 to $1.70**.
**Both together: about $1.40 to $4.60 a month, 14% to 46% of the $10 budget.** The tag-scoped budget
`capyapp-capyweb-monthly` counts both, since both carry `Project=capyweb`.

Against `docs/PLAN.md`'s $2.30:
- S3 is lower: 1.19 GB measured, against 20 GB assumed.
- CloudFront carries more: at the measured 720p bitrate, the same viewing is about 400 GB rather than
  120 GB. That is still free, but it is 40% of an allowance the whole account shares.

**Where it stops being cheap:**
- **CloudFront past 1 TB**, at about 1,250 viewer-hours a month across the account (about 250 customers
  at PLAN's viewing). Past that, $0.085/GB with `PriceClass_100`, about $0.07 per viewer-hour, or
  $0.120/GB in Asia with `PriceClass_200`. **2 TB a month costs about $87 more, not the "~$14 at 2 TB"
  in `docs/PLAN.md` section 3,** which is about six times too low. The 800 GB egress alarm is the warning.
  If it fires, the first move is to pause `/media/*` or the paid behaviour (a stack change, as in R2)
  and ask the manager.
- **A request flood.** The API throttle (10 requests a second, burst 20) limits the rate, not the
  month's total: a flood at 10 requests a second on one route for a whole month is about 26M requests,
  about $30 of API Gateway plus Lambda. The budget's forecast alert is the warning.
- **Launch capacity (not cost).** Chat polls every 5 s per open camera page, so about 50 people with a
  camera page open at once reach the chat route's 10 requests a second. Past that, the client backs
  off to 30 s on a 429, so chat slows but nothing breaks. Raising the chat route's limit is cheap when
  idle, but it raises the flood ceiling above.
- **Options not taken for `kbq`:**
  - WAF: $5 a month per web ACL, $1 per rule, $0.60 per million requests and $0.40 per 1,000 CAPTCHA
    attempts, plus $10 a month for Bot Control;
  - Cognito Plus: $0.020 per MAU, no free tier.

  (aws.amazon.com/waf/pricing and aws.amazon.com/cognito/pricing, read 2026-09-29.)

## Decisions this plan asked for

Answered by capyweb-manager on 2026-09-29 at 23:10; see "Since the draft". The questions as asked:

1. The three gos as in section 2, G1 now.
2. `PriceClass_200` for production (my recommendation) or `100`.
3. `c6e`: launch on password sign-in and switch after (my recommendation), unless the launch will be
   announced.
4. `kbq`: the pre-sign-up cap as the launch minimum (my recommendation).
5. `bpk`: who supplies the dates, contact mailbox and address, and who gives the legal read. Whether the
   Deletion page may describe the email process for launch (my recommendation).
6. Who tests on a real iPhone and Android phone.
7. Whether a chat-moderation runbook is enough for launch.
