// Play-coin numbers. Play coins are NOT money: they cannot be bought, sold, cashed out or
// transferred between people. Decided by capyweb-manager on 2026-09-29 (lane 4 questions):
// a one-time sign-up grant of 50, no daily grant, chat and reactions free, the caps below, and
// refunds for outbid bidders. Change them here and nowhere else, and update docs/DATA_MODEL.md.

/**
 * Coins a new account starts with: a one-time grant of 50, written as one `signup_grant` ledger
 * entry in the same transaction that creates the account, so it is paid exactly once per user.
 * There is no daily grant.
 */
export const STARTING_BALANCE = 50;

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
 * whether or not it wins. Decided: refund.
 */
export const REFUND_OUTBID = true;

/**
 * Paid cameras (W6): one purchase opens the camera for this many more seconds, at the camera's
 * own price_per_10_sec (so 6 x that price a minute). Nothing is charged while a whole block is
 * still paid ahead, so a reload or a second tab does not pay twice (backend/src/playback.ts).
 */
export const PLAYBACK_BLOCK_SECONDS = 60;
