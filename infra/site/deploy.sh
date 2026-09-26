#!/bin/bash
# Deploy the capyweb site: cert (us-east-1, validated through the capytube-dns role),
# site stack (capy account), DNS stack (autonomous-lab), then upload + invalidate.
# Usage: infra/site/deploy.sh [stage] [source-dir]     e.g. infra/site/deploy.sh dev demo
set -euo pipefail
cd "$(dirname "$0")/../.."
STAGE=${1:-dev}; SRC=${2:-demo}
DOMAIN=$STAGE.capytube.xyz
export AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 AWS_PAGER=""
ZONE=$(aws route53 list-hosted-zones-by-name --profile capytube-dns --dns-name capytube.xyz \
       --query 'HostedZones[0].Id' --output text); ZONE=${ZONE##*/}

# 1. certificate: reuse an issued one for the domain, else request + validate
CERT=$(aws acm list-certificates --region us-east-1 --certificate-statuses ISSUED \
       --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn | [0]" --output text)
if [ "$CERT" = "None" ]; then
  CERT=$(aws acm request-certificate --region us-east-1 --domain-name "$DOMAIN" --validation-method DNS \
         --tags Key=capy-scope,Value=capyapp Key=Project,Value=capyweb Key=Stage,Value=$STAGE \
         --query CertificateArn --output text)
  RR=null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    RR=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT" \
         --query 'Certificate.DomainValidationOptions[0].ResourceRecord' --output json)
    [ "$RR" != "null" ] && break; sleep 3
  done
  N=$(echo "$RR" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Name"])')
  V=$(echo "$RR" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Value"])')
  aws route53 change-resource-record-sets --profile capytube-dns --hosted-zone-id "$ZONE" --change-batch \
    "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$N\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"$V\"}]}}]}" >/dev/null
  aws acm wait certificate-validated --region us-east-1 --certificate-arn "$CERT"
fi
echo "cert: $CERT"

# 2. site stack (capy account)
aws cloudformation deploy --stack-name capyapp-capyweb-site-$STAGE --template-file infra/site/template.yaml \
  --tags Project=capyweb Stage=$STAGE capy-scope=capyapp --no-fail-on-empty-changeset \
  --parameter-overrides Stage=$STAGE DomainName=$DOMAIN CertArn=$CERT
out() { aws cloudformation describe-stacks --stack-name capyapp-capyweb-site-$STAGE \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET=$(out Bucket); DIST=$(out DistributionId); CDN=$(out CdnDomain)

# 3. DNS (autonomous-lab, through the role)
aws cloudformation deploy --profile capytube-dns --stack-name capyapp-capyweb-dns-$STAGE \
  --template-file infra/site/dns.yaml --no-fail-on-empty-changeset \
  --parameter-overrides DomainName=$DOMAIN CdnDomain=$CDN

# 4. content, uploaded with explicit Cache-Control.
# This matters more than it looks. The SPA fallback serves index.html with status 200, so
# CloudFront caches it under the MISSING path's URL according to that object's cache headers -
# ErrorCachingMinTTL does not apply to a 200. Without no-cache on index.html, a stale asset URL
# would serve HTML for the full default TTL (24h), long after a redeploy.
aws s3 sync "$SRC/" "s3://$BUCKET/" --delete --exclude ".DS_Store" --exclude "index.html" \
  --exclude "assets/*" --cache-control "public,max-age=300"
aws s3 sync "$SRC/assets/" "s3://$BUCKET/assets/" --delete --exclude ".DS_Store" \
  --cache-control "public,max-age=86400"
aws s3 cp "$SRC/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache,must-revalidate" --content-type "text/html; charset=utf-8"

# `s3 sync` compares size and mtime, not metadata, so an UNCHANGED file keeps whatever
# Cache-Control it was uploaded with. Changing the policy above therefore has no effect on
# files that did not change - re-stamp them explicitly. Cheap: these are small and few.
aws s3 cp "s3://$BUCKET/" "s3://$BUCKET/" --recursive --exclude "index.html" --exclude "assets/*" \
  --metadata-directive REPLACE --cache-control "public,max-age=300" >/dev/null
aws s3 cp "s3://$BUCKET/assets/" "s3://$BUCKET/assets/" --recursive \
  --metadata-directive REPLACE --cache-control "public,max-age=86400" >/dev/null
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --query Invalidation.Id --output text
echo "live: https://$DOMAIN/"

# 5. CloudFront egress alarm. us-east-1 is not a choice: CloudFront publishes its metrics only
# there, whatever region the distribution serves from.
aws cloudformation deploy --stack-name capyapp-capyweb-alarms-$STAGE --region us-east-1 \
  --template-file infra/site/alarms-use1.yaml --no-fail-on-empty-changeset \
  --tags Project=capyweb Stage=$STAGE capy-scope=capyapp \
  --parameter-overrides Stage=$STAGE DistributionId="$DIST"
echo "egress alarm: capyapp-capyweb-$STAGE-cloudfront-egress (us-east-1)"
