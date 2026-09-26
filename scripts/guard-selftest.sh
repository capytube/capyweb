#!/bin/bash
# Prove every guard rule actually fires. A guard that only ever passes is untrustworthy.
#
# Copies the repo to a scratch dir, introduces one violation at a time, and asserts the
# guard fails with the expected message. Never touches the real working tree.
#
#   scripts/guard-selftest.sh
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

rsync -a --exclude node_modules --exclude .git --exclude .aws-sam --exclude .beads "$ROOT/" "$WORK/"

PASS=0; FAIL=0
# $1 = rule name, $2 = expected text in output, $3 = shell that introduces the violation
expect_fail() {
  local name="$1" expect="$2" setup="$3"
  local sandbox; sandbox=$(mktemp -d)
  rsync -a "$WORK/" "$sandbox/"
  ( cd "$sandbox" && eval "$setup" ) >/dev/null 2>&1
  local out; out=$( cd "$sandbox" && ./scripts/guard.sh 2>&1 )
  if [ $? -eq 0 ]; then
    printf '  \033[31mMISS\033[0m %s (guard passed but should have failed)\n' "$name"; FAIL=$((FAIL+1))
  elif echo "$out" | grep -qF "$expect"; then
    printf '  \033[32mfires\033[0m %s\n' "$name"; PASS=$((PASS+1))
  else
    printf '  \033[31mWRONG\033[0m %s (failed, but not with "%s")\n' "$name" "$expect"; FAIL=$((FAIL+1))
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
expect_fail "playback locators" "playback locators stripped" \
  "sed -i.bak 's/\"streaming_address\"/\"renamed_field\"/' backend/src/lib/ddb.ts"
expect_fail "hardcoded secret" "no hardcoded secrets" \
  "echo 'const api_key = \"abcdef0123456789abcdef0123456789\";' > backend/src/oops.ts"
expect_fail "GitHub Actions" "no GitHub Actions workflows" \
  "mkdir -p .github/workflows && echo 'name: ci' > .github/workflows/ci.yml"
expect_fail "unpinned npx" "npx must use --no-install" \
  "echo 'npx some-tool' > run.sh"

printf '\n%d fired, %d wrong\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
