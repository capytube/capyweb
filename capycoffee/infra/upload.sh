#!/bin/zsh
# Upload the Capycoffee build to the stack's bucket with an explicit Content-Type per extension
# (the security-headers policy sends nosniff). Usage: infra/upload.sh <bucket> [build dir]
set -eu
B=$1; D=${2:-$HOME/.cache/capycoffee/out20260908}
P=(--profile capy --region us-east-1 --only-show-errors)
typeset -A T=(html 'text/html; charset=utf-8' js 'text/javascript; charset=utf-8' css 'text/css; charset=utf-8'
  txt 'text/plain; charset=utf-8' webp image/webp svg 'image/svg+xml' ico image/x-icon woff2 font/woff2)
n=$(find $D -type f | wc -l | tr -d ' ')
# Refuse before uploading anything if a file has an extension this script has no Content-Type for.
unknown=$(find $D -type f | sed 's/.*\.//' | sort -u | while read e; do [ -n "${T[$e]-}" ] || echo $e; done)
[ -z "$unknown" ] || { echo "upload.sh: no Content-Type for: $unknown" >&2; exit 1; }
k=0
for ext ct in ${(kv)T}; do
  # hashed assets never change; everything else may, so it is re-checked every 5 minutes
  aws s3 cp $D/_next/static s3://$B/_next/static --recursive $P --exclude '*' --include "*.$ext" --content-type "$ct" --cache-control 'public,max-age=31536000,immutable'
  aws s3 cp $D s3://$B --recursive $P --exclude '*' --include "*.$ext" --exclude '_next/static/*' --content-type "$ct" --cache-control 'public,max-age=300'
  k=$((k + $(find $D -type f -name "*.$ext" | wc -l)))
done
[ $k -eq $n ] || { echo "upload.sh: $((n-k)) files have an extension with no Content-Type here" >&2; exit 1; }
echo "uploaded $n files to s3://$B"
