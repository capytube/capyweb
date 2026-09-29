# Video options for capyweb (task W6)

Research memo, 2026-09-29 (written by a Kimi research helper, reviewed and edited by capyweb-lead). Research only: no accounts created, no trials started, no money spent, no AWS APIs called. Every price below was read from the cited page on 2026-09-29; sources are listed at the end.

## Summary

**Recommendation: self-hosted HLS — one small encoder box at the capybaras' home pushes HLS segments to S3, served through the existing CloudFront, with CloudFront signed cookies gating the paid camera.** It is the only option that meets both hard constraints at once: the ~$7/month video budget and real server-side paywall protection. At the repo's own viewing assumption (500 viewer-hours/month) it costs ≈$3.40/month, because total egress (~795 GB including existing site traffic) stays inside the 1 TB CloudFront free tier. It gives plain HLS to W6's hls.js/native-Safari player, free recordings for the fallback reel, and near-zero lock-in. Every managed vendor fails the budget even at the lowest scenario: Amazon IVS ≈$104/month (input metering alone is $54), Cloudflare Stream ≈$21, Mux ≈$487. YouTube Live is free and works for the two public cameras, but it cannot gate the paid camera: a leaked unlisted URL works forever, private streams cap at roughly 50 invited Google accounts, and charging for access to embedded YouTube content conflicts with YouTube's Terms of Service. The price of the recommendation: ~6–10 person-days of build, a ~$100 always-on box in a home in Thailand, 15–45 s latency, and egress costs that grow linearly if viewing far exceeds the plan assumption — with a clear escape hatch (720p at 1.5 Mbps, or moving the free cameras to YouTube).

## What the repo says, and what I assumed

Repo read at `feat/wasm-frontend` on 2026-09-29. Line numbers drift; the file names are the stable part.

### The cameras

- Three pet capybaras in Thailand: Magnus, Elon, Einstein (`demo/app.js:6-8`).
- Three cameras in the seed data (`backend/src/scripts/seed-data.ts:18-22`):
  - `main-cam` — public, Magnus.
  - `food-cam` — public, Einstein.
  - `wall-cam` "Climbing wall cam" — **private**, Elon, `price_per_10_sec: 1` (1 coin per 10 seconds watched). The paid tier is per-time-watched, not per-session.
- Each capybara is listed awake exactly 3 hours/day (`seed-data.ts:9-11`: Magnus 08:00–11:00, Elon 09:00–12:00, Einstein 07:00–10:00). That is ~9 camera-hours/day, ~270 camera-hours/month.
- **The repo says nothing about the physical cameras or the ingest side** — no hardware, no RTSP/RTMP, no encoder, no stream keys anywhere. Everything about the camera side below is my assumption.

### How streaming works today

- The site needs a new video source. There is no live playback path in the code today:
  - The React app plays a static MP4 reel with `react-player` (`src/components/VideoPlayer/`), from the
    Watch room and the Home page's public stream.
  - The API has **no playback route**. It comes back with the new source in W6, behind the Cognito
    authorizer and a payment check (`docs/WASM_PLAN.md` section 3, bead `capyweb-0m7`).
  - The catalog Lambda strips anything named like a playback locator from its responses
    (`backend/src/lib/ddb.ts`, `clean()`), and the WASM client has no field that could hold one.
  - The fallback reel is one hand-placed MP4 (`capytube-stream.mp4`). The WASM plan moves media behind
    CloudFront `/media/*` with OAC (bead `capyweb-2gx`). No recording pipeline exists.

### Viewers and money

- The only viewer-volume number in the repo: "100 customers × 3 sessions × 10 minutes = 3,000 sessions and 30,000 viewing-minutes per month" = **500 viewer-hours/month** (`docs/PLAN.md:166-168`).
- Constraint: "serverless only — Lambda + DynamoDB — cheap and scalable, under $10/month at 100 customers" (`docs/PLAN.md:101-102`).
- Current non-video cost model: ≈**$2.30/month** (`docs/PLAN.md:172-182`: API Gateway $0.55, Lambda $0.24, DynamoDB $0.24, CloudWatch $0.26, S3 $0.50, CloudFront $0.00, Route 53 $0.50, Cognito $0.00). **The model has no live-video line at all** — video transport cost is the gap this document fills.
- The CloudFront row assumes a 1 TB/month always-free tier and is flagged "load-bearing" and unverified (`docs/PLAN.md:189-194`, bead `capyweb-0v3`; an 800 GB/month egress alarm exists, `docs/PLAN.md:205`). Every self-delivery estimate in this document hinges on it.

### What W6 requires of the video source (`docs/WASM_PLAN.md`)

1. **Plain HLS to the browser**: hls.js (~150 KB gzip, lazy-loaded, self-hosted) everywhere except native HLS on iOS, driven from Rust through a small JS shim (`WASM_PLAN.md:465,501-503`). No vendor player SDK. WebRTC playback and vendor viewer metrics are accepted losses.
2. **Playback locator only per request**, from the playback route W6 adds, never in the catalog.
3. **Private camera**: the catalog shows title and price only; the server checks the Cognito JWT and payment before returning any locator; "the real protection must be server-side" (`WASM_PLAN.md:164-171`). Cognito managed login + PKCE + email OTP; API Gateway native JWT authorizer, zero Lambda invocations for auth (`docs/PLAN.md:114-144`).
4. **Never a dead stream**: a recorded reel served from CloudFront `/media/*` plays whenever a camera is off (`docs/PLAN.md:256`).
5. Secrets such as a signing key live in AWS secret storage (SSM SecureString or Secrets Manager), never in source. Deploys are local `sam deploy`; the deployer policy denies EC2, NAT Gateway, and "media" services (`docs/PLAN.md`) — which likely blocks AWS MediaLive/MediaPackage-class services and may cover IVS (see Open questions).

### Assumptions I had to make (not in the repo)

- Concurrent viewers per live camera: LOW 1 / EXPECTED 3 / HIGH 10, sustained across all live hours → **270 / 810 / 2,700 viewer-hours/month**. The repo's own figure (500) sits between LOW and EXPECTED; I quote costs at the repo level where it matters.
- Reference quality 1080p at ~3 Mbps (1 viewer-hour ≈ 1.35 GB). The repo contains no bitrate or resolution assumption. 720p at 1.5 Mbps (0.675 GB/viewer-hour) is shown as the budget lever.
- Cameras are consumer IP cameras outputting RTSP (typical for this class); one small encoder box handles all three.
- Viewers are mostly in Thailand/SE Asia where region-dependent pricing applies.

## Shared cost assumptions

| Quantity | Value |
|---|---|
| Camera-hours/month | 270 (3 cams × 3 h/day × 30 days) |
| Viewer-hours/month | LOW 270 · EXPECTED 810 · HIGH 2,700 (repo's own plan number: 500) |
| Bitrate | 3 Mbps at 1080p (1.35 GB/viewer-hour); 1.5 Mbps at 720p |
| Video budget | ≈$7/month (the $10 whole-site cap minus the existing ≈$2.30) |
| Fit test | option cost + $2.30 ≤ $10 |

## Option 1 — Self-hosted HLS → S3 + CloudFront (recommended)

**How it works.** Three RTSP cameras feed one Raspberry Pi-class box at the home. ffmpeg remuxes each camera (`-c copy`, no transcode — a Pi cannot reliably transcode 3×1080p, and remuxing keeps CPU trivial) into 4-second HLS segments plus playlists, and PUTs them to S3 over outbound HTTPS. CloudFront serves `/public/*` unsigned and `/private/*` with signed cookies. Nothing inbound is opened on the home network; no EC2 anywhere.

**Monthly cost.** S3 side is constant across viewer levels: 486,000 PUTs × $0.005/1,000 = $2.43; rolling storage ≈34 GB ≈ $0.85; origin GETs ≈ $0.10 → **≈$3.40/month** (≈$2.20 with 8 s segments). CloudFront requests stay under the 10M/month free tier at every level → $0. Egress (including the site's existing ~120 GB/month, which shares the same 1 TB free tier):

| Scenario | Video egress | Total incl. existing 120 GB | Billable beyond 1 TB | **Total/month** | Fits? |
|---|---|---|---|---|---|
| LOW (270 viewer-h) | 365 GB | 485 GB | 0 | **≈$3.40** | Yes |
| Repo level (500 viewer-h) | 675 GB | 795 GB | 0 | **≈$3.40** | Yes, even at 1080p |
| EXPECTED (810 viewer-h), 1080p | 1,094 GB | 1,214 GB | 214 GB × $0.085–0.120 | **≈$21–29** | No |
| EXPECTED, 720p 1.5 Mbps | 547 GB | 667 GB | 0 | **≈$3.40** | Yes |
| HIGH (2,700 viewer-h), 1080p | 3,645 GB | 3,765 GB | 2,765 GB | **≈$238–335** | No |
| HIGH, 720p 1.5 Mbps | 1,823 GB | 1,943 GB | 943 GB | **≈$84–117** | No |

Price caveat: CloudFront per-GB rates ($0.085 US/EU edge, $0.120 Asia edge, first 10 TB) and the 1 TB always-free tier were confirmed via secondary sources (see Sources); the AWS page renders its price table with JavaScript and could not be quoted verbatim. S3 GET is confirmed on the S3 pricing page; S3 PUT ($0.005/1,000) and storage (~$0.025/GB-month, ap-southeast-1) are standard published rates, labelled here as from memory.

**Latency.** 15–45 s glass-to-glass, typical for HLS with 4 s segments (12–30 s achievable). LL-HLS is effectively unavailable: it needs an origin that supports blocking playlist reloads and partial segments, which a plain S3 origin cannot do; AWS's own LL-HLS recipes use MediaPackage, which is both in the deployer policy's denied "media" class and over budget.

**Private streams.** Viewer signs in with Cognito → API Gateway native JWT authorizer → Lambda checks payment/entitlement in DynamoDB → Lambda mints a **CloudFront signed cookie** (trusted key group; private key in Secrets Manager) scoped to `/private/*` with a 2–4 h TTL. hls.js sends the cookie on every playlist/segment request (`withCredentials`). Signed cookies, not per-file signed URLs, are the right tool for HLS's hundreds of object requests. **A leaked URL/cookie keeps working until the TTL expires** — that is why you mint hours, not days. There is no per-viewer revocation; rotating the key group kills every session at once. Minting cost at ~100 viewers: negligible (<$0.10/month).

**What runs where.** Home: cameras + one ~$100 box (Pi 5 + PSU/case/storage), 5–8 W ≈ $1–2/month electricity, ffmpeg + an upload loop, systemd watchdog. AWS: S3 bucket (lifecycle expiry at ~2 days), existing CloudFront distribution with new behaviors, Lambda, Cognito, DynamoDB — all already in the stack. Vendor: none.

**Ingest.** Local RTSP → local HLS → S3 PUTs. Upload authentication, two designs: (a) a long-lived IAM user key on the device scoped by bucket policy to `s3:PutObject` on `hls/*` only — simplest, and a stolen box can only upload into that prefix until the key is revoked (blast radius capped by lifecycle expiry + a storage billing alarm + quarterly rotation); (b) short-lived presigned PUT URLs minted by a Lambda against a revocable device token — about +1 build day, no AWS keys on the device. Start with (a).

**Lock-in.** Near zero. ffmpeg, HLS, H.264 and the S3 API are open and ubiquitous; the only AWS-specific piece is ~50 lines of cookie-signing code. Exit = point any CDN at the same objects.

**Effort.** ~6–10 person-days (box image + ffmpeg + uploader + watchdog 2–3; bucket/lifecycle/CloudFront behaviors 1–2; signed-cookie Lambda + entitlement check + frontend 2–3; monitoring and alarms 1–2). Ongoing chores: OS/ffmpeg updates a few times a year, quarterly key rotation, hardware upkeep in a Thai home (heat, dust, power cuts — auto-resume on boot, occasional on-site reboot), watching the playlist-freshness and egress alarms.

**Recordings / reel.** Free from the same pipeline: retained segments are already H.264/AAC HLS — the off-air reel is a VOD playlist over kept segments, no transcode. MediaConvert only if edited reels are ever wanted (~$0.015/minute at 1080p — over budget if run nightly; avoid).

**Viewer metrics.** No vendor viewership API exists here (the WASM plan already accepts losing metrics). If a "N watching" count is wanted later, count signed-cookie mints or parse CloudFront logs.

## Option 2 — Amazon IVS

**Cost.** Low-latency channels bill per input hour plus per viewer-hour delivered. Input: Basic $0.20/h (≤1080p, ≤3.5 Mbps, no ABR ladder), Advanced SD $0.50/h, Advanced HD $0.85/h (720p max), Standard $2.00/h. Output for SE Asia viewers: SD $0.0460 / HD $0.0920 / Full HD $0.1840 per viewer-hour. Real-time stages bill $0.0920 per participant-hour (SE Asia; camera host and each viewer both count; 720p max). Channels and stages cost $0 while idle — verified on the pricing page. Free tier exists but is negligible here (~$1–2/month at LOW).

| Configuration | LOW | EXPECTED | HIGH |
|---|---|---|---|
| Basic channels (input $54 + output) | **$103.68** | **$203.04** | **$550.80** |
| Real-time stages (720p) | **$49.68** | **$99.36** | **$273.24** |

The floor is the $54/month input metering on Basic — about 8× the video budget before anyone watches. **Fails the budget in every configuration and scenario.**

**Latency.** Channels: under 5 s (2–4 s typical). Stages: under 300 ms.

**Private streams.** Best-in-class. Enable playback authorization on the channel; a Lambda (after Cognito JWT + payment check) signs an ES384 JWT with the channel ARN using an IVS playback key pair. With `viewer-id` set, `exp` is capped at 10 minutes; single-use tokens are supported. The token is validated when playback starts; a leaked token opens new sessions only until `exp`, sessions showing sharing can be auto-revoked, and `StartViewerSessionRevocation` kills a viewer's sessions on demand (e.g., when coins run out).

**What runs where.** Home: ffmpeg/OBS box pushing RTMPS outbound on TCP 443 (SRT also supported; WHIP/RTMP for stages). AWS: everything else is IVS; control plane is **not available in ap-southeast-1** — nearest are ap-south-1 and ap-northeast-1 — while the data plane is global, so this only relocates API calls. Note: the deployer policy denies "media" services (`docs/PLAN.md`); whether that covers IVS is moot at this price.

**Lock-in.** Low-moderate. RTMPS ingest retargets in minutes; sub-5 s playback needs the IVS Player SDK (generic HLS players work but slower); recordings land in your own S3 as standard HLS.

**Effort.** ~4–6 person-days (+1–2 for record-to-S3 and reel logic). Chores: encoder watchdog, stream-key rotation, EventBridge stream-state events, S3 lifecycle pruning.

**Recordings / reel.** Yes: auto-record-to-S3 carries no IVS charge (only S3 + CloudFront costs); stages recording via server-side composition costs $0.15–0.60/hour.

**Verdict.** The best operational fit of any option (fully managed, serverless, clean auth story) and the wrong price model for part-time pet cams: per-channel-hour input metering makes the floor ~$54/month. Exclude on cost unless camera-hours drop drastically (e.g., one camera ~1 h/day).

## Option 3 — Cloudflare Stream

**Cost.** Two billing dimensions: storage **$5 per 1,000 minutes/month** (prepaid in 1,000-minute increments) and delivery **$1 per 1,000 minutes** (post-paid). Live and VOD bill identically; ingest and encoding are free; delivery includes bandwidth ("no additional egress fees" — the $0-egress claim verified for Stream). No free tier; the floor is one $5 storage increment. A $5/month Starter bundle (Stream + Images) includes 1,000 stored and 5,000 delivered minutes (overage rate unstated; standard rate assumed). All RTMPS/SRT live streams are auto-recorded, and recordings count as stored minutes: naive 30-day retention of 270 camera-hours ≈ 16,200 minutes ≈ **$85/month**, so a deletion cron keeping only the latest recording per camera (~540 minutes steady state → $5) is mandatory.

| Scenario | Storage | Delivery | **Total/month** | Fits? |
|---|---|---|---|---|
| LOW (16,200 min) | $5 | $16.20 | **$21.20** | No (~2.3×) |
| EXPECTED (48,600 min) | $5 | $48.60 | **$53.60** | No |
| HIGH (162,000 min) | $5 | $162.00 | **$167.00** | No |

Best case with the Starter bundle: LOW ≈$16.20 — still over. For scale: the $7 video budget buys ~7,000 delivered minutes ≈ 117 viewer-hours/month, less than half of LOW.

**Latency.** Standard HLS ~10–30 s. LL-HLS (opt-in beta, `preferLowLatency`) <10 s, ~5 s demonstrated. WebRTC (WHIP in / WHEP out) <500 ms — but WebRTC broadcasts **cannot be recorded** (no reel), get no viewer counts, and lose HLS playback.

**Private streams.** Strong. `requireSignedURLs` kills all public links on live inputs and recordings. A Lambda self-signs RS256 JWTs (no API call, no rate limit) after the Cognito + payment check. `exp` max 24 h — mint ~1 h instead. **A leaked URL works until `exp`**; there is no per-token revocation (rotating the signing key invalidates all tokens). `accessRules` (IP/geo) are evaluated continuously during playback, and `allowedOrigins` pins playback to the capyweb domain, so a leaked token cannot be embedded elsewhere.

**What runs where.** Home: RTMP-capable camera or a small ffmpeg/OBS box pushing RTMPS/SRT/WHIP outbound. Vendor: ingest, transcode, delivery, recording. AWS: unchanged — token-minting Lambda, Cognito, DynamoDB. Friction with the existing AWS/CloudFront site is low (no DNS move; video comes from `cloudflarestream.com`); the cost is a second vendor console and bill.

**Lock-in.** Low. Standard protocols in and out (HLS/DASH), MP4 export of recordings before leaving, month-to-month.

**Effort.** ~3–5 person-days. Chores: the recording-deletion cron is mandatory (skip it and storage drifts toward $85/month), token refresh for long sessions, signing-key rotation, watching post-paid delivery minutes.

**Recordings / reel.** Yes on the RTMPS/SRT path: every broadcast is auto-recorded, playable ~60 s after stream end, clippable — subject to the storage-retention tradeoff above. No on the WebRTC path.

**Verdict.** A good technical fit that fails the budget ~2.3× even at LOW. Revisit only if viewer-hours collapse or the budget cap moves.

## Option 4 — Mux

**Cost.** The free plan excludes live streaming entirely, and live requires the "plus" quality tier, which meters **input (encoding) per camera-minute**: 1080p $0.03125/min for the first 5,000 min/month (tiered down to $0.028906). Delivery: first 100,000 min/month free (1080p), then $0.001/min. PAYG adds a $20 monthly usage credit. Storage of recordings in cold tier: $0.0012/min/month.

| Scenario | Input (16,200 min) | Delivery | Storage (30-day cold) | Credit | **Total/month** | Fits? |
|---|---|---|---|---|---|---|
| LOW | $487.82 | $0 | $19.44 | −$20 | **≈$487** | No (~70×) |
| EXPECTED | $487.82 | $0 | $19.44 | −$20 | **≈$487** | No |
| HIGH | $487.82 | $62.00 | $19.44 | −$20 | **≈$549** | No |

Encoding alone dwarfs the budget; the generous free delivery minutes are irrelevant. (Even 720p input is ≈$390/month.) A curated ~10-hour reel instead of 30-day retention drops storage to ~$1–2.

**Latency.** Standard 25–30 s; reduced 12–20 s; low (LL-HLS) ~5 s. No shipping sub-second product for this use case (WebRTC ingest is not supported for live streams).

**Private streams.** Good. Signed playback IDs: the Lambda signs RS256 JWTs (private key in Secrets Manager) after the Cognito + payment check, with short `exp` (~15 min) plus a refresh endpoint. Mux's docs confirm an expired URL stops working even mid-playback. **A leaked URL works until `exp`.** Free referrer-domain restriction pins playback to capyweb's domain.

**What runs where.** Home: encoder pushing RTMPS/SRT outbound (no WebRTC ingest). Mux: ingest, transcode, recording, multi-CDN delivery. AWS: unchanged (signing Lambda, webhooks). Stream keys are persistent and resettable in one API call; 12 h max continuous session.

**Lock-in.** Moderate-low. Playback is standard HLS and player-agnostic; Mux-specific pieces are playback IDs, the JWT scheme, and webhooks. Exit = repoint the encoder + reimplement signing + bulk-download recordings via master access.

**Effort.** ~3–5 person-days. Chores: recording-asset cleanup (storage cost control), key resets, invoice watch.

**Recordings / reel.** Yes: every broadcast auto-creates an on-demand asset, finalized at stream end with a webhook — usable as the reel, though reconnects create accumulating assets that need cleanup.

**Verdict.** Technically excellent, ~70× over budget because per-minute input pricing punishes 270 camera-hours/month. Exclude on cost.

## Option 5 — YouTube Live embed

**Cost.** $0 at every level — no cost table applies. Live streaming, transcoding, delivery, embedding, and auto-archiving are free, and the video bytes never touch AWS. Hidden costs: an encoder at the home (~$0 if an existing always-on PC/Pi runs OBS/ffmpeg; ~$100–350 for a hardware encoder), home upload bandwidth (3 streams × 3–10 Mbps), electricity.

**Latency.** Normal: ~15–60 s (no official number; third-party consensus). Low: "less than 10 seconds" for most viewers. Ultra-low: "less than 5 seconds" (YouTube Help, latency modes page).

**Private streams — fails outright.**
- *Unlisted:* "can be seen and shared by anyone with the link … Anyone with the link can also reshare it" (YouTube Help). No expiry, no per-user binding, no signed-URL mechanism. A Cognito check that merely hides the embed URL is decorative: any paying viewer can lift the video ID from the DOM and share it, and it works for anyone, indefinitely. A persistent channel embed URL (`youtube.com/embed/live_stream?channel=<ID>`) would make one leak valid for all future streams.
- *Private:* each viewer needs their own Google account, individually invited by email in Studio; the invite cap is consistently third-party-reported as 50 accounts (not on an official page) — below the ~100 paying viewers; private embeds only play for invited, signed-in Google users; and there is no API to manage the share list, so onboarding/offboarding is manual toil. Cognito cannot grant YouTube access.
- *ToS:* the Terms of Service forbid selling access to any part of the Service or Content without written permission, and forbid sales on any page "where Content from the Service is the primary basis for such sales" — which describes a page selling play coins to watch embedded YouTube streams. YouTube may also run ads on the cams with no revenue to you, and can terminate API/embed access at will. The paywalled use would put the whole channel — free cams included — at structural termination risk.

**What runs where.** Home: encoder pushing RTMPS to YouTube (outbound only; verified channel, no live-streaming restrictions in the last 90 days; 10 active streams per channel — 3 cams fit). YouTube: everything else. AWS: untouched.

**Lock-in.** Technically low (swap the iframe for another player; recordings exportable via Studio/Takeout). But you hold no viewer relationship on YouTube's side, and channel suspension kills all cameras at once with no SLA.

**Effort.** ~1–3 person-days. Chores: stream scheduling, health monitoring, manual broadcast-ID rotation if links leak, policy/strike management.

**Recordings / reel.** Yes: streams under 12 h are automatically archived, and the same iframe plays the replay — a free off-air reel.

**Verdict.** A legitimate choice for the **free public cameras only** ($0, reliable, auto-archived replays), at the price of YouTube chrome, possible ads, and click-through leakage. It cannot satisfy the paid-private-camera requirement — technically (no real gating) and contractually (ToS). Keep it as the escape hatch, not the foundation.

## Comparison table

Video-only cost per month (add ≈$2.30 existing site cost; budget: video ≤ ~$7). "Fit?" is against that video budget.

| Option | LOW | EXPECTED | HIGH | Fit? | Latency | Private-stream method (leak lifetime) | Lock-in | Build effort |
|---|---|---|---|---|---|---|---|---|
| **Self-hosted HLS → S3 + CloudFront** | ≈$3.40 | $3.40 at 720p; $21–29 at 1080p | $84–335 | **Yes** at LOW and repo level; EXPECTED only at 720p; no at HIGH | 15–45 s | CloudFront signed cookies, 2–4 h TTL; leak lives to TTL; no per-viewer revoke | Near zero | 6–10 d |
| Amazon IVS low-latency (Basic) | $104 | $203 | $551 | No (~8×) | 2–5 s | IVS playback JWT, exp ≤10 min; session revocation API | Low-moderate | 4–6 d |
| Amazon IVS real-time stages | $50 | $99 | $273 | No | <300 ms | Participant tokens; disconnect API | Low-moderate | 4–6 d |
| Cloudflare Stream | $21 | $54 | $167 | No (~2.3×) | 10–30 s (LL-HLS beta <10 s) | RS256 JWT ≤24 h; leak lives to exp; domain pinning | Low | 3–5 d |
| Mux | ≈$487 | ≈$487 | ≈$549 | No (~70×) | 5–30 s | RS256 JWT, short exp + refresh; dies mid-playback | Moderate-low | 3–5 d |
| YouTube Live embed | $0 | $0 | $0 | Yes, but paywall fails | 5–60 s by mode | None — unlisted leaks forever; private ≈50-account cap, Google accounts required | Low tech / account-termination risk | 1–3 d |

## Recommendation

**Self-hosted HLS → S3 + CloudFront, launched at 720p / ~1.5 Mbps.** Reasons:

1. It is the only option that satisfies both hard constraints simultaneously: ~$3.40/month sits far under the ~$7 video budget, and CloudFront signed cookies give the paid camera real, expiring, server-side protection with Cognito in the loop — exactly the design `capyweb-0m7` anticipates.
2. It fits W6's architecture as written: plain HLS for hls.js and native Safari, a per-request playback locator from W6's playback route, the reel behind CloudFront `/media/*`, keys in Secrets Manager, no vendor SDK, no new deploy-time dependencies.
3. At the repo's own viewing assumption (500 viewer-hours/month) total egress is ~795 GB — inside the 1 TB free tier even at 1080p, with ~20% headroom.
4. Near-zero lock-in: open formats end to end, and the site's playback layer is already vendor-neutral by design.

Accepted costs: ~6–10 person-days of build, a physical box to babysit in Thailand, 15–45 s latency (fine for watching pets; not fine for real-time interaction), and linear egress growth beyond ~700 viewer-hours/month.

First three concrete steps:

1. **Verify the free tier before writing code.** Confirm the 1 TB/month CloudFront always-free tier actually applies to this account (already open as `capyweb-0v3`; the 800 GB egress alarm exists because of it). The entire EXPECTED-case fit depends on this. Lock the launch quality decision to the outcome: 720p @ 1.5 Mbps keeps EXPECTED at $0 egress; 1080p fits only while viewer-hours stay under ~700/month.
2. **Build the home encoder.** One Pi-class box: ffmpeg remux of the three cameras' RTSP feeds into 4 s HLS segments + playlists, PUT to a new `capyapp-*` S3 bucket under `/public/*` and `/private/*` prefixes, using an upload-only scoped IAM key, 2-day lifecycle expiry, systemd watchdog, tmpfs or USB SSD for scratch (SD cards die under continuous writes).
3. **Build the gated playback path.** CloudFront behaviors for `/public/*` (unsigned) and `/private/*` (trusted key group); a Lambda behind the API Gateway Cognito authorizer that checks payment in DynamoDB and returns a 2–4 h signed cookie; W6's hls.js shim with `withCredentials`; player falls back to the reel playlist when the live playlist goes stale.

## Risks, and what to measure before committing

- **The 1 TB free tier is unverified.** It carries the LOW and repo-level cases. Confirm it in the account's billing console first; without it, even LOW costs ≈$34–47/month in egress and the recommendation changes.
- **Viewer-hours are a plan assumption, not a measurement.** The repo's 500 viewer-hours/month was written before launch. Measure real viewing for a few weeks before fixing the bitrate: CloudFront request logs for the reel, or a count of signed-cookie mints once the private camera is live. (The React app's per-minute watch-time writes are not carried into v1, `docs/WASM_PLAN.md` section 2.)
- **Home uplink.** Three 1080p streams need ~9–10 Mbps sustained upload; 720p needs ~4.5–5 Mbps. Measure the home's actual uplink in Thailand.
- **Encoder reliability.** Heat, dust, power cuts, SD wear. Watchdog + auto-resume + a playlist-freshness alarm (Lambda checking S3 object age) + someone on-site for rare physical resets. Replacement box ≈$100.
- **Linear egress at HIGH.** Beyond ~700 viewer-hours/month at 1080p (~1,480 at 720p), costs grow linearly. Mitigation ladder: cut bitrate → 720p-only → move the two public cams to YouTube embeds (free) while the paid cam stays on signed-cookie CloudFront.
- **Device-key theft.** Upload-only scoped key, quarterly rotation, storage billing alarm; upgrade to Lambda-minted presigned URLs if the risk bothers you (+1 day).
- **Latency vs. interactivity.** 15–45 s HLS latency is fine for viewing. If the robot-interaction experience (see `docs/docs-robot-marketplace.md`) needs sub-second video, no budget-fitting option provides it (IVS real-time stages would, at ~7× budget). Flagged as a question below.
- **Single-cloud dependency.** S3/CloudFront regional outage takes video down; the reel fallback (cached at the edge) softens it.

## Open questions

1. **Free tier:** confirm the 1 TB/month CloudFront always-free tier on this account (`capyweb-0v3`). It needs a billing check with the deploy identity; the recommendation's economics depend on it.
2. **Deployer policy:** the deployer policy denies "media" services (`docs/PLAN.md`, "Three things the new deployer identity changed"). Whether that covers IVS is moot while IVS fails on cost.
3. **Quality trade-off:** is 720p at ~1.5 Mbps acceptable for pet cams if viewer-hours exceed ~700/month? That is the main budget-preserving lever at EXPECTED scale.
4. **Hardware at the home:** is placing a ~$100 always-on encoder box at the capybaras' home acceptable, and who can give it an occasional physical reboot?
5. **Robot experience latency:** does the robot-interaction feature need sub-second glass-to-glass video? If yes, the video budget and the feature conflict, and the scope needs a decision.
6. **Escape hatch:** if egress ever grows past the free tier, is it acceptable to move the two free public cams to YouTube embeds (YouTube chrome, possible ads) while keeping the paid cam self-hosted?

## Sources

All pages read 2026-09-29. Prices quoted as shown on the page that day; pages whose price tables render via JavaScript are noted, with the secondary source used instead.

Amazon IVS:
- https://aws.amazon.com/ivs/pricing/ — channel input/output rates, stage participant rates, free tier, recording statement
- https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/costs.html — no IVS charge for auto-record-to-S3
- https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/record-to-s3.html — recordings land as HLS + thumbnails in your bucket
- https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/what-is.html — latency: channels <5 s, stages <300 ms
- https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/streaming-config.html — RTMPS/SRT ingest, TCP 443, H.264/AAC
- https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/rt-stream-ingest.html — WHIP/RTMP ingest, ≤720p
- https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/private-channels.html and …/private-channels-generate-tokens.html and …/private-channels-session-protection.html — playback tokens, ≤10 min exp with viewer-id, session revocation
- https://docs.aws.amazon.com/ivs/latest/RealTimeAPIReference/API_CreateParticipantToken.html — stage token duration 1–20,160 min
- https://docs.aws.amazon.com/general/latest/gr/ivs.html — IVS control plane not in ap-southeast-1

Cloudflare Stream:
- https://developers.cloudflare.com/stream/pricing/ — $5/1,000 min stored, $1/1,000 min delivered, egress included
- https://www.cloudflare.com/products/cloudflare-stream/ — $5 Starter bundle (1,000 stored + 5,000 delivered min)
- https://www.cloudflare.com/plans/ — zone plans and included Stream minutes
- https://developers.cloudflare.com/stream/stream-live/ and …/replay-recordings/ — automatic live recording, 30-day min scheduled deletion
- https://developers.cloudflare.com/stream/stream-live/start-stream-live/ and https://blog.cloudflare.com/low-latency-hls-support-for-cloudflare-stream/ — LL-HLS beta, latency
- https://developers.cloudflare.com/stream/webrtc-beta/ — WHIP/WHEP <500 ms, no recording on WebRTC
- https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/ — signed tokens, exp ≤24 h, accessRules, allowedOrigins

Mux:
- https://www.mux.com/pricing — plans, free plan excludes live, $20 PAYG credit
- https://www.mux.com/docs/pricing/video — per-minute input/delivery/storage rates by tier and resolution
- https://www.mux.com/docs/guides/live-streaming-faqs and https://www.mux.com/docs/guides/start-live-streaming — latency modes, RTMP(S)/SRT ingest, 12 h sessions
- https://www.mux.com/docs/guides/stream-recordings-of-live-streams — automatic assets, webhooks
- https://www.mux.com/docs/guides/secure-video-playback — signed playback IDs, JWT, expiry mid-playback
- https://www.mux.com/blog/walkie-talkies-and-webrtc-ingest-signaling — WebRTC product not shipping/priced for this use

YouTube:
- https://support.google.com/youtube/answer/157177 — unlisted = anyone with the link, resharing; private = per-account invites
- https://support.google.com/youtube/answer/7444635 — latency modes (<10 s low, <5 s ultra-low)
- https://support.google.com/youtube/answer/6247592 — auto-archive for streams <12 h
- https://support.google.com/youtube/answer/2853702 and https://support.google.com/youtube/answer/2474026 — encoder settings, eligibility, stream limits
- https://support.google.com/youtube/answer/171780 — embedding rules
- https://www.youtube.com/static?template=terms and https://developers.google.com/youtube/terms/api-services-terms-of-service — restrictions on selling access; monetization rights; termination
- Third-party (labelled, used only where official pages are silent): 50-account private-share cap — https://www.medial.com/post/how-to-share-a-private-video-on-youtube-a-simple-guide and https://webapps.stackexchange.com/questions/158560/; normal-mode latency consensus — https://www.dacast.com/blog/best-low-latency-video-streaming-solution/; private-embed behavior — https://mondaydigital.com/blog/allow-embedding-youtube-video/; channel embed URL — https://webcam.io/docs/live-streaming/embed.html

Self-hosted HLS:
- https://aws.amazon.com/s3/pricing/ — GET rate confirmed; PUT and storage rates are standard published figures (page table renders via JS)
- CloudFront per-GB and 1 TB always-free tier — AWS pricing page renders via JS; confirmed via secondary sources https://egresscost.com/aws/cloudfront-pricing/ and https://spendark.com/blog/cloudfront-pricing-guide/ (treat exact cents as secondary-source)
- https://aws.amazon.com/mediaconvert/pricing/ — $0.0075/normalized-min basic tier (≈$0.015/min at 1080p30)
- https://aws.amazon.com/blogs/media/how-to-configure-a-low-latency-hls-workflow-using-aws-media-services/ and https://docs.aws.amazon.com/mediapackage/latest/userguide/hls-overview.html — LL-HLS needs a MediaPackage-class origin, not plain S3

Repo sources (feat/wasm-frontend, 2026-09-29): `docs/PLAN.md`, `docs/WASM_PLAN.md`, `docs/SAM_MIGRATION_PLAN.md`, `docs/AGENT_LEARNINGS.md`, `infra/README.md`, `infra/backend/template.yaml`, `backend/src/scripts/seed-data.ts`, `backend/src/lib/ddb.ts`, `src/components/VideoPlayer/`, `src/components/Watch/`, `src/domain/catalog.ts`, `demo/`.
