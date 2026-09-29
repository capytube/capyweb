#!/bin/bash
# Upload the three pass pictures the catalog names (image_url media/pass-*.png, backend seed) to the
# site stack's media bucket (dev only), then invalidate them. They are the same files as demo/assets/.
# Found missing on dev by the W14 QA: /shop showed broken images (403 from S3).
# Usage: infra/media/upload-pass-images.sh
set -euo pipefail
STAGE=dev   # production needs its own go (docs/WASM_PLAN.md)
export AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 AWS_PAGER=""
out() { aws cloudformation describe-stacks --stack-name "capyapp-capyweb-site-$STAGE" \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET=$(out MediaBucket); DIST=$(out DistributionId)
[ -n "$BUCKET" ] && [ "$BUCKET" != None ]
cd "$(dirname "$0")/../../web/fixtures/media"
for f in pass-*.png; do
  aws s3 cp "$f" "s3://$BUCKET/media/$f" --only-show-errors --content-type image/png \
    --cache-control "public,max-age=86400"
done
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/media/pass-*' \
  --query Invalidation.Id --output text
