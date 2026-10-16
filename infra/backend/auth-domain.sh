#!/bin/bash
# Sign-in on our own name (hm-nuhjd): turn the backend stack's custom managed-login domain
# (auth.<site domain>, infra/site/stages.json "auth") on or off. Cognito puts a custom domain on a
# CloudFront distribution of its own, so this needs cloudfront:UpdateDistribution, which the
# capyweb deploy users do not hold: for prod it runs as the deploy user with a temporary inline
# grant (capyweb-auth-prod, attached by nic just before and removed right after; never nic_cli).
#
#   AWS_PROFILE=<deploy user + grant> CAPYWEB_AUTH_GO=1 infra/backend/auth-domain.sh <stage> on    the way there
#   AWS_PROFILE=<deploy user + grant> CAPYWEB_AUTH_GO=1 infra/backend/auth-domain.sh <stage> off   the way back
#   AWS_PROFILE=<deploy user + grant> infra/backend/auth-domain.sh <stage> plan-on|plan-off         show only
#
# It changes only the parameters AuthDomain and AuthCertArn, on the template already deployed
# (every other parameter keeps its value), and runs the change set only if it is exactly the
# expected one, with no resource replaced. "on" needs the issued us-east-1 certificate (infra/site/deploy.sh <stage> cert auth);
# afterwards the DNS stack aliases the name (infra/site/deploy.sh <stage> dns <name>). "off" moves
# passkeys back to the Cognito prefix domain: passkeys made on the custom name stop working, users
# keep their accounts and sign in by e-mail code. Production also needs CAPYWEB_PROD_GO=1.
set -euo pipefail
cd "$(dirname "$0")/../.."
STAGE=${1:?usage: auth-domain.sh <stage> on|off|plan-on|plan-off}; MODE=${2:?mode}
export AWS_DEFAULT_REGION=ap-southeast-1 AWS_PAGER=""
die() { echo "auth-domain.sh: $*" >&2; exit 1; }
[ -n "${AWS_PROFILE:-}" ] || die "set AWS_PROFILE to a profile holding cloudfront:UpdateDistribution (the deploy user with the temporary grant)"
case $MODE in on|off) [ "${CAPYWEB_AUTH_GO:-}" = 1 ] || die "$MODE changes the live sign-in: set CAPYWEB_AUTH_GO=1 after the go" ;;
              plan-on|plan-off) ;; *) die "mode is on, off, plan-on or plan-off" ;; esac
[ "$STAGE" != prod ] || [ "${CAPYWEB_PROD_GO:-}" = 1 ] || die "production also needs CAPYWEB_PROD_GO=1"
ST=capyapp-capyweb-backend-$STAGE
NAME=$(python3 -c 'import json, sys; print(json.load(open("infra/site/stages.json"))[sys.argv[1]]["auth"])' "$STAGE")

if [ "${MODE#plan-}" = on ]; then
  CERT=$(aws acm list-certificates --region us-east-1 --certificate-statuses ISSUED \
         --query "CertificateSummaryList[?DomainName=='$NAME'].CertificateArn | [0]" --output text)
  [[ $CERT == arn:aws:acm:us-east-1:* ]] || die "no issued certificate for $NAME: run infra/site/deploy.sh $STAGE cert auth"
  SET=(ParameterKey=AuthDomain,ParameterValue=$NAME ParameterKey=AuthCertArn,ParameterValue=$CERT)
  WANT=$'Add\tUserPoolCustomDomain\tNone\nModify\tSignupCapPermission\tConditional\nModify\tUserPool\tFalse'
else
  SET=(ParameterKey=AuthDomain,ParameterValue= ParameterKey=AuthCertArn,ParameterValue=)
  WANT=$'Modify\tSignupCapPermission\tConditional\nModify\tUserPool\tFalse\nRemove\tUserPoolCustomDomain\tNone'
fi

# Every other parameter as it is now.
KEEP=$(aws cloudformation describe-stacks --stack-name "$ST" --query 'Stacks[0].Parameters[].ParameterKey' --output text)
for k in $KEEP; do
  case $k in AuthDomain|AuthCertArn) ;; *) SET+=("ParameterKey=$k,UsePreviousValue=true") ;; esac
done
CS=auth-domain-${MODE#plan-}-$(date +%H%M%S)
drop() { aws cloudformation delete-change-set --stack-name "$ST" --change-set-name "$CS" ||
         echo "auth-domain.sh: WARN could not delete change set $CS on $ST; delete it by hand" >&2; }
# Whatever ends this script before the execute (a refusal, an error, Ctrl-C), the change set goes.
LEFT=0; trap '[ "$LEFT" != 1 ] || drop' EXIT
aws cloudformation create-change-set --stack-name "$ST" --change-set-name "$CS" --use-previous-template \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --parameters "${SET[@]}" >/dev/null
LEFT=1   # made: from here every exit before the execute deletes it
aws cloudformation wait change-set-create-complete --stack-name "$ST" --change-set-name "$CS" || {
  aws cloudformation describe-change-set --stack-name "$ST" --change-set-name "$CS" --query StatusReason --output text >&2 || true
  die "change set $CS did not build (reason above; deleted, not run)"; }
# Replacement is compared too: a Modify UserPool that replaced the pool would lose every user.
GOT=$(aws cloudformation describe-change-set --stack-name "$ST" --change-set-name "$CS" \
      --query 'Changes[].ResourceChange.[Action,LogicalResourceId,Replacement]' --output text | sort) || {
  die "could not read change set $CS (deleted, not run)"; }
echo "change set $CS on $ST:"; echo "$GOT" | sed 's/^/  /'
[ "$GOT" = "$WANT" ] || { die "not the expected change (want: $(echo "$WANT" | tr '\n\t' '; ')); deleted, not run"; }
case $MODE in plan-*) echo "plan only: deleted, not run"; exit 0 ;; esac

aws cloudformation execute-change-set --stack-name "$ST" --change-set-name "$CS"
LEFT=0   # executed: CloudFormation owns it now
aws cloudformation wait stack-update-complete --stack-name "$ST" || die "$ST did not complete: see its events"
aws cognito-idp get-user-pool-mfa-config --user-pool-id \
  "$(aws cloudformation describe-stacks --stack-name "$ST" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)" \
  --query 'WebAuthnConfiguration.RelyingPartyId' --output text | sed 's/^/passkey relying party: /'
aws cloudformation describe-stacks --stack-name "$ST" \
  --query "Stacks[0].Outputs[?OutputKey=='ManagedLoginDomain'||OutputKey=='AuthDomainCdn'].[OutputKey,OutputValue]" --output text
echo "next: infra/site/deploy.sh $STAGE dns <change-set-name> (the capyweb lead), then the web deploy for config.json"
