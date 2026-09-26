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
TEMPLATES=$(find infra -name '*.yaml' -not -path '*/node_modules/*' 2>/dev/null)

pass() { [ "$QUIET" -eq 1 ] || printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ -n "${2:-}" ] && printf '       %s\n' "$2"; FAILED=1; }
head() { [ "$QUIET" -eq 1 ] || printf '\n\033[1m%s\033[0m\n' "$1"; }

# Known, tracked exceptions. A guard that fails on day one for legacy code gets switched off,
# so pre-existing violations live here with the issue that will clear them. Nothing may be
# added without an issue id.
BASELINE=scripts/guard-baseline.txt

# Drop any hit whose "file:line" prefix is listed in the baseline.
filter_baseline() {
  if [ ! -f "$BASELINE" ]; then cat; return; fi
  grep -vFf <(grep -vE '^\s*#|^\s*$' "$BASELINE" | cut -d' ' -f1) || true
}

# Grep that ignores dependencies, build output and this script's own rule list.
src_grep() {
  grep -rnE "$1" --include='*.ts' --include='*.tsx' \
    --exclude-dir=node_modules --exclude-dir=.aws-sam --exclude-dir=dist \
    ${2:-backend/src src} 2>/dev/null | grep -v 'scripts/guard-selftest.sh'
}

head "Cost guards"

# A NAT Gateway is ~$35/month on its own - more than three times the entire budget.
if grep -qE '^\s*VpcConfig:' $TEMPLATES 2>/dev/null; then
  fail "no Lambda in a VPC" "a NAT Gateway is ~\$35/month, over 3x the whole budget"
else
  pass "no Lambda in a VPC (no NAT Gateway)"
fi

# Provisioned capacity bills whether or not anyone visits.
if grep -nE 'ProvisionedThroughput:|ProvisionedConcurrencyConfig|AutoPublishAlias' $TEMPLATES 2>/dev/null; then
  fail "no provisioned capacity" "on-demand only; provisioned capacity bills while idle"
else
  pass "no provisioned capacity"
fi

# On-demand without a ceiling has no upper bound on spend.
for t in $TEMPLATES; do
  if grep -q 'AWS::DynamoDB::Table' "$t"; then
    tables=$(grep -c 'BillingMode: PAY_PER_REQUEST' "$t")
    ceilings=$(grep -c 'OnDemandThroughput' "$t")
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
lambdas=$(grep -h 'AWS::Serverless::Function' $TEMPLATES 2>/dev/null | wc -l | tr -d ' ')
loggroups=$(grep -h 'RetentionInDays:' $TEMPLATES 2>/dev/null | wc -l | tr -d ' ')
if [ "${lambdas:-0}" -gt "${loggroups:-0}" ]; then
  fail "log retention on every function" "$lambdas function(s) but only $loggroups log group(s) with RetentionInDays"
else
  pass "explicit log retention for every function ($loggroups group(s))"
fi

# CloudFront's always-free tier covers 1TB/month of egress; S3 direct is ~$0.12/GB.
s3_hits=$(src_grep '["'"'"'`][^"'"'"'`]*\.s3[.-][a-z0-9-]*\.amazonaws\.com' | grep -v '\.test\.ts:' | filter_baseline)
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
# Checks the field names themselves, not a variable name - renaming the constant must not
# be enough to silence this.
missing_playback=""
for field in streaming_address s3_video_address; do
  grep -q "\"$field\"" backend/src/lib/ddb.ts 2>/dev/null || missing_playback="$missing_playback $field"
done
if [ -n "$missing_playback" ]; then
  fail "playback locators stripped from responses" "backend/src/lib/ddb.ts no longer hides:$missing_playback"
else
  pass "playback locators stripped from responses"
fi

# A literal AWS key or a long hex/base64 blob assigned to a secret-shaped name.
if src_grep '(AKIA|ASIA)[A-Z0-9]{16}' '.' ; then
  fail "no AWS access key ids in source"
elif grep -rnE '(api_?key|secret|token|password)\s*[:=]\s*["'"'"'][A-Za-z0-9/+_-]{20,}["'"'"']' \
      --include='*.ts' --include='*.tsx' --include='*.yaml' \
      --exclude-dir=node_modules --exclude-dir=.aws-sam \
      backend infra src 2>/dev/null | grep -vE 'PLACEHOLDER|LEAKCANARY|example|process\.env|!Ref|!Sub'; then
  fail "no hardcoded secrets" "use SSM SecureString and read it at runtime"
else
  pass "no hardcoded secrets in source or templates"
fi

head "Build guards"

# nic's Actions allowance is exhausted; a push queues runs that cannot execute.
if [ -d .github/workflows ] && [ -n "$(ls -A .github/workflows 2>/dev/null)" ]; then
  fail "no GitHub Actions workflows" "Actions minutes are exhausted; use local hooks or AWS CodeBuild"
else
  pass "no GitHub Actions workflows"
fi

# npx without --no-install silently downloads and runs whatever is published under that name.
npx_hits=$(grep -rn 'npx ' --include='*.sh' --include='*.json' --exclude-dir=node_modules . 2>/dev/null \
  | grep -v -- '--no-install' | grep -v node_modules | grep -v 'scripts/guard-selftest.sh' | filter_baseline)
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
