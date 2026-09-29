# Video design (W6)

Status, 2026-09-29: sections 1 to 7 are the design for live cameras. **What runs on dev today is
section 8, recorded mode** (nic: "mock it up with a playback for now"): the same player, bucket
layout and paid-camera gate, with CapyTube's own recording in place of the encoder box.
Author: capyweb W6 (Claude), for bead `capyweb-b6e.6`.
It builds on `docs/VIDEO_OPTIONS.md` (Option 1 and its Recommendation): self-hosted HLS, uploaded
to S3 by an encoder box at the capybaras' home and served by the site's own CloudFront.
Related beads: `capyweb-0m7` (private playback), `capyweb-3ge` (the play-coin ledger), `capyweb-2gx`
(media behind CloudFront), W12 (`/api/*` behaviour and the CSP).

## 1. The path of a frame

```
cameras (RTSP) -> encoder box at home -> S3 video bucket -> CloudFront (the site's distribution) -> player
                   ffmpeg, -c copy        PUT only           /live/*  open
                   4 s fMP4 segments                         /paid/*  signed cookies
```

A private camera adds one step. The signed-in viewer calls `POST /api/playback/{streamId}`. A Lambda
checks the payment, then sets CloudFront signed cookies that open that camera's prefix, and only that
one. The player then loads the private playlist like any other.

Everything is on the site's domain. So the cookies land where the video is, the browser needs no
CORS, and the CSP can say `'self'`.

## 2. S3 layout

One new bucket, `capyapp-video-<env>`, in the site's region.

- Block Public Access on, bucket owner enforced, SSE-S3.
- No versioning: a versioned bucket keeps every deleted segment, and that is paid storage.
- Only CloudFront reads it (OAC, section 3). Only the encoder writes it (section 5).

| Prefix | What | Served | Kept |
|---|---|---|---|
| `live/<streamId>/` | A public camera's live window: `index.m3u8`, `init.mp4`, `seg<n>.m4s` | CloudFront `/live/*`, open | Minutes. Lifecycle backstop: 1 day |
| `paid/<streamId>/` | A private camera's live window, same files | CloudFront `/paid/*`, signed cookies | Minutes. Lifecycle backstop: 1 day |
| `rec/<streamId>/<yyyy-mm-dd>/` | Recordings: the same segments, kept | Not served | N days (N = 3 to start) |

The reel is not in this bucket. It stays a plain MP4 under the site's `/media/` (`capyweb-2gx`),
named by the stream's `fallback_reel`. A new reel is cut by hand from `rec/` with ffmpeg
(`-c copy`, no transcode) and uploaded to `/media/`. No MediaConvert.

**Lifecycle.** S3 lifecycle rules count in whole days, so they cannot expire a segment after hours.
The encoder deletes a segment itself when it leaves the playlist (ffmpeg's `delete_segments` flag,
followed by `DeleteObject`). DELETE requests are free. The lifecycle rules are the backstop:

- `live/` and `paid/`: expire after 1 day.
- `rec/`: expire after N days.
- Whole bucket: abort incomplete multipart uploads after 1 day.

**Object sizes**, at the launch quality in `docs/VIDEO_OPTIONS.md` (720p at about 1.5 Mbit/s) and
4-second segments:

| Object | Size | Count |
|---|---|---|
| Segment | about 750 KB (1.5 MB at 1080p, 3 Mbit/s) | 900 per camera-hour |
| Playlist | about 1 KB (a window of 6 to 10 segments) | rewritten 900 times per camera-hour |
| `init.mp4` | about 1 KB | 1 per camera start |

At 270 camera-hours a month that is about 486,000 PUTs, about $2.43 a month
(the figure in `docs/VIDEO_OPTIONS.md`). Recordings cost about 0.675 GB per camera-hour. At 9
camera-hours a day and N = 3, that is about 18 GB, about $0.45 a month. Each extra day of
recordings adds about $0.15 a month.

## 3. CloudFront

The video bucket becomes a second origin of the site's existing distribution, reached through
**Origin Access Control** (SigV4, always sign). Its bucket policy allows `s3:GetObject` to the
CloudFront service principal only, with `AWS:SourceArn` set to this distribution.

Behaviours, most specific first:

| Path pattern | Origin | Cache policy | Viewer access |
|---|---|---|---|
| `/live/*.m3u8` | video bucket | playlist | open |
| `/live/*` | video bucket | segment | open |
| `/paid/*.m3u8` | video bucket | playlist | trusted key group (signed cookies) |
| `/paid/*` | video bucket | segment | trusted key group (signed cookies) |
| `/media/*` | site bucket (`capyweb-2gx`) | as today | open |
| `/api/*` | HTTP API (W12) | caching disabled | the API's own authorizer |

- **Playlist policy:** TTL minimum 0, default 1 s, maximum 2 s. Nothing in the cache key (no
  cookies, headers or query strings). Compression on: playlists are text.
- **Segment policy:** default TTL 1 day, maximum 1 year. Segment names never repeat, so a segment
  never changes. Nothing in the cache key. Compression off: video does not compress.
- The encoder also sets `Cache-Control` on each upload: `max-age=1` for playlists and
  `max-age=31536000, immutable` for segments. The policies keep both inside their bounds.
- Signed cookies are checked at the edge, before the cache. A cached private segment is still
  refused to a viewer without a valid cookie. The cookies are not in the cache key, so every
  paying viewer shares the same cached objects.
- Missing objects: without `s3:ListBucket`, S3 answers 403, not 404. The player treats both as
  "no stream" and plays the reel.

## 4. The signed-cookie Lambda (private cameras)

**Route.** `POST /playback/{streamId}` on the existing HTTP API, behind the Cognito JWT
authorizer. The browser calls it same-origin, as `/api/playback/{streamId}`, through W12's `/api/*`
behaviour. It must be same-origin: a `Set-Cookie` from the API's own domain would set cookies for
that domain, and CloudFront would never see them on the site's.

- The `/api/*` behaviour must pass `Set-Cookie` back to the browser. Use caching disabled and an
  origin request policy that forwards cookies (for example `AllViewerExceptHostHeader`). W12 must
  verify this once, on dev.

**Steps.**

1. API Gateway rejects a missing or invalid JWT with 401. The Lambda never runs.
2. The Lambda checks `streamId` against the id rule (the same as `validate_id` in `web/src/api.rs`)
   and reads the stream's `#META` item. It answers 404 if there is none. It answers 400 for a public
   camera, which needs no cookie. It answers 409 if the camera is not live.
3. **Payment.** The price is the stream's `price_per_10_sec`, read on the server. The client never
   sends a price. One call buys one block of 60 seconds, which is 6 × the price. The Lambda debits it
   in the play-coin ledger (`capyweb-3ge`, `docs/DATA_MODEL.md`). That is one `TransactWriteItems` in
   the viewer's `USER#{sub}` partition: it updates the balance on condition `balance >= cost` and
   writes a `TXN#` item. A client-generated idempotency key makes a retried call free. If the balance
   is too low, the answer is 402 and no cookie.
4. **Cookies.** The Lambda signs a custom policy with `Resource` =
   `https://<site-domain>/paid/<streamId>/*` and `DateLessThan` = now + 90 s (the paid 60 s plus
   30 s of grace). It sets the three cookies `CloudFront-Policy`, `CloudFront-Signature` and
   `CloudFront-Key-Pair-Id`, each with `Path=/paid/<streamId>/; Secure; HttpOnly; SameSite=Strict;
   Max-Age=90` and no `Domain` attribute. The browser sends them only for that camera's files.
5. **Answer.** `200 { "src": "/paid/<streamId>/index.m3u8", "renew_after_s": 45 }`. This route is the
   only place a private playback locator ever appears. The catalog still strips them (`clean()` in
   `backend/src/lib/ddb.ts`).

**Lifetime and renewal.** Billing is per 10 seconds watched, so the cookie is short. While the video
plays and the tab is visible, the player calls the route again after `renew_after_s`. Each call
buys the next block. The player already pauses in a hidden tab, and it does not renew then, so a
hidden tab costs nothing. If a renewal fails, the cookie expires within 45 s, CloudFront answers 403
to the next playlist request, and the player falls back to the reel. One call a minute per viewer is
about 30,000 Lambda calls a month at the repo's 500 viewer-hours. That is inside the free tier.

**The CloudFront private key.** It is an RSA 2048 key pair. The public half goes in the trusted key
group. The private half is stored in **SSM Parameter Store as a SecureString**, standard tier,
encrypted with the AWS managed key `aws/ssm`. That costs nothing to store. The Lambda reads it once
per cold start and keeps it in memory, so the KMS calls are a few cents a year. Secrets Manager
would work too, but costs $0.40 per secret a month plus $0.05 per 10,000 calls, for no gain here.
Only the playback Lambda's role may read the parameter. Rotation: add a new public key to the key
group, point the Lambda at the new key, and remove the old public key after 90 s (the longest
cookie lifetime).

**What a leak gives an attacker.**

| Leaked | Gives | For how long |
|---|---|---|
| The private playlist or a segment URL alone | Nothing: CloudFront refuses it without the cookies | — |
| One viewer's three cookies | That one camera's live window, from any browser | Until `DateLessThan`: at most 90 s, unless the viewer keeps paying |
| A downloaded segment | Those 4 seconds of video | Forever. No design prevents a viewer from recording what they watch |
| The CloudFront private key | Cookies for every private camera, at will | Until its public key is removed from the key group. That takes effect at once, and every viewer then renews with the new key |

There is no per-viewer revocation. The short lifetime is the control. An `IpAddress` condition in
the policy could bind a cookie to one IP address, but phones change address often, so it stays off.
`HttpOnly` keeps the cookies out of reach of scripts. An XSS could still make the browser fetch the
video, so the strict CSP matters here too.

## 5. The encoder upload path (waits for nic: the box)

**Waits for nic: the box.** Nothing in this section can start until the box exists at the home,
and the deploy identity (`docs/WASM_PLAN.md`, Q3) can create the bucket.

- The box runs ffmpeg for each camera. It remuxes RTSP H.264 into 4-second fMP4 HLS segments,
  without transcoding. It keeps a local rolling window and a local recording.
- An uploader puts each **segment first, then the playlist** that names it, so a player never sees a
  playlist that points at a missing segment. It sets `Content-Type` and `Cache-Control` on each
  object. It deletes each segment that leaves the window.
- Public cameras go under `live/`, the private camera under `paid/`, and recordings under `rec/`.
  The box decides the prefix from its own configuration, not from the catalog.
- When a camera stops, the uploader deletes its playlist. The next player request then gets a 403,
  and players move to the reel.

**How the box authenticates to S3.**

- A dedicated IAM user, `capyapp-encoder`, with one access key and an inline policy that allows only:
  - `s3:PutObject` on `arn:aws:s3:::capyapp-video-<env>/live/*`, `…/paid/*` and `…/rec/*`;
  - `s3:DeleteObject` on `…/live/*` and `…/paid/*`.
- No `GetObject`, no `ListBucket`, no other bucket, no other service. The bucket policy also denies
  any request that is not over TLS (`aws:SecureTransport`).
- The key lives on the box in a file readable by root only, loaded by the systemd unit. It never
  goes in the repo.
- A stolen box can only upload into those prefixes, or delete live segments. The lifecycle rules and
  a storage and request billing alarm bound the damage.
- **Rotation**, every 90 days, and at once if the box is lost: create a second key, install it on
  the box, check that uploads work, deactivate the old key, and delete it a week later.
- Later, if a long-lived key is not acceptable: IAM Roles Anywhere with our own CA certificate as the
  trust anchor (free, 1-hour credentials), or presigned PUT URLs from a Lambda against a device token
  (about one more day of work, per `docs/VIDEO_OPTIONS.md`).

## 6. The player contract

This is what the front end relies on. W6 built the front-end half.

**Paths.**

| Source | Production | Fixture mode (the default local build) | Built by |
|---|---|---|---|
| Public live camera | `/live/<streamId>/index.m3u8` | `/fixtures/live/<streamId>/index.m3u8` | `api::camera_src` |
| Public recording (`video_mode: recording`) | `/media/rec/<streamId>/index.m3u8` | `/fixtures/media/rec/<streamId>/index.m3u8` | `api::camera_src` |
| Paid camera | `/paid/<streamId>/index.m3u8`, only from the playback route's answer | `/fixtures/paid/<streamId>/index.m3u8` | `api::paid_src` checks the answer; never built by the front end |
| Reel | `/media/<fallback_reel>` | `/fixtures/media/<fallback_reel>` | `LiveStream::reel_key` + `api::media_src` |

- `api::camera_src` returns `None` unless the stream is explicitly public (`is_public()`) and its id
  passes `validate_id`. A private or unknown camera never gets a media URL from the front end.
- `api::paid_src` plays the playback route's `src` only if it is exactly this camera's own
  `/paid/<id>/index.m3u8`. Anything else (another camera, another host, a query) plays nothing.
- Fixture mode: `web/tests/make-hls-sample.sh` writes a short synthetic stream for each public
  fixture camera, and the fixture reel. The output is committed. It is VP9, because the test browser
  (Chromium headless shell) has no H.264. The live playlists have no `#EXT-X-ENDLIST`, so they play
  as live.
- Segments may be fMP4 or MPEG-TS. The player does not care.
- Private playlists are same-origin, so the browser sends the cookies by itself. hls.js needs no
  `withCredentials`, which is only for cross-origin requests. (`docs/VIDEO_OPTIONS.md`, step 3,
  mentions it. It is not needed with this layout.)

**Behaviour** (`web/src/components/player.rs` and `web/js/player.js`):

- `.mp4` plays natively. `.m3u8` plays natively in WebKit (Safari, and every iOS browser), and
  through hls.js everywhere else.
  - Chrome now answers `canPlayType('application/vnd.apple.mpegurl')` with "maybe" too (measured
    in Chromium 153). That answer alone no longer means Safari, so the shim also checks for WebKit's
    AirPlay picker.
- hls.js is loaded only when a player needs it, once per page, from a vendored and pinned copy.
  Pages without a player never request it.
- The video is muted and starts by itself, unless the viewer asked for reduced motion.
- A hidden tab pauses the video, and a live source stops fetching. When the tab is visible again,
  the video plays again only if it was playing, and a live source jumps to the live edge.
- A non-live source keeps its position in `sessionStorage` and resumes there after a reload.
- A fatal error moves to the reel. If the reel fails too, the player shows the poster and an
  offline message.
- Unmounting removes every listener and timer and destroys hls.js.

**CSP** for W12's response-headers policy:

| Directive | Needs | Why |
|---|---|---|
| `media-src` | `'self' blob:` | hls.js plays through Media Source Extensions, and the video's source is then a `blob:` URL |
| `connect-src` | `'self'` | hls.js fetches playlists and segments with XHR |
| `script-src` | `'self' 'wasm-unsafe-eval'` | the dynamic import of `/vendor/hls/…` is same-origin; the WASM needs the second |
| `img-src` | `'self'` | the poster |
| `worker-src` | nothing | hls.js runs with `enableWorker: false`. Turning workers on would need `worker-src blob:` |

If the video ever moves to a domain of its own, add it to `media-src` and `connect-src`, and move the
cookies' scope with it.

**Caching of hls.js.** It is served from a versioned path, `/vendor/hls/1.7.3/`. W12 can serve that
path as immutable, like the hashed files. An upgrade changes the path.

## 7. What this unit built, and what it did not

Built (branch `feat/wasm-w6`):

- `web/js/player.js`, the player shim, and `web/src/components/player.rs` (`VideoPlayer`).
- `api::live_src`, with tests: a private camera gets `None`.
- A first cut of the watch room at `/stream/:capyId`: the player for the capybara's first public
  camera, and a locked panel (title and price, no buttons) for each private camera.
- hls.js 1.7.3, light ESM build, vendored in `web/vendor/hls/1.7.3/` and loaded lazily.
- `web/tests/make-hls-sample.sh` and its committed output, and the browser tests in
  `web/tests/pages/w6.mjs`.
- Byte ranges in `web/tests/serve.mjs`, as S3 and CloudFront answer them. Without them the browser
  cannot seek in an MP4, and the resume position cannot be tested.
- This document.

Not built:

- The bucket, the CloudFront behaviours, the key group, the playback Lambda and the ledger debit.
  They are designed here and wait for the deploy identity (Q3) and `capyweb-0m7`.
- The encoder box and its uploader (waits for nic: the box).
- Private playback in the front end: no sign-in or payment exists yet.
- Detecting a stale live playlist. If the box dies without deleting its playlist, hls.js keeps
  reloading an unchanged playlist and reports no error. Two fixes are possible: a scheduled check
  that deletes a playlist older than 60 s, or a player check of `#EXT-X-PROGRAM-DATE-TIME`.
- Tests on a real iPhone and Android phone (`docs/WASM_PLAN.md`, risk 7). The native HLS path
  (Safari) is not covered by the Chromium tests.
- The full watch room (camera tabs, reactions, chat): W4.

## 8. Recorded mode: what runs on dev now

nic, 2026-09-29, through capyweb-manager: no encoder box and no purchase yet. The cameras play
**recorded video as HLS from our own S3 and CloudFront**, through the same player and the same
signed-cookie gate as sections 3 to 6, so the box later changes only where the segments come from.
Every page and card says **Recorded**, never "Live".

**Footage.** Only CapyTube's own recording: `capytube-stream.mp4`, the one file behind the 7
baselined S3 URLs (`capyweb-c24`). 77.6 minutes, H.264 720p30. Its only date is the S3 upload date
(2025-01-14), which is not a recording date, so the pages show no date.

- The picture has "● Live stream" burned into its frame. `infra/media/make-recordings.sh` covers it
  with "● Recorded" (`infra/media/recorded-label.png`, same place and colours; on the one camera
  angle without the frame it shows as a small badge).
- The audio is digital silence (-91 dB mean and peak), so the renditions have none.
- Each camera gets its own third: `main-cam` and `food-cam` public, `wall-cam` paid.
- Two renditions through the Mac's hardware encoder: 720p (about 1.7 Mbit/s average) and 360p
  (about 0.5), a keyframe every 2 s, 6 s fMP4 segments, VOD playlists, a master `index.m3u8`.
  Plus a one-minute MP4 reel. 1,570 files, 1.19 GB, 11 minutes to make.

**Where it lives** (site stack `capyapp-capyweb-site-<stage>`, `infra/site/template.yaml`):

| Path on the site | Bucket key | Served |
|---|---|---|
| `/media/rec/<camera>/index.m3u8` | `media/rec/<camera>/…` in `MediaBucket` | open (`/media/*`) |
| `/media/capytube-stream.mp4` | `media/capytube-stream.mp4` | open: the reel |
| `/paid/<camera>/index.m3u8` | `paid/<camera>/…` | `/paid/*`: only with the signed cookies (trusted key group) |
| `/api/<route>` | the HTTP API's `/<route>` | `/api/*`, nothing cached, every header and cookie passed |

- `MediaBucket` is private, reached only through the distribution's OAC, TLS only, no versioning.
  Upload: `infra/media/upload-media.sh` (explicit Content-Type and Cache-Control, then an invalidation).
- `/api/*` strips its prefix in a CloudFront Function. With it, the SPA fallback moved from the
  distribution-wide error responses into a second function that rewrites only extensionless paths to
  `/index.html`. So the API's own 403 and 404, CloudFront's refusals on `/paid/*` and a missing asset
  now reach the browser as they are, instead of as index.html with 200.
- **The signing key.** The private half is only in SSM (`/capyapp/capyweb/<stage>/playback-signing-key`,
  SecureString, `aws/ssm`); the local copy was overwritten and deleted. The public key
  (`KD0MHU27L6GFD` on dev) and the key group (`capyapp-capyweb-dev-media`) were made by an admin,
  outside every stack: the deploy user has no key-group permissions, because they would reach every
  project's keys in the account. The site stack takes the key group id (`PlaybackKeyGroupId`), the
  backend stack the key id (`PlaybackKeyPairId`). Rotation goes through capyweb-manager.

**The gate** (`backend/src/playback.ts`, `POST /playback/{id}`, called as `/api/playback/{id}`). This
changes one thing from section 4: section 4 bought a fresh 60 s block on every renewal. With the
player renewing 45 s in, that charges 60 s per 45 s watched, a third too much. Instead:

- Each viewer has a `paid_until` per paid camera (`PASS#{stream_id}` in their partition). A
  purchase adds 60 s **from where the paid time ends** (or from now, if it ran out), for 6 × the
  camera's `price_per_10_sec`.
- It charges only when **under 30 s** are left. Otherwise it just sets fresh cookies, so a reload or
  a second tab pays nothing. (The first dev test used "a whole block ahead" and charged a second tab
  that opened three seconds later; the unit and integration tests now cover that.)
- The answer tells the player when to come back: `renew_after_s` = time left − 20 s (at least 5).
  Steady viewing therefore pays exactly 6 coins a minute at price 1.
- Cookies expire at `paid_until` + 30 s and are scoped to `/paid/<id>/`: Secure, HttpOnly,
  SameSite=Strict, no Domain. A retried request (same Idempotency-Key) gets the first answer's
  expiry, so a replay never stretches paid time.
- The signing key is read before any coin moves: if SSM fails, the answer is 503 and nothing is
  charged.
- Five tabs buying at once pay for one block: the pass is written conditionally in the same
  transaction as the coins, so the losers re-read and find the time already paid.

**Measured on dev** (e2e user, headless Chromium, real managed login): `/paid/wall-cam/index.m3u8`
403 `MissingKey` before paying; `POST /api/playback/wall-cam` 201, 6 coins, three cookies with
`Path=/paid/wall-cam/`, HttpOnly, Secure, Strict, invisible to `document.cookie` and not sent to
`/api`; then the master playlist, the 720p playlist and a segment all 200; a second tab 200 with
nothing charged; the same key replayed; the free camera 400; no token 401.

**Weak spot, accepted for a mock.** A recording is VOD: while the cookies are valid (up to 90 s), a
paying viewer can download every segment of that camera's 26 minutes, not just the minute they
paid for. A live window (section 2) only ever holds the last few segments. With play coins that
are not money this is acceptable; with real payments, paid recordings would need per-segment
URLs signed for a moving window.

**Cost per month on dev.** Storage 1.19 GB × $0.025 = **$0.03**. The uploads were about 1,600 PUTs
($0.008, once). Egress is inside CloudFront's free 1 TB and 10M requests: one viewer-hour at
720p is about 0.8 GB and 600 segment requests, so the free tier covers about 1,250 viewer-hours a
month. Beyond it, $0.085 per GB (PriceClass_100). The Lambda, KMS and SSM calls are inside their
free tiers (about one call a minute per paying viewer).

**The front end** (`web/src/pages/watch_room.rs`, `components/player.rs`):

- A recording plays with a "Recorded" badge on the picture and "A recording, not happening right
  now." under it; no viewer count. Cards say "Recorded". "Live" appears only for a source that is
  live. The site footer and the Robot page no longer say "live".
- A paid camera shows "Paid camera · Recorded", its title and its price a minute to everyone.
  Signed out (with sign-in available): "Sign in to watch". Signed in: Watch, then a confirm line
  ("You pay 6 play coins a minute: the first minute now, then each minute while you watch. You
  have N play coins.") with Start watching and Cancel. Without sign-in configured: no button.
- Start buys through `POST /api/playback/<id>` (same-origin, one Idempotency-Key per purchase;
  a lost answer is asked again twice with the same key), then plays the checked source. It buys
  again after `renew_after_s`, but never while the tab is hidden; after 40 s or more hidden it
  starts the player again once the next minute is paid, in case the cookies ran out. Stop,
  leaving the camera or a refusal ends it; after a refusal the minute already paid still plays.
- Tests: `web/tests/pages/w6.mjs` (recordings, the live path on a stubbed camera, the reel, the
  paid camera signed out) and `w6paid.mjs` (sign-in, confirm, buy, renew with a new key, a lost
  answer retried with the same key, nothing bought while hidden, Stop, a refusal, a foreign
  source refused, leaving).
