# W16: retire the React app

Bead `capyweb-b6e.16` (docs/WASM_PLAN.md section 7, "W16"). Written 2026-09-30 by capyweb-lead, at
capyweb-manager's request: **a plan and a branch only.** Nothing is deleted on `main` or on
`feat/wasm-frontend`, and nothing in AWS, until the gos below.

The branch is `feat/wasm-frontend-w16`, one commit on top of `feat/wasm-frontend` at 9d189d6. It holds
this plan and the removal, and is ready to merge after G3 and the soak.

## 1. Why, and when

The WASM site in `web/` replaced the React app page for page (`docs/PARITY.md`). It serves dev today
and is built dark in production (G2, `docs/RELEASE_PLAN.md`). The React app is no longer deployed by any
of our stacks, and its Amplify hosting lost the apex at D0.

Keeping it costs:
- 212 files and 76,000 lines that the guard, the reviewers and every search still read;
- a root npm project with 40 packages that nobody builds;
- five of the seven direct-S3 video URLs that keep the public source file public (`capyweb-c24`,
  `capyweb-c8m`);
- an Amplify build file for hosting that no longer exists.

**When:** after G3 (the apex switch) and a soak of 7 days with no rollback. Until then, "put React back"
stays possible without a revert.

## 2. What the branch removes

212 tracked files (500 → 289, this plan included):

| Path | What it was |
|---|---|
| `src/` (193 files) | The React app: components, assets, API client, store, utils |
| `public/`, `index.html` | Its static files and HTML shell |
| `package.json`, `package-lock.json` | The root npm project (16 dependencies, 24 dev dependencies) |
| `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `postcss.config.js`, `tailwind.config.js`, `.prettierrc.yml` | Its toolchain |
| `checkts.sh`, `mockServer.sh` | Its type check and the Amplify sandbox launcher |
| `amplify/`, `amplify.yml` | The Amplify Gen 2 backend definition and the Amplify build file |
| `docs-robot-marketplace.md` | Notes on the React `/robot` page; the WASM app has `/robot` (PARITY rows 8 and 34) |

It keeps:
- **`backend/src/package.json`**, the backend's own npm project;
- **`web/`**, untouched;
- **the history in `docs/`**: older plans that name `src/` paths describe what was;
- **`.gitignore`'s Amplify lines**, so an old checkout's `amplify_outputs.json`, which held an API key,
  can never be committed;
- **`LICENSE`**. It is the Amplify starter template's (MIT No Attribution, © Amazon); whether it should
  change is nic's call (section 6).

## 3. What the branch changes

- **`demo/`:** its two direct S3 URLs now play `/media/capytube-stream.mp4`, the site's own copy through
  CloudFront. That clears `capyweb-c24`'s last two baseline entries. Opened from disk, its videos stay
  blank; they load when `demo/` is served from the site, as rollback R4 would. `demo/` stays as the
  design reference (`docs/PLAN.md` 1f; the manager's decision, section 6).
- **`scripts/guard.sh`:**
  - `src` and `amplify` leave the folder lists;
  - the loopback check still reads a root `vite.config.ts` or `package.json` if one ever comes back;
  - the pass messages say what is scanned.
- **`scripts/guard-baseline.txt`:** now empty. The five `src/` S3 entries and the two `demo/` ones went
  with their causes, and the `amplify.yml` entry went with that file.
- **`scripts/guard-selftest.sh`:** five cases used React files: `src/utils/mockData.ts` for the B4
  baseline case, `vite.config.ts` and `package.json` for the loopback cases, and the `amplify.yml`
  baseline case. They now create their own fixtures in the sandbox. 86 cases, as on `feat/wasm-frontend`.
- **`web/tailwind.config.cjs`:** it extended the React app's root `tailwind.config.js`. The branch's
  first web-checks run found this: the release build failed at the Tailwind step. The theme is now in
  `web/`'s own config, and the generated CSS is byte-for-byte the same (41,086 bytes, compared with
  Tailwind 3.4.17 on the same sources).
- **The pre-push hook** (`scripts/install-hooks.sh` and the tracked `.beads/hooks/pre-push`): the step
  that ran the React client tests in `src/api/` goes. The hook is shared by every worktree of a clone, so
  `feat/wasm-frontend` already runs that step only where `src/api/` exists (78163be); without that, a push
  from this branch was refused.
- **`README.md`:** the Amplify starter text is replaced by what the repository is.
- **`docs/WASM_PLAN.md`:** the W16 row points here.

**Checked on the branch:**
- `scripts/guard.sh`: all guards passed;
- `scripts/guard-selftest.sh`: 86 as expected, 0 wrong;
- `scripts/scan-history.py --known-ok`: 0;
- the backend tests, and the fixtures check (21 files);
- `scripts/web-checks.sh`: the full run, release build and page tests included.

## 4. The AWS clean-up (not on the branch; each item needs the master's go)

Nothing here is done by the deploy user, and none of it is reversible. The React app's AWS side is in
the **autonomous-lab** account, where the capy account's deploy user cannot even list it: `amplify
ListApps` and `appsync ListGraphqlApis` are refused. So each step starts with a **read-only inventory
by an admin**.

| # | What | Where | Note |
|---|---|---|---|
| A1 | The Amplify app **`capyweb`**: its branches, its `amplifyapp.com` hosting and its build settings | autonomous-lab | Lost `capytube.xyz` at D0 (2026-09-30 01:31). Its branch URL may still serve the React app, which plays the public source video (A5). |
| A2 | The Amplify Gen 2 backend stacks of A1 (`amplify-<appId>-<branch>-…`) and any sandbox stacks (`amplify-capyweb-<user>-sandbox-…`, from `mockServer.sh`) | autonomous-lab | Every historic AppSync endpoint already resolves NXDOMAIN (`capyweb-py9`, 2026-09-26). The inventory should confirm nothing of A1's backend is left: tables, pool, storage bucket, functions. The data is demo data (`docs/PLAN.md` Q3: start fresh). An export first is cheap if the master wants one. |
| A3 | The Amplify app **`capyweb-admin`** (d1o6kb4c8qiy31) | the DNS account | Empty: no branches, no domains. |
| A4 | Amplify's link to the GitHub repository (a GitHub App installation or a repository webhook) | GitHub `capytube/capyweb` settings | Once A1 is gone, the link has nothing to build. |
| A5 | `magnus-video-public/capytube-stream.mp4`: make it private, or remove it (`capyweb-c8m`) | the bucket's account | After A1, when nothing serves the React app, since that app plays this file. The site has its own copy in its media bucket, and `infra/media/make-recordings.sh` needs a private copy of the source. |

**Keys that deleting code does not revoke:** the two third-party video keys that were in
`amplify/functions` are live until nic rotates them (`capyweb-962`; `scripts/history-secrets-known.txt`).
W16 removes the files, but the keys stay in the public history, so rotation is still the only fix.

## 5. Order

1. **Now:** the branch is pushed and reviewed; nothing merges.
2. **G3:** the apex switch, on the master's go.
3. **The soak:** 7 days on the apex with no rollback. The alarm relay reports to the capyweb room.
4. **Merge the W16 branch** into `feat/wasm-frontend`, with capyweb-manager's yes. Then `c24` closes: the
   baseline is empty. Whatever brings `feat/wasm-frontend` to `main` is the master's.
5. **A1 to A4,** by admins, each after its inventory, with the master's go.
6. **A5** (`c8m`) after A1.
7. **`capyweb-962`** whenever nic can; it does not wait on any of this.

**Rollback:**
- **The branch:** `git revert` of the merge brings every file back.
- **A1 to A5:** these cannot be undone. That is why they come after the soak, each after its inventory.

## 6. Decisions (capyweb-manager, 2026-09-30 04:00)

- **`demo/`:** kept, as repointed on the branch.
- **The soak:** 7 days on the apex with no rollback. Then this branch merges with capyweb-manager's yes,
  and A1 to A5 go to the master.
- **`LICENSE`:** with the master, for nic. Until he answers, the file stays as it is on both branches.
- **A1 to A5:** sent to the master, marked "after the soak". Nothing is touched before its go.
