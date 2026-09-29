// Authenticated API (capyweb-7hj, docs/PLAN.md B5): the caller's account, the play-coin ledger,
// votes, bids, chat and reactions. Every route sits behind the HTTP API's Cognito JWT authorizer,
// and the caller is ALWAYS callerId(e) - the verified `sub` claim - never anything the client sends.
// Routes are declared in infra/backend/template.yaml and documented in docs/DATA_MODEL.md "Write API".

import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { doc, TABLE, query, type Item } from "./lib/ddb.ts";
import { pk, sk, gsi1, gsi2, prefix, META, ts, ttl } from "./lib/keys.ts";
import {
  guard, json, okPrivate, created, notFound, requireId, parseLimit, qs, header, pathSegments, method,
  callerId, jsonBody, onlyFields, HttpError, type Event, type Response,
} from "./lib/http.ts";
import * as v from "./lib/validate.ts";
import {
  run, ensureAccount, getAccount, derivedId, fingerprint, type LedgerRequest, type Posting, type WriteItem,
} from "./lib/ledger.ts";
import {
  CHAT_COST, REACTION_COST, MAX_VOTES_PER_REQUEST, BID_MIN_INCREMENT, MAX_BID, REFUND_OUTBID,
} from "./lib/economy.ts";

/** Chat deletes itself (DynamoDB TTL on expiresAt): the highest-volume, lowest-value data we keep. */
export const CHAT_TTL_DAYS = 30;

// -- routing ------------------------------------------------------------------------------------

export type Route =
  | { kind: "getMe" }
  | { kind: "putMe" }
  | { kind: "listTransactions" }
  | { kind: "vote"; id: string }
  | { kind: "bid"; id: string }
  | { kind: "listChat"; id: string }
  | { kind: "postChat"; id: string }
  | { kind: "react"; id: string };

/** Pure dispatch on method and path. null = no such route; "method" = right path, wrong verb. */
export function matchRoute(m: string, seg: string[]): Route | "method" | null {
  const [a, id, sub] = seg;
  const is = (want: string, r: Route): Route | "method" => (m === want ? r : "method");
  if (a === "me") {
    if (seg.length === 1) return m === "GET" ? { kind: "getMe" } : m === "PUT" ? { kind: "putMe" } : "method";
    if (seg.length === 2 && id === "transactions") return is("GET", { kind: "listTransactions" });
    return null;
  }
  if (seg.length !== 3) return null;
  if (a === "interactions") {
    if (sub === "votes") return is("POST", { kind: "vote", id });
    if (sub === "bids") return is("POST", { kind: "bid", id });
  }
  if (a === "streams") {
    if (sub === "chat") return m === "GET" ? { kind: "listChat", id } : m === "POST" ? { kind: "postChat", id } : "method";
    if (sub === "reactions") return is("POST", { kind: "react", id });
  }
  return null;
}

// -- account ------------------------------------------------------------------------------------

async function getMe(user: string): Promise<Response> {
  return okPrivate(await ensureAccount(user));
}

async function putMe(e: Event, user: string): Promise<Response> {
  const body = jsonBody(e);
  onlyFields(body, ["display_name"]); // the balance and everything else are not the caller's to set
  const name = v.displayName(body.display_name);
  await ensureAccount(user);
  const out = await doc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: pk.user(user), SK: META },
    UpdateExpression: "SET display_name = :n, updatedAt = :now",
    ConditionExpression: "attribute_exists(PK)",
    ExpressionAttributeValues: { ":n": name, ":now": ts() },
    ReturnValues: "ALL_NEW",
  }));
  const a = out.Attributes ?? {};
  return okPrivate({ id: a.id, display_name: a.display_name, balance: a.balance, createdAt: a.createdAt });
}

/** The public shape of a ledger entry. Explicit, so a new internal attribute never leaks. */
const entryOut = (i: Item) => ({
  id: i.id, type: i.type, amount: i.amount, related_type: i.related_type, related_id: i.related_id, createdAt: i.createdAt,
});

async function listTransactions(e: Event, user: string): Promise<Response> {
  const r = await query({
    pk: pk.user(user), // the caller's own partition: there is no way to name another user here
    skPrefix: prefix.txn(),
    limit: parseLimit(qs(e, "limit")),
    cursor: qs(e, "cursor"),
    ascending: false, // newest first
  });
  const items = r.items.map(entryOut);
  return okPrivate({ items, count: items.length, cursor: r.cursor });
}

// -- interactions -------------------------------------------------------------------------------

/** Interaction keys never change, so where one lives is cached for the life of the container. */
const ixnLocation = new Map<string, { PK: string; SK: string }>();

async function loadInteraction(id: string): Promise<Item | undefined> {
  let loc = ixnLocation.get(id);
  if (!loc) {
    const k = gsi1.interactionById(id);
    const out = await doc.send(new QueryCommand({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
      ExpressionAttributeValues: { ":pk": k.GSI1PK, ":sk": k.GSI1SK },
      Limit: 1,
    }));
    const hit = out.Items?.[0];
    if (!hit || hit.entity !== "Interaction") return undefined;
    loc = { PK: String(hit.PK), SK: String(hit.SK) };
    if (ixnLocation.size > 1000) ixnLocation.clear();
    ixnLocation.set(id, loc);
  }
  // The index is eventually consistent; the base item, read consistently, is the truth.
  const got = await doc.send(new GetCommand({ TableName: TABLE, Key: loc, ConsistentRead: true }));
  return got.Item as Item | undefined;
}

/**
 * Open = not closed by staff, no result declared, and not past closes_at. The same rule is
 * re-checked INSIDE the transaction (openCondition), so closing an interaction mid-request wins.
 */
export function isOpen(i: Item, now: string): boolean {
  if (i.status !== undefined && i.status !== "open") return false;
  if (i.result !== undefined && i.result !== null) return false;
  if (typeof i.closes_at === "string" && i.closes_at <= now) return false;
  return true;
}

const OPEN_CONDITION =
  "attribute_exists(PK) AND attribute_not_exists(#result) AND (attribute_not_exists(#status) OR #status = :open)" +
  " AND (attribute_not_exists(closes_at) OR closes_at > :now)";
const openNames = { "#result": "result", "#status": "status" };

const closed = () => new HttpError(409, "this interaction is closed", "interaction_closed");

async function requireInteraction(id: string, type: "vote" | "bid", now: string): Promise<Item> {
  const i = await loadInteraction(id);
  if (!i) throw new HttpError(404, "interaction not found", "not_found");
  if (i.interaction_type !== type) throw new HttpError(409, `this interaction does not take ${type}s`, "wrong_type");
  if (!isOpen(i, now)) throw closed();
  return i;
}

const nonNegInt = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;

async function vote(e: Event, user: string, ixnId: string): Promise<Response> {
  const body = jsonBody(e);
  onlyFields(body, ["option_id", "number_of_votes", "custom_request"]);
  const key = v.idempotencyKey(header(e, "idempotency-key"));
  const votes = v.wholeNumber(body.number_of_votes ?? 1, "number_of_votes", 1, MAX_VOTES_PER_REQUEST);
  const custom = body.custom_request === undefined ? undefined : v.customRequest(body.custom_request);
  const optionId = body.option_id === undefined ? undefined : requireId(String(body.option_id), "option_id");
  if (custom !== undefined && optionId !== undefined) throw new HttpError(400, "send option_id or custom_request, not both");
  if (custom === undefined && optionId === undefined) throw new HttpError(400, "option_id or custom_request is required");

  const fp = fingerprint("vote", ixnId, optionId ?? null, votes, custom ?? null);
  const out = await run(user, key, fp, async () => {
    const now = ts();
    const i = await requireInteraction(ixnId, "vote", now);
    // The price is the interaction's, read here on the server. The client never sends one.
    if (!nonNegInt(i.vote_cost)) throw new HttpError(409, "this vote has no price set", "not_priced");
    let cost = votes * i.vote_cost;
    if (custom !== undefined) {
      if (!nonNegInt(i.custom_request_cost)) throw new HttpError(409, "this vote takes no custom requests", "no_custom");
      cost += i.custom_request_cost;
    } else {
      const options = Array.isArray(i.options) ? (i.options as Item[]) : [];
      if (!options.some((o) => o?.id === optionId)) throw new HttpError(400, "unknown option_id");
    }

    const voteId = derivedId(user, key, "vote");
    const txnId = cost > 0 ? derivedId(user, key, "debit") : undefined;
    const record: Item = {
      PK: pk.ixn(ixnId), SK: sk.vote(user, voteId), entity: "UserVote",
      id: voteId, interaction_id: ixnId, capybara_id: i.capybara_id, user_id: user,
      ...(optionId !== undefined && { option_id: optionId }),
      number_of_votes: votes, cost, is_custom_request: custom !== undefined,
      ...(custom !== undefined && { custom_request: custom, ...gsi2.pendingCustomVote(now, voteId) }),
      ...(txnId && { transaction_id: txnId }),
      createdAt: now, updatedAt: now,
      ...gsi1.userVote(user, now, voteId),
    };
    const priceNames = custom !== undefined ? " AND vote_cost = :vc AND custom_request_cost = :crc" : " AND vote_cost = :vc";
    const records: WriteItem[] = [
      { Put: { TableName: TABLE, Item: record, ConditionExpression: "attribute_not_exists(PK)" } },
      {
        ConditionCheck: {
          TableName: TABLE,
          Key: { PK: i.PK, SK: i.SK },
          // Closed, or re-priced, since we read it: refuse rather than charge the old price.
          ConditionExpression: OPEN_CONDITION + priceNames,
          ExpressionAttributeNames: openNames,
          ExpressionAttributeValues: {
            ":open": "open", ":now": now, ":vc": i.vote_cost,
            ...(custom !== undefined && { ":crc": i.custom_request_cost }),
          },
        },
      },
    ];
    const postings: Posting[] = cost > 0
      ? [{ userId: user, amount: -cost, type: "vote", related_type: "vote", related_id: voteId, role: "debit" }]
      : [];
    const req: LedgerRequest = {
      userId: user, idemKey: key, fingerprint: fp, postings, records,
      result: {
        vote: {
          id: voteId, interaction_id: ixnId, ...(optionId !== undefined && { option_id: optionId }),
          number_of_votes: votes, cost, is_custom_request: custom !== undefined,
          ...(custom !== undefined && { custom_request: custom }),
          status: custom !== undefined ? "pending_review" : "counted",
        },
        charged: cost,
        ...(txnId && { transaction_id: txnId }),
      },
    };
    return req;
  });
  return out.replayed ? okPrivate({ ...out.result, replayed: true }) : created(out.result);
}

async function bid(e: Event, user: string, ixnId: string): Promise<Response> {
  const body = jsonBody(e);
  onlyFields(body, ["amount"]);
  const key = v.idempotencyKey(header(e, "idempotency-key"));
  const amount = v.wholeNumber(body.amount, "amount", 1, MAX_BID);

  const fp = fingerprint("bid", ixnId, amount);
  const out = await run(user, key, fp, async () => {
    const now = ts();
    const i = await requireInteraction(ixnId, "bid", now);
    const current = nonNegInt(i.current_bid) ? i.current_bid : 0;
    if (amount < current + BID_MIN_INCREMENT) {
      throw new HttpError(409, `a bid must be at least ${current + BID_MIN_INCREMENT}`, "bid_too_low");
    }

    // The standing high bid, if any. Bids are keyed by padded amount, so it is the last one.
    const top = await doc.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :bid)",
      ExpressionAttributeValues: { ":pk": pk.ixn(ixnId), ":bid": prefix.bid() },
      ScanIndexForward: false, Limit: 1, ConsistentRead: true,
    }));
    const prev = top.Items?.[0] as Item | undefined;
    const prevHigh = prev && prev.status === "high" ? prev : undefined;

    const bidId = derivedId(user, key, "bid");
    const records: WriteItem[] = [
      {
        Put: {
          TableName: TABLE,
          Item: {
            PK: pk.ixn(ixnId), SK: sk.bid(amount, bidId), entity: "UserBid",
            id: bidId, interaction_id: ixnId, capybara_id: i.capybara_id, user_id: user, amount,
            status: "high", createdAt: now, updatedAt: now,
            ...gsi1.userBid(user, now, bidId),
          },
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      {
        Update: {
          TableName: TABLE,
          Key: { PK: i.PK, SK: i.SK },
          UpdateExpression: "SET current_bid = :amt, bid_count = if_not_exists(bid_count, :zero) + :one, updatedAt = :now",
          // Still open, and nobody else bid since we read it (otherwise: re-read and try again).
          ConditionExpression: OPEN_CONDITION +
            (i.current_bid === undefined ? " AND attribute_not_exists(current_bid)" : " AND current_bid = :prev"),
          ExpressionAttributeNames: openNames,
          ExpressionAttributeValues: {
            ":open": "open", ":now": now, ":amt": amount, ":zero": 0, ":one": 1,
            ...(i.current_bid !== undefined && { ":prev": i.current_bid }),
          },
        },
      },
    ];
    if (prevHigh) {
      // Retire the old high bid exactly once: its refund can never be paid twice.
      records.push({
        Update: {
          TableName: TABLE,
          Key: { PK: prevHigh.PK, SK: prevHigh.SK },
          UpdateExpression: "SET #s = :outbid, updatedAt = :now",
          ConditionExpression: "attribute_exists(PK) AND #s = :high",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":outbid": "outbid", ":high": "high", ":now": now },
        },
      });
    }

    const prevUser = prevHigh ? String(prevHigh.user_id) : undefined;
    const prevAmount = prevHigh && nonNegInt(prevHigh.amount) ? prevHigh.amount : 0;
    const postings: Posting[] = [];
    let charged = amount;
    let refunded = 0;
    if (REFUND_OUTBID && prevUser === user) {
      charged = amount - prevAmount; // raising your own bid: pay only the difference
      if (charged > 0) postings.push({ userId: user, amount: -charged, type: "bid_raise", related_type: "bid", related_id: bidId, role: "debit" });
    } else {
      postings.push({ userId: user, amount: -amount, type: "bid", related_type: "bid", related_id: bidId, role: "debit" });
      if (REFUND_OUTBID && prevUser && prevAmount > 0) {
        refunded = prevAmount;
        postings.push({ userId: prevUser, amount: prevAmount, type: "bid_refund", related_type: "bid", related_id: String(prevHigh!.id), role: "refund" });
      }
    }
    return {
      userId: user, idemKey: key, fingerprint: fp, postings, records,
      result: {
        bid: { id: bidId, interaction_id: ixnId, amount, status: "high" },
        charged,
        previous_bid_refunded: refunded > 0,
        ...(charged > 0 && { transaction_id: derivedId(user, key, "debit") }),
      },
    };
  });
  return out.replayed ? okPrivate({ ...out.result, replayed: true }) : created(out.result);
}

// -- chat and reactions (the hot path: keep each one to a single cheap write) --------------------

/** Positive-only cache of "this stream exists", so a busy chat does not re-read the stream item. */
const streamSeen = new Map<string, number>();
const STREAM_CACHE_MS = 60_000;

async function requireStream(id: string): Promise<void> {
  const until = streamSeen.get(id);
  if (until && until > Date.now()) return;
  const out = await doc.send(new GetCommand({
    TableName: TABLE, Key: { PK: pk.stream(id), SK: META }, ProjectionExpression: "PK",
  }));
  if (!out.Item) throw new HttpError(404, "stream not found", "not_found");
  if (streamSeen.size > 1000) streamSeen.clear();
  streamSeen.set(id, Date.now() + STREAM_CACHE_MS);
}

/** Public shape of a chat line. user_id (the Cognito sub) stays on the server; `mine` replaces it. */
const chatOut = (i: Item, viewer: string) => ({
  id: i.id, stream_id: i.stream_id, display_name: i.display_name, text: i.text, createdAt: i.createdAt,
  mine: i.user_id === viewer,
});

function reactionCounts(item: Item | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of v.REACTIONS) out[r] = typeof item?.[r] === "number" ? (item[r] as number) : 0;
  return out;
}

async function listChat(e: Event, user: string, streamId: string): Promise<Response> {
  const cursor = qs(e, "cursor");
  // One poll = one request: the first page carries the reaction counts too (docs/PLAN.md section 3
  // budgets one request per viewer per 5 s for chat AND reactions).
  const [page, counts] = await Promise.all([
    query({ pk: pk.stream(streamId), skPrefix: prefix.chat(), limit: parseLimit(qs(e, "limit")), cursor, ascending: false }),
    cursor ? Promise.resolve(undefined) : doc.send(new GetCommand({ TableName: TABLE, Key: { PK: pk.stream(streamId), SK: sk.reactions() } })),
  ]);
  const items = page.items.map((i) => chatOut(i, user));
  return okPrivate({
    items, count: items.length, cursor: page.cursor,
    ...(counts && { reactions: reactionCounts(counts.Item as Item | undefined) }),
  });
}

async function postChat(e: Event, user: string, streamId: string): Promise<Response> {
  const body = jsonBody(e);
  onlyFields(body, ["text"]);
  const text = v.chatText(body.text);
  const [account] = await Promise.all([getAccount(user, false), requireStream(streamId)]);
  if (!account?.display_name) throw new HttpError(409, "choose a display name first (PUT /me)", "display_name_required");

  const now = ts();
  const paidKey = CHAT_COST > 0 ? v.idempotencyKey(header(e, "idempotency-key")) : undefined;
  const id = paidKey ? derivedId(user, paidKey, "chat") : randomUUID();
  const item: Item = {
    PK: pk.stream(streamId), SK: sk.chat(now, id), entity: "ChatComment",
    id, stream_id: streamId, user_id: user, display_name: account.display_name, text, createdAt: now,
    expiresAt: ttl(Date.now() + CHAT_TTL_DAYS * 86_400_000),
  };
  const message = chatOut(item, user);

  if (!paidKey) {
    await doc.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(PK)" }));
    return created({ message });
  }
  const fp = fingerprint("chat", streamId, text);
  const out = await run(user, paidKey, fp, async () => ({
    userId: user, idemKey: paidKey, fingerprint: fp,
    postings: [{ userId: user, amount: -CHAT_COST, type: "chat", related_type: "chat", related_id: id, role: "debit" }],
    records: [{ Put: { TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(PK)" } }],
    result: { message, charged: CHAT_COST },
  }));
  return out.replayed ? okPrivate({ ...out.result, replayed: true }) : created(out.result);
}

async function react(e: Event, user: string, streamId: string): Promise<Response> {
  const body = jsonBody(e);
  onlyFields(body, ["reaction"]);
  const r = v.reaction(body.reaction);
  await requireStream(streamId);
  const update = {
    TableName: TABLE,
    Key: { PK: pk.stream(streamId), SK: sk.reactions() },
    UpdateExpression: "ADD #r :one SET entity = :e, stream_id = :sid, updatedAt = :now",
    ExpressionAttributeNames: { "#r": r },
    ExpressionAttributeValues: { ":one": 1, ":e": "ReactionCounts", ":sid": streamId, ":now": ts() },
  };
  if (REACTION_COST === 0) {
    const out = await doc.send(new UpdateCommand({ ...update, ReturnValues: "ALL_NEW" }));
    return okPrivate({ reaction: r, reactions: reactionCounts(out.Attributes as Item | undefined) });
  }
  const key = v.idempotencyKey(header(e, "idempotency-key"));
  const fp = fingerprint("reaction", streamId, r);
  const out = await run(user, key, fp, async () => ({
    userId: user, idemKey: key, fingerprint: fp,
    postings: [{ userId: user, amount: -REACTION_COST, type: "reaction", related_type: "stream", related_id: streamId, role: "debit" }],
    records: [{ Update: update }],
    result: { reaction: r, charged: REACTION_COST },
  }));
  return okPrivate(out.replayed ? { ...out.result, replayed: true } : out.result);
}

// -- entry --------------------------------------------------------------------------------------

export const handler = guard(async (e: Event): Promise<Response> => {
  const route = matchRoute(method(e), pathSegments(e));
  if (route === null) return notFound("unknown route");
  if (route === "method") return json(405, { error: "method not allowed" });
  const user = callerId(e); // 401 before any read if the authorizer did not run

  switch (route.kind) {
    case "getMe":            return getMe(user);
    case "putMe":            return putMe(e, user);
    case "listTransactions": return listTransactions(e, user);
    case "vote":             return vote(e, user, requireId(route.id, "interaction id"));
    case "bid":              return bid(e, user, requireId(route.id, "interaction id"));
    case "listChat":         return listChat(e, user, requireId(route.id, "stream id"));
    case "postChat":         return postChat(e, user, requireId(route.id, "stream id"));
    case "react":            return react(e, user, requireId(route.id, "stream id"));
  }
});
