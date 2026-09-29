#!/bin/bash
# Release build of the WASM front end for one stage (docs/RELEASE_PLAN.md 1a items 3, 5 and 6),
# and the checks that stop a bad one before deploy.
#
#   scripts/build-release.sh <dev|prod> <out-dir>      build into <out-dir>, then check it
#   scripts/build-release.sh --check <dir> <dev|prod>  only check an existing build
#
# Both stages build the same way, with the API on the same origin (CAPYWEB_API_BASE=/api, the
# site's /api/* behaviour; connect-src 'self' covers it). dev adds `--features webmcp`; prod
# leaves the WebMCP tools out until the master's go. The output has no fixtures/, and keeps
# config.json as built ({"auth": null}): the deploy writes the stage's own.
#
# Checks (a failure exits 1 and names the file):
#   both  index.html has no inline script (the CSP's script-src 'self' blocks it) and every
#         integrity attribute matches its file (web/scripts/boot-script.mjs --check);
#         fixtures/ is gone;
#   prod  no file with "webmcp" in its name or path; no .js that imports it; index.html does
#         not name it; the .wasm holds none of the tool names cast_vote, list_streams,
#         get_my_account (a byte search).
# Then the size step of scripts/web-checks.sh measures the output (brotli, first-load budget).
# scripts/build-release-selftest.sh proves each check fires.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

usage() { sed -n '2,20p' "$0" >&2; exit 2; }
die() { printf '\033[31mbuild-release: %s\033[0m\n' "$1" >&2; exit 1; }
ok() { printf '  \033[32mok\033[0m   %s\n' "$1"; }

# The tool names only the webmcp feature compiles in (web/src/webmcp/).
TOOL_NAMES="cast_vote list_streams get_my_account"

check_output() {
  local dir="$1" stage="$2"
  [ -f "$dir/index.html" ] || die "no $dir/index.html: not a build output"
  [ ! -e "$dir/fixtures" ] || die "$dir/fixtures is in the output: the release serves the real API"
  if [ "$stage" = prod ]; then
    local hits
    hits=$(cd "$dir" && find . -ipath '*webmcp*' | sed 's|^\./||')
    [ -z "$hits" ] || die "prod output has WebMCP files: $(echo "$hits" | tr '\n' ' ')"
    hits=$(grep -rlE "(import|from)[[:space:]]*\(?[[:space:]]*['\"][^'\"]*webmcp" "$dir" \
             --include='*.js' --include='*.mjs' 2>/dev/null || true)
    [ -z "$hits" ] || die "prod output imports WebMCP: $(echo "$hits" | tr '\n' ' ')"
    ! grep -qi webmcp "$dir/index.html" || die "prod index.html names WebMCP"
    local wasm found=0
    while IFS= read -r -d '' wasm; do
      found=$((found + 1))
      for name in $TOOL_NAMES; do
        ! LC_ALL=C grep -qaF "$name" "$wasm" || die "prod ${wasm#"$dir"/} contains the WebMCP tool name $name"
      done
    done < <(find "$dir" -type f -name '*.wasm' -print0)
    [ "$found" -gt 0 ] || die "no .wasm in $dir"
    ok "no WebMCP: no file, no import, no tool name in the .wasm ($found checked)"
  fi
  # Last, so a planted WebMCP file is named as such rather than as a changed file.
  node web/scripts/boot-script.mjs --check "$dir" >/dev/null \
    || die "$dir/index.html: inline script or integrity mismatch (see above)"
  ok "no inline script; integrity attributes match"
}

case "${1:-}" in
  --check)
    [ $# -eq 3 ] || usage
    DIR=$2; STAGE=$3
    case "$STAGE" in dev|prod) ;; *) usage ;; esac
    printf '\033[1mChecking %s as %s\033[0m\n' "$DIR" "$STAGE"
    check_output "$DIR" "$STAGE"
    exit 0 ;;
  dev|prod) [ $# -eq 2 ] || usage; STAGE=$1; OUT=$2 ;;
  *) usage ;;
esac

# Trunk replaces the whole dist directory, so refuse anything that is not empty or an earlier
# build: a slip of the argument must not delete a source tree.
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
case "$OUT" in "$ROOT"|"$ROOT/web"|"$HOME"|/) die "refusing to build into $OUT" ;; esac
if [ -n "$(ls -A "$OUT")" ] && [ ! -f "$OUT/index.html" ]; then
  die "$OUT is not empty and holds no earlier build; pick an empty directory"
fi

for d in "$HOME/.cargo/bin" /opt/homebrew/opt/rustup/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done
export PATH
# Trunk 0.21.14 fails with "invalid value '1' for '--no-color'" when NO_COLOR=1 is set.
unset NO_COLOR
# This Mac is a standby machine: a release build must not take every core.
export CARGO_BUILD_JOBS=2
command -v trunk >/dev/null || die "trunk is not installed (brew install trunk)"
command -v node >/dev/null || die "node is not installed (the boot-script hook needs it)"

# wasm-bindgen never deletes stale snippets and Trunk copies the whole folder: a build without
# the feature once shipped js/webmcp.js left over from an earlier dev build.
rm -rf web/target/wasm-bindgen

FEATURES=()
[ "$STAGE" = dev ] && FEATURES=(--features webmcp)
printf '\033[1mRelease build for %s into %s\033[0m\n' "$STAGE" "$OUT"
t0=$SECONDS
LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT
if ! ( cd web && CAPYWEB_API_BASE=/api trunk build --release ${FEATURES[@]+"${FEATURES[@]}"} --dist "$OUT" ) >"$LOG" 2>&1; then
  tail -40 "$LOG"
  die "trunk build failed"
fi
ok "trunk build --release${FEATURES[*]:+ ${FEATURES[*]}} with CAPYWEB_API_BASE=/api ($((SECONDS - t0))s)"
rm -rf "$OUT/fixtures"

check_output "$OUT" "$STAGE"
scripts/web-checks.sh --steps size --dist "$OUT"
printf '\033[32mrelease build for %s is ready in %s\033[0m\n' "$STAGE" "$OUT"
