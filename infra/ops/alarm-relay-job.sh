#!/bin/bash
# capyweb alarm relay job (infra/ops/alarm-relay.yaml, infra/ops/alarm_relay.py; herdr-master 2026-09-30).
# capyweb-manager copies this to herdr-manager tools/capyweb-alarm-relay/read.sh, fills PIN and PROFILE below,
# and adds to tools/always-on/jobs.json:
#   {"name": "capyweb-alarm-relay", "cmd": "tools/capyweb-alarm-relay/read.sh", "every": 300, "timeout": 120}
# - Runs on the lease holder, but does nothing unless that is mac-mini-3.
# - Assumes capyapp-capyweb-alarm-reader with the admin profile; the reader gets only that session (Receive,
#   Delete and GetQueueAttributes on the one queue), never the profile. No access key anywhere.
# - Runs alarm_relay.py from the pinned reviewed commit (git archive), from a fetch-only clone; never from a
#   working tree.
# - The reader posts one herdr-ask per run and deletes messages only after the post succeeded.
# Arguments are passed to the reader (for example --dry-run).
set -uo pipefail
export PATH=/opt/homebrew/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin

PIN=""       # the reviewed commit of infra/ops/alarm_relay.py (40 hex digits)
PROFILE=""   # the admin profile on mac-mini-3 that may assume the reader role

REPO=$HOME/stacks/capyweb
log() { echo "$(date '+%F %T') capyweb-alarm-relay: $*"; }
[ "$(hostname -s)" = mac-mini-3 ] || { log "not mac-mini-3: skip"; exit 0; }
[[ $PIN =~ ^[0-9a-f]{40}$ ]] || { log "PIN is not a commit id"; exit 1; }
[ -n "$PROFILE" ] || { log "PROFILE is empty"; exit 1; }

umask 077
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
git -C "$REPO" fetch -q origin || { log "fetch failed"; exit 1; }
git -C "$REPO" cat-file -e "$PIN^{commit}" 2>/dev/null || { log "the pinned commit is not in the clone"; exit 1; }
git -C "$REPO" archive "$PIN" infra/ops/alarm_relay.py | tar -x -C "$tmp" || { log "archive failed"; exit 1; }

acct=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text 2>/dev/null) ||
  { log "the admin profile did not answer"; exit 1; }
aws sts assume-role --profile "$PROFILE" --role-arn "arn:aws:iam::$acct:role/capyapp-capyweb-alarm-reader" \
  --role-session-name capyweb-alarm-relay --duration-seconds 900 --output json >"$tmp/session.json" 2>/dev/null ||
  { log "assume-role failed"; exit 1; }
# Only the session goes to the reader: read from the private file into this shell's environment (export is a
# builtin, so the values are on no command line), and the profile is unset.
read -r ak sk st < <(python3 -c 'import json, sys
c = json.load(open(sys.argv[1]))["Credentials"]
print(c["AccessKeyId"], c["SecretAccessKey"], c["SessionToken"])' "$tmp/session.json")
rm -f "$tmp/session.json"
unset AWS_PROFILE AWS_DEFAULT_PROFILE
export AWS_ACCESS_KEY_ID=$ak AWS_SECRET_ACCESS_KEY=$sk AWS_SESSION_TOKEN=$st
unset ak sk st

out=$(taskpolicy -b python3 "$tmp/infra/ops/alarm_relay.py" \
  --queue-url "https://sqs.ap-southeast-1.amazonaws.com/$acct/capyapp-capyweb-alarm-relay" "$@" 2>&1); rc=$?
case " $* " in *" --dry-run "*) printf '%s\n' "$out" ;; *) log "$(printf '%s' "$out" | tail -1)" ;; esac
exit $rc
