# Contact mail: contact@capytube.xyz

Mail to contact@capytube.xyz is received by SES in ap-southeast-1 (account capy) and forwarded to one private
address. That address is an SSM SecureString; it is never in this repo, in a log or in a command's output.

| File | What |
|---|---|
| `contact-mail.yaml` | Stack `capyapp-capyweb-contact-mail` (capy account, ap-southeast-1): the SES identity with Easy DKIM, the raw-mail bucket, the receipt rule, the forwarder, its configuration set and the delivery log |
| `forwarder.py` | The forwarder (Python 3.12, stdlib and boto3). Tests: `python3 -B infra/mail/test_forwarder.py`, also run by `scripts/guard.sh` |
| `mail-dns.yaml` | Stack `capyapp-capyweb-mail-dns` (DNS account, ap-southeast-1): the MX and the three DKIM CNAMEs, nothing else |

How a mail travels: MX -> SES -> receipt rule `capyweb-contact` in the account's active rule set
`opensign-test-inbox` (another project's; we add one rule to it and never create or activate a set) -> the raw
mail to `s3://capyapp-capyweb-contact-mail-<account>/inbound/<messageId>` -> the forwarder (async) -> SES
`SendRawEmail` from contact@capytube.xyz to the forward address -> SES events -> the log group
`/aws/events/capyapp-capyweb-contact-mail`. The rule ends with a Stop, so the other project's rules never see
our mail.

The mail DNS is its own stack, separate from the apex stack `capyapp-capyweb-dns-<stage>`, so a rollback of the
apex never takes mail down. It adds no TXT: the apex keeps its one TXT (site verification), and SPF is unchanged.

## Parameters

| Stack | Parameter | What | Who sets it |
|---|---|---|---|
| contact-mail | `AfterRule` | The rule in `opensign-test-inbox` that ours goes after. Default `store` (their only rule, one recipient on their own test domain, no Stop). Empty = ours goes first | manager: deploy with `store` |
| contact-mail | `ForwardToParameterName` | Name of the SSM SecureString with the forward address. Default `/capyapp/capyweb/contact/forward-to` | manager: keep the default |
| contact-mail | `AlarmTopicArn` | SNS topic for the forwarder's `Errors` alarm (ALARM and OK). Empty = no alarm. `capyapp-capyweb-prod-alarms` reaches the capyweb room through the alarm relay | manager |
| contact-mail | `ReceiveMail` | `true` (default): our rule is in the shared set. `false` takes the rule out and leaves the rest of the stack; `docs/RUNBOOKS.md` section 6 recreates a lost rule with `false`, then `true` | manager: keep the default |
| mail-dns | `DkimToken1`, `DkimToken2`, `DkimToken3` | The contact-mail stack's outputs of the same names, copied as they are. The template builds `<token>._domainkey.capytube.xyz` -> `<token>.dkim.amazonses.com` | manager, from the outputs |
| (SSM) | `/capyapp/capyweb/contact/forward-to` | SecureString under the AWS managed key `aws/ssm`: the address mail goes to | manager, with the admin |

The forwarder's environment (`BUCKET`, `CONFIG_SET`, `FORWARD_TO_PARAM`) is set by the template.

## Deploy (the admin, with the manager)

Every step is run by an admin. `CAPY` is the admin profile of the capy account, `DNSADMIN` the admin profile of
the DNS account (autonomous-lab; the `capytube-dns` role cannot write MX). Run from the repo root.

**0. Check that SES has no identity for capytube.xyz yet** (the stack creates it; an existing one makes the
create fail). Expect `NotFoundException`:

```sh
aws sesv2 get-email-identity --profile "$CAPY" --region ap-southeast-1 --email-identity capytube.xyz \
  --query VerifiedForSendingStatus
```

**1. Package, make the change set, read it, execute it.** `aws cloudformation package` zips `forwarder.py` (the
function's `Code` is that local file) and uploads it under the shared SAM bucket's `capyapp-*` prefix, as the
backend's artifacts are.

```sh
OUT=$(mktemp -d)
aws cloudformation package --profile "$CAPY" --region ap-southeast-1 \
  --template-file infra/mail/contact-mail.yaml \
  --s3-bucket aws-sam-cli-managed-default-samclisourcebucket-x9uvrhw2yfp6 --s3-prefix capyapp-capyweb-contact-mail \
  --output-template-file "$OUT/contact-mail.packaged.yaml"
aws cloudformation create-change-set --profile "$CAPY" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-contact-mail --change-set-name <change-set> --change-set-type CREATE \
  --template-body "file://$OUT/contact-mail.packaged.yaml" --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=AfterRule,ParameterValue=store ParameterKey=AlarmTopicArn,ParameterValue=<topic ARN or empty> \
  --tags Key=Project,Value=capyweb Key=Stage,Value=prod
aws cloudformation wait change-set-create-complete --profile "$CAPY" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-contact-mail --change-set-name <change-set>
aws cloudformation describe-change-set --profile "$CAPY" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-contact-mail --change-set-name <change-set> \
  --query 'Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType,Replacement]' --output table
# read it, then:
aws cloudformation execute-change-set --profile "$CAPY" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-contact-mail --change-set-name <change-set>
aws cloudformation wait stack-create-complete --profile "$CAPY" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-contact-mail
```

For a later update, use `--change-set-type UPDATE` and package again.

**2. Set the forward address** (the manager types it; it is not echoed, not on a command line, and not printed):

```sh
read -rs -p 'Forward address: ' ADDR; echo
umask 077; F=$(mktemp)
ADDR="$ADDR" python3 -c 'import json, os, sys
json.dump({"Name": "/capyapp/capyweb/contact/forward-to", "Type": "SecureString", "Value": os.environ["ADDR"],
           "Overwrite": True}, open(sys.argv[1], "w"))' "$F"
aws ssm put-parameter --profile "$CAPY" --region ap-southeast-1 --cli-input-json "file://$F" >/dev/null && echo stored
rm -f "$F"; unset ADDR
```

No KMS key id: the default is `aws/ssm`. The forwarder reads it once per container, so after changing it, wait
for new containers or update the function's configuration to recycle them.

**3. Read the DKIM tokens:**

```sh
aws cloudformation describe-stacks --profile "$CAPY" --region ap-southeast-1 --stack-name capyapp-capyweb-contact-mail \
  --query "Stacks[0].Outputs[?starts_with(OutputKey,'Dkim')].[OutputKey,OutputValue]" --output table
```

**4. The DNS stack in the DNS account**, with the three `DkimToken` values:

```sh
aws cloudformation create-change-set --profile "$DNSADMIN" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-mail-dns --change-set-name <change-set> --change-set-type CREATE \
  --template-body file://infra/mail/mail-dns.yaml \
  --parameters ParameterKey=DkimToken1,ParameterValue=<t1> ParameterKey=DkimToken2,ParameterValue=<t2> \
               ParameterKey=DkimToken3,ParameterValue=<t3> \
  --tags Key=Project,Value=capyweb Key=Stage,Value=prod
aws cloudformation wait change-set-create-complete --profile "$DNSADMIN" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-mail-dns --change-set-name <change-set>
aws cloudformation describe-change-set --profile "$DNSADMIN" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-mail-dns --change-set-name <change-set> \
  --query 'Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType]' --output table
# read it (one MX, one record group of three CNAMEs), then:
aws cloudformation execute-change-set --profile "$DNSADMIN" --region ap-southeast-1 \
  --stack-name capyapp-capyweb-mail-dns --change-set-name <change-set>
dig +short MX capytube.xyz            # 10 inbound-smtp.ap-southeast-1.amazonaws.com.
dig +short CNAME <t1>._domainkey.capytube.xyz
```

**5. Wait for the identity to verify** (minutes to a few hours; both must read `true` / `SUCCESS`):

```sh
aws sesv2 get-email-identity --profile "$CAPY" --region ap-southeast-1 --email-identity capytube.xyz \
  --query '[VerifiedForSendingStatus,DkimAttributes.Status]' --output text
```

## The proof (run with the manager)

Send a mail to contact@capytube.xyz from another verified SES identity of the capy account (`<verified sender>`):

```sh
aws sesv2 send-email --profile "$CAPY" --region ap-southeast-1 --from-email-address '<verified sender>' \
  --destination ToAddresses=contact@capytube.xyz \
  --content 'Simple={Subject={Data="CapyTube contact test, no action needed"},Body={Text={Data="Test of the contact forwarder."}}}' \
  --query MessageId --output text
```

Then, a minute later, show the three pieces. None of these prints an address.

```sh
# a) the raw mail in S3 (the key is inbound/<SES messageId>)
aws s3api list-objects-v2 --profile "$CAPY" --region ap-southeast-1 \
  --bucket capyapp-capyweb-contact-mail-619071347239 --prefix inbound/ \
  --query 'reverse(sort_by(Contents,&LastModified))[:3].[LastModified,Key,Size]' --output table

# b) the forwarder's line: sesMessageId (the S3 key's id), verdicts, decision "forwarded", sentMessageId
aws logs filter-log-events --profile "$CAPY" --region ap-southeast-1 \
  --log-group-name /aws/lambda/capyapp-capyweb-contact-forwarder --filter-pattern '"sesMessageId"' \
  --start-time $(( ($(date +%s) - 1800) * 1000 )) --query 'events[].message' --output text

# c) the delivery record for that sentMessageId: "Email Sent" and "Email Delivered"
aws logs filter-log-events --profile "$CAPY" --region ap-southeast-1 \
  --log-group-name /aws/events/capyapp-capyweb-contact-mail --filter-pattern '"<sentMessageId>"' \
  --start-time $(( ($(date +%s) - 1800) * 1000 )) --query 'events[].message' --output text
```

If (b) shows `"decision": "error"`, its `error` is an AWS error code. `AccessDenied*` there means the role or its
permissions boundary lacks a grant (see the design notes). The mail stays in S3 either way.

## Rollback

To stop receiving but keep the stack (the bucket, the forwarder, the identity), update it with
`ReceiveMail=false`: only our rule leaves the shared set.

To remove everything, delete the DNS stack first (mail stops arriving), then the mail stack:

```sh
aws cloudformation delete-stack --profile "$DNSADMIN" --region ap-southeast-1 --stack-name capyapp-capyweb-mail-dns
aws cloudformation delete-stack --profile "$CAPY" --region ap-southeast-1 --stack-name capyapp-capyweb-contact-mail
```

- The DNS stack takes the MX and the three DKIM records with it; the apex and www records are untouched.
- The mail stack takes the rule `capyweb-contact` (only ours: the rule set and opensign's rules stay), the
  forwarder, its role, the configuration set, the events rule and the log policy, and the SES identity.
- The bucket is retained with its mail. A later create of the mail stack fails on the bucket name until the
  bucket is emptied and deleted.

## Design notes

- **Packaging:** plain CloudFormation, `aws cloudformation package`: it zips a single local `Code` file for an
  `AWS::Lambda::Function`, so only `forwarder.py` ships. No build step, so no SAM.
- **Delivery record:** SES configuration set `capyapp-capyweb-contact` -> EventBridge (default bus) -> rule
  `capyapp-capyweb-contact-mail-events` -> log group `/aws/events/capyapp-capyweb-contact-mail` (90 days). Each
  line reads `Email Delivered messageId=<id>`. The rule transforms the event first, because the full SES event
  carries the destination address and the original headers. CloudWatch Logs needs a resource policy for
  EventBridge to write; there are at most 10 per region per account, and this account is shared, so ours
  (`capyapp-capyweb-contact-mail-events`) names only this log group.
- **kms:Decrypt:** not in the role. The parameter is under the AWS managed key `aws/ssm`, whose key policy
  already allows Decrypt for every principal in the account when the call comes through SSM, and the key
  policy of an AWS managed key cannot be changed. The permissions boundary still applies: it must not leave out
  `kms:Decrypt`, or GetParameter fails.
- **Boundary:** the role is `capyapp-capyweb-contact-forwarder` and carries `capyapp-lambda-boundary`, like every
  backend function role. The boundary must allow `s3:GetObject` (it grants `s3:*` on `capyapp-*`),
  `ses:SendRawEmail`, `ssm:GetParameter` and `kms:Decrypt`. Whether it does can only be read in IAM:
  `aws iam get-policy --policy-arn arn:aws:iam::619071347239:policy/capyapp-lambda-boundary`, then
  `get-policy-version` with its default version.
- **The role** may send only as contact@capytube.xyz (`ses:FromAddress`), read only `inbound/*` of the bucket, and
  read only the one parameter.
- **What the forwarder drops:** spam or virus verdict FAIL; mail not for contact@capytube.xyz; any mail with an
  `X-CapyTube-Forwarded` header line, also one quoted inside a bounce or complaint report, so a failing
  forward cannot loop.
- **What it rewrites:** From becomes `"<name, or the sender's local part> via CapyTube contact"
  <contact@capytube.xyz>` (RFC 2047 for non-ASCII names); Reply-To is the original From address; To is the
  forward address. Cc, Bcc, Sender, Return-Path, every DKIM or ARC signature, Authentication-Results,
  Received-SPF, delivery and read-receipt headers, Resent-* and X-SES-* go. Subject, the other headers and the
  body are passed through byte for byte. It adds `X-CapyTube-Forwarded: 1`.
- **Too large, or refused:** SES v1 `SendRawEmail` takes up to 10 MB. A larger message, or one SES refuses
  (`MessageRejected`), becomes a short plain-text notice to the forward address with the bucket and key, and
  Reply-To the sender. Any other error fails the invocation (async: two retries, then the `Errors` alarm).
