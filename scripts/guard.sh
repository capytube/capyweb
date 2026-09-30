#!/bin/bash
# capyweb guard: the five ways this project's AWS bill gets blown, as checks.
#
# The budget is $10/month at ~100 customers (docs/PLAN.md section 3). Choosing serverless
# does not by itself keep it there - each rule below is a specific, previously-hit way to
# leave that envelope, plus the security rules that must not regress.
#
# Runs locally. NOT GitHub Actions: nic's Actions allowance is exhausted (standing rule,
# docs/AGENT_LEARNINGS.md). Wire it up with: scripts/install-hooks.sh
#
#   scripts/guard.sh          check everything
#   scripts/guard.sh --quiet  only print failures (used by the pre-commit hook)

set -uo pipefail
cd "$(dirname "$0")/.."

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

FAILED=0
TEMPLATES=$(find infra \( -name '*.yaml' -o -name '*.yml' \) -not -path '*/node_modules/*' 2>/dev/null)

pass() { [ "$QUIET" -eq 1 ] || printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ -n "${2:-}" ] && printf '       %s\n' "$2"; FAILED=1; }
head() { [ "$QUIET" -eq 1 ] || printf '\n\033[1m%s\033[0m\n' "$1"; }
# A rule whose subject does not exist yet (e.g. waits on another task). Says so, never fails.
# The colour wraps the whole line, so "skipped: <reason>" stays greppable as plain text.
skip() { [ "$QUIET" -eq 1 ] || printf '  \033[33mskipped: %s\033[0m\n' "$1"; }

# Known, tracked exceptions. A guard that fails on day one for legacy code gets switched off,
# so pre-existing violations live here with the issue that will clear them. Nothing may be
# added without an issue id.
BASELINE=scripts/guard-baseline.txt

# Drop hits listed in the baseline for THIS rule.
# Entries are "<rule> <file>:<line> <issue> <note>". Matching is anchored on "file:line:" -
# an unanchored "file:66" would also swallow a real violation at line 660.
filter_baseline() {
  local rule="$1"
  if [ ! -f "$BASELINE" ]; then cat; return; fi
  local pats; pats=$(awk -v r="$rule" '$1 == r && $0 !~ /^[[:space:]]*#/ {print "^" $2 ":"}' "$BASELINE")
  if [ -z "$pats" ]; then cat; return; fi
  grep -vE -f <(printf '%s\n' "$pats") || true
}

# Grep that ignores dependencies, build output and this script's own rule list.
src_grep() {
  grep -rnE "$1" --include='*.ts' --include='*.tsx' \
    --exclude-dir=node_modules --exclude-dir=.aws-sam --exclude-dir=dist \
    ${2:-backend/src src} 2>/dev/null | grep -v 'scripts/guard-selftest.sh'
}

head "Cost guards"

# A NAT Gateway is ~$35/month on its own - more than three times the entire budget.
if grep -qE '^[[:space:]]*VpcConfig[[:space:]]*:|AWS::EC2::NatGateway' $TEMPLATES 2>/dev/null; then
  fail "no Lambda in a VPC" "a NAT Gateway is ~\$35/month, over 3x the whole budget"
else
  pass "no Lambda in a VPC (no NAT Gateway)"
fi

# Provisioned capacity bills whether or not anyone visits.
if grep -nE 'ProvisionedThroughput[[:space:]]*:|ProvisionedConcurrencyConfig|AutoPublishAlias' $TEMPLATES 2>/dev/null; then
  fail "no provisioned capacity" "on-demand only; provisioned capacity bills while idle"
else
  pass "no provisioned capacity"
fi

# On-demand without a ceiling has no upper bound on spend.
for t in $TEMPLATES; do
  if grep -q 'AWS::DynamoDB::Table' "$t"; then
    tables=$(grep -cE '^[[:space:]]*BillingMode[[:space:]]*:[[:space:]]*PAY_PER_REQUEST' "$t")
    ceilings=$(grep -cE '^[[:space:]]*OnDemandThroughput[[:space:]]*:' "$t")
    if [ "$tables" -eq 0 ]; then
      fail "DynamoDB on-demand in $t" "every table needs BillingMode: PAY_PER_REQUEST"
    elif [ "$ceilings" -eq 0 ]; then
      fail "DynamoDB throughput ceiling in $t" "add OnDemandThroughput so excess throttles instead of billing"
    else
      pass "DynamoDB on-demand with a throughput ceiling ($t)"
    fi
  fi
done

# Log retention defaults to "never expire"; ingest is the classic serverless sleeper cost.
# Checked per function name, not by comparing counts - a comment or an unrelated log group
# used to balance the totals while a real function's logs never expired. A FunctionName that is a
# reference (!GetAtt, !Ref: a Lambda permission naming its function) is not a function of its own.
missing_retention=""
for fn in $(grep -hE '^[[:space:]]*FunctionName[[:space:]]*:' $TEMPLATES 2>/dev/null \
            | grep -vE 'FunctionName[[:space:]]*:[[:space:]]*(!GetAtt|!Ref|\{)' \
            | sed -E 's/.*FunctionName[[:space:]]*:[[:space:]]*//; s/[[:space:]]*$//'); do
  # The matching AWS::Logs::LogGroup must exist AND carry RetentionInDays.
  if ! awk -v fn="$fn" '
        /LogGroupName[[:space:]]*:/ && index($0, fn) { found = 1 }
        found && /RetentionInDays[[:space:]]*:/ { ok = 1; exit }
        END { exit ok ? 0 : 1 }' $TEMPLATES 2>/dev/null; then
    missing_retention="$missing_retention $fn"
  fi
done
if [ -n "$missing_retention" ]; then
  fail "log retention on every function" "no log group with RetentionInDays for:$missing_retention"
else
  pass "explicit log retention for every function"
fi

# CloudFront's always-free tier covers 1TB/month of egress; S3 direct is ~$0.12/GB.
# web/ (the Rust front end) is scanned too, with *.rs and *.toml: adding the extensions alone
# would have left the crate unscanned (docs/WASM_PLAN.md section 5, rule 3).
# BUILD_OUT_DIRS skips build output in every content scan. grep's --exclude-dir matches a
# directory's base name, so this also covers web/target/ and web/dist/: a release build copies
# fixtures and compiled code there, and each hit would be reported twice (or, in target/, in
# generated code nobody can fix). worktrees/ is .claude/worktrees/: whole temporary checkouts
# for helper agents (gitignored), which made every hit appear once per checkout and failed the
# guard on another branch's half-finished work.
BUILD_OUT_DIRS="--exclude-dir=node_modules --exclude-dir=.aws-sam --exclude-dir=dist --exclude-dir=target --exclude-dir=worktrees"
s3_hits=$(grep -rnE '["'"'"'`][^"'"'"'`]*\.s3[.-][a-z0-9-]*\.amazonaws\.com' \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' \
  --include='*.html' --include='*.css' --include='*.rs' --include='*.toml' $BUILD_OUT_DIRS \
  backend/src src demo amplify web 2>/dev/null \
  | grep -v '\.test\.ts:' | grep -v 'scripts/guard-selftest.sh' | filter_baseline s3-url)
if [ -n "$s3_hits" ]; then
  echo "$s3_hits"
  fail "no direct S3 URLs in application code" "serve media through CloudFront: 1TB/month free vs ~\$0.12/GB"
else
  pass "no direct S3 URLs in application code"
fi

head "Security guards"

# A Scan reads the whole table: unbounded cost and latency that grows with the data.
if src_grep 'ScanCommand|paginateScan'; then
  fail "no DynamoDB Scan" "Query/GetItem only - a Scan's cost grows with the table"
else
  pass "no DynamoDB Scan"
fi

# These are how you WATCH a paid stream; they must never reach an unauthenticated client.
# BEHAVIOURAL: actually calls clean() and asserts the fields are gone. Grepping for a name -
# a variable, or the literal strings - passes for a clean() that does nothing at all.
if [ -d backend/src/node_modules ] && command -v node >/dev/null 2>&1; then
  if node --experimental-strip-types --no-warnings -e '
      import("./backend/src/lib/ddb.ts").then(({ clean }) => {
        const leaky = ["streaming_address","s3_video_address","playback_id","playbackId",
                       "hls_url","m3u8_url","video_url","stream_url","api_key","accessToken"];
        const item = Object.fromEntries(leaky.map(f => [f, "LEAK"]));
        item.id = "keep";
        const out = clean(item);
        const survived = leaky.filter(f => f in out);
        if (survived.length) { console.error("leaked: " + survived.join(" ")); process.exit(1); }
        if (out.id !== "keep") { console.error("clean() dropped a domain field"); process.exit(1); }
      }).catch(e => { console.error(e.message); process.exit(1); });
    ' 2>&1; then
    pass "playback locators and credentials stripped (behavioural check)"
  else
    fail "playback locators stripped from responses" "clean() let a playback locator or credential through"
  fi
else
  pass "playback locator check skipped (backend/src/node_modules absent)"
fi

# A literal AWS key id, or a long blob assigned to a credential-shaped name.
# Scope is every text file we author, not just *.ts under backend/ - demo/, amplify/, shell
# scripts and JSON were all unscanned, and the first two leaked Livepeer keys lived in
# amplify/. The `=` and `.` are in the value charset so padded base64 is not a free pass.
# web/ with *.rs and *.toml joined in the WASM rewrite: a key pasted into the crate would ship
# inside the public .wasm (docs/WASM_PLAN.md section 5, rule 3). *.mjs and *.cjs too: the
# crate's tests and tooling are ES modules (web/tests/*.mjs), and a review found a key id and an
# S3 URL in one passed every scan.
SECRET_SCAN_DIRS="backend infra src demo amplify docs scripts web"
SECRET_FILES="--include=*.ts --include=*.tsx --include=*.js --include=*.mjs --include=*.cjs --include=*.json --include=*.yaml --include=*.yml --include=*.sh --include=*.html --include=*.md --include=*.rs --include=*.toml"
# Exclude only a direct env read, not any line that merely mentions process.env - the
# `process.env.X || "<literal fallback>"` idiom was slipping through.
# Excluded: obvious placeholders, CloudFormation intrinsics, and REFERENCES to a secret
# rather than a secret - secret("NAME"), localStorage.getItem("name"), SSM parameter paths.
# The value-shape rule does the heavy lifting: a literal made only of [A-Za-z0-9_] that
# contains an underscore is a NAME (GOOGLE_CLIENT_SECRET, dynamic_auth_token), whereas real
# keys are hex, base64 or hyphenated UUIDs and contain no underscores.
SECRET_ALLOW='PLACEHOLDER|LEAKCANARY|EXAMPLEKEY|your-|xxxx|!Ref|!Sub|!GetAtt|guard-selftest'
SECRET_ALLOW="$SECRET_ALLOW"'|secret\(|getItem\(|getenv\(|GetParameter|process\.env\[|["'"'"'][A-Za-z0-9]*_[A-Za-z0-9_]*["'"'"'][[:space:]]*[),;]'

# The files at the repo root too (amplify.yml, package.json, index.html, the tool configs): the
# folder list above never reached them.
ROOT_SCAN_FILES=$(find . -maxdepth 1 -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \
  -o -name '*.cjs' -o -name '*.json' -o -name '*.yaml' -o -name '*.yml' -o -name '*.sh' -o -name '*.html' \
  -o -name '*.md' -o -name '*.rs' -o -name '*.toml' \) | sed 's|^\./||' | sort)

akia=$(grep -rnE '(AKIA|ASIA)[A-Z0-9]{16}' $SECRET_FILES $BUILD_OUT_DIRS . 2>/dev/null \
  | grep -vE "$SECRET_ALLOW" | sed 's|^\./||' | filter_baseline secret)
literals=$(grep -rniE '(api_?key|secret|token|password|passphrase|credential)[A-Za-z_]*[[:space:]]*[:=][^"'"'"']{0,60}["'"'"'][A-Za-z0-9/+=._-]{20,}["'"'"']' \
  $SECRET_FILES $BUILD_OUT_DIRS $SECRET_SCAN_DIRS $ROOT_SCAN_FILES 2>/dev/null \
  | grep -vE "$SECRET_ALLOW" | filter_baseline secret)
# A credential in a URL's query string (a webhook or presigned URL): unquoted, so the rule above
# never saw one. "&amp;" too: that is how an HTML attribute writes the "&".
urlcreds=$(grep -rniE '([?&]|&amp;)(token|access_token|api_?key|secret|password|signature|sig|x-amz-signature|x-amz-credential)=[A-Za-z0-9/+._%-]{16,}' \
  $SECRET_FILES $BUILD_OUT_DIRS $SECRET_SCAN_DIRS $ROOT_SCAN_FILES 2>/dev/null \
  | grep -vE "$SECRET_ALLOW" | filter_baseline secret)
if [ -n "$akia" ] || [ -n "$literals" ] || [ -n "$urlcreds" ]; then
  # Where, never what: the value itself must not reach a terminal, a log or a hook's output.
  printf '%s\n' "$akia" "$literals" "$urlcreds" | grep -v '^$' | cut -d: -f1,2 | sed 's/$/: (value not shown)/'
  fail "no hardcoded secrets" "use SSM SecureString and read it at runtime"
else
  pass "no hardcoded secrets (source, templates, scripts, demo, amplify, web, root files)"
fi

# The repo is public, so no real AWS account id (capyweb-manager, 2026-09-30): not in an ARN, at the end
# of a bucket name, after the word "account", or quoted alone. Docs write <account-id>; commands read it
# with `aws sts get-caller-identity`; tests use AWS's documentation examples. Every tracked or new file but
# the self-test, whose cases plant made-up ids on purpose.
acct_hits=$(git grep -I -n -E --untracked \
  'arn:aws[a-z-]*:[a-z0-9-]*:[a-z0-9-]*:[0-9]{12}|capy[a-z0-9-]*-[0-9]{12}([^0-9]|$)|[Aa]ccount[^0-9A-Za-z]{1,4}[0-9]{12}([^0-9]|$)|"[0-9]{12}"' \
  -- . ':!*.lock' ':!*package-lock.json' ':!scripts/guard-selftest.sh' 2>/dev/null \
  | grep -vE '111122223333|123456789012|000000000000')
if [ -n "$acct_hits" ]; then
  printf '%s\n' "$acct_hits" | cut -d: -f1,2 | sed 's/$/: (id not shown)/'
  fail "no AWS account id in the repo" "write <account-id>, or read it with aws sts get-caller-identity"
else
  pass "no AWS account id in the repo"
fi

# The WASM client's types are the API's public shape. A field named like a playback locator
# there means someone expects the API to SEND one - to anyone, since the .wasm is public -
# which is the exact leak clean() in ddb.ts exists to stop. (docs/WASM_PLAN.md section 5, rule 4)
# The pattern is READ from ddb.ts rather than copied, so the two cannot drift: if the
# declaration moves or changes shape, this rule fails instead of checking a stale copy.
# Checked: every const, static, type and fn name, every field name inside a struct or enum body
# (camelCase normalised to snake_case, as ddb.ts's normaliseName does, so playbackId and
# streamUrl are caught) and every string in a #[serde(...)] attribute (rename = "...",
# alias = "..."). Comments are ignored.
PLAYBACK_RS_FILES="web/src/domain.rs"
playback_re=$(perl -0777 -ne 'print $1 if m{\bconst\s+PLAYBACK_NAME\s*=\s*/(.+?)/i\s*;}s' \
  backend/src/lib/ddb.ts 2>/dev/null)
if [ -z "$playback_re" ]; then
  fail "no playback-locator field in the WASM client" \
    "could not read 'const PLAYBACK_NAME = /.../i;' from backend/src/lib/ddb.ts - update this rule with it"
else
  # A scanner that crashes prints nothing, which would read as "clean": record its failure.
  playback_hits=$(for f in $PLAYBACK_RS_FILES; do
    [ -f "$f" ] || continue
    PLAYBACK_RE="$playback_re" perl -0777 -ne '
      my $re = qr/$ENV{PLAYBACK_RE}/i;
      my $src = $_;
      $src =~ s~//[^\n]*~~g;                           # line and doc comments
      $src =~ s~/\*.*?\*/~~gs;                         # block comments
      my @names;
      # serde attribute strings anywhere: rename, alias, rename(serialize/deserialize)
      while ($src =~ m~#\[serde\((.*?)\)\]~gs) { my $a = $1; push @names, $1 while $a =~ m~"([^"]*)"~g; }
      # item names: a const or static named like a locator would bake one into the public .wasm;
      # a type alias or fn named like one means something is handling one
      push @names, $1 while $src =~ m~\b(?:const|static|type|fn)\s+(?:mut\s+)?(?:r#)?([A-Za-z_]\w*)~g;
      # field names: identifiers followed by a single ":" inside a struct/enum body
      while ($src =~ m~\b(?:struct|enum)\s+\w+[^;{]*\{~g) {
        my ($start, $depth, $i) = (pos($src), 1, pos($src));
        while ($depth && $i < length $src) { my $c = substr($src, $i++, 1); $depth++ if $c eq "{"; $depth-- if $c eq "}"; }
        my $body = substr($src, $start, $i - $start);
        $body =~ s~#\[.*?\]~~gs;                        # attributes carry no field names
        push @names, $1 while $body =~ m~(?:^|[\s,{(])(?:r#)?([A-Za-z_]\w*)\s*:(?!:)~g;
      }
      for my $n (@names) {
        (my $norm = $n) =~ s/([a-z0-9])([A-Z])/$1_$2/g;
        print "$ARGV: $n\n" if lc($norm) =~ $re;
      }' "$f" 2>&1 || echo "$f: the field scanner itself failed (perl error above)"
  done)
  if [ -n "$playback_hits" ]; then
    echo "$playback_hits"
    fail "no playback-locator field in the WASM client" \
      "the catalog never serves playback; see PLAYBACK_NAME in backend/src/lib/ddb.ts"
  else
    pass "no playback-locator field in $PLAYBACK_RS_FILES (pattern read from ddb.ts)"
  fi
fi

# Nothing on nic's machines listens beyond loopback (global rule; docs/WASM_PLAN.md section 5,
# rule 5). A dev server on 0.0.0.0 publishes unreleased code and fixtures to every network the
# laptop joins. vite.config.ts had `host: true` (binds all interfaces) until W13.
loopback_problem=""
if [ -f web/Trunk.toml ]; then
  # [serve] addresses must be written out and list only 127.0.0.1 / ::1. An absent key means
  # "Trunk's default", which is loopback today but is not ours to rely on.
  # The array may span several lines; keep reading until its closing bracket.
  serve_addrs=$(awk '
      cont { sub(/#.*/, ""); print; if ($0 ~ /\]/) cont = 0; next }
      /^[[:space:]]*\[/ { in_serve = ($0 ~ /^[[:space:]]*\[serve\][[:space:]]*$/) }
      in_serve && /^[[:space:]]*addresses?[[:space:]]*=/ {
        sub(/#.*/, ""); sub(/^[^=]*=/, ""); print; cont = ($0 ~ /\[/ && $0 !~ /\]/) }
    ' web/Trunk.toml | tr -d '[]" '"'" | tr ',' '\n' | sed '/^$/d')
  if [ -z "$serve_addrs" ]; then
    loopback_problem="$loopback_problem web/Trunk.toml([serve]-addresses-unset)"
  fi
  for a in $serve_addrs; do
    case "$a" in 127.0.0.1|::1) ;; *) loopback_problem="$loopback_problem web/Trunk.toml(addresses:$a)";; esac
  done
fi
for f in web/Trunk.toml vite.config.ts package.json; do
  [ -f "$f" ] || continue
  # Comments do not bind anything; strip them before looking.
  code=$(sed -E 's@(^|[[:space:]])(#|//).*$@@' "$f")
  echo "$code" | grep -qF '0.0.0.0' && loopback_problem="$loopback_problem $f(0.0.0.0)"
  echo "$code" | grep -qE "host[\"']?[[:space:]]*[:=][[:space:]]*(true|[\"']::?[\"'])" \
    && loopback_problem="$loopback_problem $f(host-all-interfaces)"
  # `vite --host` with no address, or followed by another flag, binds every interface.
  echo "$code" | grep -qE -- "--host([[:space:]]*(\$|[\"',;&|]|--)|=?[[:space:]]*(0\.0\.0\.0|::)([^:0-9a-f]|\$))" \
    && loopback_problem="$loopback_problem $f(--host-without-loopback)"
done
if [ -n "$loopback_problem" ]; then
  fail "dev servers bind loopback only" "use 127.0.0.1 or ::1 -$loopback_problem"
else
  pass "dev servers bind loopback only (web/Trunk.toml, vite.config.ts, package.json)"
fi

head "Build guards"

# Two managers own .beads/hooks: beads keeps its block between BEGIN/END markers, and
# install-hooks.sh appends ours after it. Either can clobber the other silently, and this
# has already happened once. Fail loudly rather than lose a gate.
hookdir=$(git rev-parse --git-path hooks 2>/dev/null)
hook_problem=""
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  hookdir=""   # not a clone (scratch copy, tarball): the rule does not apply
fi
if [ -z "$hookdir" ]; then
  pass "hook check skipped (not a git work tree)"
else
for h in pre-commit pre-push; do
  [ -f "$hookdir/$h" ] || { hook_problem="$hook_problem $h(absent)"; continue; }
  grep -qF "BEGIN CAPYWEB GUARD" "$hookdir/$h" || hook_problem="$hook_problem $h(guard-block-gone)"
  if git ls-files --error-unmatch ".beads/hooks/$h" >/dev/null 2>&1; then
    grep -qF "BEGIN BEADS INTEGRATION" "$hookdir/$h" || hook_problem="$hook_problem $h(beads-block-gone)"
  fi
done
if [ -n "$hook_problem" ]; then
  fail "hooks intact (beads + guard blocks)" "run scripts/install-hooks.sh -$hook_problem"
else
  pass "hooks intact (beads and guard blocks both present)"
fi
fi

# The code repo is public, and the issues describe live leaked keys and attack surface, so beads
# data never goes to git: only beads' config, README, metadata and hooks are tracked, no issue
# export (*.jsonl) is tracked anywhere, and the config keeps no-push and names no sync remote
# (docs/WASM_PLAN.md section 6; capyweb-manager, 2026-09-29).
if [ -z "$hookdir" ]; then
  pass "beads check skipped (not a git work tree)"
else
  beads_problem=""
  beads_extra=$(git ls-files .beads | grep -v -E '^\.beads/(\.gitignore|README\.md|config\.yaml|metadata\.json|hooks/[A-Za-z-]+)$')
  [ -n "$beads_extra" ] && beads_problem="$beads_problem tracked:$(echo $beads_extra | tr ' ' ',')"
  jsonl_hits=$(git ls-files | grep -i -E '\.jsonl$')
  [ -n "$jsonl_hits" ] && beads_problem="$beads_problem jsonl:$(echo $jsonl_hits | tr ' ' ',')"
  grep -qE '^no-push:[[:space:]]*true[[:space:]]*$' .beads/config.yaml 2>/dev/null ||
    beads_problem="$beads_problem no-push-missing"
  # Any uncommented "remote" key, quoted or not, flat (sync.remote) or nested, block or flow style.
  grep -v -E '^[[:space:]]*#' .beads/config.yaml 2>/dev/null |
    grep -qE "(^|[{,[:space:]])[\"']?(sync\\.)?remote[\"']?[[:space:]]*:" &&
    beads_problem="$beads_problem sync-remote-set"
  if [ -n "$beads_problem" ]; then
    fail "beads data stays out of git" "the repo is public; untrack it or restore .beads/config.yaml -$beads_problem"
  else
    pass "beads data stays out of git (config, README, metadata and hooks only; no-push, no sync remote)"
  fi
fi

# nic's Actions allowance is exhausted; a push queues runs that cannot execute.
if [ -d .github/workflows ] && [ -n "$(ls -A .github/workflows 2>/dev/null)" ]; then
  fail "no GitHub Actions workflows" "Actions minutes are exhausted; use local hooks or AWS CodeBuild"
else
  pass "no GitHub Actions workflows"
fi

# npx without --no-install silently downloads and runs whatever is published under that name.
npx_hits=$(grep -rn 'npx ' --include='*.sh' --include='*.json' $BUILD_OUT_DIRS . 2>/dev/null \
  | grep -v -- '--no-install' | grep -v node_modules | grep -v 'scripts/guard-selftest.sh' \
  | grep -v '^\./scripts/guard\.sh:' | filter_baseline npx)
if [ -n "$npx_hits" ]; then
  echo "$npx_hits"
  fail "npx must use --no-install" "otherwise it downloads and executes an arbitrary npm package"
else
  pass "npx pinned with --no-install"
fi

head "Release guards (WASM front end)"

# deploy.sh's web mode (W12) must keep three properties, each of which fails silently in a
# browser rather than at deploy time (docs/WASM_PLAN.md section 5, "Release" and rule 6):
#   - .wasm as application/wasm: otherwise streaming compilation refuses the module;
#   - hashed files as max-age=31536000,immutable: the demo mode re-stamps every object with
#     max-age=300, which would throw away the reason the files are hashed;
#   - no --delete of hashed files: a visitor holding the previous index.html still asks for the
#     previous .wasm, and the SPA fallback answers a deleted one with index.html and status 200,
#     which WebAssembly cannot compile - a blank page until they reload.
# Read as logical commands (backslash continuations joined, comments dropped). This is a static
# check: it sees the upload commands, not which branch runs them, so W12's prune of old
# releases still needs a human review.
DEPLOY_SH=infra/site/deploy.sh
if [ -f "$DEPLOY_SH" ]; then
  deploy_cmds=$(sed -E 's/^[[:space:]]*#.*$//' "$DEPLOY_SH" \
    | awk '{ if (sub(/\\[[:space:]]*$/, "")) { buf = buf $0 " "; next } print buf $0; buf = "" }')
  if ! echo "$deploy_cmds" | grep -qE -- '--web([^A-Za-z0-9_-]|$)'; then
    skip "deploy.sh has no --web mode yet (W12, capyweb-b6e.12)"
  else
    deploy_problem=""
    echo "$deploy_cmds" | grep -qF 'application/wasm' \
      || deploy_problem="$deploy_problem no-application/wasm-content-type"
    echo "$deploy_cmds" | grep -F 'max-age=31536000' | grep -qF 'immutable' \
      || deploy_problem="$deploy_problem no-max-age=31536000,immutable"
    echo "$deploy_cmds" | grep -E 'max-age=31536000|immutable' | grep -qE -- '--delete([^A-Za-z-]|$)' \
      && deploy_problem="$deploy_problem --delete-on-the-hashed-upload"
    # Any OTHER bulk command (s3 sync, or cp --recursive) that deletes, or stamps a short
    # Cache-Control, over a prefix holding the hashed files must leave them out: the demo
    # mode's `sync --delete` would remove last release's .wasm, and its max-age=300 re-stamp
    # would undo immutable. Shown by an --exclude of "*" or of a *.wasm pattern (the .wasm
    # stands for all hashed files: it is the one whose loss blanks the page). Only commands on
    # the bucket ROOT count; the hashed files live there, not under assets/.
    echo "$deploy_cmds" | grep -E 's3 sync|--recursive' | grep -vF 'immutable' \
      | grep -E "s3://[^/\"' ]+/[\"']?([[:space:]]|\$)" \
      | grep -E -- '--delete([^A-Za-z-]|$)|--cache-control' \
      | grep -qvE -- "--exclude[= ]+[\"']?(\\*[\"' ]|\\*\$|[^\"' ]*\\.wasm)" \
      && deploy_problem="$deploy_problem bulk-sync/re-stamp-without---exclude-*.wasm"
    if [ -n "$deploy_problem" ]; then
      fail "deploy.sh web mode keeps wasm type, immutable caching and old hashed files" \
        "see docs/WASM_PLAN.md section 5 \"Release\" -$deploy_problem"
    else
      pass "deploy.sh web mode: application/wasm, immutable hashed files, no --delete of them"
    fi
  fi
fi

# Without 'wasm-unsafe-eval' in the CSP, the browser refuses to compile the module and the app
# is a blank page - on the live site only (docs/WASM_PLAN.md section 5, rule 8). The CSP lives in
# the response headers policies an admin creates from infra/site/headers-<stage>.json (no stack may
# create one; capyweb-manager, 2026-09-29), and web/tests/serve.mjs sends dev's to every page test.
# HSTS must not carry includeSubDomains or preload: preload takes months to undo
# (docs/RELEASE_PLAN.md section 4).
for headers in infra/site/headers-*.json; do
  [ -f "$headers" ] || { skip "no infra/site/headers-<stage>.json yet (W12, capyweb-b6e.12)"; break; }
  if problem=$(python3 - "$headers" <<'PY'
import json, sys
c = json.load(open(sys.argv[1]))["SecurityHeadersConfig"]
csp = c["ContentSecurityPolicy"]["ContentSecurityPolicy"]
script = next((d for d in csp.split(";") if d.strip().startswith("script-src")), "")
hsts = c["StrictTransportSecurity"]
bad = []
if "'wasm-unsafe-eval'" not in script: bad.append("script-src lacks 'wasm-unsafe-eval'")
if hsts.get("IncludeSubdomains") or hsts.get("Preload"): bad.append("HSTS has includeSubDomains or preload")
print("; ".join(bad))
sys.exit(1 if bad else 0)
PY
  ); then
    pass "$headers: CSP allows 'wasm-unsafe-eval'; HSTS without includeSubDomains or preload"
  else
    fail "$headers is safe to ship" "$problem"
  fi
done

# 9. The alarm relay's lines go to a room people outside the team read: its sanitiser and its
#    "delete only after the post" rule have tests (infra/ops/test_alarm_relay.py).
head "Alarm relay"
if out=$(python3 -B -m unittest -q infra/ops/test_alarm_relay.py 2>&1); then
  pass "infra/ops/alarm_relay.py: $(printf '%s' "$out" | grep -o 'Ran [0-9]* tests')"
else
  fail "infra/ops/alarm_relay.py tests" "$(printf '%s' "$out" | tail -3 | tr '\n' ' ')"
fi

# 10. The contact-mail forwarder handles strangers' mail and a private forward address: its header rewrite,
#     drops and log hygiene (no address, subject or body in a log line) have tests (infra/mail/test_forwarder.py).
head "Contact mail"
if out=$(python3 -B -m unittest -q infra/mail/test_forwarder.py 2>&1); then
  pass "infra/mail/forwarder/forwarder.py: $(printf '%s' "$out" | grep -o 'Ran [0-9]* tests')"
else
  fail "infra/mail/forwarder/forwarder.py tests" "$(printf '%s' "$out" | tail -3 | tr '\n' ' ')"
fi
# `aws cloudformation package` zips the whole directory as the Lambda's code: only forwarder.py belongs there.
mail_code=$(ls -A infra/mail/forwarder 2>/dev/null | tr '\n' ' ')
if [ "$mail_code" = "forwarder.py " ]; then
  pass "infra/mail/forwarder/ holds only forwarder.py (the Lambda's zip)"
else
  fail "infra/mail/forwarder/ must hold only forwarder.py: it is zipped whole as the Lambda's code" "found: ${mail_code:-nothing}"
fi

if [ "$FAILED" -eq 0 ]; then
  [ "$QUIET" -eq 1 ] || printf '\n\033[32mall guards passed\033[0m\n'
  exit 0
fi
printf '\n\033[31mguard failed\033[0m - commit with --no-verify only if you know why\n'
exit 1
