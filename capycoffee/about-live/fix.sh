#!/bin/sh
# LIVE roast.capy.life About bug fix (nsu YES 2026-10-14 23:0x; capyweb-manager): the "Meet Freebird" story paragraph was
# shown twice. Downloads the 4 live About files, checks they are the bytes saved in live-20261005/, cuts the repeated
# paragraph (cut.py), checks the result shas, uploads with each object's own Content-Type and Cache-Control, invalidates
# /about/* and checks the served bytes. Touches nothing else. Way back: sh capycoffee/about-live/back.sh
#   CAPY_ROAST_GO=1 sh capycoffee/about-live/fix.sh     (from the repo root; AWS profile capy)
set -eu
[ "${CAPY_ROAST_GO:-}" = 1 ] || { echo "fix.sh: set CAPY_ROAST_GO=1 (only on nsu's typed GO)" >&2; exit 2; }
H=$(cd "$(dirname "$0")" && pwd); D=E2OXY1QMKKXDFD P="--profile capy --region us-east-1"
B=$(aws cloudformation describe-stack-resource $P --stack-name capyapp-capycoffee-roast --logical-resource-id SiteBucket --query StackResourceDetail.PhysicalResourceId --output text </dev/null)
case $B in capyapp-capycoffee-roast-*) ;; *) echo "no Roast bucket from the stack; stop" >&2; exit 1;; esac
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# key | live sha256 (before) | fixed sha256 (after)
cat > "$T/list" <<'L'
about/index.html|345611662f96243760848875c00250dd8f9979b6a3bfbd7b53794f8b3c4bf4eb|26c98266630682b22a9d6dae6aa2eef3ff06c46e5583e21578f79f90bc783120
about/index.txt|e077894eca2db720136999368a575c4f44ef45fd7fb6d10208d47d2b197c70d8|c2dca231c059aaa4e7773c8d8e306ee1e7a69dd41de6e25adcd88c4ab64b8b30
about/__next._full.txt|e077894eca2db720136999368a575c4f44ef45fd7fb6d10208d47d2b197c70d8|c2dca231c059aaa4e7773c8d8e306ee1e7a69dd41de6e25adcd88c4ab64b8b30
about/__next.about.__PAGE__.txt|485e16fada36b0e3193aac86c1bda3d06e28818feb797bb3552effbea06fb00e|e51949c75722bf9d5b218da69f12a6d938d8f7ea6c03692c9934ac50cd772c55
L
files=
while IFS='|' read -r key old new; do
  f="$T/$(echo "$key" | tr / _)"; aws s3 cp $P --only-show-errors "s3://$B/$key" "$f" </dev/null
  [ "$(shasum -a 256 "$f" | cut -d' ' -f1)" = "$old" ] || { echo "live $key is not the expected bytes; nothing uploaded" >&2; exit 1; }
  files="$files $f"
done < "$T/list"
python3 "$H/cut.py" $files
while IFS='|' read -r key old new; do
  f="$T/$(echo "$key" | tr / _)"
  [ "$(shasum -a 256 "$f" | cut -d' ' -f1)" = "$new" ] || { echo "fixed $key has the wrong sha256; nothing uploaded" >&2; exit 1; }
done < "$T/list"
while IFS='|' read -r key old new; do
  f="$T/$(echo "$key" | tr / _)"
  CC=$(aws s3api head-object $P --bucket $B --key "$key" --query CacheControl --output text </dev/null)
  CT=$(aws s3api head-object $P --bucket $B --key "$key" --query ContentType --output text </dev/null)
  if [ "$CC" = None ] || [ -z "$CC" ]; then set --; else set -- --cache-control "$CC"; fi
  if [ "$CT" != None ] && [ -n "$CT" ]; then set -- "$@" --content-type "$CT"; fi
  aws s3 cp $P --only-show-errors "$f" "s3://$B/$key" "$@" </dev/null
done < "$T/list"
I=$(aws cloudfront create-invalidation --profile capy --distribution-id $D --paths '/about/*' '/about' --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --profile capy --distribution-id $D --id "$I"
bad=0
while IFS='|' read -r key old new; do
  curl -s "https://roast.capy.life/$key" </dev/null | shasum -a 256 | grep -q "^$new" && echo "live: $key fixed" || { echo "served $key is not the fixed bytes after $I" >&2; bad=1; }
done < "$T/list"
[ $bad = 0 ] && echo "fixed; invalidation $I; way back: sh capycoffee/about-live/back.sh"
exit $bad
