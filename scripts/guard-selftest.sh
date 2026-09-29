#!/bin/bash
# Prove every guard rule actually fires. A guard that only ever passes is untrustworthy.
#
# Copies the repo to a scratch dir, introduces one violation at a time, and asserts the
# guard fails with the expected message. Never touches the real working tree.
# The WASM rules also get a passing case each, and scripts/web-checks.sh (the pre-push build
# checks) is tested the same way. Its cargo cases compile the crate: ~2 minutes on the first
# run, well under a minute after that.
#
#   scripts/guard-selftest.sh
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# web/target (gigabytes) and web/dist are build output; copying them into every sandbox would
# make each case take minutes. The cargo cases get their own target dir instead (below).
rsync -a --exclude node_modules --exclude .git --exclude .aws-sam --exclude /web/target \
      --exclude /web/dist --exclude /.claude \
      --exclude '.beads/embeddeddolt' --exclude '.beads/proxieddb' "$ROOT/" "$WORK/"
# The behavioural playback check imports the real module, so it needs the installed SDK.
mkdir -p "$WORK/backend/src"
ln -sfn "$ROOT/backend/src/node_modules" "$WORK/backend/src/node_modules"
# The hooks rule only applies inside a work tree, and beads points hooksPath at .beads/hooks.
( cd "$WORK" && git init -q && git config core.hooksPath .beads/hooks && git add -A ) 2>/dev/null

PASS=0; FAIL=0
# The cargo cases compile the sandbox's copy of the crate. A target dir of their own keeps them
# from overwriting the real build's outputs; it sits under web/target, so it is build output
# too (ignored by git and by every scan), and only the first run is slow.
export CARGO_TARGET_DIR="$ROOT/web/target/guard-selftest"

new_sandbox() {
  local sandbox; sandbox=$(mktemp -d)
  rsync -a "$WORK/" "$sandbox/" 2>/dev/null
  ln -sfn "$ROOT/backend/src/node_modules" "$sandbox/backend/src/node_modules"
  ( cd "$sandbox" && git config core.hooksPath .beads/hooks && git add -A ) 2>/dev/null
  # The cargo cases share one target dir, and cargo's fingerprint for the crate does not
  # depend on where the sandbox is - only on source mtimes, which rsync -a preserves. Without
  # this, a clean sandbox reused the test binary a previous case built with its failing test.
  find "$sandbox/web/src" -type f -exec touch {} + 2>/dev/null
  echo "$sandbox"
}

# $1 = rule name, $2 = expected text in output, $3 = shell that introduces the violation,
# $4 = the check to run (default: the guard)
expect_fail() {
  local name="$1" expect="$2" setup="$3" check="${4:-./scripts/guard.sh}"
  local sandbox; sandbox=$(new_sandbox)
  ( cd "$sandbox" && eval "$setup" ) >/dev/null 2>&1
  local out; out=$( cd "$sandbox" && eval "$check" 2>&1 )
  if [ $? -eq 0 ]; then
    printf '  \033[31mMISS\033[0m %s (check passed but should have failed)\n' "$name"; FAIL=$((FAIL+1))
  elif echo "$out" | grep -qF "$expect"; then
    printf '  \033[32mfires\033[0m %s\n' "$name"; PASS=$((PASS+1))
  else
    printf '  \033[31mWRONG\033[0m %s (failed, but not with "%s")\n' "$name" "$expect"; FAIL=$((FAIL+1))
    echo "$out" | tail -5 | sed 's/^/         /'
  fi
  rm -rf "$sandbox"
}

# The other half: a rule that fires on everything is as useless as one that never does.
# $1 = case name, $2 = text the passing output must contain, $3 = setup, $4 = check
expect_pass() {
  local name="$1" expect="$2" setup="$3" check="${4:-./scripts/guard.sh}"
  local sandbox; sandbox=$(new_sandbox)
  ( cd "$sandbox" && eval "$setup" ) >/dev/null 2>&1
  local out; out=$( cd "$sandbox" && eval "$check" 2>&1 )
  if [ $? -ne 0 ]; then
    printf '  \033[31mFALSE\033[0m %s (check failed on good input)\n' "$name"; FAIL=$((FAIL+1))
    echo "$out" | grep -E 'FAIL|^[^ ]' | head -5 | sed 's/^/         /'
  elif echo "$out" | grep -qF "$expect"; then
    printf '  \033[32mpasses\033[0m %s\n' "$name"; PASS=$((PASS+1))
  else
    printf '  \033[31mWRONG\033[0m %s (passed, but without "%s")\n' "$name" "$expect"; FAIL=$((FAIL+1))
  fi
  rm -rf "$sandbox"
}

echo "Baseline: the real tree must pass"
if ./scripts/guard.sh >/dev/null 2>&1; then
  printf '  \033[32mok\033[0m   clean tree passes\n'; PASS=$((PASS+1))
else
  printf '  \033[31mFAIL\033[0m clean tree does not pass\n'; FAIL=$((FAIL+1))
fi

echo "Each rule must fire on a real violation"
expect_fail "VPC / NAT Gateway" "no Lambda in a VPC" \
  "printf '      VpcConfig:\n        SubnetIds: [subnet-1]\n' >> infra/backend/template.yaml"
expect_fail "provisioned capacity" "no provisioned capacity" \
  "printf '      ProvisionedThroughput:\n        ReadCapacityUnits: 5\n' >> infra/backend/template.yaml"
expect_fail "DynamoDB ceiling" "throughput ceiling" \
  "sed -i.bak 's/OnDemandThroughput/RemovedCeiling/g' infra/backend/template.yaml"
expect_fail "log retention" "log retention on every function" \
  "sed -i.bak 's/RetentionInDays: 14/Retention_removed: 14/g' infra/backend/template.yaml"
expect_fail "direct S3 URL" "no direct S3 URLs" \
  "echo 'const v = \"https://bucket.s3.ap-southeast-1.amazonaws.com/x.mp4\";' > backend/src/leak.ts"
expect_fail "DynamoDB Scan" "no DynamoDB Scan" \
  "echo 'import { ScanCommand } from \"@aws-sdk/lib-dynamodb\";' > backend/src/scan.ts"
expect_fail "playback locators (gutted clean)" "playback locators stripped" \
  "sed -i.bak 's/if (INTERNAL.has(name)) return true;/return false;/' backend/src/lib/ddb.ts"
expect_fail "playback locators (new field name)" "playback locators stripped" \
  "sed -i.bak 's/playback|hls/NOMATCH|hls/' backend/src/lib/ddb.ts"
expect_fail "hardcoded secret" "no hardcoded secrets" \
  "echo 'const api_key = \"abcdef0123456789abcdef0123456789\";' > backend/src/oops.ts"
# The review demonstrated these three bypasses; each must now fire.
expect_fail "secret behind a process.env fallback" "no hardcoded secrets" \
  "echo 'const apiKey = process.env.LIVEPEER_KEY || \"dGhpcyBpcyBhIGZha2Ugc2VjcmV0IGtleSAxMjM0NTY3\";' > backend/src/oops.ts"
expect_fail "base64-padded secret" "no hardcoded secrets" \
  "echo 'const secret = \"wJalrXUtnFEMI/K7MDENG/bPxRfiCYzzzzzzzzzz=\";' > backend/src/oops.ts"
expect_fail "camelCase secret name" "no hardcoded secrets" \
  "echo 'const clientSecret = \"abcdef0123456789abcdef0123456789\";' > backend/src/oops.ts"
expect_fail "secret outside backend/ (demo, amplify, shell)" "no hardcoded secrets" \
  "echo 'const apiKey = \"abcdef0123456789abcdef0123456789\";' > demo/oops.js"
# Root-level files, and a credential in a URL's query string (2026-09-30). A hit shows where,
# never the value: each check exits 0 (a MISS) if the value reaches the output.
NOSHOW='out=$(./scripts/guard.sh 2>&1); rc=$?; echo "$out" | grep -q Zq9Xw8Vu7EXAMPLE5Po4Nm3Lk2 && { echo VALUE PRINTED; exit 0; }; echo "$out"; exit $rc'
expect_fail "secret in a root-level config file" "(value not shown)" \
  "echo 'export const apiKey = \"Zq9Xw8Vu7EXAMPLE5Po4Nm3Lk2Jh1Gf0\";' >> vite.config.ts" "$NOSHOW"
expect_fail "token in a URL query, root-level file" "no hardcoded secrets" \
  "echo 'curl \"https://hooks.example.test/x?id=1&token=Zq9Xw8Vu7EXAMPLE5Po4Nm3Lk2\"' > deploy-hook.sh" "$NOSHOW"
expect_fail "token after an HTML-escaped &amp;, under demo/" "no hardcoded secrets" \
  "echo '<a href=\"https://h.example.test/x?a=1&amp;token=Zq9Xw8Vu7EXAMPLE5Po4Nm3Lk2\">x</a>' > demo/oops.html" "$NOSHOW"
expect_fail "signature in a URL query, under docs/" "no hardcoded secrets" \
  "echo 'see https://b.example.test/o?X-Amz-Signature=Zq9Xw8Vu7EXAMPLE5Po4Nm3Lk2' > docs/oops.md" "$NOSHOW"
expect_fail "the baselined webhook fires without its baseline entry" "amplify.yml:" \
  "sed -i '' '/^secret amplify.yml:/d' scripts/guard-baseline.txt"
expect_fail "GitHub Actions" "no GitHub Actions workflows" \
  "mkdir -p .github/workflows && echo 'name: ci' > .github/workflows/ci.yml"
expect_fail "unpinned npx" "npx must use --no-install" \
  "echo 'npx some-tool' > run.sh"
expect_fail "hooks clobbered (beads block gone)" "hooks intact" \
  "h=\$(git rev-parse --git-path hooks); grep -v 'BEADS INTEGRATION' \"\$h/pre-commit\" > \"\$h/t\" && mv \"\$h/t\" \"\$h/pre-commit\" && chmod +x \"\$h/pre-commit\""

# B4: an unanchored baseline entry for :66 used to swallow a real violation at :660.
expect_fail "baseline must not swallow a nearby line" "no direct S3 URLs" \
  "python3 -c \"
lines = open('src/utils/mockData.ts').read().split(chr(10))
while len(lines) < 665: lines.append('')
lines[659] = 'const leak = \\\"https://other.s3.ap-southeast-1.amazonaws.com/v.mp4\\\";'
open('src/utils/mockData.ts','w').write(chr(10).join(lines))
\""

# --- WASM front end (docs/WASM_PLAN.md section 5, "Checks as local hooks", rules 1-8) --------
# Setup helpers. The setups are eval'd in a subshell inside the sandbox, so these run there.
add_rust() { printf '%s\n' "$@" >> web/src/domain.rs; }
set_trunk_addresses() { ADDR="$1" perl -0pi -e 's/^addresses = [^\n]*/addresses = $ENV{ADDR}/m' web/Trunk.toml; }
# A plausible W12 web mode that keeps all three properties; the bad cases break one each.
deploy_web_good() {
  cat > infra/site/deploy.sh <<'EOF'
#!/bin/bash
# Usage: infra/site/deploy.sh [stage] [source-dir] [--web]
STAGE=${1:-dev}; SRC=${2:-demo}; WEB=0; [ "${3:-}" = "--web" ] && WEB=1
if [ "$WEB" = 1 ]; then
  aws s3 cp "$SRC/" "s3://$BUCKET/" --recursive --exclude "*" --include "*.wasm" \
    --content-type application/wasm --cache-control "public,max-age=31536000,immutable"
  aws s3 cp "$SRC/" "s3://$BUCKET/" --recursive --exclude "*" --include "*-*.js" --include "snippets/*" \
    --cache-control "public,max-age=31536000,immutable"
fi
aws s3 sync "$SRC/" "s3://$BUCKET/" --delete --exclude "*.wasm" --exclude "*-*.js" --exclude "index.html" \
  --exclude "assets/*" --cache-control "public,max-age=300"
aws s3 sync "$SRC/assets/" "s3://$BUCKET/assets/" --delete --cache-control "public,max-age=86400"
aws s3 cp "s3://$BUCKET/" "s3://$BUCKET/" --recursive --exclude "index.html" --exclude "*.wasm" \
  --metadata-directive REPLACE --cache-control "public,max-age=300"
EOF
}
# Rewrites infra/site/headers-dev.json: $1 = a python expression on c (the SecurityHeadersConfig).
headers_edit() {
  python3 - "$1" <<'PY'
import json, sys
p = "infra/site/headers-dev.json"
d = json.load(open(p)); c = d["SecurityHeadersConfig"]
csp = c["ContentSecurityPolicy"]
exec(sys.argv[1])
json.dump(d, open(p, "w"), indent=2)
PY
}
# Fake release output of a given size: random bytes do not compress, so N bytes stay ~N.
fake_dist() { mkdir -p big/snippets/s; head -c "$1" /dev/urandom > big/app_bg.wasm; head -c "${2:-10}" /dev/urandom > big/app.js
              head -c "${3:-10}" /dev/urandom > big/snippets/s/shim.js; }
# Commits for the pre-push cases. hooksPath=/dev/null: the beads hooks must not run here.
commit_all() { git add -A && git -c core.hooksPath=/dev/null -c user.name=selftest -c user.email=selftest@invalid \
                 -c commit.gpgsign=false commit -q --no-verify -m "$1"; }
WC=./scripts/web-checks.sh
# git's pre-push stdin for pushing HEAD over <remote sha> ($1 = remote sha expression or zeros)
PUSH_LINE='printf "refs/heads/main %s refs/heads/main %s\n" "$(git rev-parse HEAD)"'

echo "WASM front end: rule 1 (pre-push fmt, clippy on both targets, tests)"
expect_fail "rule 1: cargo fmt" "cargo fmt --check" \
  "printf 'pub fn   badly_formatted( ) {}\n' >> web/src/lib.rs" "$WC --steps fmt"
# cfg-gated code is linted by one target only; each case proves its run really happens.
expect_fail "rule 1: clippy wasm32 (wasm-only code)" "cargo clippy (wasm32, webmcp)" \
  "printf '#[cfg(target_arch = \"wasm32\")]\npub fn selftest_lint(v: &[u8]) -> bool {\n    v.len() == 0\n}\n' >> web/src/lib.rs" \
  "$WC --steps clippy-wasm"
expect_fail "rule 1: clippy host (host-only code)" "cargo clippy (host)" \
  "printf '#[cfg(not(target_arch = \"wasm32\"))]\npub fn selftest_lint(v: &[u8]) -> bool {\n    v.len() == 0\n}\n' >> web/src/lib.rs" \
  "$WC --steps clippy"
expect_fail "rule 1: cargo test" "cargo test" \
  "printf '#[test]\nfn selftest_fails() {\n    assert_eq!(1 + 1, 3);\n}\n' >> web/src/lib.rs" "$WC --steps test"
expect_pass "rule 1: the clean crate passes all four" "cargo test" "" \
  "$WC --steps fmt,clippy-wasm,clippy,test"

echo "WASM front end: fixtures generated from the backend seed"
expect_fail "fixtures: a hand-edited fixture" "web/fixtures/capybaras.json" \
  "sed -i '' 's/\"Magnus\"/\"Magnos\"/' web/fixtures/capybaras.json" "$WC --steps fixtures"
expect_fail "fixtures: a seed change without regenerating" "web/fixtures/nfts/capy-1234.json" \
  "sed -i '' 's/price: 5, is_for_sale: 1/price: 9, is_for_sale: 1/' backend/src/scripts/seed-data.ts" "$WC --steps fixtures"
expect_pass "fixtures: the committed fixtures match" "fixtures match the backend seed" "" "$WC --steps fixtures"

echo "WASM front end: rule 2 (size budget, brotli -q 11)"
expect_fail "rule 2: .wasm over 350,000 bytes" "over the 350000-byte" "fake_dist 360000" "$WC --steps size --dist big"
expect_fail "rule 2: root .js counts" "over the 350000-byte" "fake_dist 340000 20000" "$WC --steps size --dist big"
expect_fail "rule 2: snippets count" "over the 350000-byte" "fake_dist 340000 10 20000" "$WC --steps size --dist big"
expect_fail "rule 2: output of two builds mixed" "expected one .wasm" \
  "fake_dist 1000 && cp big/app_bg.wasm big/old_bg.wasm" "$WC --steps size --dist big"
expect_pass "rule 2: under budget" "size budget: " "fake_dist 1000" "$WC --steps size --dist big"

echo "WASM front end: pre-push runs rules 1-2 only when the push changes web/ or the fixture sources"
# An oversized fake dist makes "the checks ran" visible as a size failure, without a build.
expect_pass "pre-push: push without web/ changes skips" "skipped: web checks" \
  'commit_all base && echo x >> docs/WASM_PLAN.md && commit_all docs && fake_dist 360000' \
  "$PUSH_LINE \"\$(git rev-parse HEAD~1)\" | $WC --pre-push origin --steps size --dist big"
expect_fail "pre-push: push with web/ changes runs" "over the 350000-byte" \
  'commit_all base && echo x >> web/tests/smoke.mjs && commit_all web && fake_dist 360000' \
  "$PUSH_LINE \"\$(git rev-parse HEAD~1)\" | $WC --pre-push origin --steps size --dist big"
expect_fail "pre-push: push changing only the fixture sources runs" "over the 350000-byte" \
  'commit_all base && echo "// x" >> backend/src/scripts/seed-data.ts && commit_all seed && fake_dist 360000' \
  "$PUSH_LINE \"\$(git rev-parse HEAD~1)\" | $WC --pre-push origin --steps size --dist big"
expect_fail "pre-push: new branch runs" "over the 350000-byte" \
  'commit_all base && fake_dist 360000' \
  "$PUSH_LINE 0000000000000000000000000000000000000000 | $WC --pre-push origin --steps size --dist big"
expect_fail "pre-push: stdin already consumed, no upstream: runs" "over the 350000-byte" \
  'commit_all base && fake_dist 360000' "$WC --pre-push origin --steps size --dist big </dev/null"
expect_pass "pre-push: deleting a remote branch skips" "skipped: web checks" \
  'commit_all base && fake_dist 360000' \
  "printf '(delete) 0000000000000000000000000000000000000000 refs/heads/old %s\n' \"\$(git rev-parse HEAD)\" | $WC --pre-push origin --steps size --dist big"

echo "WASM front end: rule 3 (content scans cover web/, skip build output)"
expect_fail "rule 3: S3 URL in web/*.rs" "no direct S3 URLs" \
  "echo 'pub const V: &str = \"https://bucket.s3.ap-southeast-1.amazonaws.com/x.mp4\";' > web/src/leak.rs"
expect_fail "rule 3: secret in web/*.rs" "no hardcoded secrets" \
  "echo 'pub const API_KEY: &str = \"abcdef0123456789abcdef0123456789\";' > web/src/oops.rs"
expect_fail "rule 3: secret in web/*.toml" "no hardcoded secrets" \
  "echo 'api_key = \"abcdef0123456789abcdef0123456789\"' >> web/Trunk.toml"
# ES-module tooling (web/tests/*.mjs, tailwind.config.cjs) is authored code too; review
# rv-1790663637-53030 put an S3 URL and a key id in an .mjs and every scan passed.
expect_fail "rule 3: S3 URL in web/*.mjs" "no direct S3 URLs" \
  "echo 'export const V = \"https://bucket.s3.ap-southeast-1.amazonaws.com/x.mp4\";' > web/tests/leak.mjs"
expect_fail "rule 3: secret in web/*.cjs" "no hardcoded secrets" \
  "echo 'module.exports = { apiKey: \"abcdef0123456789abcdef0123456789\" };' > web/oops.cjs"
expect_fail "rule 3: AWS key id in an .mjs" "no hardcoded secrets" \
  "printf 'const k = \"%s%s\";\\n' AKIA IOSFODNN7EXAMPL1 > web/tests/k.mjs"  # split: history scan
expect_pass "rule 3: web/target and web/dist are not scanned" "no direct S3 URLs" \
  "mkdir -p web/target/x web/dist && echo 'const V = \"https://b.s3.ap-southeast-1.amazonaws.com/x.mp4\"; const API_KEY = \"abcdef0123456789abcdef0123456789\";' | tee web/target/x/gen.rs > web/dist/app.js"

echo "WASM front end: rule 4 (no playback-locator field in web/src/domain.rs)"
expect_fail "rule 4: snake_case field" "no playback-locator field" \
  "add_rust 'pub struct Leak {' '    pub playback_id: String,' '}'"
expect_fail "rule 4: camelCase field (normalised first)" "no playback-locator field" \
  "add_rust '#[allow(non_snake_case)]' 'pub struct Leak {' '    pub streamUrl: String,' '}'"
expect_fail "rule 4: serde rename" "no playback-locator field" \
  "add_rust 'pub struct Leak {' '    #[serde(rename = \"playbackId\")]' '    pub source: String,' '}'"
expect_fail "rule 4: enum struct variant" "no playback-locator field" \
  "add_rust 'pub enum Leak {' '    Hls { video_src: String },' '}'"
# A const or static named like a locator would bake one into the public .wasm (review
# rv-1790663637-53030 found these, and type aliases, passing).
expect_fail "rule 4: const" "no playback-locator field" \
  "add_rust 'pub const PLAYBACK_URL: &str = \"x\";'"
expect_fail "rule 4: static" "no playback-locator field" \
  "add_rust 'pub static HLS_SRC: &str = \"x\";'"
expect_fail "rule 4: type alias (camelCase)" "no playback-locator field" \
  "add_rust 'pub type VideoAddress = String;'"
expect_fail "rule 4: fn" "no playback-locator field" \
  "add_rust 'pub fn stream_url() -> String { String::new() }'"
# The pattern is read from ddb.ts, not copied: a term added there is enforced here at once...
expect_fail "rule 4: follows ddb.ts (no drifting copy)" "no playback-locator field" \
  "sed -i.bak 's/(playback|hls/(playback|capyleak|hls/' backend/src/lib/ddb.ts && add_rust 'pub struct S {' '    pub capyleak: String,' '}'"
# ...and a declaration it can no longer find fails loudly instead of checking nothing.
expect_fail "rule 4: ddb.ts pattern unreadable" "could not read 'const PLAYBACK_NAME" \
  "sed -i.bak 's/const PLAYBACK_NAME =/const PLAYBACK_PATTERN =/' backend/src/lib/ddb.ts"
expect_pass "rule 4: honest fields and comments pass" "no playback-locator field" \
  "add_rust '/// never a playback_url or stream_url here' 'pub struct Fine {' '    pub stream_count: u32,' '    pub title: String,' '}' 'pub const MAX_STREAMS: usize = 3;' 'pub fn stream_title() -> String { String::new() }'"

echo "WASM front end: rule 5 (dev servers on loopback only)"
expect_fail "rule 5: vite host: true" "dev servers bind loopback only" \
  "sed -i.bak \"s/host: '127.0.0.1'/host: true/\" vite.config.ts"
expect_fail "rule 5: vite --host with no address" "dev servers bind loopback only" \
  "sed -i.bak 's/\"dev\": \"vite\"/\"dev\": \"vite --host\"/' package.json"
expect_fail "rule 5: Trunk on 0.0.0.0" "dev servers bind loopback only" "set_trunk_addresses '[\"0.0.0.0\"]'"
expect_fail "rule 5: Trunk on the IPv6 wildcard" "dev servers bind loopback only" "set_trunk_addresses '[\"::\"]'"
expect_fail "rule 5: Trunk addresses unset" "dev servers bind loopback only" "sed -i.bak '/^addresses = /d' web/Trunk.toml"
expect_pass "rule 5: 127.0.0.1 and ::1 (multi-line)" "dev servers bind loopback only" \
  "set_trunk_addresses \"\$(printf '[\n  \"127.0.0.1\",  # v4\n  \"::1\",\n]')\""

echo "WASM front end: rule 6 (deploy.sh web mode)"
expect_fail "rule 6: --web without wasm type or immutable" "deploy.sh web mode" \
  "printf '#!/bin/bash\n[ \"\${3:-}\" = --web ] && WEB=1\naws s3 sync web/dist s3://b/ --exclude \"*.wasm\" --cache-control public,max-age=300\n' > infra/site/deploy.sh"
expect_fail "rule 6: --delete on the immutable upload" "delete-on-the-hashed-upload" \
  "deploy_web_good && sed -i.bak 's/--content-type application\\/wasm/--delete --content-type application\\/wasm/' infra/site/deploy.sh"
expect_fail "rule 6: demo sync --delete removes old .wasm" "without---exclude-*.wasm" \
  "deploy_web_good && sed -i.bak 's/--delete --exclude \"\\*.wasm\" /--delete /' infra/site/deploy.sh"
expect_fail "rule 6: max-age=300 re-stamp undoes immutable" "without---exclude-*.wasm" \
  "deploy_web_good && sed -i.bak 's/--exclude \"index.html\" --exclude \"\\*.wasm\"/--exclude \"index.html\"/' infra/site/deploy.sh"
expect_pass "rule 6: a web mode with all three" "deploy.sh web mode: application/wasm" "deploy_web_good"
expect_pass "rule 6: no web mode: says it skipped" "skipped: deploy.sh has no --web mode yet (W12, capyweb-b6e.12)" \
  "printf '#!/bin/bash\n# a --web flag named only in a comment is not a web mode\naws s3 sync demo/ s3://b/ --delete\n' > infra/site/deploy.sh"

echo "WASM front end: rule 7 (no GitHub Actions) is the \"GitHub Actions\" case above"

echo "WASM front end: rule 8 (CSP allows 'wasm-unsafe-eval'; HSTS never preloaded)"
expect_fail "rule 8: CSP without it" "script-src lacks 'wasm-unsafe-eval'" \
  "headers_edit \"csp['ContentSecurityPolicy'] = csp['ContentSecurityPolicy'].replace(\\\" 'wasm-unsafe-eval'\\\", '')\""
expect_fail "rule 8: only in another directive" "script-src lacks 'wasm-unsafe-eval'" \
  "headers_edit \"csp['ContentSecurityPolicy'] = csp['ContentSecurityPolicy'].replace(\\\" 'wasm-unsafe-eval'\\\", '').replace(\\\"style-src 'self'\\\", \\\"style-src 'self' 'wasm-unsafe-eval'\\\")\""
expect_fail "rule 8: HSTS preload" "HSTS has includeSubDomains or preload" \
  "headers_edit \"c['StrictTransportSecurity']['Preload'] = True\""
expect_pass "rule 8: the configs as written" "headers-dev.json: CSP allows 'wasm-unsafe-eval'; HSTS without includeSubDomains or preload" ":"
expect_pass "rule 8: no headers config yet, says it skipped" \
  "skipped: no infra/site/headers-<stage>.json yet (W12, capyweb-b6e.12)" "rm -f infra/site/headers-*.json"

echo "Smoke-test server (web/tests/serve.mjs)"
# Loopback only, SPA fallback for page paths, 404 for missing files, wasm type, busy port.
serve_probe() {
  mkdir -p probe && echo '<p>app</p>' > probe/index.html && printf 'asm' > probe/a.wasm
  cat > probe.mjs <<'EOF'
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const port = 8793, base = `http://127.0.0.1:${port}`;
const start = () => { const p = spawn('node', ['web/tests/serve.mjs', 'probe', String(port)]); p.out = '';
  p.stdout.on('data', (d) => (p.out += d)); p.stderr.on('data', (d) => (p.out += d)); return p; };
const a = start();
const check = (ok, what) => { if (!ok) { console.error('serve: ' + what + '\n' + a.out); a.kill(); process.exit(1); } };
for (let i = 0; !a.out.includes('listening'); i++) {
  check(i < 100 && a.exitCode === null, 'server did not start');
  await new Promise((r) => setTimeout(r, 50));
}
check(a.out.includes('listening http://127.0.0.1:'), 'binds 127.0.0.1');
const deep = await fetch(`${base}/stream/magnus`);
check(deep.status === 200 && (await deep.text()).includes('app'), 'deep link falls back to index.html');
check((await fetch(`${base}/missing.wasm`)).status === 404, 'missing file with an extension is 404');
check((await fetch(`${base}/a.wasm`)).headers.get('content-type') === 'application/wasm', 'wasm type');
const b = start(); const [code] = await once(b, 'exit');
check(code !== 0 && b.out.includes('already in use'), 'refuses a busy port');
a.kill(); console.log('serve ok'); process.exit(0);
EOF
  node probe.mjs
}
expect_pass "serve.mjs: loopback, SPA fallback, 404, wasm type, busy port" "serve ok" "" "serve_probe"

printf '\n%d as expected, %d wrong\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
