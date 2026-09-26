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
# used to balance the totals while a real function's logs never expired.
missing_retention=""
for fn in $(grep -hE '^[[:space:]]*FunctionName[[:space:]]*:' $TEMPLATES 2>/dev/null \
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
s3_hits=$(grep -rnE '["'"'"'`][^"'"'"'`]*\.s3[.-][a-z0-9-]*\.amazonaws\.com' \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html' --include='*.css' \
  --exclude-dir=node_modules --exclude-dir=.aws-sam --exclude-dir=dist \
  backend/src src demo amplify 2>/dev/null \
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
SECRET_SCAN_DIRS="backend infra src demo amplify docs scripts"
SECRET_FILES="--include=*.ts --include=*.tsx --include=*.js --include=*.json --include=*.yaml --include=*.yml --include=*.sh --include=*.html --include=*.md"
# Exclude only a direct env read, not any line that merely mentions process.env - the
# `process.env.X || "<literal fallback>"` idiom was slipping through.
# Excluded: obvious placeholders, CloudFormation intrinsics, and REFERENCES to a secret
# rather than a secret - secret("NAME"), localStorage.getItem("name"), SSM parameter paths.
# The value-shape rule does the heavy lifting: a literal made only of [A-Za-z0-9_] that
# contains an underscore is a NAME (GOOGLE_CLIENT_SECRET, dynamic_auth_token), whereas real
# keys are hex, base64 or hyphenated UUIDs and contain no underscores.
SECRET_ALLOW='PLACEHOLDER|LEAKCANARY|EXAMPLEKEY|your-|xxxx|!Ref|!Sub|!GetAtt|guard-selftest'
SECRET_ALLOW="$SECRET_ALLOW"'|secret\(|getItem\(|getenv\(|GetParameter|process\.env\[|["'"'"'][A-Za-z0-9]*_[A-Za-z0-9_]*["'"'"'][[:space:]]*[),;]'

akia=$(grep -rnE '(AKIA|ASIA)[A-Z0-9]{16}' $SECRET_FILES \
  --exclude-dir=node_modules --exclude-dir=.aws-sam . 2>/dev/null | grep -vE "$SECRET_ALLOW")
literals=$(grep -rniE '(api_?key|secret|token|password|passphrase|credential)[A-Za-z_]*[[:space:]]*[:=][^"'"'"']{0,60}["'"'"'][A-Za-z0-9/+=._-]{20,}["'"'"']' \
  $SECRET_FILES --exclude-dir=node_modules --exclude-dir=.aws-sam $SECRET_SCAN_DIRS 2>/dev/null \
  | grep -vE "$SECRET_ALLOW")
if [ -n "$akia" ] || [ -n "$literals" ]; then
  [ -n "$akia" ] && echo "$akia"
  [ -n "$literals" ] && echo "$literals"
  fail "no hardcoded secrets" "use SSM SecureString and read it at runtime"
else
  pass "no hardcoded secrets (source, templates, scripts, demo, amplify)"
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

# nic's Actions allowance is exhausted; a push queues runs that cannot execute.
if [ -d .github/workflows ] && [ -n "$(ls -A .github/workflows 2>/dev/null)" ]; then
  fail "no GitHub Actions workflows" "Actions minutes are exhausted; use local hooks or AWS CodeBuild"
else
  pass "no GitHub Actions workflows"
fi

# npx without --no-install silently downloads and runs whatever is published under that name.
npx_hits=$(grep -rn 'npx ' --include='*.sh' --include='*.json' --exclude-dir=node_modules . 2>/dev/null \
  | grep -v -- '--no-install' | grep -v node_modules | grep -v 'scripts/guard-selftest.sh' | filter_baseline npx)
if [ -n "$npx_hits" ]; then
  echo "$npx_hits"
  fail "npx must use --no-install" "otherwise it downloads and executes an arbitrary npm package"
else
  pass "npx pinned with --no-install"
fi

if [ "$FAILED" -eq 0 ]; then
  [ "$QUIET" -eq 1 ] || printf '\n\033[32mall guards passed\033[0m\n'
  exit 0
fi
printf '\n\033[31mguard failed\033[0m - commit with --no-verify only if you know why\n'
exit 1
