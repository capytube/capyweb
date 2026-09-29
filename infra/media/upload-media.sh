#!/bin/bash
# Upload the output of make-recordings.sh to the site stack's media bucket (dev only), with an
# explicit Content-Type and Cache-Control per file type, then invalidate the video paths.
# Usage: infra/media/upload-media.sh <dir made by make-recordings.sh>
#
# Paths on the site (docs/VIDEO_DESIGN.md section 8):
#   media/rec/<camera>/index.m3u8   public recording   https://<site>/media/rec/<camera>/index.m3u8
#   media/capytube-stream.mp4       the reel           https://<site>/media/capytube-stream.mp4
#   paid/<camera>/index.m3u8        paid recording     /paid/* needs the signed cookies
set -euo pipefail
SRC=${1:?dir made by make-recordings.sh}
STAGE=dev   # production needs its own go (docs/WASM_PLAN.md)
export AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 AWS_PAGER=""
out() { aws cloudformation describe-stacks --stack-name "capyapp-capyweb-site-$STAGE" \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET=$(out MediaBucket); DIST=$(out DistributionId)
[ -n "$BUCKET" ] && [ "$BUCKET" != None ]

# A re-cut reuses segment names, so nothing here is immutable: a day at the edge, and an
# invalidation after each upload. --delete clears what a previous cut left in each prefix.
CC="public,max-age=86400"
for prefix in media paid; do
  [ -d "$SRC/$prefix" ] || continue
  aws s3 sync "$SRC/$prefix/" "s3://$BUCKET/$prefix/" --delete --only-show-errors --exclude '*' \
    --include '*.m4s' --include '*.mp4' --content-type video/mp4 --cache-control "$CC"
  # Playlists last, so no playlist names a segment that is not there yet.
  aws s3 sync "$SRC/$prefix/" "s3://$BUCKET/$prefix/" --delete --only-show-errors --exclude '*' \
    --include '*.m3u8' --content-type application/vnd.apple.mpegurl --cache-control "$CC"
done
aws s3 ls "s3://$BUCKET/" --recursive --summarize | tail -2
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/media/*' '/paid/*' \
  --query Invalidation.Id --output text
