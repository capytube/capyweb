#!/bin/sh
# Way back for fix.sh: puts today's live bytes (old/, from before the redesign, sha-checked) back on every changed key
# with the object's own Content-Type and Cache-Control, deletes the keys fix.sh added, invalidates /* and checks that
# every changed key serves the old bytes and no added key is left in the bucket.
#   CAPY_ROAST_GO=1 sh back.sh     (from this folder or anywhere; AWS profile capy)
set -eu
[ "${CAPY_ROAST_GO:-}" = 1 ] || { echo "back.sh: set CAPY_ROAST_GO=1" >&2; exit 2; }
H=$(cd "$(dirname "$0")" && pwd); D=E2OXY1QMKKXDFD P="--profile capy --region us-east-1"
B=$(aws cloudformation describe-stack-resource $P --stack-name capyapp-capycoffee-roast --logical-resource-id SiteBucket --query StackResourceDetail.PhysicalResourceId --output text </dev/null)
case $B in capyapp-capycoffee-roast-*) ;; *) echo "no Roast bucket from the stack; stop" >&2; exit 1;; esac
grep -v '|-|' "$H/list.txt" | while IFS='|' read -r key old new ct cc; do
  [ "$(shasum -a 256 "$H/old/$key" | cut -d' ' -f1)" = "$old" ] || { echo "old/$key has the wrong sha256; stop" >&2; exit 1; }
done
grep -v '|-|' "$H/list.txt" | while IFS='|' read -r key old new ct cc; do
  CC=$(aws s3api head-object $P --bucket $B --key "$key" --query CacheControl --output text </dev/null) || CC=None
  CT=$(aws s3api head-object $P --bucket $B --key "$key" --query ContentType --output text </dev/null) || CT=None
  [ "$CC" != None ] && [ -n "$CC" ] || CC=$cc; [ "$CT" != None ] && [ -n "$CT" ] || CT=$ct
  aws s3 cp $P --only-show-errors "$H/old/$key" "s3://$B/$key" --content-type "$CT" --cache-control "$CC" </dev/null
done
grep '|-|' "$H/list.txt" | while IFS='|' read -r key old new ct cc; do aws s3 rm $P --only-show-errors "s3://$B/$key" </dev/null; done
I=$(aws cloudfront create-invalidation --profile capy --distribution-id $D --paths '/*' --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --profile capy --distribution-id $D --id "$I"
bad=0
while IFS='|' read -r key old new ct cc; do
  if [ "$old" = - ]; then ! aws s3api head-object $P --bucket $B --key "$key" >/dev/null 2>&1 </dev/null || { echo "$key is still in the bucket" >&2; bad=1; }
  else curl -s "https://roast.capy.life/$key" </dev/null | shasum -a 256 | grep -q "^$old" || { echo "served $key is not today's bytes after $I" >&2; bad=1; }; fi
done < "$H/list.txt"
[ $bad = 0 ] && echo "back: roast.capy.life is as before the redesign; invalidation $I"
exit $bad
