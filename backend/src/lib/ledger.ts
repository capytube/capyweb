// The play-coin ledger (capyweb-3ge, docs/PLAN.md B6). Play coins are not money.
//
// Only this module writes a balance. Every change is ONE TransactWriteItems that contains:
//   - an idempotency marker   USER#{caller} / IDEM#{key}      put if absent   (retries charge once)
//   - per posting:
//       the balance update    USER#{user}   / #META           debit: only if balance >= amount
//       an immutable entry    USER#{user}   / TXN#{ts}#{id}   put if absent, never updated
//   - the domain records the coins paid for (a vote, a bid, ...), with their own conditions.
// Either all of it happens or none of it does. So:
//   1. a balance never goes below zero (the debit's condition is checked atomically);
//   2. every balance change has exactly one ledger entry for the same amount, written in the
//      same transaction, so the entries of a user always add up to their balance;
//   3. one idempotency key per user charges at most once.
// Keys: docs/DATA_MODEL.md, "Money and participation" and "Write API".

import { createHash } from "node:crypto";
import { GetCommand, PutCommand, TransactWriteCommand, type TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { doc, TABLE } from "./ddb.ts";
import { pk, sk, gsi1, gsi2, META, ts, ttl } from "./keys.ts";
import { HttpError } from "./http.ts";
import { STARTING_BALANCE } from "./economy.ts";

export type WriteItem = NonNullable<TransactWriteCommandInput["TransactItems"]>[number];

export type TxnType =
  | "signup_grant" | "grant" | "vote" | "bid" | "bid_raise" | "bid_refund" | "chat" | "reaction";

export interface Posting {
  userId: string;
  /** Signed whole coins: negative = debit, positive = credit. Never 0. */
  amount: number;
  type: TxnType;
  related_type?: string;
  related_id?: string;
  /** Distinguishes several postings of one request when deriving their ids. */
  role: string;
}

export interface LedgerRequest {
  /** The caller. Owns the idempotency marker. */
  userId: string;
  idemKey: string;
  /** Hash of what was asked for, so a key reused for a DIFFERENT request is refused, not replayed. */
  fingerprint: string;
  /** At most one per user: DynamoDB refuses two operations on one item in one transaction. */
  postings: Posting[];
  /** Domain items written or checked in the same transaction. */
  records: WriteItem[];
  /** Returned to the caller, and stored in the marker so a retry gets the same answer. */
  result: Record<string, unknown>;
}

/** How long a key is remembered. A retry after this is a new request. */
export const IDEMPOTENCY_TTL_HOURS = 24;
/** Attempts on TransactionConflict or a changed record before giving up with 409. */
export const MAX_ATTEMPTS = 4;
/** DynamoDB's hard limit on items per transaction. */
const MAX_TRANSACT_ITEMS = 100;

/**
 * Deterministic ids: the same user, key and role always give the same id, so the keys a request
 * writes are a function of the request - a replay can never mint a second entry under a new id.
 */
export function derivedId(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("base64url").slice(0, 22);
}

export function fingerprint(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("base64url").slice(0, 22);
}

export type Role =
  | { kind: "marker" }
  | { kind: "balance"; posting: Posting }
  | { kind: "entry"; posting: Posting }
  | { kind: "record"; index: number };

export interface Built {
  items: WriteItem[];
  roles: Role[];
  /** Ledger entry id per posting role. */
  entryIds: Record<string, string>;
}

/** Pure: build the transaction for one ledger request at time `now`. Unit-tested for its invariants. */
export function buildTransaction(req: LedgerRequest, now: string): Built {
  const users = new Set<string>();
  for (const p of req.postings) {
    if (!Number.isSafeInteger(p.amount) || p.amount === 0) throw new Error(`posting amount must be a non-zero whole number`);
    if (users.has(p.userId)) throw new Error("one posting per user per transaction");
    users.add(p.userId);
  }

  const items: WriteItem[] = [];
  const roles: Role[] = [];
  const entryIds: Record<string, string> = {};

  items.push({
    Put: {
      TableName: TABLE,
      Item: {
        PK: pk.user(req.userId),
        SK: sk.idem(req.idemKey),
        entity: "Idempotency",
        fingerprint: req.fingerprint,
        result: req.result,
        createdAt: now,
        expiresAt: ttl(Date.parse(now) + IDEMPOTENCY_TTL_HOURS * 3_600_000),
      },
      ConditionExpression: "attribute_not_exists(PK)",
    },
  });
  roles.push({ kind: "marker" });

  for (const p of req.postings) {
    const debit = p.amount < 0;
    items.push({
      Update: {
        TableName: TABLE,
        Key: { PK: pk.user(p.userId), SK: META },
        UpdateExpression: debit
          ? "SET balance = balance - :amt, updatedAt = :now"
          : "SET balance = balance + :amt, updatedAt = :now",
        // attribute_exists: a balance only lives on a real user item. `balance >= :amt` is false
        // when balance is absent, so a user with no balance can never be debited.
        ConditionExpression: debit ? "attribute_exists(PK) AND balance >= :amt" : "attribute_exists(PK)",
        ExpressionAttributeValues: { ":amt": Math.abs(p.amount), ":now": now },
      },
    });
    roles.push({ kind: "balance", posting: p });

    const id = derivedId(req.userId, req.idemKey, p.role);
    entryIds[p.role] = id;
    items.push({
      Put: {
        TableName: TABLE,
        Item: txnItem(p, id, now),
        ConditionExpression: "attribute_not_exists(PK)",
      },
    });
    roles.push({ kind: "entry", posting: p });
  }

  req.records.forEach((r, index) => {
    items.push(r);
    roles.push({ kind: "record", index });
  });

  if (items.length > MAX_TRANSACT_ITEMS) throw new Error(`transaction too large: ${items.length} items`);
  return { items, roles, entryIds };
}

function txnItem(p: Posting, id: string, now: string): Record<string, unknown> {
  return {
    PK: pk.user(p.userId),
    SK: sk.txn(now, id),
    entity: "TokenTransaction",
    id,
    user_id: p.userId,
    type: p.type,
    amount: p.amount,
    ...(p.related_type && { related_type: p.related_type }),
    ...(p.related_id && { related_id: p.related_id }),
    createdAt: now,
    ...gsi1.ledger(now, id),
    ...gsi2.txnById(id),
  };
}

export const insufficient = () => new HttpError(409, "not enough coins", "insufficient_coins");
const busy = () => new HttpError(409, "that changed while you were doing it; please try again", "conflict");
const keyReused = () =>
  new HttpError(409, "this Idempotency-Key was already used for a different request", "idempotency_mismatch");

interface CancelReason { Code?: string }

/** Classify a cancelled transaction. Exported for unit tests. */
export function classify(
  roles: Role[],
  reasons: CancelReason[],
): { kind: "replay" } | { kind: "insufficient" } | { kind: "record"; index: number } | { kind: "retry" } | { kind: "unknown" } {
  const codes = roles.map((_, i) => reasons[i]?.Code ?? "None");
  // The marker first: if this key was already used, nothing else about this attempt matters.
  if (codes[0] === "ConditionalCheckFailed") return { kind: "replay" };
  for (const [i, role] of roles.entries()) {
    if (codes[i] !== "ConditionalCheckFailed") continue;
    if (role.kind === "balance" && role.posting.amount < 0) return { kind: "insufficient" };
    if (role.kind === "record") return { kind: "record", index: role.index };
    return { kind: "unknown" }; // a credit to a missing user, or an entry id collision: never expected
  }
  if (codes.some((c) => c === "TransactionConflict")) return { kind: "retry" };
  return { kind: "unknown" };
}

async function readMarker(userId: string, idemKey: string): Promise<Record<string, unknown> | undefined> {
  const out = await doc.send(
    new GetCommand({ TableName: TABLE, Key: { PK: pk.user(userId), SK: sk.idem(idemKey) }, ConsistentRead: true }),
  );
  return out.Item as Record<string, unknown> | undefined;
}

export interface Outcome {
  result: Record<string, unknown>;
  replayed: boolean;
}

/** Replay a stored result if this key was already used for the same request. */
export async function replayIfDone(userId: string, idemKey: string, fp: string): Promise<Outcome | undefined> {
  const m = await readMarker(userId, idemKey);
  if (!m) return undefined;
  if (m.fingerprint !== fp) throw keyReused();
  return { result: (m.result as Record<string, unknown>) ?? {}, replayed: true };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a ledger request. `prepare` reads whatever state the request depends on (consistently) and
 * builds it; it runs again after a conflict or a changed record, so the retry sees the new state.
 * If `prepare` refuses (closed, outbid, ...) the key may belong to a request that already
 * succeeded - in which case that success is replayed instead of the refusal.
 */
export async function run(
  userId: string,
  idemKey: string,
  fp: string,
  prepare: (attempt: number) => Promise<LedgerRequest>,
): Promise<Outcome> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let req: LedgerRequest;
    try {
      req = await prepare(attempt);
    } catch (err) {
      const done = await replayIfDone(userId, idemKey, fp);
      if (done) return done;
      throw err;
    }
    const built = buildTransaction(req, ts());
    try {
      await doc.send(new TransactWriteCommand({ TransactItems: built.items }));
      return { result: req.result, replayed: false };
    } catch (err) {
      if ((err as { name?: string }).name !== "TransactionCanceledException") throw err;
      const verdict = classify(built.roles, (err as { CancellationReasons?: CancelReason[] }).CancellationReasons ?? []);
      switch (verdict.kind) {
        case "replay": {
          const done = await replayIfDone(userId, idemKey, fp);
          if (done) return done;
          break; // the marker expired between the two reads: try again
        }
        case "insufficient":
          throw insufficient();
        case "record":
        case "retry":
          break; // re-prepare against the new state
        case "unknown":
          throw err;
      }
      await sleep(15 * 2 ** attempt + Math.floor(Math.random() * 20));
    }
  }
  throw busy();
}

// -- reads and account creation ---------------------------------------------------------------

export interface Account {
  id: string;
  display_name: string | null;
  balance: number;
  createdAt: string;
}

function toAccount(item: Record<string, unknown>): Account {
  return {
    id: String(item.id),
    display_name: typeof item.display_name === "string" ? item.display_name : null,
    balance: typeof item.balance === "number" ? item.balance : 0,
    createdAt: String(item.createdAt),
  };
}

export async function getAccount(userId: string, consistent = true): Promise<Account | undefined> {
  const out = await doc.send(
    new GetCommand({ TableName: TABLE, Key: { PK: pk.user(userId), SK: META }, ConsistentRead: consistent }),
  );
  return out.Item ? toAccount(out.Item) : undefined;
}

/**
 * Create the user item on first sight. Exactly once per user: the put is conditional, and the
 * optional starting grant rides in the same transaction, so it cannot be claimed twice.
 * The user item carries NO GSI attributes: every coin change rewrites it, and an indexed item
 * would pay one extra write unit per index per change.
 */
export async function ensureAccount(userId: string): Promise<Account> {
  const existing = await getAccount(userId);
  if (existing) return existing;
  const now = ts();
  const item = { PK: pk.user(userId), SK: META, entity: "User", id: userId, balance: STARTING_BALANCE, createdAt: now, updatedAt: now };
  try {
    if (STARTING_BALANCE > 0) {
      const p: Posting = { userId, amount: STARTING_BALANCE, type: "signup_grant", role: "signup" };
      const id = derivedId(userId, "signup");
      await doc.send(new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: TABLE, Item: txnItem(p, id, now), ConditionExpression: "attribute_not_exists(PK)" } },
        ],
      }));
    } else {
      await doc.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(PK)" }));
    }
    return toAccount(item);
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name !== "ConditionalCheckFailedException" && name !== "TransactionCanceledException") throw err;
    const now2 = await getAccount(userId); // created concurrently by another request
    if (!now2) throw err;
    return now2;
  }
}

/**
 * Credit coins (admin grants, E7, and tests). Not reachable from any user route. Idempotent on
 * `idemKey` like everything else; the caller of an admin grant must also write the audit log.
 */
export async function credit(userId: string, amount: number, idemKey: string, type: TxnType = "grant"): Promise<Outcome> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("credit amount must be a positive whole number");
  await ensureAccount(userId);
  const fp = fingerprint("credit", userId, amount, type);
  return run(userId, idemKey, fp, async () => ({
    userId, idemKey, fingerprint: fp,
    postings: [{ userId, amount, type, role: "credit" }],
    records: [],
    result: { credited: amount },
  }));
}
