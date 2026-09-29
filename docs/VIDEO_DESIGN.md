# Video design (W6)

Status: design only, 2026-09-29. Nothing here is deployed, and no AWS call was made to write it.
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
| Public live camera | `/live/<streamId>/index.m3u8` | `/fixtures/live/<streamId>/index.m3u8` | `api::live_src` |
| Private live camera | `/paid/<streamId>/index.m3u8`, only from the playback route's answer | — | never by the front end in W6 |
| Reel | `/media/<fallback_reel>` | `/fixtures/media/<fallback_reel>` | `LiveStream::reel_key` + `api::media_src` |

- `api::live_src` returns `None` unless the stream is explicitly public (`is_public()`) and its id
  passes `validate_id`. A private or unknown camera never gets a media URL from the front end.
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
