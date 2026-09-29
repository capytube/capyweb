/**
 * Pre-sign-up cap (capyweb-kbq, docs/RELEASE_PLAN.md section 1a item 11). The user pool's PreSignUp
 * trigger. Open self sign-up gives each new account 50 play coins, and Cognito's default sender
 * delivers only 50 emails a day per account, so a script could use up everyone's sign-up emails.
 * This lets at most SIGNUP_CAP_DAY self sign-ups through per UTC day and SIGNUP_CAP_HOUR per UTC
 * hour (40 and 10, capyweb-manager 2026-09-29), and refuses the rest.
 *
 * Every refusal is a thrown Error: Cognito shows its message on the managed-login page, and the
 * function's own AWS/Lambda Errors metric drives the signups-refused alarm. Anything that goes wrong
 * (throttling, a network error, bad configuration) refuses too. A flood is exactly when the table
 * may throttle, so this fails closed.
 *
 * Counts attempts that reach the trigger, not confirmed accounts. Re-sent confirmation codes do not
 * pass through here.
 */
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { doc, TABLE } from "./lib/ddb.ts";
import { pk, sk, ttl } from "./lib/keys.ts";

/** What a refused visitor sees. No numbers and no internals. */
export const PUBLIC_MESSAGE = "Sign-ups are paused for a while. Please try again later.";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Retries when two sign-ups race for the same counter (TransactionConflict). */
const ATTEMPTS = 3;

export interface Limits {
  day: number;
  hour: number;
}

/** The Cognito PreSignUp event, as far as this function reads it. Everything else passes through. */
export interface PreSignUpEvent {
  triggerSource: string;
  [k: string]: unknown;
}

export type Send = (cmd: TransactWriteCommand) => Promise<unknown>;

export type Reason = "day_cap" | "hour_cap" | "error";
export type Verdict = { ok: true } | { ok: false; reason: Reason; error?: string };

export function readLimits(env: Record<string, string | undefined> = process.env): Limits {
  const day = Number(env.SIGNUP_CAP_DAY);
  const hour = Number(env.SIGNUP_CAP_HOUR);
  const ok = (n: number) => Number.isSafeInteger(n) && n >= 1;
  if (!ok(day) || !ok(hour)) throw new Error("SIGNUP_CAP_DAY and SIGNUP_CAP_HOUR must be whole numbers of at least 1");
  return { day, hour };
}

/** The UTC day and hour `now` falls in, their counter keys, and when the counters expire. */
export function counters(now: Date) {
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const hourStart = dayStart + now.getUTCHours() * HOUR_MS;
  return {
    day: { PK: pk.signups(now), SK: sk.signupsDay() },
    hour: { PK: pk.signups(now), SK: sk.signupsHour(now) },
    // Two days after the counted day began: never inside the day it counts, and gone soon after.
    expiresAt: ttl(dayStart + 2 * DAY_MS),
    dayEnds: dayStart + DAY_MS,
    hourEnds: hourStart + HOUR_MS,
  };
}

/**
 * One transaction, two conditional counters (day first, then hour). Each adds 1 only while below
 * its limit, and the transaction makes them move together or not at all, so a sign-up refused by
 * the hour cap never uses up a place in the day.
 */
export function buildTransaction(now: Date, limits: Limits, table: string = TABLE) {
  const c = counters(now);
  const update = (Key: { PK: string; SK: string }, limit: number) => ({
    Update: {
      TableName: table,
      Key,
      UpdateExpression: "ADD #n :one SET expiresAt = :exp, entity = :entity",
      ConditionExpression: "attribute_not_exists(#n) OR #n < :limit",
      ExpressionAttributeNames: { "#n": "n" },
      ExpressionAttributeValues: { ":one": 1, ":limit": limit, ":exp": c.expiresAt, ":entity": "SignupCounter" },
    },
  });
  return { TransactItems: [update(c.day, limits.day), update(c.hour, limits.hour)] };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Counts one sign-up if both caps allow it. Never throws: the caller turns a refusal into one. */
export async function admit(send: Send, now: Date, limits: Limits, table: string = TABLE): Promise<Verdict> {
  const input = buildTransaction(now, limits, table);
  for (let attempt = 1; ; attempt++) {
    try {
      await send(new TransactWriteCommand(input));
      return { ok: true };
    } catch (err) {
      const name = (err as { name?: string }).name ?? "Error";
      if (name !== "TransactionCanceledException") return { ok: false, reason: "error", error: name };
      const codes = ((err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [])
        .map((r) => r.Code ?? "None");
      if (codes[0] === "ConditionalCheckFailed") return { ok: false, reason: "day_cap" };
      if (codes[1] === "ConditionalCheckFailed") return { ok: false, reason: "hour_cap" };
      if (codes.includes("TransactionConflict") && attempt < ATTEMPTS) {
        await pause(20 * attempt + Math.floor(Math.random() * 30));
        continue;
      }
      return { ok: false, reason: "error", error: `${name}: ${codes.join(",")}` };
    }
  }
}

/**
 * Once a cap is reached, this container refuses without writing until that hour or day is over.
 * Refused attempts would otherwise still cost write units (4 per attempt: two transactional
 * updates), and the table's ceiling is 20 a second, so a flood of refusals would throttle every
 * other write on the table. Losing this on a cold start only costs one more refused write.
 */
let blocked: { until: number; reason: Reason } | undefined;

export function resetForTests(): void {
  blocked = undefined;
}

export async function capSignUp<E extends PreSignUpEvent>(event: E, send: Send, now: Date = new Date()): Promise<E> {
  // Admin-created users and federated sign-ins are not open sign-up: they pass untouched.
  if (event.triggerSource !== "PreSignUp_SignUp") return event;

  let verdict: Verdict;
  if (blocked && now.getTime() < blocked.until) {
    verdict = { ok: false, reason: blocked.reason };
  } else {
    blocked = undefined;
    try {
      verdict = await admit(send, now, readLimits());
    } catch (err) {
      verdict = { ok: false, reason: "error", error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (verdict.ok) return event; // unchanged: no auto-confirm, no auto-verify

  if (verdict.reason !== "error" && !blocked) {
    const c = counters(now);
    blocked = { until: verdict.reason === "day_cap" ? c.dayEnds : c.hourEnds, reason: verdict.reason };
  }
  // One line per refusal: the reason only, never the email address or anything else from the event.
  console.log(JSON.stringify({ signup: "refused", reason: verdict.reason, ...(verdict.error && { error: verdict.error }) }));
  throw new Error(PUBLIC_MESSAGE);
}

export const handler = (event: PreSignUpEvent) => capSignUp(event, (cmd) => doc.send(cmd));
