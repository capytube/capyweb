> Written 2026-09-29 by a read-only helper for W14 (docs/WASM_PLAN.md section 7), at 5bf43f3. Since then gap 2, the first-sign-in name prompt, is built (W14, web/src/components/name_prompt.rs). The other gaps and `og:image` wait for W12 or later (capyweb-manager, 2026-09-29).

# W14 parity check: React vs demo/ vs WASM (feat/wasm-frontend @ 5bf43f3)

## Summary

37 rows compared: 28 parity, 4 deliberate drops plus the wallet and NFT parts of the profile (all from docs/WASM_PLAN.md "Decisions" Q1 and section 2), 5 gaps. None of the gaps blocks cutover: every route React serves exists in the WASM app with the same URL (web/src/app.rs:35-48, enforced by web/src/routes.rs:131), and every promise the site makes (play coins are not money, Recorded vs LIVE, free watching, legal pages) is kept. The gaps are small polish items: floating reaction bursts (demo, PLAN.md D3), the "Hi, {name}" greeting and the first-sign-in name modal in the header, the footer copyright line, and a demo-only coin top-up. Caveat: this is a static read of the code; nothing was built or run, and features that call write routes (chat, reactions, votes, bids, names) only work once those backend routes are deployed, which is a backend question and not front-end parity.

## Blocks cutover

None found. The nearest candidate is the name modal on first sign-in (gap 2): React opens it on a user's first sign-in (src/components/Header/Header.tsx:100-112), and docs/WASM_PLAN.md section 2 (Header row, line 116) promises it for the WASM app. It does not block, because /profile lets you set a display name (web/src/pages/profile.rs:180). Owners should also note that the "[Insert Date]" placeholders are in React too (src/components/TermsOfService.tsx:9,67; src/components/PrivacyPolicy.tsx:39,190), so they are not a parity gap. The WASM app highlights them (web/src/pages/terms.rs:14,62; privacy.rs:14,137), and they need real dates before launch either way.

## All rows

| # | Feature | React | demo | WASM | Verdict | Evidence |
|---|---|---|---|---|---|---|
| 1 | Routes / URLs | 12 routes | 4 views (home/watch/play/shop) | Same 12 plus /auth/callback and a 404 fallback | parity | src/App.tsx:83-95; demo/index.html:56,157,210,268; web/src/app.rs:35-48; web/src/routes.rs:131 |
| 2 | Header: logo + Beta ribbon | yes | logo | yes | parity | src/components/Header/Header.tsx:65-68, src/components/DemoSiteRibbon/index.tsx:8; web/src/components/chrome.rs Header (`capytube.svg`, "Beta") |
| 3 | Header coin balance pill | balance + coin icon | coin pill "Not real money" | coin pill, title "Play coins. Not real money." | parity | Header.tsx:84-86; demo/index.html:48; web/src/auth.rs:471-474 |
| 4 | Header "Hi, {name}" greeting | yes | name input in header | no | gap (can wait) | Header.tsx:90; demo/index.html:46; web/src/auth.rs:455-481 (pill + Sign out only) |
| 5 | Name modal on first sign-in | YourProfile modal | n/a | none; name editable on /profile | gap (can wait) | Header.tsx:100-112; docs/WASM_PLAN.md:116; web/src/pages/profile.rs:180 |
| 6 | Wallet address snippet, NFT avatar | yes | no | no | deliberate drop | Header.tsx:88-96; docs/WASM_PLAN.md:18-19 (Q1) |
| 7 | Nav + phone tab bar | Navbar + FooterNavbar (<500px JS) | top nav | Nav + CSS tab bar | parity | src/App.tsx:78-80; web/src/components/chrome.rs TabBar; web/style/chrome.css:272 |
| 8 | Footer links | Footer component | reset link | About/Robot/Privacy/Terms/Deletion | parity | src/components/Footer/Footer.tsx; web/src/routes.rs:46-52 |
| 9 | Footer copyright "2024 © Capytube All rights reserved" | yes | no | no | gap (can wait) | src/components/Footer/Footer.tsx:10; web/src/components/chrome.rs Footer |
| 10 | "Play coins are not money" copy | no explicit wording | yes | footer modal + pages | parity (WASM stronger) | demo/index.html:48,292; web/src/components/chrome.rs Footer; home.rs, profile.rs, about.rs (grep "not money") |
| 11 | Sign in / sign out | Dynamic widget (wallet login) | none | Cognito managed login, Sign in / Sign out | parity (provider change per Q2) | Header.tsx:73-78; docs/WASM_PLAN.md:20 (Q2); web/src/auth.rs:154-189,481 |
| 12 | Sign up | via Dynamic | n/a | through Cognito managed login | parity | web/src/auth.rs:1,154 |
| 13 | Home: stream / "Now showing" | PublicStream | stage with reel | Now showing + Recorded pill | parity | src/components/Home/PublicStream/PublicStream.tsx:19; web/src/pages/home.rs:98-109 |
| 14 | Home: premium stream card | disabled card | no | no | deliberate drop | docs/WASM_PLAN.md:118 ("Premium card dropped") |
| 15 | Home: capybara cards / gang | OurCapybaras | cast | Gang with empty + error states | parity | demo/index.html:105-133; web/src/pages/home.rs:254-266 |
| 16 | Home: gallery | CapyGallery | no | PhotoStrip | parity | src/components/Home/index.tsx:6; web/src/pages/home.rs:279-281 |
| 17 | Home: "How a visit works" | no | yes | yes | parity | demo/index.html:84; web/src/pages/home.rs:210-216 |
| 18 | /watch capybara list | Starring cards | n/a | yes, loading + empty | parity | src/components/Watch/Starring/Starring.tsx; web/src/pages/watch.rs:66-77 |
| 19 | Watch room player, Recorded vs LIVE | VideoPlayer, no honest label | "Tap to start" reel | player with live/recorded labels and reel fallback (D1) | parity (WASM stronger) | src/components/VideoPlayer/index.tsx; demo/index.html:177; web/src/components/player.rs; watch_room.rs:256-258 |
| 20 | Viewer count | no ("watch time" counter only) | no | "N watching", hidden for recordings | parity / WASM extra | web/src/pages/watch_room.rs:110-112,181-182,256 |
| 21 | Watch-time counter | UserStreamCounter | no | no | deliberate drop | src/components/Watch/WatchRoom/UserStreamCounter/index.tsx; docs/WASM_PLAN.md:127 |
| 22 | Chat | ChatRoom (no polling) | sample chat | chat panel with polling | parity | src/components/Watch/WatchRoom/ChatRoom/ChatRoom.tsx; demo/index.html:194-197; web/src/pages/watch_room.rs:216-222, web/js/chat.js |
| 23 | Reactions (5 capy emoji) | love/like/wow/angry/fire | emoji float | same 5 names | parity | src/components/Watch/WatchRoom/EmojiRating/EmojiRating.tsx:19-23; web/js/chat.js:5-6 |
| 24 | Floating reaction bursts | no | yes | no | gap (can wait) | demo/app.js:263 (floatEmoji); docs/PLAN.md:261 (D3); web/js/chat.js (no float code) |
| 25 | Private cameras gated | n/a | n/a | "Sign in to watch", paid playback | parity / WASM extra | web/src/pages/watch_room.rs:307-314,609 |
| 26 | Play: capybara picker | ChooseCapySection | picker | yes | parity | src/components/Play/ChooseCapySection.tsx; demo/index.html:215; web/src/pages/play.rs:808 |
| 27 | Votes (snack) + custom snack idea | VoteInteractionCard | options + custom | yes, cost before confirm | parity | src/components/Play/VoteInteractionCard.tsx; demo/index.html:237-241; web/src/pages/play.rs:324,493 |
| 28 | Bids | BidInteractionCard | bid form | yes | parity | src/components/Play/BidInteractionCard.tsx; demo/index.html:259; web/src/pages/play.rs:326 |
| 29 | Rules + thanks | RulesPopup, ThanksSection | toast | inline Rules + thank-you line | parity | src/components/Play/GameSection.tsx:7; web/src/pages/play.rs:496-503 |
| 30 | CAPYL on-chain payment | yes | no | play coins from ledger | deliberate drop | src/utils/useSendCapyl.ts; docs/WASM_PLAN.md:121 (Q1) |
| 31 | Shop / passes list: search, sort, details, offers, activity | NFT list, search, sort, details | 3 passes, buy with coins | read-only passes with search, sort, offers, activity | parity (claim waits on write API per plan) | src/components/NFTMarket; demo/index.html:268-273; web/src/pages/shop.rs:105-125,210,229; docs/WASM_PLAN.md:122 |
| 32 | Coin top-up ("Add 25 coins") | no | yes (demo-only) | no | gap (can wait; ledger is server-only, docs/PLAN.md:236 B6) | demo/index.html:295 |
| 33 | Profile: signed-out pitch, name, balance, ledger | NoLoginPage, CAPYL table, wallet, NFTs | n/a | pitch + sign in; name, coins, ledger with Load more | parity; wallet/NFT sections deliberate drop (Q1) | src/components/Account/ProfilePage.tsx; web/src/pages/profile.rs:25-46,107,180-208 |
| 34 | About / Terms / Privacy / Deletion / Robot | static | n/a | static ports; robot video plays signed-out | parity | src/components/AboutUs.tsx etc.; web/src/pages/{about,terms,privacy,deletion,robot}.rs; robot.rs:8,82 |
| 35 | SEO/meta | title only, no description | n/a | title, description, og:title/description/type, theme-color, per-page titles, noindex on 404, robots.txt | parity (WASM stronger) | index.html:7; web/index.html:6-11; web/src/lib.rs:17-20; web/robots.txt |
| 36 | Loading / error / empty states | mostly none | n/a | Suspense fallbacks, role=alert errors, empty notices | parity (WASM stronger) | web/src/pages/home.rs:52-58,265-266; play.rs:799-840; shop.rs:125 |
| 37 | Brand assets | src/assets (capytube.svg, capy coin, emoji svgs, cast photos) | demo/assets | web/assets (capytube, capyCoin, favicon, cast, posters) | parity | src/assets; demo/assets; web/assets |


## Can wait

1. **Floating reaction bursts** (row 24): add a float layer in web/js/chat.js on reaction send, plus a CSS keyframe that respects `prefers-reduced-motion` (web/style/base.css:92). About 40 lines.
2. **First-sign-in name modal** (row 5): after `/me` loads with no username, open `Modal` with the display-name form lifted from web/src/pages/profile.rs:180. web/src/auth.rs plus a small component, about 60-100 lines.
3. **"Hi, {name}" in header** (row 4): show `session` username next to the coin pill in web/src/auth.rs:465-481, about 10 lines (needs the name in `Session`, web/src/state.rs).
4. **Footer copyright** (row 9): one line in web/src/components/chrome.rs Footer (update the year).
5. **Coin top-up** (row 32): only if a server grant route is added (docs/PLAN.md B6); it was a demo convenience.

Not gaps but worth noting before launch: no `og:image` or web manifest in either app (D7 PWA is unbuilt), and "[Insert Date]" in Terms/Privacy (both apps).

## WASM has, React lacks

404 page with noindex (web/src/app.rs:35, web/src/lib.rs:17-20); honest Recorded/LIVE labels and reel fallback (D1); "N watching" viewer count; "play coins are not money" modal; meta description/OG tags; skip link, modal focus handling, reduced-motion CSS; loading/empty/error states; private-camera gating; deep-linkable camera tabs; activity windows on capybara cards (home.rs:248, D9); dev-only WebMCP tools (web/src/webmcp).
