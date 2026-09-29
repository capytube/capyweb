// Paid cameras (W6, docs/VIDEO_DESIGN.md sections 4 and 8): POST /playback/{streamId}.
//
// The caller buys time on one paid camera with play coins, and the answer carries CloudFront
// signed cookies that open that camera's /paid/<id>/ files, and nothing else, until the paid time
// ends plus a short grace. The browser calls it same-origin as /api/playback/<id> (the site's
// /api/* behaviour), so the cookies land on the site's own domain, where CloudFront checks them.
//
// Paid time is a per-viewer, per-camera `paid_until` (sk.pass). A purchase moves it on by one
// block from wherever it is (or from now, if it has run out), and nothing is charged while 30 s or
// more are still paid. So the player's renewals pay for exactly the time that passes, and a reload
// or a second tab does not pay twice. The coins, the new paid_until and a check that the
// camera's price has not changed are one ledger transaction (lib/ledger.ts).
//
// Only this function's role may read the signing key (SSM SecureString). It is read once per cold
// start, BEFORE any coins move: a caller is never charged for cookies we then cannot sign.

import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { doc, TABLE, type Item } from "./lib/ddb.ts";
import { pk, sk, META } from "./lib/keys.ts";
import {
  guard, json, okPrivate, created, notFound, requireId, header, pathSegments, method, callerId, jsonBody,
  onlyFields, HttpError, type Event, type Response,
} from "./lib/http.ts";
import * as v from "./lib/validate.ts";
import { run, ensureAccount, derivedId, fingerprint, type Posting, type WriteItem } from "./lib/ledger.ts";
import { PLAYBACK_BLOCK_SECONDS } from "./lib/economy.ts";
import { signedCookies, setCookieHeaders } from "./lib/cfsign.ts";

/** Cookies outlive the paid time by this much, so a renewal that is a little late does not cut the picture. */
export const GRACE_SECONDS = 30;
/** The player renews this long before the paid time ends. */
export const RENEW_BEFORE_END_SECONDS = 20;

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "";
const KEY_PAIR_ID = process.env.SIGNING_KEY_PAIR_ID ?? "";
const KEY_PARAM = process.env.SIGNING_KEY_PARAM ?? "";

/** Where a paid camera's files live on the site. The only place this locator is ever handed out. */
export const paidPrefix = (streamId: string) => `/paid/${streamId}/`;

// -- pure rules (unit-tested) -------------------------------------------------------------------

/**
 * A purchase charges only when less than this is left. Above it, it just re-issues the cookies:
 * a reload or a second tab pays nothing. Just above RENEW_BEFORE_END_SECONDS, so the player's own
 * renewals always charge, and steady viewing pays exactly one block per block of time.
 */
export const CHARGE_WHEN_UNDER_SECONDS = 30;

/** What one purchase does, at `now` (epoch seconds), given the viewer's current paid_until. */
export function nextPass(now: number, paidUntil: number, pricePer10s: number): { charge: number; paidUntil: number } {
  if (paidUntil - now >= CHARGE_WHEN_UNDER_SECONDS) return { charge: 0, paidUntil };
  return { charge: pricePer10s * (PLAYBACK_BLOCK_SECONDS / 10), paidUntil: Math.max(now, paidUntil) + PLAYBACK_BLOCK_SECONDS };
}

/** Seconds until the player should buy again. Never 0, so a stuck clock cannot spin the player. */
export const renewAfter = (now: number, paidUntil: number): number =>
  Math.max(5, paidUntil - now - RENEW_BEFORE_END_SECONDS);

const positiveInt = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x > 0;

/** Refuse anything that is not a paid camera with something to show and a price. Throws HttpError. */
export function sellable(s: Item | undefined): number {
  if (!s) throw new HttpError(404, "stream not found", "not_found");
  if (s.access_type === "public") throw new HttpError(400, "this camera is free to watch", "free_camera");
  if (s.access_type !== "private") throw new HttpError(409, "this camera is not for sale", "not_for_sale");
  // A recording can always be watched; a live camera only while it is live.
  if (s.video_mode !== "recording" && s.is_live !== true) throw new HttpError(409, "this camera is offline", "offline");
  if (!positiveInt(s.price_per_10_sec)) throw new HttpError(409, "this camera has no price set", "not_priced");
  return s.price_per_10_sec;
}

// -- the signing key ----------------------------------------------------------------------------

let keyLoader: () => Promise<string> = async () => {
  const out = await new SSMClient({}).send(new GetParameterCommand({ Name: KEY_PARAM, WithDecryption: true }));
  const pem = out.Parameter?.Value;
  if (!pem) throw new Error("signing key parameter is empty");
  return pem;
};
let cachedKey: Promise<string> | undefined;

function signingKey(): Promise<string> {
  cachedKey ??= keyLoader().catch((err) => {
    cachedKey = undefined; // try again on the next call rather than failing until the next cold start
    throw err;
  });
  return cachedKey;
}

/** Tests only: sign with a generated key instead of reading SSM. */
export function useSigningKeyForTests(pem: string): void {
  keyLoader = async () => pem;
  cachedKey = undefined;
}

// -- the route ----------------------------------------------------------------------------------

interface PassResult {
  stream_id: string;
  paid_until: number;
  charged: number;
  transaction_id?: string;
}

async function readItem(pkValue: string, skValue: string): Promise<Item | undefined> {
  const out = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: pkValue, SK: skValue }, ConsistentRead: true }));
  return out.Item as Item | undefined;
}

async function buy(e: Event, user: string, streamId: string): Promise<Response> {
  onlyFields(jsonBody(e), []);
  const key = v.idempotencyKey(header(e, "idempotency-key"));
  if (!SITE_ORIGIN || !KEY_PAIR_ID || !KEY_PARAM) throw new HttpError(503, "paid cameras are not open yet", "not_ready");
  let pem: string;
  try {
    pem = await signingKey();
  } catch (err) {
    console.error("signing key unavailable", { err: err instanceof Error ? err.name : String(err) });
    throw new HttpError(503, "paid cameras are not available right now", "not_ready");
  }
  await ensureAccount(user);

  const fp = fingerprint("playback", streamId);
  const out = await run(user, key, fp, async () => {
    const now = Math.floor(Date.now() / 1000);
    const [stream, pass] = await Promise.all([readItem(pk.stream(streamId), META), readItem(pk.user(user), sk.pass(streamId))]);
    const price = sellable(stream);
    const before = typeof pass?.paid_until === "number" ? pass.paid_until : 0;
    const next = nextPass(now, before, price);
    const result: PassResult = { stream_id: streamId, paid_until: next.paidUntil, charged: next.charge };
    if (next.charge === 0) return { userId: user, idemKey: key, fingerprint: fp, postings: [], records: [], result: { ...result } };

    const txnId = derivedId(user, key, "debit");
    result.transaction_id = txnId;
    const at = new Date(now * 1000).toISOString();
    const records: WriteItem[] = [
      {
        Put: {
          TableName: TABLE,
          Item: {
            PK: pk.user(user), SK: sk.pass(streamId), entity: "PlaybackPass",
            user_id: user, stream_id: streamId, paid_until: next.paidUntil, updatedAt: at,
          },
          // Moved by another purchase since we read it: the ledger re-reads and tries again.
          ConditionExpression: pass ? "paid_until = :before" : "attribute_not_exists(PK)",
          ...(pass && { ExpressionAttributeValues: { ":before": before } }),
        },
      },
      {
        ConditionCheck: {
          TableName: TABLE,
          Key: { PK: pk.stream(streamId), SK: META },
          // Re-priced or opened up since we read it: refuse rather than charge the old price.
          ConditionExpression: "access_type = :private AND price_per_10_sec = :price",
          ExpressionAttributeValues: { ":private": "private", ":price": price },
        },
      },
    ];
    const postings: Posting[] = [{
      userId: user, amount: -next.charge, type: "playback", related_type: "stream", related_id: streamId, role: "debit",
    }];
    return { userId: user, idemKey: key, fingerprint: fp, postings, records, result: { ...result } };
  });

  // The cookies come from the stored paid_until, so a retried request gets the same expiry: a
  // replay can never stretch the time that was paid for.
  const r = out.result as unknown as PassResult;
  const now = Math.floor(Date.now() / 1000);
  const expires = r.paid_until + GRACE_SECONDS;
  const body = {
    src: `${paidPrefix(streamId)}index.m3u8`,
    paid_until: r.paid_until,
    renew_after_s: renewAfter(now, r.paid_until),
    charged: r.charged,
    ...(r.transaction_id && { transaction_id: r.transaction_id }),
    ...(out.replayed && { replayed: true }),
  };
  const res = r.charged > 0 && !out.replayed ? created(body) : okPrivate(body);
  if (expires > now) {
    const cookies = signedCookies(`${SITE_ORIGIN}${paidPrefix(streamId)}*`, expires, KEY_PAIR_ID, pem);
    res.cookies = setCookieHeaders(cookies, paidPrefix(streamId), expires - now);
  }
  return res;
}

export const handler = guard(async (e: Event): Promise<Response> => {
  const seg = pathSegments(e);
  if (seg.length !== 2 || seg[0] !== "playback") return notFound("unknown route");
  if (method(e) !== "POST") return json(405, { error: "method not allowed" });
  const user = callerId(e); // 401 before any read if the authorizer did not run
  return buy(e, user, requireId(seg[1], "stream id"));
});
