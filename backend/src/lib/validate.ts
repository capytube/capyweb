// Input rules for the authenticated write API. Pure functions, no I/O, unit-tested.

import { BadInput } from "./http.ts";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 32;
export const CHAT_MAX_CHARS = 280;
/** Keeps a chat item under 1 KB, so each message is exactly one write unit. */
export const CHAT_MAX_BYTES = 800;
export const CUSTOM_REQUEST_MAX_CHARS = 60;

/** The five reactions the stream page has always had (LiveStream.ratingCounts). */
export const REACTIONS = ["capylove", "capylike", "capywow", "capyangry", "capyfire"] as const;
export type Reaction = (typeof REACTIONS)[number];

/**
 * Characters that change how OTHER text renders: bidi overrides and isolates (which can make a
 * message appear to say something else, or reorder a neighbour's name), plus the invisible marks.
 * Zero-width joiner is allowed: emoji sequences need it.
 */
const BIDI_OR_INVISIBLE = /[؜​‎‏‪-‮⁠⁦-⁩﻿]/u;
const CONTROL = /\p{Cc}/u;

const codePoints = (s: string): number => [...s].length;

/** Shared text rules: NFC, trimmed, no controls or bidi tricks, bounded length. */
function cleanText(raw: unknown, field: string, maxChars: number, minChars = 1): string {
  if (typeof raw !== "string") throw new BadInput(`${field} must be a string`);
  const s = raw.normalize("NFC").trim();
  if (CONTROL.test(s)) throw new BadInput(`${field} must be one line with no control characters`);
  if (BIDI_OR_INVISIBLE.test(s)) throw new BadInput(`${field} contains invisible or direction-changing characters`);
  const n = codePoints(s);
  if (n < minChars) throw new BadInput(minChars === 1 ? `${field} is empty` : `${field} must be at least ${minChars} characters`);
  if (n > maxChars) throw new BadInput(`${field} must be at most ${maxChars} characters`);
  return s;
}

/**
 * Letters and digits in any script, with single spaces, '.', '_', '-' and apostrophes between
 * them. Starts and ends with a letter or digit. No emoji, no symbols, no runs of spaces.
 */
const NAME_SHAPE = /^[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}]|[ ._'-](?=[\p{L}\p{N}]))*$/u;

/** Names that would read as the site or its staff talking. Compared case- and separator-blind. */
const RESERVED_NAMES = ["admin", "administrator", "capytube", "moderator", "mod", "staff", "support", "system", "official"];

export function displayName(raw: unknown): string {
  const s = cleanText(raw, "display_name", DISPLAY_NAME_MAX, DISPLAY_NAME_MIN);
  if (!NAME_SHAPE.test(s)) {
    throw new BadInput("display_name may use letters, digits, and single spaces, '.', '_', '-' or ' between them");
  }
  const folded = s.toLowerCase().replace(/[ ._'-]/g, "");
  if (RESERVED_NAMES.includes(folded)) throw new BadInput("that display_name is reserved");
  return s;
}

export function chatText(raw: unknown): string {
  const s = cleanText(raw, "text", CHAT_MAX_CHARS);
  if (Buffer.byteLength(s, "utf8") > CHAT_MAX_BYTES) throw new BadInput(`text must be at most ${CHAT_MAX_BYTES} bytes`);
  return s;
}

export function customRequest(raw: unknown): string {
  return cleanText(raw, "custom_request", CUSTOM_REQUEST_MAX_CHARS);
}

export function reaction(raw: unknown): Reaction {
  if (typeof raw !== "string" || !(REACTIONS as readonly string[]).includes(raw)) {
    throw new BadInput(`reaction must be one of: ${REACTIONS.join(", ")}`);
  }
  return raw as Reaction;
}

/** A positive whole number within [min, max]. Rejects 1.0-as-string, floats, NaN, booleans. */
export function wholeNumber(raw: unknown, field: string, min: number, max: number): number {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < min || raw > max) {
    throw new BadInput(`${field} must be a whole number from ${min} to ${max}`);
  }
  return raw;
}

/**
 * Idempotency keys come from the client (a UUID per user action is ideal). They are scoped to
 * the caller's own partition, so one user cannot collide with, or probe, another's keys.
 */
const IDEM_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function idempotencyKey(raw: string | undefined): string {
  if (!raw) throw new BadInput("Idempotency-Key header is required for anything that spends coins");
  if (!IDEM_RE.test(raw)) throw new BadInput("Idempotency-Key must be 8-64 characters of A-Z a-z 0-9 _ -");
  return raw;
}
