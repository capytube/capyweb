#!/bin/bash
# Prove every check of scripts/build-release.sh fires: a check that only ever passes is not one.
#
#   scripts/build-release-selftest.sh [<prod-out-dir>]
#
# Each case copies a clean output, plants one fault, and expects `build-release.sh --check` to
# fail with the expected message. With a real prod build (scripts/build-release.sh prod <dir>)
# the cases run on a copy of it; without one, on a small stand-in with the same layout, so the
# test needs no build. Never touches the directory it is given.
set -uo pipefail
cd "$(dirname "$0")/.."
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
CHECK=scripts/build-release.sh

if [ -n "${1:-}" ]; then
  [ -f "$1/index.html" ] || { echo "build-release-selftest: $1 is not a build output" >&2; exit 2; }
  rsync -a "$1/" "$WORK/clean/"
  printf '\033[1mbuild-release checks, on a copy of %s\033[0m\n' "$1"
else
  # A stand-in prod output: an external boot script with a matching integrity, glue, a snippet
  # and a .wasm without any tool name.
  mkdir -p "$WORK/clean/snippets/capyweb-web-0123456789abcdef/js"
  printf "import init from '/capyweb-web-0123456789abcdef.js';\nawait init();\n" >"$WORK/clean/boot-0123456789abcdef.js"
  printf "import { a } from './snippets/capyweb-web-0123456789abcdef/js/auth.js';\n" >"$WORK/clean/capyweb-web-0123456789abcdef.js"
  printf 'export const a = 1;\n' >"$WORK/clean/snippets/capyweb-web-0123456789abcdef/js/auth.js"
  printf '\0asm\1\0\0\0list_capybaras open_page' >"$WORK/clean/capyweb-web-0123456789abcdef_bg.wasm"
  sri=$(openssl dgst -sha384 -binary "$WORK/clean/boot-0123456789abcdef.js" | openssl base64 -A)
  cat >"$WORK/clean/index.html" <<EOF
<!DOCTYPE html><html><head><title>CapyTube</title>
<script type="module" src="/boot-0123456789abcdef.js" integrity="sha384-$sri"></script>
</head><body></body></html>
EOF
  printf '\033[1mbuild-release checks, on a stand-in prod output\033[0m\n'
fi

PASS=0; FAIL=0
# $1 = case name, $2 = expected text, $3 = shell run in the copy to plant the fault,
# $4 = stage to check as (default prod)
expect_fail() {
  local name="$1" expect="$2" setup="$3" stage="${4:-prod}" dir out
  dir=$(mktemp -d "$WORK/case.XXXX"); rsync -a "$WORK/clean/" "$dir/"
  ( cd "$dir" && eval "$setup" ) || { printf '  \033[31mSETUP\033[0m %s\n' "$name"; FAIL=$((FAIL+1)); return; }
  if out=$("$CHECK" --check "$dir" "$stage" 2>&1); then
    printf '  \033[31mMISS\033[0m  %s (check passed but should have failed)\n' "$name"; FAIL=$((FAIL+1))
  elif echo "$out" | grep -qF "$expect"; then
    printf '  \033[32mfires\033[0m %s\n' "$name"; PASS=$((PASS+1))
  else
    printf '  \033[31mWRONG\033[0m %s (failed, but not with "%s")\n' "$name" "$expect"; FAIL=$((FAIL+1))
    echo "$out" | tail -3 | sed 's/^/         /'
  fi
}
expect_pass() {
  local name="$1" setup="$2" stage="${3:-prod}" dir out
  dir=$(mktemp -d "$WORK/case.XXXX"); rsync -a "$WORK/clean/" "$dir/"
  ( cd "$dir" && eval "$setup" )
  if out=$("$CHECK" --check "$dir" "$stage" 2>&1); then
    printf '  \033[32mpasses\033[0m %s\n' "$name"; PASS=$((PASS+1))
  else
    printf '  \033[31mFAILS\033[0m %s (should pass)\n' "$name"; FAIL=$((FAIL+1))
    echo "$out" | tail -3 | sed 's/^/         /'
  fi
}

expect_pass "clean output (prod)" ":"
expect_pass "clean output (dev)" ":" dev
expect_fail "prod: a planted snippets/x/webmcp.js" "prod output has WebMCP files: snippets/x/webmcp.js" \
  "mkdir -p snippets/x && echo 'export const t = 1;' > snippets/x/webmcp.js"
expect_pass "dev: WebMCP files are allowed" \
  "mkdir -p snippets/x && echo 'export const t = 1;' > snippets/x/webmcp.js" dev
expect_fail "prod: a WebMCP directory" "prod output has WebMCP files" "mkdir -p assets/WebMCP && touch assets/WebMCP/a.txt"
expect_fail "prod: glue that imports webmcp" "prod output imports WebMCP" \
  "echo \"import { w } from './snippets/y/js/tools-webmcp-bridge.mjs';\" >> \$(ls capyweb-web-*.js | grep -v _bg | head -1)"
expect_fail "prod: a dynamic import of webmcp" "prod output imports WebMCP" \
  "echo \"const m = await import('./snippets/y/js/webmcp.js');\" > extra.js"
expect_fail "prod: index.html preloads webmcp" "prod index.html names WebMCP" \
  "sed -i.bak 's|</head>|<link rel=\"modulepreload\" href=\"/snippets/z/js/WebMCP-x.js\"></head>|' index.html && rm index.html.bak"
for tool in cast_vote list_streams get_my_account; do
  expect_fail "prod: tool name $tool in the .wasm" "contains the WebMCP tool name $tool" \
    "printf '\\0$tool\\0' >> \$(ls *.wasm | head -1)"
done
expect_fail "inline script (prod)" "inline script(s), which the CSP blocks" \
  "sed -i.bak 's|</head>|<script>window.x = 1</script></head>|' index.html && rm index.html.bak"
expect_fail "inline script (dev)" "inline script(s), which the CSP blocks" \
  "sed -i.bak 's|</head>|<script type=\"module\">import \"/a.js\";</script></head>|' index.html && rm index.html.bak" dev
expect_fail "boot script changed after its integrity was taken" "does not match the file" \
  "echo '// changed' >> \$(ls boot-*.js | head -1)"
expect_fail "fixtures left in the output" "fixtures is in the output" "mkdir fixtures && echo '{}' > fixtures/streams.json"

printf '\n%d cases, \033[%sm%d failed\033[0m\n' "$((PASS + FAIL))" "$([ "$FAIL" -eq 0 ] && echo 32 || echo 31)" "$FAIL"
[ "$FAIL" -eq 0 ]
