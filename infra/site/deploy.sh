#!/bin/bash
# Deploy the capyweb site one step at a time (docs/RELEASE_PLAN.md section 1). Each step says which
# account it touches. The DNS-account steps (cert, dns) run only when named, and every stack change
# is a change set that is shown here and executed by hand after reading it.
#
#   infra/site/deploy.sh <stage> content <dist> --web   a release build (scripts/build-release.sh <stage> <dist>)
#   infra/site/deploy.sh <stage> content <dir>          a plain static site: demo/ is the way back on dev
#   infra/site/deploy.sh <stage> stack <change-set>     the site stack                  (capy account)
#   infra/site/deploy.sh <stage> alarms <change-set>    the us-east-1 egress alarm stack (capy account)
#   infra/site/deploy.sh <stage> cert                   the us-east-1 certificate; its validation
#                                                       records go to the DNS account (capytube-dns)
#   infra/site/deploy.sh <stage> dns <change-set>       the DNS stack (DNS account). For prod this is
#                                                       the apex switch: herdr-master's go G3 only
#   infra/site/deploy.sh <stage> prune <dist>           lists old hashed files; deletes nothing
#
# Names, key group and headers-policy ids per stage: infra/site/stages.json. Production also needs
# CAPYWEB_PROD_GO=1, set only with herdr-master's go (through capyweb-manager).
set -euo pipefail
cd "$(dirname "$0")/../.."
STAGE=${1:?usage: infra/site/deploy.sh <stage> <command> ...}; CMD=${2:?command}; shift 2
export AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 AWS_PAGER=""
die() { echo "deploy.sh: $*" >&2; exit 1; }
cfg() { python3 -c 'import json, sys; print(json.load(open("infra/site/stages.json"))[sys.argv[1]][sys.argv[2]])' "$STAGE" "$1" 2>/dev/null ||
        die "no '$1' for stage '$STAGE' in infra/site/stages.json"; }
DOMAIN=$(cfg domain); WWW=$(cfg www)
[ "$STAGE" != prod ] || [ "${CAPYWEB_PROD_GO:-}" = 1 ] ||
  die "production needs herdr-master's go; then set CAPYWEB_PROD_GO=1 (docs/RELEASE_PLAN.md section 2)"
SITE=capyapp-capyweb-site-$STAGE; BACKEND=capyapp-capyweb-backend-$STAGE
out() { aws cloudformation describe-stacks --stack-name "$1" --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" \
        --output text; }
zone() { local z; z=$(aws route53 list-hosted-zones-by-name --profile capytube-dns --dns-name capytube.xyz \
         --query 'HostedZones[0].Id' --output text); echo "${z##*/}"; }

# An issued us-east-1 certificate whose names cover the stage's (both, for prod).
find_cert() {
  local arn
  for arn in $(aws acm list-certificates --region us-east-1 --certificate-statuses ISSUED \
               --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn" --output text); do
    [ -z "$WWW" ] && { echo "$arn"; return; }
    aws acm describe-certificate --region us-east-1 --certificate-arn "$arn" \
      --query Certificate.SubjectAlternativeNames --output text | tr '\t' '\n' | grep -qx "$WWW" && { echo "$arn"; return; }
  done
}

# Create a change set, show what it would do, and print the line that runs it. Never executes.
# Usage: change_set <region> <stack> <name> <template> <params.json> [--profile p] [tags...]
change_set() {
  local region=$1 stack=$2 name=$3 template=$4 params=$5; shift 5
  local prof=(); if [ "${1:-}" = --profile ]; then prof=(--profile "$2"); shift 2; fi
  local tags=(); [ $# -gt 0 ] && tags=(--tags "$@")
  local type=CREATE
  aws cloudformation describe-stacks ${prof[@]+"${prof[@]}"} --region "$region" --stack-name "$stack" >/dev/null 2>&1 && type=UPDATE
  aws cloudformation create-change-set ${prof[@]+"${prof[@]}"} --region "$region" --stack-name "$stack" --change-set-name "$name" \
    --change-set-type $type --template-body "file://$template" --parameters "file://$params" ${tags[@]+"${tags[@]}"} \
    --query Id --output text >/dev/null
  if ! aws cloudformation wait change-set-create-complete ${prof[@]+"${prof[@]}"} --region "$region" --stack-name "$stack" \
       --change-set-name "$name" 2>/dev/null; then
    aws cloudformation describe-change-set ${prof[@]+"${prof[@]}"} --region "$region" --stack-name "$stack" --change-set-name "$name" \
      --query StatusReason --output text
    return 1
  fi
  local changes
  changes=$(aws cloudformation describe-change-set ${prof[@]+"${prof[@]}"} --region "$region" --stack-name "$stack" \
    --change-set-name "$name" --query 'Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType,Replacement]' \
    --output text)
  echo "$changes"
  # The distribution and the buckets must never be replaced: a new distribution has a new domain
  # (the DNS points at the old one), and a replaced bucket is empty.
  if echo "$changes" | grep -E 'AWS::CloudFront::Distribution|AWS::S3::Bucket' | grep -qE '(True|Conditional)$'; then
    echo "WARNING: this change set replaces a distribution or a bucket. Do not execute it." >&2
  fi
  echo "Read it, then: aws cloudformation execute-change-set ${prof[*]+${prof[*]}} --region $region --stack-name $stack --change-set-name $name"
}

params_file() {  # key=value ... -> a CloudFormation parameters file (private temp)
  local f; f=$(mktemp); python3 - "$@" > "$f" <<'EOF'
import json, sys
print(json.dumps([{"ParameterKey": k, "ParameterValue": v} for k, v in (a.split("=", 1) for a in sys.argv[1:])]))
EOF
  echo "$f"
}

# Content types, written on every object from the local file: an S3-to-S3 re-stamp without
# --content-type turns everything into binary/octet-stream, and browsers refuse module scripts
# served that way (the bug in the first version of this script).
type_of() {
  case "$1" in
    *.html) echo "text/html; charset=utf-8" ;;
    *.js|*.mjs) echo "text/javascript; charset=utf-8" ;;
    *.css) echo "text/css; charset=utf-8" ;;
    *.json) echo "application/json" ;;
    *.xml) echo "application/xml" ;;
    *.wasm) echo "application/wasm" ;;   # streaming compilation refuses any other type
    *.svg) echo "image/svg+xml" ;;
    *.png) echo "image/png" ;;
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.webp) echo "image/webp" ;;
    *.ico) echo "image/x-icon" ;;
    *.woff2) echo "font/woff2" ;;
    *.mp4) echo "video/mp4" ;;
    *.m3u8) echo "application/vnd.apple.mpegurl" ;;
    *.m4s) echo "video/iso.segment" ;;
    *) echo "text/plain; charset=utf-8" ;;
  esac
}
# Trunk names a root file after a hash of its content (15 or 16 hex digits; the release build's
# boot-<hash>.js too), so such a file never changes and a visitor holding the previous index.html
# can still load the previous release's. snippets/ is NOT content-addressed: wasm-bindgen keeps
# the folder name when a snippet changes (checked 2026-09-29: two different chat.js under one name),
# so those are revalidated on every load.
HASHED='^[^/]+-[0-9a-f]{12,16}(_bg)?\.(wasm|js|css|png|svg|webp|woff2)$'
cache_of() {
  if [ "$1" = index.html ]; then echo "no-cache,must-revalidate"
  elif [[ $1 == snippets/* ]]; then echo "no-cache"
  elif [[ $1 =~ $HASHED ]]; then echo "public,max-age=31536000,immutable"
  elif [[ $1 == assets/* || $1 == vendor/* ]]; then echo "public,max-age=86400"
  else echo "public,max-age=300"; fi
}

case "$CMD" in
content)
  SRC=${1:?usage: deploy.sh <stage> content <dir> [--web]}; WEB=0; [ "${2:-}" = --web ] && WEB=1
  [ -f "$SRC/index.html" ] || die "$SRC has no index.html"
  BUCKET=$(out "$SITE" Bucket); DIST=$(out "$SITE" DistributionId)
  [ -n "$BUCKET" ] && [ "$BUCKET" != None ] || die "no bucket in $SITE"
  STAGED=$(mktemp -d); trap 'rm -rf "$STAGED"' EXIT
  cp -R "$SRC/." "$STAGED/"; rm -rf "$STAGED/fixtures"; find "$STAGED" -name .DS_Store -delete
  if [ "$WEB" = 1 ]; then
    [ "$(find "$STAGED" -maxdepth 1 -name '*.wasm' | wc -l | tr -d ' ')" = 1 ] || die "expected one .wasm in $SRC"
    # The release checks: no inline script (the CSP), and for prod no WebMCP at all.
    [ -x scripts/build-release.sh ] || die "scripts/build-release.sh is missing: its checks guard every web upload"
    scripts/build-release.sh --check "$STAGED" "$STAGE"
    # The stage's own sign-in settings, from the backend stack (public values).
    AUTH_DOMAIN=$(out "$BACKEND" ManagedLoginDomain); CLIENT=$(out "$BACKEND" UserPoolClientId)
    [ -n "$AUTH_DOMAIN" ] && [ "$AUTH_DOMAIN" != None ] || die "no ManagedLoginDomain in $BACKEND"
    AUTH_DOMAIN=$AUTH_DOMAIN CLIENT=$CLIENT python3 -c 'import json, os
print(json.dumps({"auth": {"domain": "https://" + os.environ["AUTH_DOMAIN"], "client_id": os.environ["CLIENT"]}}))' \
      > "$STAGED/config.json"
  fi
  # Only production is for crawlers (docs/CRAWLERS_NOTES.md), whatever robots.txt the build carries.
  [ "$STAGE" = prod ] || printf '# %s: not for crawlers\nUser-agent: *\nDisallow: /\n' "$STAGE" > "$STAGED/robots.txt"

  # Nothing is deleted: the previous release's files stay loadable (see prune). Hashed files that
  # are already there are skipped, since they cannot have changed. index.html goes last, so it
  # never names a file that is not there yet.
  aws s3api list-objects-v2 --bucket "$BUCKET" --query 'Contents[].Key' --output text | tr '\t' '\n' | sort > "$STAGED.keys"
  n=0; skipped=0
  while read -r key; do
    cc=$(cache_of "$key")
    if [[ $cc == *immutable ]] && grep -qxF "$key" "$STAGED.keys"; then skipped=$((skipped + 1)); continue; fi
    aws s3 cp "$STAGED/$key" "s3://$BUCKET/$key" --content-type "$(type_of "$key")" --cache-control "$cc" \
      --only-show-errors
    n=$((n + 1))
  done < <(cd "$STAGED" && find . -type f ! -path ./index.html | sed 's#^\./##' | sort; echo index.html)
  rm -f "$STAGED.keys"
  echo "uploaded $n files, $skipped hashed files already there"
  aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --query Invalidation.Id --output text
  ;;

stack)
  NAME=${1:?usage: deploy.sh <stage> stack <change-set-name>}
  CERT=$(find_cert); [ -n "$CERT" ] || die "no issued certificate covers $DOMAIN ${WWW}: run the cert step first"
  API=$(out "$BACKEND" ApiUrl)   # https://<id>.execute-api.<region>.amazonaws.com/<stage>
  [[ $API == https://*/* ]] || die "no ApiUrl in $BACKEND"
  API_HOST=${API#https://}; API_HOST=${API_HOST%%/*}
  P=$(params_file Stage="$STAGE" DomainName="$DOMAIN" WwwDomain="$WWW" CertArn="$CERT" \
      PlaybackKeyGroupId="$(cfg playbackKeyGroupId)" ApiDomain="$API_HOST" ApiOriginPath="/${API#https://*/}" \
      ResponseHeadersPolicyId="$(cfg responseHeadersPolicyId)" PriceClass="$(cfg priceClass)")
  trap 'rm -f "$P"' EXIT
  change_set ap-southeast-1 "$SITE" "$NAME" infra/site/template.yaml "$P" \
    Key=Project,Value=capyweb Key=Stage,Value="$STAGE" Key=capy-scope,Value=capyapp
  ;;

alarms)
  # us-east-1 is not a choice: CloudFront publishes its metrics only there.
  NAME=${1:?usage: deploy.sh <stage> alarms <change-set-name>}
  P=$(params_file Stage="$STAGE" DistributionId="$(out "$SITE" DistributionId)"); trap 'rm -f "$P"' EXIT
  change_set us-east-1 "capyapp-capyweb-alarms-$STAGE" "$NAME" infra/site/alarms-use1.yaml "$P" \
    Key=Project,Value=capyweb Key=Stage,Value="$STAGE" Key=capy-scope,Value=capyapp
  ;;

cert)
  CERT=$(find_cert)
  if [ -z "$CERT" ]; then
    names=("$DOMAIN"); [ -n "$WWW" ] && names+=("$WWW")
    CERT=$(aws acm request-certificate --region us-east-1 --domain-name "$DOMAIN" \
           --subject-alternative-names "${names[@]}" --validation-method DNS \
           --tags Key=capy-scope,Value=capyapp Key=Project,Value=capyweb Key=Stage,Value="$STAGE" \
           --query CertificateArn --output text)
    # One validation record per name; ACM fills them in a few seconds after the request.
    for _ in $(seq 20); do
      RECORDS=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT" \
                --query 'Certificate.DomainValidationOptions[].ResourceRecord' --output json)
      [ "$(echo "$RECORDS" | python3 -c 'import json, sys; r = json.load(sys.stdin); print(len([x for x in r if x]))')" = "${#names[@]}" ] && break
      sleep 3
    done
    BATCH=$(echo "$RECORDS" | python3 -c 'import json, sys
seen, changes = set(), []
for r in json.load(sys.stdin):
    if r and r["Name"] not in seen:
        seen.add(r["Name"])
        changes.append({"Action": "UPSERT", "ResourceRecordSet": {"Name": r["Name"], "Type": "CNAME", "TTL": 300,
                        "ResourceRecords": [{"Value": r["Value"]}]}})
print(json.dumps({"Changes": changes}))')
    aws route53 change-resource-record-sets --profile capytube-dns --hosted-zone-id "$(zone)" --change-batch "$BATCH" >/dev/null
    aws acm wait certificate-validated --region us-east-1 --certificate-arn "$CERT"
  fi
  echo "cert: $CERT"
  ;;

dns)
  NAME=${1:?usage: deploy.sh <stage> dns <change-set-name>}
  CDN=$(out "$SITE" CdnDomain); [[ $CDN == *.cloudfront.net ]] || die "no CdnDomain in $SITE"
  P=$(params_file DomainName="$DOMAIN" WwwDomain="$WWW" CdnDomain="$CDN"); trap 'rm -f "$P"' EXIT
  change_set ap-southeast-1 "capyapp-capyweb-dns-$STAGE" "$NAME" infra/site/dns.yaml "$P" --profile capytube-dns
  ;;

prune)
  # Hashed files that the given release does not use: candidates for deletion once no visitor can
  # still hold an index.html that names them. Printed with their dates for a person to review; the
  # delete commands are printed, never run (docs/WASM_PLAN.md section 5, rule 6).
  SRC=${1:?usage: deploy.sh <stage> prune <dist of the live release>}
  BUCKET=$(out "$SITE" Bucket)
  aws s3api list-objects-v2 --bucket "$BUCKET" --query 'Contents[].[Key,LastModified]' --output text |
    while read -r key when; do
      [[ $key =~ $HASHED ]] && [ ! -e "$SRC/$key" ] && echo "$when  aws s3 rm s3://$BUCKET/$key"
    done | sort
  ;;

*) die "unknown command '$CMD' (content, stack, alarms, cert, dns, prune)" ;;
esac
