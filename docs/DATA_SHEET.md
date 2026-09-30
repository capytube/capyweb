# CapyTube: what data the site keeps (data sheet)

For the legal reader of the Terms, Privacy and Deletion pages. Facts only, as built on the
`feat/wasm-frontend` branch for the W12 release, read from the code on 2026-09-29. Each fact names the
file it was checked in; **"not verified"** marks the few that were not. There are no legal conclusions
here; open points are listed as questions at the end. The staff procedures are in `docs/RUNBOOKS.md`.

## The service in one paragraph

CapyTube shows capybara cameras. Anyone can watch the free cameras and read the chat without an
account. With an account, people choose a display name, chat, react, vote on and bid for what the
capybaras do next, and watch paid cameras, all with **play coins**. Every new account gets **50 play
coins once** (`backend/src/lib/economy.ts`, `STARTING_BALANCE`). Play coins **have no cash value**: they
cannot be bought, sold, cashed out or sent to another person (`economy.ts`, header; the site has no
payment of any kind).

## What is collected, why, and for how long

| Data | Why | Where it is kept | How long |
|---|---|---|---|
| **Email address** | Sign-in, the sign-up code, password reset | Amazon Cognito user pool only (`UsernameAttributes: [email]`, `infra/backend/template.yaml`). No handler writes it to the database (checked: no backend handler reads or stores an email). | Until the account is deleted |
| **Password** | Sign-in | Cognito, which stores its own hash. Sign-in happens on Cognito's hosted sign-in page, so the password never reaches CapyTube's code (`web/src/oauth.rs`: the app receives a one-time code, never a password). Minimum 12 characters (template, `PasswordPolicy`). | Until the account is deleted |
| **Account id** (`sub`) | Links everything below to the account | Cognito and the database (`USER#{sub}`, `backend/src/lib/keys.ts`) | Until the account is deleted |
| **Display name** | Shown next to the person's chat messages | Database, user item (`backend/src/writes.ts` `putMe`), and copied into each chat message (`writes.ts` `postChat`) | Until the account is deleted; the copies in chat, 30 days |
| **Play-coin balance and history** | The game: every coin change has one history entry | Database (`backend/src/lib/ledger.ts`) | Until the account is deleted |
| **Votes and bids** (a vote can carry a short "custom request" the person writes) | The game | Database (`writes.ts` `vote`, `bid`) | Until the account is deleted |
| **Chat messages** | Public chat under each free camera | Database, with the account id, the display name and the text (`writes.ts` `postChat`) | **30 days**, then deleted automatically (`CHAT_TTL_DAYS`); DynamoDB removes expired items usually within a few days |
| **Reactions** (five emoji-style buttons) | Public counts per camera | Database, as totals only. **No account id is stored with a reaction** (`writes.ts` `react`). | As long as the camera exists |
| **Paid-camera time** | Which paid camera the person has paid for, and until when | Database, one small item per person and paid camera (`backend/src/playback.ts`) | Until the account is deleted |
| **Request records** ("idempotency keys") | Stop a retried click from spending coins twice | Database, with the answer to that request (`ledger.ts`) | **24 hours**, then deleted automatically |
| **Last chat time** | Limit chat to one message every 2 seconds per person | Database, user item (`writes.ts` `claimChatSlot`) | Until the account is deleted |
| **Emails sent to contact@capytube.xyz** | Answering the person | SES receives it in Singapore and keeps the raw message in a private bucket; a function forwards it to the team's mailbox (`infra/mail/`, `capyweb-puq`) | **90 days** in the bucket (lifecycle rule); the forwarded copy, as long as the team's mailbox keeps it |

The site does not ask for a real name, age, address, phone number or payment details: the sign-up form
asks only for an email address and a password (`Schema` in the template). Sign-up is refused past a
daily and an hourly limit (the sign-up cap: 40 a day and 10 an hour, `backend/src/signupcap.ts`). It
keeps only two counts per UTC day and hour, with no email address or other personal data, deleted after two
days.

## Paid-camera cookies

When a signed-in person buys time on a paid camera, the server sets three cookies:
`CloudFront-Policy`, `CloudFront-Signature` and `CloudFront-Key-Pair-Id` (`backend/src/lib/cfsign.ts`).

- **What they contain:** the address of that one camera's video files, an expiry time, a signature, and
  the id of the signing key. **No account id, email or display name.**
- **How long:** until the paid time ends plus 30 seconds (`GRACE_SECONDS`, `playback.ts`). One purchase
  buys 60 seconds; the player renews while the person keeps watching (`economy.ts`
  `PLAYBACK_BLOCK_SECONDS`).
- **Scope:** sent only with requests for that camera's files; not readable by scripts; not sent from
  other sites (`Path`, `HttpOnly`, `Secure`, `SameSite=Strict`, `cfsign.ts` `setCookieHeaders`).

These are the only cookies CapyTube's own servers set.

## What the browser keeps

| Where | What | How long | Checked in |
|---|---|---|---|
| Memory only | Access and ID tokens (15 minutes each), the email address and account id read from the ID token (the email appears as the tooltip of the "Sign out" button) | Until the tab closes or the person signs out | `web/src/auth.rs` (header, `User`); template `AccessTokenValidity`, `IdTokenValidity` |
| `localStorage`, key `capyweb.auth.refresh` | The Cognito refresh token, so a returning visitor stays signed in | Up to **30 days**; each use replaces it with a new one; removed and revoked at sign-out | `auth.rs` `REFRESH_KEY`, `sign_out`; template `RefreshTokenValidity`, `RefreshTokenRotation` |
| `sessionStorage`, key `capyweb.auth.flow` | During one sign-in redirect: a random state value and code verifier, the page to return to, and the vote or bid the person was about to make | Deleted when the sign-in returns; otherwise until the tab closes | `auth.rs` `FLOW_KEY`, `AuthCallback`; `web/src/oauth.rs` `Flow`, `PendingAction` |
| `sessionStorage`, key `capyweb.auth.name-prompt-dismissed` | That the person closed the "choose a display name" prompt | Until the tab closes | `auth.rs` `NAME_PROMPT_KEY` |
| `sessionStorage`, keys starting `capyweb:pos:` | Where a recorded video was paused, to resume there | Until the tab closes | `web/js/player.js` `savePos` |
| Cookies on Cognito's sign-in domain | Cognito's own sign-in session, set by AWS on `capyapp-capyweb-<stage>.auth.ap-southeast-1.amazoncognito.com`, ended at sign-out through Cognito's `/logout` | Set by AWS; not verified | `oauth.rs` `logout_url` |
| Paid-camera cookies | See above | Paid time plus 30 seconds | `cfsign.ts` |

## Server logs and backups

- **Server logs: 14 days** (`RetentionInDays: 14` on every function's log group, template). By design
  they hold **no account id and no email**: the functions log only unexpected errors (with the request
  path, which names a camera or a vote, never a person) and the health check's results
  (`lib/http.ts` `guard`, `playback.ts`, `healthcheck.ts`). Request logging on the API and the website
  is not switched on (no access-log setting in `infra/backend/template.yaml` or `infra/site/template.yaml`).
  The sign-up cap logs one line per refused sign-up with the reason only (`signupcap.ts`); it receives
  the email address from Cognito but never logs or stores it.
- **Backups: 35 days.** The database keeps point-in-time recovery (`PointInTimeRecoveryEnabled: true`,
  template; 35 days is AWS's default and the template does not change it). Deleted data can be restored
  from it for 35 days after deletion.

## Where it is stored

- **Amazon Web Services, Asia Pacific (Singapore), `ap-southeast-1`**: the database, the sign-in user
  pool, the functions, their logs, and the website's and videos' storage (`infra/README.md`; the
  deploy scripts set `ap-southeast-1`).
- **Amazon CloudFront** delivers the website and the videos from edge locations near the viewer. The
  set of locations is a setting (`PriceClass`, `infra/site/template.yaml`): today North America and
  Europe (`PriceClass_100`); the release plan recommends adding Asia (`docs/RELEASE_PLAN.md` 1a item 2).
- **Emails** (sign-up codes, password resets) are sent by Cognito's default sender, run by AWS
  (`EmailSendingAccount: COGNITO_DEFAULT`, template).

## Who can see what

- **Anyone, signed in or not:** chat messages on the free cameras with the author's **display name**
  (never the email or account id: `writes.ts` `chatOut`), reaction totals, and the current highest bid
  amount on a bid round (a number, without a name).
- **The person themselves:** their balance, coin history and display name (`GET /me`,
  `GET /me/transactions` only ever return the caller's own records, `writes.ts`).
- **Staff:** there is no admin screen yet. People with access to the AWS account (the deploy user and
  AWS administrators) can read the database and the user pool, including email addresses, through the
  AWS console or command line. Who holds that access is **not verified here**.

## What the site does not do

- **No analytics, no advertising, no tracking pixels.** No such script or service exists in the site's
  code (`web/index.html`, `web/src`, `web/js`).
- **No third-party scripts.** The video player library is served from the site itself (`web/vendor/hls`,
  `web/index.html`).
- **Fonts:** the three fonts are served from the site itself (`web/assets/fonts`, `web/style/fonts.css`;
  `docs/RELEASE_PLAN.md` 1a item 3), so no font service sees visitors' IP addresses.
- **No data goes to anyone but AWS** from the site's code: the app talks only to its own domain (the API
  is served as `/api`, `docs/RELEASE_PLAN.md` 1a item 6) and to Cognito's sign-in domain (`web/src/oauth.rs`).
  The site's content security policy allows no other origin (`infra/site/headers-prod.json`). No payments:
  play coins only.

## Deletion

By email from the account's own address; staff confirm by replying to that address, switch off sign-in,
then delete the account and its data within 30 days (`web/src/pages/deletion.rs`; procedure in
`docs/RUNBOOKS.md` section 1). Backups age out within 35 days after that. Reaction totals and bid amounts
carry no name and stay. Play coins are not refunded (they have no cash value).

## Questions for the legal reader

1. Is a 30-day deletion window, plus 35 days in backups, acceptable for the places CapyTube's users are
   likely to be?
2. The current Privacy page mentions cookies for advertising, marketing emails, and sharing with payment
   processors and analytics providers (`web/src/pages/privacy.rs`). The site has none of these. Should
   those passages go?
3. The site does not ask for age. Is a minimum age, or a statement about children, needed?
4. Is storing data in Singapore, and serving it through CloudFront edges abroad, something the Privacy
   page must state?
5. Are public chat messages (shown with the display name, kept 30 days) covered well enough by the
   Terms?
6. Staff keep an account's `sub` and the deletion date for 35 days after a deletion, only to re-apply the
   deletion if the database is restored from a backup. Is that acceptable, and should it be stated?

**2026-09-30 (capyweb-bpk):** the dates and the contact mailbox are filled in. Terms and Privacy were
rewritten from this sheet after an AI legal read (not a lawyer), which answered question 2 (those
passages are gone) and asked for a minimum age (13, with a parent's or guardian's permission under 18:
the owner's to confirm). Still to be supplied by the owner: who runs the site (a company name and
address, or "CapyTube" with no postal address), which is one line in `web/src/pages/legal.rs`, and the
governing law that follows from it.
