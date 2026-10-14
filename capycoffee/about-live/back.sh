#!/bin/sh
# Way back for about-live/fix.sh: puts the saved live bytes (live-20261005/, sha-checked) of the 4 About files back on
# roast.capy.life with each object's own Content-Type and Cache-Control, invalidates /about/* and checks the served bytes.
#   sh capycoffee/about-live/back.sh     (from the repo root; AWS profile capy)
set -eu
H=$(cd "$(dirname "$0")" && pwd); D=E2OXY1QMKKXDFD P="--profile capy --region us-east-1"
B=$(aws cloudformation describe-stack-resource $P --stack-name capyapp-capycoffee-roast --logical-resource-id SiteBucket --query StackResourceDetail.PhysicalResourceId --output text </dev/null)
case $B in capyapp-capycoffee-roast-*) ;; *) echo "no Roast bucket from the stack; stop" >&2; exit 1;; esac
L="about/index.html|345611662f96243760848875c00250dd8f9979b6a3bfbd7b53794f8b3c4bf4eb
about/index.txt|e077894eca2db720136999368a575c4f44ef45fd7fb6d10208d47d2b197c70d8
about/__next._full.txt|e077894eca2db720136999368a575c4f44ef45fd7fb6d10208d47d2b197c70d8
about/__next.about.__PAGE__.txt|485e16fada36b0e3193aac86c1bda3d06e28818feb797bb3552effbea06fb00e"
echo "$L" | while IFS='|' read -r key sum; do
  [ "$(shasum -a 256 "$H/live-20261005/$key" | cut -d' ' -f1)" = "$sum" ] || { echo "saved $key has the wrong sha256; stop" >&2; exit 1; }
done
echo "$L" | while IFS='|' read -r key sum; do
  CC=$(aws s3api head-object $P --bucket $B --key "$key" --query CacheControl --output text </dev/null)
  CT=$(aws s3api head-object $P --bucket $B --key "$key" --query ContentType --output text </dev/null)
  if [ "$CC" = None ] || [ -z "$CC" ]; then set --; else set -- --cache-control "$CC"; fi
  if [ "$CT" != None ] && [ -n "$CT" ]; then set -- "$@" --content-type "$CT"; fi
  aws s3 cp $P --only-show-errors "$H/live-20261005/$key" "s3://$B/$key" "$@" </dev/null
done
I=$(aws cloudfront create-invalidation --profile capy --distribution-id $D --paths '/about/*' '/about' --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --profile capy --distribution-id $D --id "$I"
echo "$L" | { bad=0; while IFS='|' read -r key sum; do
  curl -s "https://roast.capy.life/$key" </dev/null | shasum -a 256 | grep -q "^$sum" && echo "back: $key" || { echo "served $key is not the saved bytes after $I" >&2; bad=1; }
done; exit $bad; }
