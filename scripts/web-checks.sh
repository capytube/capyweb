#!/bin/bash
# Pre-push checks for the Rust/WebAssembly front end in web/: the build-time rules of
# docs/WASM_PLAN.md section 5 ("Checks as local hooks"), rules 1 and 2, plus a headless
# browser smoke test of the release build.
#
# Local, NOT GitHub Actions: nic's Actions allowance is exhausted and there is no CI to catch
# what this misses. The pre-push hook calls it; scripts/guard.sh holds the static rules.
#
#   scripts/web-checks.sh                      run every step now
#   scripts/web-checks.sh --pre-push [remote]  read git's pre-push lines on stdin and run only
#                                              when the push changes something under web/
#   scripts/web-checks.sh --steps fmt,size     run only these steps, in the usual order
#   scripts/web-checks.sh --dist DIR           measure / serve DIR instead of web/dist
#
# Steps: fmt clippy-wasm clippy test fixtures build size smoke. Stops at the first failure.
# About 20 s after a source change, 2.5 minutes from cold on this Mac (see web/README.md).
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

# Release WASM + every first-load JS file (the wasm-bindgen glue at the dist root and each
# snippet), brotli -q 11, in bytes ("KB" in the plan means 1,000 bytes). The budget is
# docs/WASM_PLAN.md section 5, rule 2. The W1 shell measured ~145,000 bytes against it.
SIZE_BUDGET_BYTES=300000

ALL_STEPS="fmt clippy-wasm clippy test fixtures build size smoke"
STEPS=$ALL_STEPS
MODE=now
REMOTE=origin
DIST=web/dist
# Local tooling, deliberately outside the repo and its dependencies (see web/README.md).
PW_DIR=${CAPYWEB_PW_DIR:-$HOME/.cache/capyweb/pw}
# 8791 is `trunk serve`; a different port means the smoke test never hits a dev server.
SMOKE_PORT=${CAPYWEB_SMOKE_PORT:-8792}

while [ $# -gt 0 ]; do
  case "$1" in
    --pre-push) MODE=pre-push; [ -n "${2:-}" ] && [ "${2#-}" = "$2" ] && { REMOTE=$2; shift; }
                # git passes the remote's URL as a second argument; it is not needed here.
                [ -n "${2:-}" ] && [ "${2#-}" = "$2" ] && shift ;;
    --steps) STEPS=$(echo "${2:-}" | tr ',' ' '); shift ;;
    --dist) DIST=${2:-}; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "web-checks: unknown argument '$1' (try --help)" >&2; exit 2 ;;
  esac
  shift
done
for s in $STEPS; do
  case " $ALL_STEPS " in *" $s "*) ;; *) echo "web-checks: unknown step '$s' (steps: $ALL_STEPS)" >&2; exit 2 ;; esac
done
wants() { case " $STEPS " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
# The colour wraps the whole line, so "skipped: <reason>" stays greppable as plain text.
skip() { printf '  \033[33mskipped: %s\033[0m\n' "$1"; }
fail() {
  printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ -n "${2:-}" ] && printf '       %s\n' "$2"
  printf '\n\033[31mweb checks failed\033[0m - push with --no-verify only if you know why\n'
  exit 1
}

# --- Does this push touch web/? ---------------------------------------------------------------
# git feeds pre-push one line per ref: "<local ref> <local sha> <remote ref> <remote sha>".
# Checks run when any pushed ref changes a file under web/. A new branch (remote sha all zeros)
# counts as changed, and so does a remote tip this clone has never fetched: without it there is
# nothing to diff against, and a gate that guesses "unchanged" is a gate with a hole in it.
# The fixtures are generated from these backend files, so a change there re-checks them too.
WATCH_PATHS="web/ backend/src/scripts/seed-data.ts backend/src/lib/ddb.ts backend/src/lib/keys.ts"
push_touches_web() {
  local lref lsha rref rsha seen=0
  while read -r lref lsha rref rsha; do
    [ -n "${lsha:-}" ] || continue
    seen=1
    case "$lsha" in *[!0]*) ;; *) continue ;; esac               # deleting a remote ref
    case "$rsha" in *[!0]*) ;; *) REASON="new branch $rref"; return 0 ;; esac
    if ! git cat-file -e "$rsha^{commit}" 2>/dev/null; then
      REASON="remote tip of $rref is not in this clone"; return 0
    fi
    if [ -n "$(git diff --name-only "$rsha" "$lsha" -- $WATCH_PATHS)" ]; then
      REASON="$rref changes web/ or the fixture sources"; return 0
    fi
  done
  [ "$seen" -eq 1 ] && return 1
  # No lines at all: something earlier in the hook (the beads block runs first) read stdin.
  # Fall back to the branch's remote-tracking ref, and run when there is none.
  local branch tip
  branch=$(git symbolic-ref --short -q HEAD) || { REASON="no ref lines and a detached HEAD"; return 0; }
  tip=$(git rev-parse --verify -q "refs/remotes/$REMOTE/$branch") \
    || { REASON="no ref lines and no $REMOTE/$branch yet (new branch)"; return 0; }
  if [ -n "$(git diff --name-only "$tip" HEAD -- $WATCH_PATHS)" ]; then
    REASON="no ref lines; HEAD changes web/ or the fixture sources against $REMOTE/$branch"; return 0
  fi
  return 1
}

if [ "$MODE" = pre-push ]; then
  if ! push_touches_web; then
    skip "web checks (this push does not change web/ or the fixture sources)"
    exit 0
  fi
  printf '\n\033[1mWASM front end (%s)\033[0m\n' "$REASON"
else
  printf '\n\033[1mWASM front end\033[0m\n'
fi

# --- Environment ------------------------------------------------------------------------------
# rustup's cargo honours web/rust-toolchain.toml; put it ahead of any other cargo on PATH.
for d in "$HOME/.cargo/bin" /opt/homebrew/opt/rustup/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done
export PATH
# Trunk 0.21.14 fails with "invalid value '1' for '--no-color'" when NO_COLOR=1 is set.
unset NO_COLOR
# This Mac is a standby machine: a push must not take every core.
export CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS:-4}

need() { command -v "$1" >/dev/null 2>&1 || fail "$1 is not installed" "$2"; }
{ wants fmt || wants clippy-wasm || wants clippy || wants test; } \
  && need cargo "install rustup (brew install rustup); web/rust-toolchain.toml pins the rest"
wants build && need trunk "brew install trunk (0.21)"
wants size && need brotli "brew install brotli"
wants smoke && need node "brew install node"

TMP=$(mktemp -d)
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
START=$SECONDS

# Run "$@" in web/, quietly. On failure show the tail of its output: cargo and trunk put the
# error at the end. Exit codes decide, not warnings: the "proc-macro-error2 v2.0.1 ...
# future-incompat" note that every cargo run prints is a dependency notice, not a failure.
run() {
  local name="$1" t0=$SECONDS; shift
  if ( cd web && "$@" ) >"$TMP/log" 2>&1; then
    pass "$name ($((SECONDS - t0))s)"
  else
    tail -60 "$TMP/log"
    fail "$name" "the output above is the end of: (cd web && $*)"
  fi
}

# --- Rule 1: formatting, lints for both targets, tests ----------------------------------------
# Both clippy runs, because the crate is two programs: wasm32 is what ships, and the host
# target is what `cargo test` compiles. Code behind cfg(target_arch) is only linted by one.
wants fmt && run "cargo fmt --check" cargo fmt --check
wants clippy-wasm && run "cargo clippy (wasm32) -D warnings" \
  cargo clippy --all-targets --target wasm32-unknown-unknown -- -D warnings
wants clippy && run "cargo clippy (host) -D warnings" cargo clippy --all-targets -- -D warnings
wants test && run "cargo test" cargo test

# --- Fixtures: the app's offline data still matches what the backend would serve -------------
# web/fixtures is generated from the backend's seed through the real clean(); --check names any
# file that drifted. ddb.ts imports the AWS SDK (it never sends a command here), so this needs
# backend/src/node_modules (cd backend/src && npm ci).
if wants fixtures; then
  if [ ! -d backend/src/node_modules ]; then
    skip "fixtures check: no backend/src/node_modules (cd backend/src && npm ci)"
  elif node --experimental-strip-types --no-warnings web/tests/fixtures.mjs --check >"$TMP/fixtures.log" 2>&1; then
    pass "fixtures match the backend seed ($(sed -n 's/^Checked \([0-9]*\).*/\1/p' "$TMP/fixtures.log") files)"
  else
    cat "$TMP/fixtures.log"
    fail "fixtures" "regenerate with: node --experimental-strip-types web/tests/fixtures.mjs"
  fi
fi

# --- Rule 2: release build and size budget ----------------------------------------------------
wants build && run "trunk build --release" trunk build --release

if wants size; then
  [ -d "$DIST" ] || fail "size budget" "no $DIST - run the build step first (scripts/web-checks.sh --steps build,size)"
  # Exactly one .wasm: none means no build; two means output from two builds is mixed, and
  # the total would describe neither.
  wasm_count=$(find "$DIST" -maxdepth 1 -type f -name '*.wasm' | wc -l | tr -d ' ')
  [ "$wasm_count" -eq 1 ] || fail "size budget" "expected one .wasm at the root of $DIST, found $wasm_count - rebuild"
  total=0
  while IFS= read -r -d '' f; do
    bytes=$(brotli -q 11 -c "$f" | wc -c | tr -d ' ')
    total=$((total + bytes))
    printf '       %9d  %s\n' "$bytes" "${f#"$DIST"/}"
  done < <( { find "$DIST" -maxdepth 1 -type f \( -name '*.wasm' -o -name '*.js' \) -print0
              [ -d "$DIST/snippets" ] && find "$DIST/snippets" -type f -print0; } )
  printf '       %9d  total, brotli -q 11 (budget %d)\n' "$total" "$SIZE_BUDGET_BYTES"
  if [ "$total" -gt "$SIZE_BUDGET_BYTES" ]; then
    fail "size budget" "$total bytes is over the $SIZE_BUDGET_BYTES-byte first-load budget (docs/WASM_PLAN.md section 5)"
  fi
  pass "size budget: $total of $SIZE_BUDGET_BYTES bytes brotli ($((total * 100 / SIZE_BUDGET_BYTES))%)"
fi

# --- Smoke test: the release build in a real browser ------------------------------------------
# Catches what compiles but does not run: a panic at start-up, a missing asset, a route that
# renders nothing. Served by web/tests/serve.mjs on 127.0.0.1 only, stopped on any exit.
if wants smoke; then
  if [ ! -d "$PW_DIR/node_modules/playwright" ] || [ ! -d "$PW_DIR/browsers" ]; then
    skip "smoke test: no Playwright in $PW_DIR. Install it once with:"
    echo "         npm i --prefix \"$PW_DIR\" playwright@1 &&"
    echo "         PLAYWRIGHT_BROWSERS_PATH=\"$PW_DIR/browsers\" \"$PW_DIR/node_modules/.bin/playwright\" install chromium-headless-shell"
    echo "         (or set CAPYWEB_PW_DIR to an existing install)"
  else
    [ -f "$DIST/index.html" ] || fail "smoke test" "no $DIST/index.html - run the build step first"
    t0=$SECONDS
    node web/tests/serve.mjs "$DIST" "$SMOKE_PORT" >"$TMP/serve.log" 2>&1 &
    SERVER_PID=$!
    for _ in $(seq 100); do
      grep -q '^listening' "$TMP/serve.log" && break
      kill -0 "$SERVER_PID" 2>/dev/null || { SERVER_PID=""; cat "$TMP/serve.log"
        fail "smoke test" "the static server did not start (set CAPYWEB_SMOKE_PORT to use another port)"; }
      sleep 0.1
    done
    grep -q '^listening' "$TMP/serve.log" || fail "smoke test" "the static server did not report listening within 10 s"
    if BASE="http://127.0.0.1:$SMOKE_PORT" NODE_PATH="$PW_DIR/node_modules" \
         PLAYWRIGHT_BROWSERS_PATH="$PW_DIR/browsers" node web/tests/smoke.mjs >"$TMP/smoke.log" 2>&1 \
       && grep -q '^smoke: ok' "$TMP/smoke.log"; then
      pass "smoke: ok (headless Chromium against $DIST, $((SECONDS - t0))s)"
    else
      tail -40 "$TMP/smoke.log"
      fail "smoke test" "web/tests/smoke.mjs failed against http://127.0.0.1:$SMOKE_PORT"
    fi
  fi
fi

printf '\n\033[32mweb checks passed\033[0m in %ds\n' "$((SECONDS - START))"
