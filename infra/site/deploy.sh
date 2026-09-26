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

# 4. content
aws s3 sync "$SRC/" "s3://$BUCKET/" --delete --exclude ".DS_Store"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --query Invalidation.Id --output text
echo "live: https://$DOMAIN/"
