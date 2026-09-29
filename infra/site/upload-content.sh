#!/bin/bash
# Content-only upload to a capyweb site stack: no stack, certificate or DNS steps, so it needs only
# the capy profile. Usage: infra/site/upload-content.sh <stage> <source-dir>
#   infra/site/upload-content.sh dev <dir with the WASM build and its config.json>
#   infra/site/upload-content.sh dev demo        # the way back to the static demo
# Same Cache-Control policy as infra/site/deploy.sh step 4,
# but every object is written from the local file with an explicit Content-Type: the S3-to-S3
# re-stamp in deploy.sh drops Content-Type, and browsers refuse module scripts served as
# binary/octet-stream.
set -euo pipefail
STAGE=${1:?stage}; SRC=${2:?source dir}
[ "$STAGE" = dev ] || { echo "only dev: production content waits for the W12 go" >&2; exit 1; }
[ -f "$SRC/index.html" ] || { echo "$SRC has no index.html" >&2; exit 1; }
export AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 AWS_PAGER=""
out() { aws cloudformation describe-stacks --stack-name "capyapp-capyweb-site-$STAGE" \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET=$(out Bucket); DIST=$(out DistributionId)

type_of() {
  case "$1" in
    *.html) echo "text/html; charset=utf-8" ;;
    *.js|*.mjs) echo "text/javascript; charset=utf-8" ;;
    *.css) echo "text/css; charset=utf-8" ;;
    *.json) echo "application/json" ;;
    *.wasm) echo "application/wasm" ;;
    *.svg) echo "image/svg+xml" ;;
    *.png) echo "image/png" ;;
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.webp) echo "image/webp" ;;
    *.ico) echo "image/x-icon" ;;
    *.mp4) echo "video/mp4" ;;
    *.m3u8) echo "application/vnd.apple.mpegurl" ;;
    *.m4s) echo "video/iso.segment" ;;
    *) echo "text/plain; charset=utf-8" ;;
  esac
}
cache_of() {
  case "$1" in
    index.html) echo "no-cache,must-revalidate" ;;
    assets/*) echo "public,max-age=86400" ;;
    *) echo "public,max-age=300" ;;
  esac
}

# Remove objects that are not in the new build (what `sync --delete` did).
comm -23 <(aws s3 ls "s3://$BUCKET/" --recursive | awk '{print $4}' | sort) \
         <(cd "$SRC" && find . -type f ! -name .DS_Store | sed 's#^\./##' | sort) |
  while read -r key; do aws s3 rm "s3://$BUCKET/$key" >/dev/null; done

# index.html last, so no page references assets that are not there yet.
(cd "$SRC" && find . -type f ! -name .DS_Store ! -path ./index.html | sed 's#^\./##'; echo index.html) |
  while read -r key; do
    aws s3 cp "$SRC/$key" "s3://$BUCKET/$key" --content-type "$(type_of "$key")" \
      --cache-control "$(cache_of "$key")" >/dev/null
  done
# Dev is not for search engines, whatever robots.txt the build carries (docs/CRAWLERS_NOTES.md).
printf '# dev: not for crawlers\nUser-agent: *\nDisallow: /\n' |
  aws s3 cp - "s3://$BUCKET/robots.txt" --content-type "text/plain; charset=utf-8" \
    --cache-control "public,max-age=300" >/dev/null
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --query Invalidation.Id --output text
