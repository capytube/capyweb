// Public, unauthenticated catalog reads. No auth, no authorizer, no Scan.
// Routes are declared in infra/backend/template.yaml and dispatched here by path shape,
// so one warm function serves the whole catalog instead of six cold ones.

import { getItem, query, type Item } from "./lib/ddb.ts";
import { pk, prefix, META } from "./lib/keys.ts";
import {
  guard, ok, notFound, badRequestError, requireId, requireEnum, parseLimit, qs, pathSegments,
  type Event, type Response,
} from "./lib/http.ts";

/**
 * The unfiltered /streams and /nfts routes merge two index partitions, and a DynamoDB cursor
 * belongs to exactly one. Silently ignoring a supplied cursor would leave a paging client
 * looping on page one forever, so say so instead.
 */
function rejectCursorWhenUnfiltered(cursor: string | undefined, filterHint: string): void {
  if (cursor) throw badRequestError(`paging requires a filter: ${filterHint}`);
}

const ACCESS_TYPES = ["public", "private"] as const;
const INTERACTION_TYPES = ["vote", "bid"] as const;

const page = (items: Item[], cursor?: string) => ok({ items, count: items.length, cursor });

async function listCapybaras(e: Event): Promise<Response> {
  const r = await query({
    index: "GSI1",
    pk: "CAPY",
    limit: parseLimit(qs(e, "limit")),
    cursor: qs(e, "cursor"),
    ascending: true, // GSI1SK is NAME#, so this is alphabetical
  });
  return page(r.items, r.cursor);
}

async function getCapybara(id: string): Promise<Response> {
  const item = await getItem(pk.capy(id), META);
  return item ? ok(item) : notFound("capybara not found");
}

async function listInteractions(e: Event, capyId: string): Promise<Response> {
  const type = requireEnum(qs(e, "type"), INTERACTION_TYPES, "type");
  const r = await query({
    pk: pk.capy(capyId),
    skPrefix: prefix.interaction(type),
    limit: parseLimit(qs(e, "limit")),
    cursor: qs(e, "cursor"),
    ascending: false, // newest session first
  });
  return page(r.items, r.cursor);
}

async function listStreams(e: Event): Promise<Response> {
  const access = requireEnum(qs(e, "access"), ACCESS_TYPES, "access");
  const limit = parseLimit(qs(e, "limit"));
  const cursor = qs(e, "cursor");

  if (access) {
    const r = await query({ index: "GSI1", pk: `STREAM#${access}`, limit, cursor, ascending: false });
    return page(r.items, r.cursor);
  }

  rejectCursorWhenUnfiltered(cursor, "pass ?access=public or ?access=private");
  const [pub, priv] = await Promise.all([
    query({ index: "GSI1", pk: "STREAM#public", limit, ascending: false }),
    query({ index: "GSI1", pk: "STREAM#private", limit, ascending: false }),
  ]);
  const items = [...pub.items, ...priv.items];
  const truncated = Boolean(pub.cursor || priv.cursor);
  return ok({
    items,
    count: items.length,
    truncated,
    ...(truncated && { hint: "pass ?access=public or ?access=private to page through results" }),
  });
}

async function getStream(id: string): Promise<Response> {
  const item = await getItem(pk.stream(id), META);
  return item ? ok(item) : notFound("stream not found");
}

async function listNfts(e: Event): Promise<Response> {
  const raw = qs(e, "forSale");
  const forSale = requireEnum(raw, ["0", "1"] as const, "forSale");
  const limit = parseLimit(qs(e, "limit"));
  const cursor = qs(e, "cursor");

  if (forSale !== undefined) {
    const r = await query({ index: "GSI1", pk: `NFT#SALE#${forSale}`, limit, cursor, ascending: true });
    return page(r.items, r.cursor);
  }

  rejectCursorWhenUnfiltered(cursor, "pass ?forSale=1 or ?forSale=0");
  const [listed, unlisted] = await Promise.all([
    query({ index: "GSI1", pk: "NFT#SALE#1", limit, ascending: true }),
    query({ index: "GSI1", pk: "NFT#SALE#0", limit, ascending: true }),
  ]);
  const items = [...listed.items, ...unlisted.items];
  const truncated = Boolean(listed.cursor || unlisted.cursor);
  return ok({
    items,
    count: items.length,
    truncated,
    ...(truncated && { hint: "pass ?forSale=1 or ?forSale=0 to page through results" }),
  });
}

async function getNft(id: string): Promise<Response> {
  const item = await getItem(pk.nft(id), META);
  return item ? ok(item) : notFound("nft not found");
}

async function listOffers(e: Event, nftId: string): Promise<Response> {
  const r = await query({
    pk: pk.nft(nftId),
    skPrefix: prefix.offer(),
    limit: parseLimit(qs(e, "limit")),
    cursor: qs(e, "cursor"),
    ascending: false, // OFFER#<padded price>, so highest offer first
  });
  return page(r.items, r.cursor);
}

async function listActivity(e: Event, nftId: string): Promise<Response> {
  const r = await query({
    pk: pk.nft(nftId),
    skPrefix: prefix.activityLog(),
    limit: parseLimit(qs(e, "limit")),
    cursor: qs(e, "cursor"),
    ascending: false, // newest event first
  });
  return page(r.items, r.cursor);
}

export type Route =
  | { kind: "listCapybaras" }
  | { kind: "getCapybara"; id: string }
  | { kind: "listInteractions"; id: string }
  | { kind: "listStreams" }
  | { kind: "getStream"; id: string }
  | { kind: "listNfts" }
  | { kind: "getNft"; id: string }
  | { kind: "listOffers"; id: string }
  | { kind: "listActivity"; id: string };

/**
 * Pure path dispatch, separated from I/O so it can be tested without AWS.
 * Returns null for anything unrecognised; ids are validated by the caller.
 */
export function matchRoute(seg: string[]): Route | null {
  const [collection, id, sub] = seg;
  switch (collection) {
    case "capybaras":
      if (seg.length === 1) return { kind: "listCapybaras" };
      if (seg.length === 2) return { kind: "getCapybara", id };
      if (seg.length === 3 && sub === "interactions") return { kind: "listInteractions", id };
      return null;
    case "streams":
      if (seg.length === 1) return { kind: "listStreams" };
      if (seg.length === 2) return { kind: "getStream", id };
      return null;
    case "nfts":
      if (seg.length === 1) return { kind: "listNfts" };
      if (seg.length === 2) return { kind: "getNft", id };
      if (seg.length === 3 && sub === "offers") return { kind: "listOffers", id };
      if (seg.length === 3 && sub === "activity") return { kind: "listActivity", id };
      return null;
    default:
      return null;
  }
}

export const handler = guard(async (e: Event): Promise<Response> => {
  const route = matchRoute(pathSegments(e));
  if (!route) return notFound("unknown route");

  switch (route.kind) {
    case "listCapybaras":   return listCapybaras(e);
    case "getCapybara":     return getCapybara(requireId(route.id, "capybara id"));
    case "listInteractions":return listInteractions(e, requireId(route.id, "capybara id"));
    case "listStreams":     return listStreams(e);
    case "getStream":       return getStream(requireId(route.id, "stream id"));
    case "listNfts":        return listNfts(e);
    case "getNft":          return getNft(requireId(route.id, "nft id"));
    case "listOffers":      return listOffers(e, requireId(route.id, "nft id"));
    case "listActivity":    return listActivity(e, requireId(route.id, "nft id"));
  }
});
