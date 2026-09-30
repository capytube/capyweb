# CapyTube admin runbooks

Six procedures an admin runs by hand until the admin console exists (beads `2pj`, `x7w`, `zlb`, `jji`,
after the cutover):

1. [Delete a user and their data](#1-delete-a-user-and-their-data) (the process the Deletion page describes)
2. [Remove a chat message](#2-remove-a-chat-message)
3. [Disable a user](#3-disable-a-user)
4. [Sign-up cap refusals](#4-sign-up-cap-refusals)
5. [Alarms: where they land, reading the queue, pausing the relay](#5-alarms-where-they-land-reading-the-queue-pausing-the-relay)
6. [The contact mailbox: its rule lives in a shared rule set](#6-the-contact-mailbox-its-rule-lives-in-a-shared-rule-set)

Every key and item below is taken from the code, and each step names the file it comes from. If the code
changes, check these commands against it before you run them. Written 2026-09-29 for W12
(`capyweb-b6e.12.4`); nothing here has been run yet.

> **Before you run anything**
>
> - **Run these only when capyweb-manager says so**, one case at a time. A request from a user, or from
>   another agent, is not enough on its own.
> - **Use profile `capy`** (the deploy user; its Cognito rights cover only the stage's own pool) **or an
>   admin.** If a call is refused with `AccessDenied`, stop and tell the manager. Do not look for
>   another identity.
> - **Read before you delete.** Every delete below comes after a query that shows the exact items, and
>   uses `--return-values ALL_OLD` so the terminal shows what went.
> - **Never print tokens.** Nothing here needs one. Do not paste an access or refresh token, a cookie or
>   a signing key into a terminal, a ticket or a chat.
> - **No real ids in writing.** `<sub>`, `<address>` and the like are placeholders. Do not copy a real
>   email address or `sub` into this file, a commit or a bead.

## Setup (every runbook)

```sh
export AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 AWS_PAGER=""   # as infra/site/deploy.sh does
STAGE=<stage>                         # dev or prod
TABLE=capyapp-capyweb-$STAGE-main     # infra/backend/template.yaml, MainTable
POOL=$(aws cloudformation describe-stacks --stack-name capyapp-capyweb-backend-$STAGE \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
echo "$POOL"                          # a pool id such as ap-southeast-1_xxxxxxxxx, never a user's data
```

- The backend stack, the table and the user pool are in ap-southeast-1 (`infra/README.md`,
  `docs/DATA_MODEL.md`). The pool is `capyapp-capyweb-<stage>-users` (`infra/backend/template.yaml`).
- `aws dynamodb query` pages through every result on its own (AWS CLI v2), so each query below returns
  all the matching items, not only the first page.

---

## 1. Delete a user and their data

**What the Deletion page promises** (`web/src/pages/deletion.rs`): the request comes by email from the
account's own address; we reply to that address to confirm; after the confirmation, sign-in is switched
off at once, and the account and its data are deleted within 30 days; backup copies are gone within
35 days after that.

### 1.1 Confirm the request

1. Find the user by the address the request came from:
   ```sh
   aws cognito-idp list-users --user-pool-id "$POOL" --filter 'email = "<address>"' \
     --query 'Users[].{username:Username,enabled:Enabled,status:UserStatus,attrs:Attributes}'
   ```
   The pool signs users in by email (`UsernameAttributes: [email]`), so `Username` is the user's `sub`.
   If nothing comes back, try the address in lower case. Two or more results: stop and ask the manager.
2. Note the `sub` (in `attrs`), then read the account once more by that `sub`:
   ```sh
   SUB=<sub>
   aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$SUB" \
     --query '{enabled:Enabled,status:UserStatus,attrs:UserAttributes}'
   ```
   Go on only if `email` matches the address that wrote, and `email_verified` is `true`.
3. **A From address can be forged.** Reply to the address **stored in Cognito** (not to a Reply-To in
   the request), say what will be deleted, and ask them to answer to confirm. Wait for that answer. The
   30 days start when it arrives.

### 1.2 Stop the account first, then wait 15 minutes

```sh
aws cognito-idp admin-disable-user --user-pool-id "$POOL" --username "$SUB"
aws cognito-idp admin-user-global-sign-out --user-pool-id "$POOL" --username "$SUB"
```

Then **wait 15 minutes** before you delete any item. The reason is in the code: an access token that
was already issued keeps working at the API for up to 15 minutes (`AccessTokenValidity: 15` in
`infra/backend/template.yaml`; API Gateway checks the token's signature and expiry itself, not whether
Cognito revoked it). During that time a call to `GET /me` or `POST /playback/{id}` runs
`ensureAccount()` (`backend/src/writes.ts` `getMe`, `backend/src/playback.ts` `buy`), which **creates
the user item again, with a new 50-coin sign-up grant** (`backend/src/lib/ledger.ts` `ensureAccount`).
A tab left open on the site calls `GET /me` on its own. Deleting first would let that recreate the
account behind you.

### 1.3 List everything that belongs to them

Every item the code writes with a user's id, from `backend/src/lib/keys.ts` and the handlers:

| Item | Key | Written by | How to find it |
|---|---|---|---|
| User (`entity: User`): `id`, `balance`, `display_name`, `last_chat_at`, `createdAt`, `updatedAt` | `USER#{sub}` / `#META` | `lib/ledger.ts` `ensureAccount`; `writes.ts` `putMe`, `claimChatSlot` | query A |
| Ledger entries (`TokenTransaction`), one per coin change, sign-up grant included | `USER#{sub}` / `TXN#{ts}#{id}`; also in GSI1 `TXN` and GSI2 `TXN#{id}` | `lib/ledger.ts` `txnItem` | query A |
| Idempotency markers (`Idempotency`): a fingerprint and the stored answer of one request; TTL 24 h | `USER#{sub}` / `IDEM#{key}` | `lib/ledger.ts` `buildTransaction` | query A |
| Paid-camera time (`PlaybackPass`): `paid_until` per paid camera; no TTL | `USER#{sub}` / `PASS#{stream_id}` | `playback.ts` `buy` | query A |
| Votes (`UserVote`), with `custom_request` text if they wrote one | `IXN#{interaction_id}` / `VOTE#{sub}#{id}`; GSI1 `USER#{sub}` / `VOTE#…`; a pending custom request is also in GSI2 `MODQ#vote` | `writes.ts` `vote` | query B |
| Bids (`UserBid`), `status` `high` or `outbid` | `IXN#{interaction_id}` / `BID#{amount}#{id}`; GSI1 `USER#{sub}` / `BID#…` | `writes.ts` `bid` | query B |
| Chat messages (`ChatComment`): `user_id`, a copy of `display_name`, `text`; TTL 30 days | `STREAM#{stream_id}` / `CHAT#{ts}#{id}`; **no index** | `writes.ts` `postChat` | query C |

Not theirs, and nothing to delete:

- **Reactions** are counters with no user id (`STREAM#{id}` / `REACTIONS`, `writes.ts` `react`). The
  totals keep their taps.
- **Other users' ledger entries.** When this user outbid someone, that person's `bid_refund` entry points
  at that person's own bid (`related_id` in `writes.ts` `bid`), not at this user.
- **An email address.** No handler writes one to the table: the user item has no GSI keys
  (`lib/ledger.ts` `ensureAccount`), so `gsi2.byEmail` in `keys.ts` is unused. Query D checks it.
- The NFT, offer, robot-slot and audit keys in `docs/DATA_MODEL.md` are reserved; no route writes them.
  Query B (the whole GSI1 `USER#{sub}` partition) and query D would show them if one ever did.

**Query A: the user's own partition** (user item, ledger, markers, paid-camera time):

```sh
aws dynamodb query --table-name "$TABLE" \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"USER#$SUB\"}}" \
  --projection-expression "PK, SK, #e, #t, amount, balance, display_name" \
  --expression-attribute-names '{"#e":"entity","#t":"type"}' --output table
```

**Query B: votes and bids** (and anything else ever indexed under the user in GSI1):

```sh
aws dynamodb query --table-name "$TABLE" --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"USER#$SUB\"}}" \
  --projection-expression "PK, SK, #e, interaction_id, amount, #s, number_of_votes, custom_request" \
  --expression-attribute-names '{"#e":"entity","#s":"status"}' --output table
```

**Query C: chat messages.** Chat has no index by author, so read each camera's chat and keep the
user's lines. First the camera ids (public and private; chat only runs on public ones, but a camera can
change):

```sh
for A in public private; do
  aws dynamodb query --table-name "$TABLE" --index-name GSI1 \
    --key-condition-expression "GSI1PK = :pk" \
    --expression-attribute-values "{\":pk\":{\"S\":\"STREAM#$A\"}}" \
    --query 'Items[].id.S' --output text
done
```

Then, with those ids:

```sh
for S in <stream id> <stream id>; do
  aws dynamodb query --table-name "$TABLE" \
    --key-condition-expression "PK = :pk AND begins_with(SK, :c)" \
    --filter-expression "user_id = :u" \
    --expression-attribute-values "{\":pk\":{\"S\":\"STREAM#$S\"},\":c\":{\"S\":\"CHAT#\"},\":u\":{\"S\":\"$SUB\"}}" \
    --projection-expression "PK, SK, display_name, #x, createdAt" \
    --expression-attribute-names '{"#x":"text"}' --output table
done
```

This reads every chat line kept for each camera (30 days at most, `CHAT_TTL_DAYS` in `writes.ts`), which
is a few read units at today's size.

**Query D: checks that should come back empty.**

```sh
aws dynamodb query --table-name "$TABLE" --index-name GSI2 \
  --key-condition-expression "GSI2PK = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"USER#$SUB\"}}" --query 'Count'
aws dynamodb query --table-name "$TABLE" --index-name GSI2 \
  --key-condition-expression "GSI2PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"EMAIL#<address in lower case>"}}' --query 'Count'
```

Anything but `0`: stop and ask the manager. The code does not write either today.

### 1.4 Check the hard cases before deleting

Look at every bid in query B with `status` `high`, and at every interaction they voted in. Read the
interaction (it lives under its capybara, so find it by id through GSI1, `keys.ts` `gsi1.interactionById`):

```sh
aws dynamodb query --table-name "$TABLE" --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk AND GSI1SK = :m" \
  --expression-attribute-values '{":pk":{"S":"IXN#<interaction id>"},":m":{"S":"#META"}}' \
  --projection-expression "PK, SK, title, #s, #r, closes_at, current_bid, bid_count" \
  --expression-attribute-names '{"#s":"status","#r":"result"}' --output table
```

An interaction is open unless `status` is set to something other than `open`, a `result` is set, or
`closes_at` has passed (`writes.ts` `isOpen`).

- **They hold the standing high bid on an open round.** Delete the bid anyway, and **leave the
  interaction's `current_bid` as it is.** What the code then does:
  - The next bid must still beat `current_bid` (`writes.ts` `bid`, `bid_too_low`), so nobody can win
    for less than was bid.
  - No refund is paid to anyone, because no remaining bid has `status` `high`; the deleted user's
    coins go with the account.
  - The top remaining bid is `outbid` and **was already refunded**. Do not lower `current_bid` to it:
    that would hand a win to someone who has their coins back.
  - Tell the manager, so that staff know: if the round closes with no bid at `status` `high`, it has no
    winner (or staff reopen it). `bid_count` keeps counting the deleted bid; it is a number with no name.
- **They won a round that is closed.** Delete the bid. If the interaction's `result` names them (their
  display name), ask the manager for the replacement wording, then change only that field:
  ```sh
  aws dynamodb update-item --table-name "$TABLE" \
    --key '{"PK":{"S":"<interaction PK>"},"SK":{"S":"<interaction SK>"}}' \
    --update-expression "SET #r = :r" --condition-expression "attribute_exists(PK)" \
    --expression-attribute-names '{"#r":"result"}' \
    --expression-attribute-values '{":r":{"S":"<wording from the manager>"}}' --return-values UPDATED_NEW
  ```
- **Votes.** No vote total is stored anywhere: the code writes each vote as its own item and nothing
  adds them up (`writes.ts` `vote`). Deleting their votes takes them out of any count made later. A
  result already declared stays as it is. A custom request waiting for review leaves the moderation
  queue (GSI2 `MODQ#vote`) with the item. Coins spent are not refunded (play coins have no cash value,
  `lib/economy.ts`).
- **Their display name on chat** is a copy in each chat item (`writes.ts` `postChat`), so it goes with
  the chat items from query C. Changing or deleting the user item does not touch it.

### 1.5 Delete the items

Put the keys from queries A, B and C into one file, read it, then delete line by line. Keys are made of
ids that match `^[A-Za-z0-9_-]{1,128}$` (`lib/http.ts` `requireId`), ISO timestamps and `#`, so they are
safe inside the JSON below.

```sh
umask 077; KEYS=$(mktemp)     # holds only keys; delete it at the end
aws dynamodb query --table-name "$TABLE" \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"USER#$SUB\"}}" \
  --query 'Items[].[PK.S,SK.S]' --output text >> "$KEYS"
aws dynamodb query --table-name "$TABLE" --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"USER#$SUB\"}}" \
  --query 'Items[].[PK.S,SK.S]' --output text >> "$KEYS"
for S in <stream id> <stream id>; do
  aws dynamodb query --table-name "$TABLE" \
    --key-condition-expression "PK = :pk AND begins_with(SK, :c)" \
    --filter-expression "user_id = :u" \
    --expression-attribute-values "{\":pk\":{\"S\":\"STREAM#$S\"},\":c\":{\"S\":\"CHAT#\"},\":u\":{\"S\":\"$SUB\"}}" \
    --query 'Items[].[PK.S,SK.S]' --output text >> "$KEYS"
done
wc -l "$KEYS"; cat "$KEYS"    # read it: every line must be USER#<sub>, IXN#… VOTE#/BID#, or STREAM#… CHAT#
```

When the list matches what queries A to C showed:

```sh
while IFS=$'\t' read -r P S; do
  aws dynamodb delete-item --table-name "$TABLE" \
    --key "{\"PK\":{\"S\":\"$P\"},\"SK\":{\"S\":\"$S\"}}" \
    --condition-expression "attribute_exists(PK)" \
    --return-values ALL_OLD --query '[Attributes.PK.S, Attributes.SK.S, Attributes.entity.S]' --output text
done < "$KEYS"
rm -f "$KEYS"
```

Deleting a base item also removes it from GSI1 and GSI2 (the ledger's `TXN` browse, the moderation
queue). Run queries A, B and C again: each must be empty.

### 1.6 Delete the Cognito user

```sh
aws cognito-idp admin-delete-user --user-pool-id "$POOL" --username "$SUB"
aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$SUB"   # expect UserNotFoundException
```

This removes the email address, the password (Cognito keeps only its own hash; our code never sees a
password, since sign-in happens on Cognito's managed login) and the `sub`. The address can sign up again
later as a new account with a new `sub`.

Then reply to the stored address to say it is done, and tell the manager: the date, the `sub` and the
number of items deleted. Keep no copy of the email address in the note, and drop the `sub` from it once
the 35 days in 1.7 are over.

### 1.7 What cannot be deleted at once, and why

| Where | How long | What it holds for this user |
|---|---|---|
| DynamoDB point-in-time recovery | **35 days** (`PointInTimeRecoveryEnabled: true` in `infra/backend/template.yaml`, with no `RecoveryPeriodInDays`, so AWS's default of 35) | Every deleted item can be restored for 35 days. **If the table is ever restored to a time before this deletion, run 1.3 to 1.5 again**; keep the `sub` and date for that purpose only until the 35 days are over. |
| CloudWatch Logs | **14 days** (`RetentionInDays: 14` on every function's log group in the template) | By design, **no user id and no email**. The handlers log only: `unhandled` with the request path and an error message (`lib/http.ts` `guard`; paths carry camera or interaction ids, never a user id); `signing key unavailable` with an error name (`playback.ts`); the health check's targets (`healthcheck.ts`). Lambda's own start and end lines carry request ids. An unexpected error message from AWS could in principle quote a value from the request; none is known. |
| API Gateway and CloudFront access logs | none | Not configured: neither template sets access logging (`infra/backend/template.yaml`, `infra/site/template.yaml`). |
| Chat items | 30 days | Deleted in 1.5. Left alone, they would expire by TTL (`CHAT_TTL_DAYS`, `writes.ts`); DynamoDB removes expired items usually within a few days of the expiry. |
| The pre-sign-up function (sign-up cap, being built in `b6e.12.2`) | 14 days, if its log group follows the rest | **To check when it lands:** its event carries the new user's email address, so it must not log the event. |

---

## 2. Remove a chat message

Chat is kept per camera (`STREAM#{stream_id}` / `CHAT#{ts}#{id}`, `keys.ts` `sk.chat`), newest last,
with no index by author (`docs/DATA_MODEL.md`). Times in the key are **UTC**.

1. **Find the camera.** The room's address is `/stream/<capybara id>`; the chat belongs to one of the
   camera tabs in that room. List the cameras:
   ```sh
   aws dynamodb query --table-name "$TABLE" --index-name GSI1 \
     --key-condition-expression "GSI1PK = :pk" \
     --expression-attribute-values '{":pk":{"S":"STREAM#public"}}' \
     --query 'Items[].{id:id.S,title:title.S,capybaras:capybara_ids.L[].S}' --output json
   ```
2. **Find the line** by the time the reporter gives, converted to UTC. A `~` after the end time takes in
   the whole of that minute (`~` sorts after every character a timestamp has):
   ```sh
   aws dynamodb query --table-name "$TABLE" \
     --key-condition-expression "PK = :pk AND SK BETWEEN :from AND :to" \
     --expression-attribute-values '{":pk":{"S":"STREAM#<stream id>"},":from":{"S":"CHAT#<YYYY-MM-DDTHH:MM>"},":to":{"S":"CHAT#<YYYY-MM-DDTHH:MM>~"}}' \
     --projection-expression "SK, display_name, #x, user_id" \
     --expression-attribute-names '{"#x":"text"}' --output table
   ```
   `user_id` is the author's `sub`. It is never sent to the site (`writes.ts` `chatOut`), so only this
   query shows who wrote the line; you need it for [Disable a user](#3-disable-a-user).
3. **Delete it**, with the exact `SK` from step 2:
   ```sh
   aws dynamodb delete-item --table-name "$TABLE" \
     --key '{"PK":{"S":"STREAM#<stream id>"},"SK":{"S":"<SK>"}}' \
     --condition-expression "attribute_exists(PK)" \
     --return-values ALL_OLD --query '[Attributes.display_name.S, Attributes.text.S]' --output text
   ```

**What readers see afterwards:**

- Anyone who opens the room, or loads it again, no longer sees the line after at most **5 seconds**:
  the chat read is `Cache-Control: public, max-age=5` (`CACHE_CHAT`, `writes.ts`), and the site's `/api/*`
  behaviour caches nothing (`Managed-CachingDisabled`, `infra/site/template.yaml`).
- **Viewers already in the room keep seeing it** until they reload or leave: the page adds new lines and
  never removes one it already shows (`merge_newest` in `web/src/pages/watch_room.rs`).
- The author is not told, and can post again at once unless you also [disable](#3-disable-a-user) them.

---

## 3. Disable a user

For abuse (chat, many accounts). Keeps their data; only sign-in stops. `<sub>` comes from the chat line
(runbook 2, step 2) or from `list-users` (runbook 1.1).

```sh
aws cognito-idp admin-disable-user --user-pool-id "$POOL" --username "<sub>"
aws cognito-idp admin-user-global-sign-out --user-pool-id "$POOL" --username "<sub>"
aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "<sub>" --query '{enabled:Enabled,status:UserStatus}'
```

- **At once:** they cannot sign in, and their refresh token (kept in the browser for up to 30 days,
  `RefreshTokenValidity: 30`) no longer gets new tokens.
- **For up to 15 more minutes**, an access token already issued still works at the API
  (`AccessTokenValidity: 15`; API Gateway's JWT authorizer checks signature and expiry, not revocation,
  `infra/backend/template.yaml` `CognitoJwt`). With it they can still: post chat (one line per 2 seconds,
  `writes.ts` `claimChatSlot`), react, vote, bid, and buy paid-camera time. Signed cookies from such a
  purchase last at most about 2 minutes past it (`paid_until` is at most 90 s ahead, plus 30 s grace:
  `playback.ts` `nextPass`, `GRACE_SECONDS`), and a signed cookie cannot be withdrawn.
- **So:** 15 minutes after disabling, run runbook 2 again for anything they posted in between.
- Their past chat lines stay up until removed (runbook 2) or until they expire after 30 days.

**Re-enable** (on the manager's word):

```sh
aws cognito-idp admin-enable-user --user-pool-id "$POOL" --username "<sub>"
```

They sign in again as before; their coins, votes and bids were never touched.

---

## 4. Sign-up cap refusals

Built in `capyweb-b6e.12.2` (`kbq`, `backend/src/signupcap.ts`): the pool's pre-sign-up function
`capyapp-capyweb-<stage>-signup-cap` refuses self sign-ups past a daily and an hourly cap (40 a UTC day
and 10 a UTC hour, the manager's decision of 2026-09-29; `SIGNUP_CAP_DAY` and `SIGNUP_CAP_HOUR` in
`infra/backend/template.yaml`). It counts in two items of the main table, `PK = SIGNUPS#<yyyy-mm-dd>`
with `SK = DAY` and `SK = HOUR#<hh>` (UTC), which TTL removes two days later (`docs/DATA_MODEL.md`).
Every refusal throws, so the function's own `Errors` (plus `Throttles`) raise the alarm
**`capyapp-capyweb-<stage>-signups-refused`** to the stage's topic `capyapp-capyweb-<stage>-alarms`.
Admin-created users (`admin-create-user`) are not counted or capped.

**What the alarm means.** At least one person tried to sign up and was refused because the cap was
reached. Until the hour or the day rolls over, **every** new sign-up is refused, real people included.
Signing in to an existing account is not affected. The cap exists because Cognito's default sender
delivers at most 50 emails a day for the whole account (`docs/RELEASE_PLAN.md` section 3), so a script
could otherwise use up the sign-up emails for everyone.

**Read it:**

```sh
aws cloudwatch describe-alarms --alarm-names capyapp-capyweb-$STAGE-signups-refused \
  --query 'MetricAlarms[].{state:StateValue,reason:StateReason,updated:StateUpdatedTimestamp}'
aws logs filter-log-events --log-group-name /aws/lambda/capyapp-capyweb-$STAGE-signup-cap \
  --start-time $(( ($(date +%s) - 86400) * 1000 )) \
  --filter-pattern '{ $.signup = "refused" }' \
  --query 'events[].[timestamp,message]' --output text
# Today's counts (read only):
aws dynamodb query --table-name capyapp-capyweb-$STAGE-main \
  --key-condition-expression 'PK = :p' --expression-attribute-values "{\":p\":{\"S\":\"SIGNUPS#$(date -u +%F)\"}}" \
  --query 'Items[].[SK.S,n.N]' --output text
```

Each refusal logs one line, `{"signup":"refused","reason":"day_cap"|"hour_cap"|"error"}` (plus the
error's name for `error`), and never the email address. A call throttled at the function's concurrency
of 2 leaves no line; it shows only in the alarm's `Throttles`.

Look at when the refusals came: a burst within minutes is a script; a steady trickle over the day is
real interest. `reason: error` means the function failed (a DynamoDB error, for example) and refused
to be safe: tell the manager.

**What to do.**

- A burst: nothing, the cap did its job. Tell the manager. If it repeats, the manager decides whether to
  add more (`docs/RELEASE_PLAN.md` section 3 lists the options and their cost).
- Real people refused: tell the manager. **Raising the cap is a change to a template parameter of the
  backend stack**, deployed through the manager like any other change. It is not done by editing the
  counter item. Mind the 50-a-day email limit when choosing the new number.

---

## 5. Alarms: where they land, reading the queue, pausing the relay

Built in `capyweb-b6e.12.6`, the design of herdr-master and capyweb-manager on 2026-09-30. There is no
email, so nobody has a confirmation link to click.

**Where they land: the capyweb room.**
- The five capyweb topics deliver to one SQS queue, `capyapp-capyweb-alarm-relay` in ap-southeast-1
  (`infra/ops/alarm-relay.yaml`):
  - `capyapp-capyweb-<stage>-alarms` and `capyapp-capyweb-<stage>-egress-alarm` for dev and prod;
  - `capyapp-capyweb-alerts` (the budget).
- Every 5 minutes, the herdr-manager job `capyweb-alarm-relay` on Mac mini 3 runs
  `tools/capyweb-alarm-relay/read.sh`, a copy of `infra/ops/alarm-relay-job.sh`.
- The job assumes the role `capyapp-capyweb-alarm-reader` and runs `infra/ops/alarm_relay.py` from a
  pinned, reviewed commit.
- The reader posts **one line per alarm** that went to ALARM, or came back to OK from ALARM. It sends
  all of a run's lines in **one** `herdr-ask --project capyweb --post`:

```
[capyweb prod] site-down: ALARM at 01:23 +07 — Threshold Crossed: 1 out of the last 1 datapoints [0.0 (…
[capyweb prod] site-down: OK at 01:41 +07 — Threshold Crossed: …
[capyweb] notice on alerts
```

- **What is skipped:** transitions into or out of INSUFFICIENT_DATA are dropped.
- **Other messages:** anything that is not an alarm, such as a budget notice, becomes
  `[capyweb] notice on <topic>` with no body. **Look at the budget in the console** when that appears.
- **Sanitising:** the room is read by people outside the team, so each line carries no account id, ARN,
  hostname, e-mail address, IP address or URL (`sanitise()` and its tests in
  `infra/ops/test_alarm_relay.py`).
- **Deletion:** messages are deleted only after the post succeeded. A failed run leaves them for the next
  one.
- **Retention:** the queue keeps a message for **4 days**. A job that is down longer loses the oldest
  alarms, but the alarm itself still shows its state (below).

**What each alarm means** is in `infra/README.md` ("The backend alarms"). The alarm's own state is the
truth. The room only reports changes:

```sh
for R in ap-southeast-1 us-east-1; do
  aws cloudwatch describe-alarms --region $R --alarm-name-prefix capyapp-capyweb-$STAGE \
    --query 'MetricAlarms[].[AlarmName,StateValue,StateUpdatedTimestamp]' --output text
done
```

Before the switch (G3), `capyapp-capyweb-prod-site-down` is in ALARM on purpose: its probe cannot
resolve the apex yet.

**Read the queue by hand**, on Mac mini 3, with nothing posted and nothing deleted:

```sh
~/stacks/herdr-manager/tools/capyweb-alarm-relay/read.sh --dry-run
```

It prints the lines a run would post, then one summary line. The messages it read stay hidden for
2 minutes (the queue's visibility timeout), then the next run sees them again. To count what is waiting
without reading it, as an admin: `aws sqs get-queue-attributes --queue-url <the queue's URL>
--attribute-names ApproximateNumberOfMessages`. Do not paste the queue's URL into a room: it carries the
account id.

**Pause the relay.** Ask capyweb-manager: the job is an entry named `capyweb-alarm-relay` in herdr-manager
`tools/always-on/jobs.json`, and taking that entry out stops it. Messages wait in the queue for up to
4 days. When the job comes back, its first run posts everything still waiting, in one post, in time order.
The job's log is one summary line per run. `FAILED` means nothing was deleted that had not been posted.

**Stop a noisy alarm** without losing the others: fix what it measures, or change the alarm in its
template through the usual change set. Do not unsubscribe the queue from a topic. The relay is how every
alarm reaches the team.

## 6. The contact mailbox: its rule lives in a shared rule set

Built in `capyweb-puq` (capyweb-manager, 2026-09-30). The stacks, the proof and the rollback are in
`infra/mail/README.md`.

**How mail to contact@capytube.xyz arrives.**
- SES in ap-southeast-1 receives it through one rule, `capyweb-contact`, in our stack
  `capyapp-capyweb-contact-mail`.
- The rule sits in the account's one active receipt rule set, `opensign-test-inbox`, which belongs to another
  project (its stack `opensign-serverless-test`, resource `InboxRuleSet`). Ours comes after their only rule,
  `store`.
- Our rule matches only contact@capytube.xyz and ends with a Stop, so their rules never see our mail.
- It stores the raw mail in our bucket (90 days), and the forwarder sends it on to the address in SSM.
  **Never print that address**, and never put it in a room, a commit or a bead.

**The risk.**
- If the other project deletes its stack or replaces the rule set, our rule goes with it. Mail to contact@
  then bounces, and nothing of ours alarms.
- The other project has promised to tell capyweb-manager first, and to move the set to a new owner.

**The check**, as an admin; the deploy user may not read receipt rules. Run it at G3's +5 minutes
(`node scripts/live-checks.mjs prod --alarms` prints it) and whenever contact mail seems quiet:

```sh
aws ses describe-active-receipt-rule-set --region ap-southeast-1 \
  --query '[Metadata.Name, Rules[].Name]' --output text
```

It should show `opensign-test-inbox`, then `store` and `capyweb-contact`.

**If `capyweb-contact` is missing**, and the set is still `opensign-test-inbox`, recreate it with two
updates of `capyapp-capyweb-contact-mail` (same template, change sets as in `infra/mail/README.md` step 1,
`--change-set-type UPDATE`, every other parameter `UsePreviousValue=true`):
1. `ReceiveMail=false`. CloudFormation still believes the rule exists, and this takes it out of the stack.
   The rule is already gone, so its delete may fail in the cleanup phase; the stack still ends
   `UPDATE_COMPLETE`. If it ends anywhere else, stop and tell capyweb-manager.
2. `ReceiveMail=true`, with `AfterRule` set to the rule ours should follow. If `store` is no longer in the
   set, ask capyweb-manager where ours goes before this step. It creates the rule afresh.
3. Run the check again, then send a test mail as in the README's proof.

Do not rename the rule's logical id instead: the rule's name is fixed, so the cleanup of the old logical id
would delete the new rule by that name.

**If the active set is gone or has another name:**
- stop, and tell capyweb-manager;
- never create or activate a rule set yourself: the account has only one active set per region, and other
  projects' mail depends on it.
