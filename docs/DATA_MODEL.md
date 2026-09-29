# capyweb single-table data model

Table `capyapp-capyweb-<stage>-main`, deployed in ap-southeast-1.
Keys `PK`/`SK`, two overloaded indexes `GSI1` (`GSI1PK`/`GSI1SK`) and `GSI2` (`GSI2PK`/`GSI2SK`).

Replaces the 11 Amplify models. Access patterns below were read off the real call sites in
`src/api/*/index.ts`, not invented — every Amplify query in the repo appears in section 2.

Issue: `capyweb-1iz`. Rationale for one table over eleven: `docs/PLAN.md` §2 D2.

---

## 1. Conventions

| Rule | Why |
|---|---|
| `SK` of a parent item is `#META` | `#` sorts below every other prefix, so `Query(PK)` returns the parent first |
| Timestamps are ISO-8601 UTC, e.g. `2026-09-26T04:12:33.123Z` | lexicographic order == chronological order, so `ScanIndexForward:false` is "newest first" |
| Amounts in sort keys are zero-padded to 20 digits | lexicographic order == numeric order, so "highest bid" is a `Limit:1` reverse query |
| Every item carries `entity`, `id`, `createdAt`, `updatedAt` | `entity` makes items self-describing when scanning or exporting |
| `expiresAt` (epoch **seconds**) is the TTL attribute | free deletion of chat and expired offers; keeps storage and PITR small |
| **Only set `GSI1PK`/`GSI2PK` when that item needs that index** | a GSI is sparse: an item with no key attribute is not in the index at all |

That last rule is the cost lever. Both indexes project `ALL`, so an item present in both costs
**3 write units** (table + 2 indexes), not 1. Most items belong to one index or none.

---

## 2. Key map

`{}` marks a value substituted at write time. `ts` = ISO timestamp, `amt` = padded amount.

### Core

| Entity | PK | SK | GSI1PK / GSI1SK | GSI2PK / GSI2SK |
|---|---|---|---|---|
| User | `USER#{id}` | `#META` | `WALLET#{wallet}` / `#META` | `EMAIL#{email}` / `#META` |
| Capybara | `CAPY#{id}` | `#META` | `CAPY` / `NAME#{name}` | — |
| LiveStream | `STREAM#{id}` | `#META` | `STREAM#{access_type}` / `START#{ts}#{id}` | — |
| Interaction | `CAPY#{capybara_id}` | `IXN#{type}#{session_date}#{id}` | `IXN#{id}` / `#META` | — |
| ChatComment | `STREAM#{stream_id}` | `CHAT#{ts}#{id}` | — | — |

`Interaction` deliberately lives inside the capybara's item collection: "interactions for this
capybara of this type" becomes a `begins_with(SK, "IXN#vote#")` with no index at all. `GSI1` exists
only so an interaction can be fetched by its own id.

`ChatComment` uses no index and carries a TTL. Chat is the highest-volume, lowest-value data in the
system; it should cost one write unit and then delete itself.

### Money and participation

| Entity | PK | SK | GSI1PK / GSI1SK | GSI2PK / GSI2SK |
|---|---|---|---|---|
| UserVote | `IXN#{interaction_id}` | `VOTE#{user_id}#{id}` | `USER#{user_id}` / `VOTE#{ts}#{id}` | `MODQ#vote` / `{ts}#{id}` ‡ |
| UserBid | `IXN#{interaction_id}` | `BID#{amt}#{id}` | `USER#{user_id}` / `BID#{ts}#{id}` | — |
| TokenTransaction | `USER#{user_id}` | `TXN#{ts}#{id}` | `TXN` / `{ts}#{id}` | `TXN#{id}` / `#META` |
| Idempotency marker | `USER#{user_id}` | `IDEM#{key}` | — | — |
| ReactionCounts | `STREAM#{stream_id}` | `REACTIONS` | — | — |

‡ **sparse**: `GSI2PK` is written **only** when `is_custom_request` is true and `approved` is null.
Approving or rejecting removes the attribute, and the item leaves the index. `GSI2` *is* the
moderation queue (issue `capyweb-x7w`) — no filter, no scan, and it costs nothing when empty.

`TokenTransaction` sharing the `USER#{id}` partition with the user's own `#META` item is the
load-bearing choice: appending a ledger entry and updating the balance is a single
`TransactWriteItems` **within one partition**. That is what makes the ledger safe (issue
`capyweb-3ge`).

Added with the ledger (lane 4, `capyweb-3ge`/`capyweb-7hj`), no existing key changed:

- **User `#META` carries `balance` and is written only by `backend/src/lib/ledger.ts`.** It must stay
  out of both indexes: every coin change rewrites it, and each index would add a write unit per change.
  `GSI1`/`GSI2` on the user (wallet, email) stay unset until a feature needs them.
  It also holds `last_chat_at`, the per-user chat limit (see "Write API").
- **Idempotency marker** `IDEM#{key}`: the client's `Idempotency-Key` header, in the caller's own
  partition, put with `attribute_not_exists` in the same transaction as the balance update. It holds a
  fingerprint of the request and the response, so a retry replays the first answer. TTL 24 h.
- **Ids are deterministic**: a ledger entry's, vote's or bid's `id` is
  `sha256(user, key, role)` (22 base64url characters), so a replayed request can never mint a second
  entry under a new id.
- **UserBid** gains `status`: `high` for the standing bid, `outbid` once beaten. Retiring the old
  high bid is conditional on `status = high`, which is what makes a refund payable once.
- **ReactionCounts** is one small item per stream with a number per reaction. No index, so a reaction is
  one write unit. (The seed's `ratingCounts` map on the stream's `#META` is not used by the API.)
- The table now has **TTL on `expiresAt`** enabled in the template; chat (30 days) and markers use it.

### NFT

| Entity | PK | SK | GSI1PK / GSI1SK | GSI2PK / GSI2SK |
|---|---|---|---|---|
| NFT | `NFT#{id}` | `#META` | `NFT#SALE#{is_for_sale}` / `PRICE#{amt}#{id}` | `USER#{owner_id}` / `NFT#{id}` |
| Offer | `NFT#{nft_id}` | `OFFER#{amt}#{id}` | `USER#{from}` / `OFFER#{ts}#{id}` | — |
| ActivityLog | `NFT#{nft_id}` | `LOG#{ts}#{id}` | `USER#{from}` / `ALOG#{ts}#{id}` | — |

### Robot marketplace

From `src/domain/robotMarketplace.ts`. Not yet built — keys reserved so the shape is settled.

| Entity | PK | SK | GSI1PK / GSI1SK | GSI2PK / GSI2SK |
|---|---|---|---|---|
| Robot | `ROBOT#{id}` | `#META` | `ROBOT` / `STATUS#{status}#{id}` | — |
| Slot | `ROBOT#{robot_id}` | `SLOT#{startsAt}#{id}` | `SLOT#{status}` / `{startsAt}#{id}` | — |
| SlotBid | `SLOT#{slot_id}` | `BID#{amt}#{id}` | `USER#{bidder_id}` / `SBID#{ts}#{id}` | — |
| Entitlement | `SLOT#{slot_id}` | `ENT#{id}` | `USER#{owner_id}` / `ENT#{startsAt}#{id}` | — |
| ResaleListing | `ENT#{entitlement_id}` | `RESALE#{id}` | — | `RESALE#{status}` / `{expiresAt}#{id}` |
| Session | `SLOT#{slot_id}` | `SESSION#{id}` | — | — |
| SessionEvent | `SLOT#{slot_id}` | `SESSION#{session_id}#EV#{ts}` | — | — |

Session events append into the slot partition, so the full incident log for a session — commands,
heartbeats, staff interventions, the stop — is one query. The research note in Notion is explicit
that this log matters more than clever robot autonomy.

### Admin

| Entity | PK | SK | GSI1PK / GSI1SK |
|---|---|---|---|
| AuditLog | `AUDIT#{yyyy-mm-dd}` | `{ts}#{id}` | `USER#{actor_id}` / `AUDIT#{ts}` |

Partitioned by day so the write hotspot moves daily. Backs issue `capyweb-2pj`.

---

## 3. Every existing query, mapped

Each row is a real call site in `src/api/`. "Op" is the DynamoDB operation that replaces it.

| Existing call | Op | Key expression |
|---|---|---|
| `User.get({id})` | GetItem | `PK=USER#{id}, SK=#META` |
| `User.getUserByWalletAddress` | Query GSI1 | `GSI1PK=WALLET#{wallet}` |
| `User.getUserByEmailAddress` | Query GSI2 | `GSI2PK=EMAIL#{email}` |
| `Capybara.list()` | Query GSI1 | `GSI1PK=CAPY` |
| `LiveStream.list()` | Query GSI1 ×2 | `GSI1PK=STREAM#public` and `STREAM#private` |
| `LiveStream.list({access_type: public})` | Query GSI1 | `GSI1PK=STREAM#public` |
| `LiveStream.list({access_type: private})` | Query GSI1 | `GSI1PK=STREAM#private` |
| `LiveStream.get({id})` | GetItem | `PK=STREAM#{id}, SK=#META` |
| `Interactions.listByCapybara_idAndInteraction_type` | Query | `PK=CAPY#{id}, begins_with(SK,"IXN#{type}#")` |
| `ChatComments.listByStream_id` | Query | `PK=STREAM#{id}, begins_with(SK,"CHAT#")`, reverse |
| `UserVotes.listByInteraction_id` | Query | `PK=IXN#{id}, begins_with(SK,"VOTE#")` |
| `UserVotes.list()` (all) | Query GSI2 | pending queue only — see note below |
| `UserBids.listByInteraction_id` | Query | `PK=IXN#{id}, begins_with(SK,"BID#")`, reverse = highest first |
| `UserBids.list()` (all) | Query GSI1 | per user: `GSI1PK=USER#{id}, begins_with(GSI1SK,"BID#")` |
| `TokenTransaction.list()` | Query GSI1 | `GSI1PK=TXN`, reverse |
| `TokenTransaction.get({id})` | Query GSI2 | `GSI2PK=TXN#{id}` |
| `NFT.list()` | Query GSI1 ×2 | `GSI1PK=NFT#SALE#0` and `NFT#SALE#1` |
| `NFT.listNFTByIs_for_sale` | Query GSI1 | `GSI1PK=NFT#SALE#{0\|1}` |
| `NFT.listNFTByOwner_id` | Query GSI2 | `GSI2PK=USER#{owner_id}, begins_with(GSI2SK,"NFT#")` |
| `NFT.get({id})` | GetItem | `PK=NFT#{id}, SK=#META` |
| `Offers.listOffersByNftId` | Query | `PK=NFT#{id}, begins_with(SK,"OFFER#")`, reverse |
| `ActivityLog.listActivityLogsByNftId` | Query | `PK=NFT#{id}, begins_with(SK,"LOG#")`, reverse |

**No Scan anywhere.** The two `list()` calls that were genuinely unbounded —
`UserVotes.list()` and `UserBids.list()` — were only ever used to populate a Jotai atom; they
become per-interaction or per-user queries, which is what the screens actually need.

---

## 4. Two things that do not fit cleanly

Stated rather than hidden, because both need a decision.

**ActivityLog by buyer.** Amplify had `sellerActivityLog` (`from`) and `buyerActivityLog` (`to`).
`GSI1` indexes `from` only. To query "NFTs I bought" the log entry must be written twice — once
keyed to the seller, once to the buyer — costing one extra write unit per transfer. The alternative
is deriving it from current NFT ownership and skipping the index. Recommendation: **write the second
item.** Transfers are rare, the log is append-only, and a buyer's history is exactly the thing a
support request asks for.

**Global ledger browse.** `GSI1PK=TXN` puts every transaction in one index partition. At 100
customers (~30k writes/month) that is nowhere near the 1,000 WCU/partition limit. If volume grows,
shard it to `TXN#{yyyy-mm}` and have the admin ledger query the current month. Noted, not built.

---

## 5. Migration

Nothing to migrate unless Nic keeps the old Amplify data (open question Q3 in `docs/PLAN.md`).
The deployed dev table is empty. If the answer is "start fresh", this design costs nothing to adopt;
if it is "keep", the one-off is a read-only `Scan` per old table transformed into the keys above,
which needs a temporary grant since `capyapp-macbook-pro-14` cannot read `capyweb-*` tables.

## 6. Write API

Implemented in `backend/src/writes.ts` (function `capyapp-capyweb-<stage>-writes`). Every route but
the chat read sits behind the HTTP API's Cognito JWT authorizer (`CognitoJwt`), and only **access
tokens** are accepted (`token_use: access`; an ID token is 401). The caller is **only** the token's
`sub` claim; no route takes a user id, and every body is checked against an allow-list of fields, so a
`user_id`, `balance`, `cost` or `price` in a body is a 400. Responses are `no-store`, except the
public chat read (`public, max-age=5`). Errors are
`{"error": "...", "code": "..."}`; `code` is stable for clients to switch on. Coin numbers (starting
balance, chat and reaction costs, caps) are named constants in `backend/src/lib/economy.ts`, all
"free and no grants" until decided.

Anything that spends coins takes an `Idempotency-Key` header (8–64 of `A-Za-z0-9_-`, a UUID per user
action). Same key and same request: the first answer again, `200` with `"replayed": true`. Same key and
a different request: `409 idempotency_mismatch`.

| Route | Does | Success | Refusals |
|---|---|---|---|
| `GET /me` | the caller's account; creates it on first sight | 200 | 401 |
| `PUT /me` | set `display_name` (2–32 letters/digits, single `. _ - '` or space between; staff-like names reserved) | 200 | 400 |
| `GET /me/transactions?limit&cursor` | the caller's ledger, newest first | 200 | 400 bad cursor |
| `POST /interactions/{id}/votes` | vote; cost = `number_of_votes × vote_cost` (+ `custom_request_cost`) from the interaction item | 201 | 404, 409 `interaction_closed` `wrong_type` `not_priced` `no_custom` `insufficient_coins` |
| `POST /interactions/{id}/bids` | bid `amount` ≥ `current_bid + 1`; the outbid bidder is refunded | 201 | 404, 409 `interaction_closed` `bid_too_low` `insufficient_coins` |
| `GET /streams/{id}/chat?limit&cursor` | **public, no sign-in**: chat newest first, display names only; the first page also carries `reactions` | 200 | 400, 403 `private_stream`, 404 |
| `POST /streams/{id}/chat` | post one line (≤ 280 characters, ≤ 800 bytes), at most one per user per 2 s | 201 | 403 `private_stream`, 404, 409 `display_name_required`, 429 `slow_down` |
| `POST /streams/{id}/reactions` | one of `capylove capylike capywow capyangry capyfire` | 200 | 400, 403 `private_stream`, 404 |

Chat and reactions work only on streams whose `access_type` is exactly `public`. Anything else
(private, missing, unknown) is `403 private_stream` for reads, posts and reactions, until private
playback and payment exist (`capyweb-0m7`). A public verdict is cached 60 s per warm container.

The chat limit is folded into the user-item access posting already needed: one conditional
`UpdateItem` on `USER#{id}/#META` sets `last_chat_at` only if it is 2 s old or absent (and a display
name exists), and returns the display name. A post costs 2 write units (that update plus the chat
`Put`, both under 1 KB with no index) instead of 1 write + 0.5 read unit before. The two writes are not
in one transaction, which would double both; a failed `Put` only makes the user wait 2 s.

Reactions have **no per-user limit in v1**: only the HTTP API route throttle (10 rps, burst 20,
shared by all callers) and the function's reserved concurrency of 5 bound them. Each is 1 write unit.

An interaction is open unless `status` is set to anything but `open`, a `result` is declared, or
`closes_at` (ISO time) has passed. The same rule is re-checked inside the transaction, together with
the price, so closing or re-pricing an interaction mid-request refuses it instead of charging.
`session_date` does **not** close an interaction: staff close one with `status`, `result` or `closes_at`,
so seeded interactions with none of those stay open.
Reactions are counted on their own `REACTIONS` item; the seed's `ratingCounts` map on the stream's
`#META` is not read or written by the API.
Display names are **not unique**; only the reserved staff-like names are refused.

Examples (`Authorization: Bearer <access token>` on every request):

```http
GET /me
200 {"id":"0b6e…","display_name":null,"balance":0,"createdAt":"2026-09-29T08:00:00.000Z"}

PUT /me                         {"display_name":"Capy Fan"}
200 {"id":"0b6e…","display_name":"Capy Fan","balance":0,"createdAt":"…"}

GET /me/transactions?limit=2
200 {"items":[{"id":"q3…","type":"vote","amount":-2,"related_type":"vote","related_id":"Xy…",
     "createdAt":"…"}],"count":1,"cursor":"WyJ…"}

POST /interactions/snack-vote-1/votes   Idempotency-Key: 5d1c…   {"option_id":"carrots","number_of_votes":2}
201 {"vote":{"id":"Xy…","interaction_id":"snack-vote-1","option_id":"carrots","number_of_votes":2,
     "cost":2,"is_custom_request":false,"status":"counted"},"charged":2,"transaction_id":"q3…"}
    {"custom_request":"Mango please"} instead of option_id: status "pending_review", joins GSI2 MODQ#vote
409 {"error":"not enough coins","code":"insufficient_coins"}

POST /interactions/wall-bid-1/bids      Idempotency-Key: 9a7e…   {"amount":21}
201 {"bid":{"id":"Lk…","interaction_id":"wall-bid-1","amount":21,"status":"high"},"charged":21,
     "previous_bid_refunded":false,"transaction_id":"…"}
409 {"error":"a bid must be at least 22","code":"bid_too_low"}

POST /streams/main-cam/chat              {"text":"hello capy"}
201 {"message":{"id":"…","stream_id":"main-cam","display_name":"Capy Fan","text":"hello capy",
     "createdAt":"…"}}                  the id lets the client mark its own lines for the session
429 {"error":"one message every 2 seconds, please","code":"slow_down"}

GET /streams/main-cam/chat?limit=50      no Authorization; Cache-Control: public, max-age=5
200 {"items":[{"id":"…","stream_id":"main-cam","display_name":"Capy Fan","text":"hello capy",
     "createdAt":"…"}],"count":1,
     "reactions":{"capylove":3,"capylike":0,"capywow":1,"capyangry":0,"capyfire":0}}

POST /streams/main-cam/reactions         {"reaction":"capylove"}
200 {"reaction":"capylove","reactions":{"capylove":4,"capylike":0,"capywow":1,"capyangry":0,"capyfire":0}}
```

Chat lines never carry the author's `user_id` (their Cognito `sub`), and the shared read has no
per-viewer fields.

### The ledger transaction

One `TransactWriteItems` per coin-moving request, all or nothing:

| # | Item | Operation and condition |
|---|---|---|
| 1 | `USER#{caller}` / `IDEM#{key}` | Put, `attribute_not_exists(PK)` |
| 2 | `USER#{user}` / `#META` (per posting) | debit: `SET balance = balance - :amt` if `attribute_exists(PK) AND balance >= :amt`; credit: `+`, if `attribute_exists(PK)` |
| 3 | `USER#{user}` / `TXN#{ts}#{id}` (per posting) | Put, `attribute_not_exists(PK)`; never updated or deleted |
| 4+ | the records paid for: vote Put + interaction ConditionCheck (open, price unchanged); bid Put + interaction Update (open, `current_bid` unchanged) + old high bid `high → outbid` | as listed |

Invariants: a balance never goes below zero; a user's entries always add up to their balance; one key
charges once. A `TransactionConflict` or a changed record re-reads the state and retries (4 attempts,
then `409 conflict`).

## 7. Next

`capyweb-1iz` delivers this document. Implementation follows in `capyweb-qu7` (public reads) and
`capyweb-7hj` (authenticated writes). A thin `backend/src/lib/keys.ts` should own every key string
in section 2 so no handler builds one by hand.
