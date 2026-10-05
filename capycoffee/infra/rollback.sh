#!/bin/zsh
# R-coffee: remove roast.capy.life completely (hm-zxnj3). Empties the bucket, deletes the stack,
# then deletes the ACM validation CNAME that CloudFormation leaves in the shared zone (it does not
# remove it on delete). Touches only names under roast.capy.life; refuses anything else.
set -eu
BATCH=$(mktemp -t r-coffee)
trap 'rm -f "$BATCH"' EXIT
ST=capyapp-capycoffee-roast; ZONE=Z0311842207LCZ23XHXL0
P=(--profile capy --region us-east-1)
if aws cloudformation describe-stacks $P --stack-name $ST >/dev/null 2>&1; then
  B=$(aws cloudformation describe-stacks $P --stack-name $ST --query "Stacks[0].Outputs[?OutputKey=='Bucket'].OutputValue" --output text)
  [ -n "$B" ] && [ "$B" != None ] && aws s3 rm s3://$B --recursive $P --only-show-errors
  aws cloudformation delete-stack $P --stack-name $ST
  aws cloudformation wait stack-delete-complete $P --stack-name $ST
  echo "stack $ST deleted"
fi
# Whatever is still under roast.capy.life: only an ACM validation CNAME may remain, and it goes.
left=$(aws route53 list-resource-record-sets --profile capy --hosted-zone-id $ZONE \
  --query "ResourceRecordSets[?ends_with(Name,'roast.capy.life.')]" --output json)
echo "$left" | python3 -c '
import json,re,sys
rs=json.load(sys.stdin)
for r in rs:
  ok = r["Type"]=="CNAME" and re.fullmatch(r"_[0-9a-f]+\.roast\.capy\.life\.", r["Name"]) and all(v["Value"].rstrip(".").endswith(".acm-validations.aws") for v in r.get("ResourceRecords",[]))
  if not ok: sys.exit("STOP: unexpected record left: %s %s" % (r["Name"], r["Type"]))
json.dump({"Comment":"R-coffee: ACM validation CNAME left by stack delete","Changes":[{"Action":"DELETE","ResourceRecordSet":r} for r in rs]}, open(sys.argv[1],"w"))
print(len(rs), "validation record(s) to delete")
' "$BATCH"
if [ "$(echo "$left" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')" != 0 ]; then
  aws route53 change-resource-record-sets --profile capy --hosted-zone-id $ZONE --change-batch file://$BATCH --query ChangeInfo.Status --output text
  
fi
echo "left under roast.capy.life: $(aws route53 list-resource-record-sets --profile capy --hosted-zone-id $ZONE --query "length(ResourceRecordSets[?ends_with(Name,'roast.capy.life.')])" --output text)"
rm -f "$BATCH"
