// Play-coin numbers. Play coins are NOT money: they cannot be bought, sold, cashed out or
// transferred between people. Every number here is a product decision nobody has written down
// yet, so each defaults to "no free coins, no charge" and is listed as an open question for
// capyweb-lead (lane 4 report, capyweb-3ge / capyweb-7hj). Change them here and nowhere else.

/** Coins a new account starts with. 0 = none. If raised, the grant is a ledger entry (type signup_grant). */
export const STARTING_BALANCE = 0;

/** Coins charged per chat message. 0 = free (plain write, no ledger entry). */
export const CHAT_COST = 0;

/** Coins charged per reaction. 0 = free (plain counter update, no ledger entry). */
export const REACTION_COST = 0;

/** Most votes one request may buy. A cap on accidental spend, not a price. */
export const MAX_VOTES_PER_REQUEST = 10;

/** A new bid must beat the current one by at least this many coins. */
export const BID_MIN_INCREMENT = 1;

/** Sanity ceiling on a single bid, far above any balance the ledger can currently hold. */
export const MAX_BID = 1_000_000;

/**
 * When someone is outbid, their coins come back in the same transaction (a bid_refund entry),
 * so only the standing high bid is ever held. false = the old app's behaviour: every bid is spent
 * whether or not it wins. Open question for capyweb-lead.
 */
export const REFUND_OUTBID = true;
