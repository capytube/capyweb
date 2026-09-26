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

‡ **sparse**: `GSI2PK` is written **only** when `is_custom_request` is true and `approved` is null.
Approving or rejecting removes the attribute, and the item leaves the index. `GSI2` *is* the
moderation queue (issue `capyweb-x7w`) — no filter, no scan, and it costs nothing when empty.

`TokenTransaction` sharing the `USER#{id}` partition with the user's own `#META` item is the
load-bearing choice: appending a ledger entry and updating the balance is a single
`TransactWriteItems` **within one partition**. That is what makes the ledger safe (issue
`capyweb-3ge`).

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

## 6. Next

`capyweb-1iz` delivers this document. Implementation follows in `capyweb-qu7` (public reads) and
`capyweb-7hj` (authenticated writes). A thin `backend/src/lib/keys.ts` should own every key string
in section 2 so no handler builds one by hand.
