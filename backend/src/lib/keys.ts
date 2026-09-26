// Every DynamoDB key string in capyweb lives here. Handlers must never build one by hand.
// The shape is documented in docs/DATA_MODEL.md - change both together.

/** Parent item of an entity. '#' sorts below every other prefix, so Query(PK) returns it first. */
export const META = "#META";

/** Amounts in sort keys are zero-padded so lexicographic order equals numeric order. */
const AMT_WIDTH = 20;

export function amt(n: number): string {
  // isSafeInteger, not isInteger: 1e21 is an "integer" but String() gives "1e+21",
  // which pads to a key that sorts nowhere near its value.
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`amount must be a non-negative safe integer, got ${n}`);
  }
  const s = String(n);
  if (s.length > AMT_WIDTH) throw new RangeError(`amount too large: ${n}`);
  return s.padStart(AMT_WIDTH, "0");
}

/** ISO-8601 UTC with milliseconds. Lexicographic order equals chronological order. */
export function ts(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) throw new RangeError(`invalid date: ${String(d)}`);
  return date.toISOString();
}

/** TTL attribute value: epoch SECONDS, not milliseconds. DynamoDB ignores millisecond values. */
export function ttl(d: Date | number): number {
  const ms = d instanceof Date ? d.getTime() : d;
  return Math.floor(ms / 1000);
}

const norm = (s: string) => s.trim().toLowerCase();

// -- partition prefixes -------------------------------------------------------

export const pk = {
  user: (id: string) => `USER#${id}`,
  capy: (id: string) => `CAPY#${id}`,
  stream: (id: string) => `STREAM#${id}`,
  ixn: (id: string) => `IXN#${id}`,
  nft: (id: string) => `NFT#${id}`,
  robot: (id: string) => `ROBOT#${id}`,
  slot: (id: string) => `SLOT#${id}`,
  ent: (id: string) => `ENT#${id}`,
  auditDay: (d: Date | string = new Date()) => `AUDIT#${ts(d).slice(0, 10)}`,
} as const;

// -- sort keys ----------------------------------------------------------------

export const sk = {
  meta: () => META,
  interaction: (type: string, sessionDate: string, id: string) => `IXN#${type}#${sessionDate}#${id}`,
  chat: (at: string, id: string) => `CHAT#${at}#${id}`,
  vote: (userId: string, id: string) => `VOTE#${userId}#${id}`,
  bid: (amount: number, id: string) => `BID#${amt(amount)}#${id}`,
  txn: (at: string, id: string) => `TXN#${at}#${id}`,
  offer: (price: number, id: string) => `OFFER#${amt(price)}#${id}`,
  activityLog: (at: string, id: string) => `LOG#${at}#${id}`,
  slot: (startsAt: string, id: string) => `SLOT#${startsAt}#${id}`,
  entitlement: (id: string) => `ENT#${id}`,
  resale: (id: string) => `RESALE#${id}`,
  session: (id: string) => `SESSION#${id}`,
  sessionEvent: (sessionId: string, at: string) => `SESSION#${sessionId}#EV#${at}`,
  audit: (at: string, id: string) => `${at}#${id}`,
} as const;

/** begins_with() prefixes for range queries within a partition. */
export const prefix = {
  interaction: (type?: string) => (type ? `IXN#${type}#` : "IXN#"),
  chat: () => "CHAT#",
  vote: () => "VOTE#",
  bid: () => "BID#",
  txn: () => "TXN#",
  offer: () => "OFFER#",
  activityLog: () => "LOG#",
  slot: () => "SLOT#",
  entitlement: () => "ENT#",
  nftOwned: () => "NFT#",
} as const;

// -- GSI1 ---------------------------------------------------------------------

export const gsi1 = {
  byWallet: (wallet: string) => ({ GSI1PK: `WALLET#${norm(wallet)}`, GSI1SK: META }),
  allCapybaras: (name: string) => ({ GSI1PK: "CAPY", GSI1SK: `NAME#${name}` }),
  streamsByAccess: (accessType: string, startTime: string, id: string) => ({
    GSI1PK: `STREAM#${accessType}`,
    GSI1SK: `START#${startTime}#${id}`,
  }),
  interactionById: (id: string) => ({ GSI1PK: `IXN#${id}`, GSI1SK: META }),
  userVote: (userId: string, at: string, id: string) => ({ GSI1PK: `USER#${userId}`, GSI1SK: `VOTE#${at}#${id}` }),
  userBid: (userId: string, at: string, id: string) => ({ GSI1PK: `USER#${userId}`, GSI1SK: `BID#${at}#${id}` }),
  ledger: (at: string, id: string) => ({ GSI1PK: "TXN", GSI1SK: `${at}#${id}` }),
  nftBySale: (isForSale: 0 | 1, price: number, id: string) => ({
    GSI1PK: `NFT#SALE#${isForSale}`,
    GSI1SK: `PRICE#${amt(price)}#${id}`,
  }),
  userOffer: (userId: string, at: string, id: string) => ({ GSI1PK: `USER#${userId}`, GSI1SK: `OFFER#${at}#${id}` }),
  userActivity: (userId: string, at: string, id: string) => ({ GSI1PK: `USER#${userId}`, GSI1SK: `ALOG#${at}#${id}` }),
  robots: (status: string, id: string) => ({ GSI1PK: "ROBOT", GSI1SK: `STATUS#${status}#${id}` }),
  slotsByStatus: (status: string, startsAt: string, id: string) => ({
    GSI1PK: `SLOT#${status}`,
    GSI1SK: `${startsAt}#${id}`,
  }),
  userSlotBid: (userId: string, at: string, id: string) => ({ GSI1PK: `USER#${userId}`, GSI1SK: `SBID#${at}#${id}` }),
  userEntitlement: (userId: string, startsAt: string, id: string) => ({
    GSI1PK: `USER#${userId}`,
    GSI1SK: `ENT#${startsAt}#${id}`,
  }),
  auditByActor: (actorId: string, at: string) => ({ GSI1PK: `USER#${actorId}`, GSI1SK: `AUDIT#${at}` }),
} as const;

// -- GSI2 ---------------------------------------------------------------------
// Sparse by design: omit these attributes and the item is absent from the index entirely.

export const gsi2 = {
  byEmail: (email: string) => ({ GSI2PK: `EMAIL#${norm(email)}`, GSI2SK: META }),
  txnById: (id: string) => ({ GSI2PK: `TXN#${id}`, GSI2SK: META }),
  nftByOwner: (ownerId: string, id: string) => ({ GSI2PK: `USER#${ownerId}`, GSI2SK: `NFT#${id}` }),
  resaleByStatus: (status: string, expiresAt: string, id: string) => ({
    GSI2PK: `RESALE#${status}`,
    GSI2SK: `${expiresAt}#${id}`,
  }),
  /**
   * The moderation queue (capyweb-x7w). Attach ONLY while a custom request is awaiting a decision;
   * clear both attributes on approve/reject and the item leaves the index. Querying GSI2PK=MODQ#vote
   * is therefore the pending queue with no filter and no scan.
   */
  pendingCustomVote: (at: string, id: string) => ({ GSI2PK: "MODQ#vote", GSI2SK: `${at}#${id}` }),
} as const;
