# WebMCP notes (2026-09-29)

Research for W10 (`capyweb-5k7`), from public pages only. Nothing was installed and no browser was
run, so the testing section says what the docs claim, not what was seen working.

**Who checked what.** A cursor-agent helper (grok-4.7-high) wrote the first pass on a read-only copy of
the repo. The lead then re-read these sources and confirmed them:
- the spec source `index.bs` on main;
- the Chrome Status API record;
- Google's `agentic-javascript-tools.md` guide;
- every claim about this repo.

Marked *(not rechecked)*: claims the lead did not re-read. They come from the helper alone.

## Summary

- **Build against `document.modelContext`.** The source is the living Draft Community Group Report of the
  W3C Web Machine Learning CG, dated 29 September 2026. It has no frozen snapshot, and the spec source
  last changed on 28 September.
- **The shim's call is right:** `registerTool(tool, { signal })` returns a promise, a rejection means
  "not registered", and aborting that signal unregisters the tool.
- **Keep `navigator.modelContext` only as a fallback for old previews.** Google's guide says it was
  deprecated in Chromium 150 and is no longer supported.
- **`consequentialHint` does not block the call.** The page's own confirm dialog stays the gate that
  spends coins.
- **There are two signals.** Aborting the **registration** signal removes the tool; it does not cancel a
  call that has already started. The signal passed **into `execute`** cancels a call.
- **Nothing ships WebMCP on for every site.** Chrome runs an origin trial (149 to 156). Without a token
  or the local flag, the API is not there. Edge runs a trial too. Firefox is neutral and Safari opposed;
  neither ships it.
- **Tests:** keep the injected stand-in host. It works in headless Chromium with no flag. A native call
  needs a real Chrome with a feature flag, and sources disagree on which flag and whether headless works.

## 1. The spec

WebMCP lives in the **W3C Web Machine Learning Community Group**: not WICG, and not on the Standards
Track. The spec page says: "It is not a W3C Standard nor is it on the W3C Standards Track."
- Report: <https://webmachinelearning.github.io/webmcp/>.
- Explainer: the repo's [README](https://github.com/webmachinelearning/webmcp/blob/main/README.md).
- Issues: <https://github.com/webmachinelearning/webmcp/issues>.
- Tests: <https://wpt.fyi/results/webmcp>.

An older write-up, [proposal.html](https://webmachinelearning.github.io/webmcp/docs/proposal.html),
still documents `navigator.modelContext`, `provideContext` and `unregisterTool`. None of them are in the
current spec.

### Where the object sits

```webidl
partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};
```

There is no `navigator.modelContext` in the spec source.

`registerTool` is refused in two cases *(not rechecked)*:
- `SecurityError` when the agent cluster is not origin-keyed (except `file:`);
- `NotAllowedError` when the document may not use the `tools` permissions-policy feature, whose
  default allowlist is `'self'`.

### Registering and removing a tool

```webidl
Promise<undefined> registerTool(ModelContextTool tool, optional ModelContextRegisterToolOptions options = {});

dictionary ModelContextRegisterToolOptions {
  sequence<USVString> exposedTo;
  AbortSignal signal;
};
```

The promise resolves to `undefined`. There is no `{ unregister() }` object; aborting `options.signal`
unregisters the tool.

The steps also reject *(not rechecked)*:
- a duplicate name;
- an empty name or description;
- a name longer than 128 characters, or with anything other than ASCII letters, digits, `_`, `-` or `.`;
- an `inputSchema` that `JSON.stringify` cannot serialize;
- a bad `exposedTo` origin;
- a signal that is already aborted.

`exposedTo` lists extra origins that may see the tool. Leave it empty and the tool is visible to this
origin's documents and to the browser's own agent.

From the spec source:

> Unregistering a tool does not cancel an execution that has already invoked its `ToolExecuteCallback`.

### The tool

```webidl
dictionary ModelContextTool {
  required DOMString name;
  USVString title;
  required DOMString description;
  object inputSchema;
  required ToolExecuteCallback execute;
  ToolAnnotations annotations;
};

callback ToolExecuteCallback = Promise<any> (object inputObject, ToolExecuteCallbackOptions options);

dictionary ToolExecuteCallbackOptions {
  required AbortSignal signal;
};
```

- **`execute`** gets the arguments and `{ signal }`.
- **Its result** is JSON-stringified for the caller. The spec does not require MCP's
  `{ content: [{ type: "text", text }] }` shape; the explainer's example uses it anyway, and Google's
  guide says `execute` "can return any value".
- **Declarative (form) tools** are still marked TODO in the spec. This site does not need them.

### Annotations

```webidl
dictionary ToolAnnotations {
  boolean readOnlyHint = false;
  boolean untrustedContentHint = false;
  boolean consequentialHint = false;
  boolean debugging = false;
};
```

- **`readOnlyHint`:** the tool changes no state. A navigation tool is therefore not read-only.
- **`untrustedContentHint`:** the output contains data the registering site does not vouch for, so an
  agent must not take it as instructions. This fits `read_chat`.
- **`consequentialHint`:** executing the tool has significant, real-world or non-reversible effects, for
  example spending money.
- **`debugging`:** the tool is meant for developer tooling. None of ours set it.

The spec's security section says a client *may* use `consequentialHint` to ask the user **before**
executing. It does not require the browser to ask. Google's guide:

> Treat `consequentialHint` as a hint, not an enforcement mechanism. It does not block execution on its
> own.

The same guide dates `consequentialHint` from Chrome 154 and `debugging` from Chrome 156.

`requestUserInteraction()` is **not** in the spec source. Chrome's security page (updated 1 September
2026) still says the draft includes it *(not rechecked)*. Treat it as absent.

### Other methods

```webidl
Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options = {});
Promise<DOMString> executeTool(RegisteredTool tool, optional any inputObject, optional ModelContextExecuteToolOptions options = {});
```

These are for an agent running in the page and for tests. `executeTool` takes a tool object from
`getTools()`, not a bare name, and resolves to the JSON-stringified result. Its `signal` option cancels
that call. The spec also has the events `toolchange`, `toolactivated` and `toolcancel`. `provideContext`
and `clearContext` are gone.

## 2. Browsers today

Nothing found ships WebMCP on for every site, with no flag and no token.

| Browser | What the sources say | On by default? |
|---|---|---|
| Chrome | Origin trial `4163014905550602241`, Chrome **149 to 156** (desktop, Android, WebView). Dev trial from 146. An extension to **162** was requested on 28 September 2026 and is not granted in the record. Local flag `chrome://flags/#enable-webmcp-testing`. | No |
| Edge | Origin trial, "live in Edge 150" (WebMCP repo), expires **17 November 2026** (Microsoft's trial page). *(not rechecked)* | No |
| Firefox | Mozilla standards position **neutral**, issue closed. No implementation found. *(not rechecked)* | No |
| Safari | WebKit standards position **oppose**, issue closed. No implementation found. *(not rechecked)* | No |
| Brave | An open issue to experiment with it in Leo. *(not rechecked)* | Not confirmed |

**Chrome.** Checked in the [Chrome Status API](https://chromestatus.com/feature/5117755740913664) record,
last updated 2026-09-28 23:57:
- the origin-trial stage covers 149 to 156;
- a stage for extending it to 162 has `ot_action_requested: true`. Do not plan on 162 until it is granted;
- the top-level status still reads "Proposed". Go by the stage milestones.

Chrome 154 went stable on 22 September and 155 reached early stable on 23 September *(not rechecked)*.
Both are inside the trial, so a token would work today.

To join, register the origin, get a token, and send it on each page (a
`<meta http-equiv="origin-trial">` tag or an `Origin-Trial` header). Joining is a production decision
and goes through capyweb-manager. The token itself is a deployment step (the tag in `index.html` or a
header from the W12 site work); no CSP directive governs it.

## 3. Agents that call it

A page's tools are visible only to an agent already looking at that page. Discovery is the open
document, not a crawl.

**Claimed by the publisher** *(not rechecked)*:
- **ChatGPT desktop app, built-in browser.** OpenAI's help page "Using site tools in the ChatGPT desktop
  app" (403 to a direct fetch, so this comes from a search extract) says site tools use WebMCP, work only
  in that built-in browser (not in Chrome), and need an account and model that support them. The WebMCP
  repo lists ChatGPT Desktop as supported.
- **Model Context Tool Inspector.** A Chrome extension that lists a page's tools and calls them by hand
  or from a prompt ([Chrome's WebMCP page](https://developer.chrome.com/docs/ai/webmcp)).
- **In-page script:** `getTools()` and `executeTool()`.

**Not confirmed:**
- Gemini in Chrome;
- Copilot in Edge;
- Brave Leo;
- the ChatGPT Chrome extension.

**To try capyweb's tools by hand:**
- turn on `chrome://flags/#enable-webmcp-testing`, then open the site with the Tool Inspector;
- or open it in the ChatGPT desktop app's browser.

Without either, `document.modelContext` is missing and `web/js/webmcp.js` registers nothing.

## 4. This repo against the spec

Checked on `feat/wasm-frontend` at daaba2e.

**Right:**
- `web/js/webmcp.js` prefers `document.modelContext`, calls `registerTool(tool, { signal })`, awaits the
  promise, and counts a rejection as "not registered".
- It does nothing when neither object exists.
- `web/src/webmcp.rs` passes `execute`'s `signal` to `fetch`, so a cancelled call cancels its request.
- `readOnlyHint` is false for navigation, and `consequentialHint` is reserved for spending or posting.

**Out of date:**
- **The draft's date.** The shim's header comment and `docs/AGENT_LEARNINGS.md` date it 28 September
  2026; the report is dated 29 September. The API they describe is still right. They leave out
  `exposedTo`, `debugging`, and the rule that unregistering does not cancel a call in flight.
- **The `{ unregister() }` branch** matches the old proposal, not the spec. It is harmless.
- **`navigator.modelContext`** is a deprecated fallback. Keep it second, never first.
- **WASM_PLAN section 4** said the explainer says no browser ships WebMCP. The explainer does not say
  that; the origin trial is the accurate statement. It also said `open_stream` is built, but W1 renamed
  it `open_page`. Both are corrected in the same commit as these notes.

**Missing, and W10 must add it:** section 4 promises that the tools sit behind a build-time `webmcp`
feature, off in production until reviewed. That gate does not exist yet:
- `web/src/app.rs` always mounts `<Tools/>`;
- `web/Cargo.toml` has no such feature;
- the only gate is `webmcpAvailable()`.

Any Chrome with the testing flag on would therefore see `list_streams` and `open_page` on a production
build today.

**Not needed for these tools:**
- **`exposedTo`:** leave it unset. The tools stay on this origin, and the browser's agent still sees
  them.
- **`debugging`:** leave it false.
- **`untrustedContentHint`:** false is right for the catalog and navigation. Set it on `read_chat`.

**The two signals, applied:**
- Sign-out aborts the registration controller, which removes the signed-in tools.
- It does not stop a `get_my_account` call already running. That call's request still carries the old
  token and ends when the server answers or the caller cancels.
- If W10 wants sign-out to stop calls in flight, it must keep its own controller per call and abort it
  on sign-out as well.

**The confirm stays on the page.** There is no browser confirm API to call. If an agent also asks the
user because of `consequentialHint`, the user confirms twice, which is acceptable. Do not remove the page
dialog because the hint exists.

## 5. Testing

Three mechanisms. They test different things.

1. **Stand-in host (what we have).** `web/tests/smoke.mjs` injects a fake `document.modelContext` before
   load and asserts:
   - registration and the tool count;
   - `list_streams`;
   - `open_page`, including a refused name;
   - a host that rejects registration.

   No flag, no token and no agent are needed, and it runs headless. It proves our side, not that Chrome
   accepts the tool.
2. **Native Chrome** *(not run; not rechecked)*:
   - Chrome's page gives only the UI flag `chrome://flags/#enable-webmcp-testing`.
   - Puppeteer's guide ([pptr.dev/guides/webmcp](https://pptr.dev/guides/webmcp)) says Chrome 151 or
     later with `--enable-features=WebMCP`.
   - Other write-ups name `WebMCPTesting` or `WebModelContext`.
   - Whether headless works is disputed.

   Playwright has no WebMCP helper; use `page.evaluate` with `getTools()` and `executeTool()`. Try it in
   W10 with installed Chrome (`channel: 'chrome'`), not the bundled Chromium:

   ```js
   const browser = await chromium.launch({
     channel: 'chrome',
     args: ['--enable-features=WebMCP'],
   });
   const page = await browser.newPage();
   await page.goto(url);
   const names = await page.evaluate(async () => {
     const mc = document.modelContext;
     if (!mc) return null; // the flag did not apply
     return (await mc.getTools()).map((t) => t.name);
   });
   ```

3. **Polyfills** such as `@mcp-b/global` test the polyfill, not Chrome. We do not need one.

## 6. What W10 should do with this

1. **Add the build-time `webmcp` feature**, off in release builds, as section 4 promises. Production
   registers nothing until the tool list is reviewed and nic says yes.
2. **Update the shim's header comment:**
   - the 29 September report;
   - the promise resolves to `undefined`;
   - the registration signal removes the tool but does not cancel a running call;
   - `navigator` is a deprecated fallback.

   Keep the call itself as it is. Then remove the `{ unregister() }` branch, so the code and the
   comment describe one draft.
3. **Set `untrustedContentHint` on `read_chat`.** `Effect::annotations()` in `web/src/webmcp.rs`
   emits only `readOnlyHint` and `consequentialHint`, so it needs a third field. Leave `debugging`
   and `exposedTo` unset everywhere.
4. **Consequential tools keep the page's own confirm inside `execute`.** A test must show that `execute`
   does not resolve without the on-page click.
5. **Sign-out:** abort the registration controllers. Also abort any tool call in flight, if calls should
   not outlive the session (a per-call controller).
6. **Try one native check in Chrome with the flag.** If it works headless, add it; if not, record why.
   The stand-in host stays the regular test.
7. **An origin-trial token is a production decision**, through capyweb-manager. It is not part of W10.

## Sources

Read 2026-09-29.

**Rechecked by the lead:**
- Spec source `index.bs` on main: <https://github.com/webmachinelearning/webmcp/blob/main/index.bs>.
- Chrome Status API: <https://chromestatus.com/api/v0/features/5117755740913664>.
- Google's guide:
  <https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/webmcp/agentic-javascript-tools.md>.

**From the helper:**
- Published report: <https://webmachinelearning.github.io/webmcp/>
- Implementation status: <https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md>
- Chrome WebMCP docs, updated 7 August 2026: <https://developer.chrome.com/docs/ai/webmcp>
- Chrome origin-trial blog, 9 June 2026: <https://developer.chrome.com/blog/ai-webmcp-origin-trial>
- Chrome tool security, updated 1 September 2026: <https://developer.chrome.com/docs/ai/webmcp/secure-tools>
- Origin trials how-to: <https://developer.chrome.com/docs/web-platform/origin-trials>
- Edge trial: <https://developer.microsoft.com/en-us/microsoft-edge/origin-trials/trials/0b76fe60-b266-458e-a285-04e375c0c31a>
- Mozilla position: <https://github.com/mozilla/standards-positions/issues/1412>
- WebKit position: <https://github.com/WebKit/standards-positions/issues/670>
- Brave issue: <https://github.com/brave/brave-browser/issues/55232>
- Puppeteer guide: <https://pptr.dev/guides/webmcp>
- OpenAI site tools (403 to a direct fetch):
  <https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app>
