# Crawlers and SPA soft-404s (2026-09-29)

Research for the production cutover (`capyweb-1w5`), from public pages only.

**Who checked what.** A headless Kimi helper wrote the first pass from a read-only copy of the repo.
The lead then re-read these and confirmed them:
- Google's JavaScript SEO page (the soft-404 strategies and the noindex caveat, both quoted in full);
- AWS's edge-function restrictions page;
- AWS's CloudFront Functions event-structure page;
- every claim about this repo.

Marked *(not rechecked)*: claims the lead did not re-read. They come from the helper alone.

## What the site serves today

- **The shell.** `web/index.html` has no page content until the WASM runs. Its `<head>` has a static title,
  a meta description, `og:title`, `og:description` and `og:type`. It has no canonical, no `og:url` and no
  `og:image`.
  - Until 2026-09-29 the title and descriptions said "live". They were changed with this note, since every
    camera is a recording (VIDEO_DESIGN section 8).
- **Client-side tags.** `PageHead` sets only `document.title`, from the client. It sets no description,
  canonical, robots or Open Graph tag.
- **Unknown paths.** Every path without a file extension answers **200** with the shell:
  - `SpaFunction` rewrites it to `/index.html` when the API is wired;
  - otherwise `CustomErrorResponses` does the same.

  Unknown paths are therefore soft-404s. The client shows "Page not found" (`web/src/pages/not_found.rs`).
- **No `robots.txt` and no `sitemap.xml`.**

## Google

- **Rendering:** Google renders client-side apps with an evergreen headless Chromium, queued after the
  crawl, and indexes the rendered HTML
  ([JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics),
  last updated 2026-03-04). Whether the renderer waits for WASM and its API calls is not documented.
- **Soft 404s:** a 200 page that looks like an error or is empty is reported as a soft 404 and not
  indexed *(not rechecked)*. A real 4xx is never indexed, and an indexed URL that starts answering 4xx is
  dropped *(not rechecked)*.
- **Google's advice for single-page apps** (JavaScript SEO basics, quoted):

  > To avoid soft 404 errors when using client-side rendering and routing, use one of the following
  > strategies: Use a JavaScript redirect to a URL for which the server responds with a `404` HTTP status
  > code (for example `/not-found`). Add a `<meta name="robots" content="noindex">` to error pages using
  > JavaScript.

  And its caveat:

  > When Google encounters the `noindex` tag, it may skip rendering and JavaScript execution, which means
  > using JavaScript to change or remove the robots `meta` tag from `noindex` may not work as expected.

  So `noindex` may be added from the client, on the not-found view only. It must never be in the shell and
  removed later.
- **Titles and descriptions** set from the client are fine for Google (same page). Dynamic rendering is "a
  workaround and not a recommended solution" *(not rechecked)*.

## Other crawlers *(not rechecked)*

| Crawler | robots.txt token | For | Runs JavaScript? |
|---|---|---|---|
| Bingbot | `bingbot` | Bing search | Yes (evergreen Edge, Bing's own blog) |
| Applebot | `Applebot` | Spotlight, Siri, Safari | Yes ("may render", Apple's page) |
| GPTBot | `GPTBot` | OpenAI training | No (third-party measurement) |
| OAI-SearchBot | `OAI-SearchBot` | ChatGPT search | No (third-party) |
| ClaudeBot | `ClaudeBot` | Anthropic training | No (third-party) |
| Claude-SearchBot | `Claude-SearchBot` | Claude search | Not known |
| PerplexityBot | `PerplexityBot` | Perplexity search | No (third-party) |
| CCBot | `CCBot` | Common Crawl | No (Common Crawl's FAQ) |
| Google-Extended | `Google-Extended` | Gemini training, a token only | No crawler |
| Applebot-Extended | `Applebot-Extended` | Apple training, a token only | No crawler |

- **What they see.** Every crawler that does not run JavaScript sees only the shell: the title, the
  description, the Open Graph tags and the `<noscript>` line. So they index nothing of value from this site.
- **User-triggered fetchers** (ChatGPT-User, Claude-User, Perplexity-User) may not honour robots.txt,
  by their publishers' own notes.

**Link previews** (Slack, X, Facebook, LinkedIn, WhatsApp) read tags from the served HTML only; none is
documented to run JavaScript. So per-page previews need tags in the served HTML, which only prerendering
gives. Every shared link today previews with the shell's site-wide tags.

## Options

**(a) `noindex` from the client on the not-found view.**
- This is Google's own second strategy. Bing renders JavaScript, so it probably sees it too, though
  no Bing page says so.
- The cost is a few lines: `not_found.rs` adds the tag on mount and removes it on unmount.
- The tag must be added only on error views. The watch room and a pass page would add it when the API
  answers 404 for the id.
- It changes nothing for crawlers that do not run JavaScript. They never saw content anyway.

**(b) A real 404 at the edge.**
- **What AWS confirms** (both pages read 2026-09-29):
  - A viewer-response CloudFront Function "can generate or modify the `statusCode`"
    ([event structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html)).
  - It runs on cache hits too.
  - "CloudFront doesn't invoke edge functions for viewer response events when the origin returns HTTP
    status code 400 or higher"
    ([restrictions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/edge-function-restrictions-all.html)).

  So the rewrite to the shell, which answers 200, must stay, and the viewer-response function turns it
  into a 404.
- **What the viewer-response function sees: measured on dev.** The helper proposed a marker header set
  by the viewer-request function and read by the viewer-response one. AWS does not say such a header
  survives: its event-structure page says the `request` in the event "represents the actual request that
  CloudFront received from the viewer". So the functions check both:
  - the marker, when present;
  - otherwise the original path against the route list.

  They report which one fired in an `x-capyweb-404` header. On dev (2026-09-29, capyweb-manager's go)
  every 404 said `marker`. So the viewer-response function sees the request **as the viewer-request
  function changed it**, headers included. The path check stays as a fallback.
- **The route list** holds the ten static pages exactly, plus the prefixes `/stream/`, `/shop/` and
  `/auth/callback`. It must be kept in step with `web/src/app.rs`. A guard test can compare them.
- **Unknown ids** (`/stream/nobody`) pass the prefix check. The client's `noindex` from (a) covers them.
  A CloudFront KeyValueStore of known ids could cover them at the edge, but that is not worth it until
  such URLs show up.
- `CustomErrorResponses` cannot do this job: it applies to the whole distribution and keys off the
  origin's status, and S3 answers the same 403 for `/watch` as for `/garbage`.

**(c) Prerendering the static pages.**
- Leptos 0.8 has no build-time static export for a Trunk client-side app *(not rechecked)*. Its static
  mode needs an SSR server.
- A post-build step could load each static route in headless Chromium and save the HTML.
- That is the only way to get per-page link previews, and the edge route list from (b) would have to
  stop rewriting those paths.
- It is medium to high effort. Not worth it unless per-page previews become a product need.

**(d) `robots.txt` and `sitemap.xml`.** Two static files at the root. Having extensions, they pass
through `SpaFunction` untouched.
- The sitemap helps crawlers find the real routes, since the shell has no links.
- Its `Sitemap:` line and its entries need absolute URLs on the production domain, so they come with
  W12's deploy.

**(e) Tags in the shell.**
- `og:image`, `og:url` and a canonical for the site root give every shared link a capybara picture.
- Per-page descriptions set from the client help Google only.

## The robots.txt policy (capyweb-manager, 2026-09-29)

This is the manager's decision, in one file (`web/robots.txt`), and easy to change if the master or nic
wants otherwise.
- **Allowed:** search and answer engines (Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User,
  Claude-SearchBot, Claude-User, PerplexityBot, and every other crawler by default). They bring the site
  its audience.
- **Opted out:** crawlers that only gather training data: GPTBot, ClaudeBot, CCBot, Google-Extended and
  Applebot-Extended.
- **Disallowed for every crawler:** `/api/`, `/paid/`, `/media/` and `/auth/`. They are for people using
  the site: the API, paid video, recordings and sign-in.
- **Dev is not for crawlers at all.** `infra/site/deploy.sh <stage> content` writes `Disallow: /` over whatever
  `robots.txt` the build carries.

## Built on 2026-09-29, and what is left

**Built** (tested by `web/tests/pages/crawl.mjs`; on dev since 2026-09-29):
1. **Client `noindex`** (`noindex_while_shown` in `web/src/lib.rs`) on three views: "Page not found", a
   pass that does not exist, and a capybara with no camera. It is removed when the view goes, and it is
   never in the shell.
2. **`robots.txt`** with the policy above.
3. **The edge 404.**
   - `SpaFunction` marks paths that are not routes of the app.
   - `NotFoundFunction` (viewer response) answers 404 for them and keeps the shell's body.
   - Trailing slashes count as the route, as in the client router.
   - A percent-encoded spelling of a route, such as `/%77atch`, is not a route: it answers 404. Review
     rv-1790689952-88135 called this a false 404, but measured on dev, Chromium sends the path as is
     and the app's router shows "Page not found" for it too, so the status and the page agree. No link
     on the site produces such a URL. Decoding it at the edge alone would serve 200 for a page that
     says "not found"; if it is ever wanted, the edge and the router must both decode (or the edge
     redirects to the plain spelling).
   - A Rust test keeps both route lists equal to the app's routes (`edge_routes_match_the_app`).
   - Measured on dev:
     - `/garbage`, `/no/such/page` and `/stream/a/b` answer 404;
     - the pages, `/watch/`, `/stream/magnus`, `/shop/pass-1` and `/auth/callback` answer 200;
     - files and the API are unchanged.

**Left for W12 and the cutover:**
- `sitemap.xml` and the `Sitemap:` line;
- `og:image`, `og:url` and a canonical in the shell (all need the production domain);
- the production stack update.

## Recommendation for the cutover (W16, with the W12 site work)

1. **Client `noindex` on the not-found view**, and on the watch room or a pass page when their id is
   unknown. Cheap, and Google's own advice. It can land before the cutover.
2. **`og:image`, `og:url` and a canonical** in `web/index.html`.
3. **`robots.txt` with a `Sitemap:` line, and `sitemap.xml`** of the static routes and the current
   capybara rooms. The AI-training opt-out lines only if capyweb-manager decides so.
4. **A real 404 at the edge** (b), after a dev test of what the viewer-response function sees. It needs
   the manager's go for the dev test and the production go for the cutover.

**Not worth it now:** prerendering, dynamic rendering or SSR, and a KeyValueStore of ids.

## Sources

Read 2026-09-29.

**Rechecked by the lead:**
- Google, JavaScript SEO basics (last updated 2026-03-04):
  <https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics>
- AWS, restrictions on all edge functions:
  <https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/edge-function-restrictions-all.html>
- AWS, CloudFront Functions event structure:
  <https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html>

**From the helper:**
- Google:
  - HTTP and network errors: <https://developers.google.com/search/docs/crawling-indexing/http-network-errors>
  - Block indexing: <https://developers.google.com/search/docs/crawling-indexing/block-indexing>
  - Dynamic rendering: <https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering>
  - Common crawlers (Google-Extended): <https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers>
- The crawlers' publishers:
  - Bing: <https://blogs.bing.com/webmaster/october-2019/The-new-evergreen-Bingbot-simplifying-SEO-by-leveraging-Microsoft-Edge>
  - OpenAI: <https://platform.openai.com/docs/bots>
  - Anthropic: <https://support.anthropic.com/en/articles/8896518>
  - Perplexity: <https://docs.perplexity.ai/guides/bots>
  - Common Crawl: <https://commoncrawl.org/faq>
  - Apple: <https://support.apple.com/en-us/119829>
- Third-party measurement of AI crawlers and JavaScript (not official): <https://vercel.com/blog/the-rise-of-the-ai-crawler>
- Link previews:
  - Slack: <https://api.slack.com/robots>
  - X: <https://developer.x.com/en/docs/twitter-for-websites/cards/guides/getting-started>
  - Facebook: <https://developers.facebook.com/docs/sharing/webmasters/crawler>
  - LinkedIn: <https://www.linkedin.com/help/linkedin/answer/a521928>
  - Open Graph: <https://ogp.me>
- Build and route tools:
  - Leptos `SsrMode`: <https://docs.rs/leptos_router/latest/leptos_router/enum.SsrMode.html>
  - CloudFront KeyValueStore: <https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions.html>

The helper's full first pass is kept at `~/.cache/assist/results/capyweb-crawlers.md`.
