#!/usr/bin/env bash
# Create or update the capyapp-capyweb-ops stack (infra/ops/template.yaml) by change set, and show
# the change set; it is executed by hand after reading it. Usage: infra/ops/deploy.sh <change-set-name>
#
# The budget emails the address the account-wide budget capyweb-monthly-20 already uses
# (capyweb-manager, 2026-09-29). It is read here, handed over as a NoEcho parameter through a private
# temp file, and never printed, logged or committed.
set -euo pipefail
NAME=${1:?usage: infra/ops/deploy.sh <change-set-name>}
export AWS_PROFILE=${AWS_PROFILE:-capy}
REGION=ap-southeast-1
STACK=capyapp-capyweb-ops

ACCT=$(aws sts get-caller-identity --query Account --output text)
BUDGET_EMAIL=$(aws budgets describe-subscribers-for-notification --region us-east-1 --account-id "$ACCT" \
  --budget-name capyweb-monthly-20 \
  --notification NotificationType=FORECASTED,ComparisonOperator=GREATER_THAN,Threshold=100,ThresholdType=PERCENTAGE \
  --query "Subscribers[?SubscriptionType=='EMAIL'] | [0].Address" --output text)
[[ "$BUDGET_EMAIL" == *@* ]] || { echo "capyweb-monthly-20 has no email subscriber to reuse" >&2; exit 1; }

umask 077
PARAMS=$(mktemp)
trap 'rm -f "$PARAMS"' EXIT
BUDGET_EMAIL=$BUDGET_EMAIL python3 -c 'import json, os
print(json.dumps([{"ParameterKey": "BudgetEmail", "ParameterValue": os.environ["BUDGET_EMAIL"]},
                  {"ParameterKey": "EnableAnomalyDetection", "ParameterValue": "false"}]))' > "$PARAMS"
unset BUDGET_EMAIL

TYPE=CREATE
aws cloudformation describe-stacks --region $REGION --stack-name $STACK >/dev/null 2>&1 && TYPE=UPDATE
aws cloudformation create-change-set --region $REGION --stack-name $STACK --change-set-name "$NAME" \
  --change-set-type $TYPE --template-body file://infra/ops/template.yaml --parameters "file://$PARAMS" \
  --tags Key=Project,Value=capyweb Key=Stage,Value=ops Key=capy-scope,Value=capyapp --query Id --output text
aws cloudformation wait change-set-create-complete --region $REGION --stack-name $STACK --change-set-name "$NAME"
aws cloudformation describe-change-set --region $REGION --stack-name $STACK --change-set-name "$NAME" \
  --query 'Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType,Replacement]' --output text
echo "Read it, then: aws cloudformation execute-change-set --region $REGION --stack-name $STACK --change-set-name $NAME"
