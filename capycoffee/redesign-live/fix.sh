#!/bin/sh
# Capy Roast redesign LIVE (p221; held for nic's word, run only on nsu's typed GO): puts the redesign build on
# roast.capy.life. Checks every file in this folder against list.txt, then that every changed key on live is today's
# bytes (old/) and every added key is absent (a rerun after a stop may find either already in the new bytes), uploads
# the added keys first (stylesheet, script, pictures) and then the changed ones, keeping a changed object's own
# Content-Type and Cache-Control (an added key gets the ones infra/upload.sh sets), invalidates /* and checks every
# served key. Keys only on live are left alone. Way back: sh back.sh
#   CAPY_ROAST_GO=1 sh fix.sh     (from this folder or anywhere; AWS profile capy)
set -eu
[ "${CAPY_ROAST_GO:-}" = 1 ] || { echo "fix.sh: set CAPY_ROAST_GO=1 (only on nsu's typed GO)" >&2; exit 2; }
H=$(cd "$(dirname "$0")" && pwd); D=E2OXY1QMKKXDFD P="--profile capy --region us-east-1"
B=$(aws cloudformation describe-stack-resource $P --stack-name capyapp-capycoffee-roast --logical-resource-id SiteBucket --query StackResourceDetail.PhysicalResourceId --output text </dev/null)
case $B in capyapp-capycoffee-roast-*) ;; *) echo "no Roast bucket from the stack; stop" >&2; exit 1;; esac
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
sum() { shasum -a 256 "$1" | cut -d' ' -f1; }
while IFS='|' read -r key old new ct cc; do
  [ "$(sum "$H/new/$key")" = "$new" ] || { echo "new/$key has the wrong sha256; nothing uploaded" >&2; exit 1; }
  [ "$old" = - ] || [ "$(sum "$H/old/$key")" = "$old" ] || { echo "old/$key has the wrong sha256; nothing uploaded" >&2; exit 1; }
done < "$H/list.txt"
n=0
while IFS='|' read -r key old new ct cc; do
  f="$T/x"; rm -f "$f"
  if aws s3api head-object $P --bucket $B --key "$key" >/dev/null 2>&1 </dev/null; then
    aws s3 cp $P --only-show-errors "s3://$B/$key" "$f" </dev/null; s=$(sum "$f")
    if [ "$s" = "$new" ]; then n=$((n+1)); elif [ "$old" = - ] || [ "$s" != "$old" ]; then
      echo "live $key is not today's bytes ($s); nothing uploaded" >&2; exit 1; fi
  elif [ "$old" != - ]; then echo "live $key is missing; nothing uploaded" >&2; exit 1; fi
done < "$H/list.txt"
[ $n = 0 ] || echo "fix.sh: $n keys already have the new bytes (a rerun); going on"
up() { # key ct cc changed
  if [ "$4" = 1 ]; then
    CC=$(aws s3api head-object $P --bucket $B --key "$1" --query CacheControl --output text </dev/null)
    CT=$(aws s3api head-object $P --bucket $B --key "$1" --query ContentType --output text </dev/null)
    [ "$CC" != None ] && [ -n "$CC" ] || CC=$3; [ "$CT" != None ] && [ -n "$CT" ] || CT=$2
  else CT=$2 CC=$3; fi
  aws s3 cp $P --only-show-errors "$H/new/$1" "s3://$B/$1" --content-type "$CT" --cache-control "$CC" </dev/null
}
grep '|-|' "$H/list.txt" | while IFS='|' read -r key old new ct cc; do up "$key" "$ct" "$cc" 0; done
grep -v '|-|' "$H/list.txt" | while IFS='|' read -r key old new ct cc; do up "$key" "$ct" "$cc" 1; done
I=$(aws cloudfront create-invalidation --profile capy --distribution-id $D --paths '/*' --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --profile capy --distribution-id $D --id "$I"
bad=0
while IFS='|' read -r key old new ct cc; do
  curl -s "https://roast.capy.life/$key" </dev/null | shasum -a 256 | grep -q "^$new" || { echo "served $key is not the new bytes after $I" >&2; bad=1; }
done < "$H/list.txt"
[ $bad = 0 ] && echo "live: redesign on roast.capy.life, $(wc -l < "$H/list.txt" | tr -d ' ') keys served as built; invalidation $I; way back: sh $H/back.sh"
exit $bad
