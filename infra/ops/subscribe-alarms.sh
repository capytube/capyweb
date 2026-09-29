#!/usr/bin/env bash
# Subscribe the alarm recipient to production's two alarm topics (docs/RELEASE_PLAN.md, P10):
# capyapp-capyweb-prod-alarms (ap-southeast-1: api-down, site-down, table-throttled,
# signups-refused) and capyapp-capyweb-prod-egress-alarm (us-east-1: CloudFront egress).
# Usage: CAPYWEB_PROD_GO=1 infra/ops/subscribe-alarms.sh
#
# The recipient is the address the account-wide budget capyweb-monthly-20 already emails
# (capyweb-manager, 2026-09-29), read here and never printed, logged or put on a command line (it
# goes to the CLI in a private temp file). SNS email needs the recipient to click the link in
# AWS's confirmation email; until then the subscription is "PendingConfirmation" and sends nothing.
# Dev's topics stay without subscribers (capyweb-manager, 2026-09-29).
set -euo pipefail
[ "${CAPYWEB_PROD_GO:-}" = 1 ] || { echo "production only, with herdr-master's go: set CAPYWEB_PROD_GO=1" >&2; exit 1; }
export AWS_PROFILE=${AWS_PROFILE:-capy} AWS_PAGER=""
ACCT=$(aws sts get-caller-identity --query Account --output text)

umask 077
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
aws budgets describe-subscribers-for-notification --region us-east-1 --account-id "$ACCT" \
  --budget-name capyweb-monthly-20 \
  --notification NotificationType=FORECASTED,ComparisonOperator=GREATER_THAN,Threshold=100,ThresholdType=PERCENTAGE \
  --output json > "$TMP/subscribers.json"

for pair in ap-southeast-1:capyapp-capyweb-prod-alarms us-east-1:capyapp-capyweb-prod-egress-alarm; do
  region=${pair%%:*}; topic="arn:aws:sns:$region:$ACCT:${pair#*:}"
  aws sns list-subscriptions-by-topic --region "$region" --topic-arn "$topic" --output json > "$TMP/subs.json"
  # Writes the subscribe request if the address is not subscribed yet; prints only the outcome.
  state=$(python3 - "$TMP" "$topic" <<'EOF'
import json, sys
tmp, topic = sys.argv[1], sys.argv[2]
emails = [s["Address"] for s in json.load(open(f"{tmp}/subscribers.json"))["Subscribers"] if s["SubscriptionType"] == "EMAIL"]
if not emails:
    print("none"); sys.exit()
subs = json.load(open(f"{tmp}/subs.json"))["Subscriptions"]
mine = [s for s in subs if s["Protocol"] == "email" and s["Endpoint"].lower() == emails[0].lower()]
if mine:
    print("pending" if mine[0]["SubscriptionArn"] == "PendingConfirmation" else "confirmed"); sys.exit()
json.dump({"TopicArn": topic, "Protocol": "email", "Endpoint": emails[0]}, open(f"{tmp}/request.json", "w"))
print("new")
EOF
)
  case "$state" in
    none) echo "capyweb-monthly-20 has no email subscriber to reuse" >&2; exit 1 ;;
    new) aws sns subscribe --region "$region" --cli-input-json "file://$TMP/request.json" --query SubscriptionArn \
           --output text >/dev/null
         rm -f "$TMP/request.json"
         echo "$topic: subscribed; waiting for the recipient to confirm" ;;
    *) echo "$topic: already $state" ;;
  esac
done
