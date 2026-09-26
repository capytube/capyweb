// DynamoDB access for the single table. Query/GetItem only - never Scan.
// Key shapes live in ./keys.ts and are documented in docs/DATA_MODEL.md.

import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = process.env.TABLE_MAIN ?? "";

/** Attributes that describe where an item lives, not what it is. Never sent to a client. */
const INTERNAL = new Set(["PK", "SK", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK", "expiresAt"]);

export type Item = Record<string, unknown>;

/** Strip key plumbing so responses expose the domain shape, not the table design. */
export function clean<T extends Item>(item: T | undefined): Item | undefined {
  if (!item) return undefined;
  const out: Item = {};
  for (const [k, v] of Object.entries(item)) if (!INTERNAL.has(k)) out[k] = v;
  return out;
}

export const cleanAll = (items: Item[] = []): Item[] => items.map((i) => clean(i)!).filter(Boolean);

/**
 * Pagination cursors.
 *
 * A cursor is a DynamoDB LastEvaluatedKey, which is position data for one specific query.
 * Replaying it against a different query is meaningless: on another partition DynamoDB raises
 * ValidationException (a 500 an anonymous caller could trigger at will), and on another
 * partition of the same index it silently pages from the wrong place. So each cursor is bound
 * to the query that produced it by a short hash, and a cursor that does not match is rejected.
 *
 * Key ATTRIBUTE NAMES are not stored - only the values, ordered by name. The names are implied
 * by the index, so the cursor carries no description of the table's key layout.
 */
export class BadCursor extends Error {}

/** Attribute names present in a LastEvaluatedKey, sorted, for each index. */
const KEY_ATTRS: Record<string, string[]> = {
  "": ["PK", "SK"],
  GSI1: ["GSI1PK", "GSI1SK", "PK", "SK"],
  GSI2: ["GSI2PK", "GSI2SK", "PK", "SK"],
};

export interface CursorCtx {
  index?: "GSI1" | "GSI2";
  pk: string;
  skPrefix?: string;
  ascending: boolean;
}

function shapeHash(ctx: CursorCtx): string {
  const canonical = JSON.stringify([ctx.index ?? "", ctx.pk, ctx.skPrefix ?? "", ctx.ascending]);
  return createHash("sha256").update(canonical).digest("base64url").slice(0, 10);
}

export function encodeCursor(key: Item | undefined, ctx: CursorCtx): string | undefined {
  if (!key) return undefined;
  const values = KEY_ATTRS[ctx.index ?? ""].map((a) => key[a]);
  return Buffer.from(JSON.stringify([shapeHash(ctx), values]), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined, ctx: CursorCtx): Item | undefined {
  if (!cursor) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new BadCursor("invalid cursor");
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) throw new BadCursor("invalid cursor");
  const [hash, values] = parsed as [unknown, unknown];
  if (hash !== shapeHash(ctx)) throw new BadCursor("cursor does not belong to this query");

  const attrs = KEY_ATTRS[ctx.index ?? ""];
  if (!Array.isArray(values) || values.length !== attrs.length) throw new BadCursor("invalid cursor");
  const key: Item = {};
  for (const [i, a] of attrs.entries()) {
    const v = values[i];
    if (typeof v !== "string" || v === "") throw new BadCursor("invalid cursor");
    key[a] = v;
  }
  return key;
}

export async function getItem(pk: string, sk: string): Promise<Item | undefined> {
  const out = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }));
  return clean(out.Item as Item | undefined);
}

export interface QueryOpts {
  /** Index to query. Omit for the base table. */
  index?: "GSI1" | "GSI2";
  pk: string;
  /** begins_with() filter on the sort key. */
  skPrefix?: string;
  limit?: number;
  cursor?: string;
  /** false = descending, i.e. newest or highest first. */
  ascending?: boolean;
}

export interface Page {
  items: Item[];
  cursor?: string;
}

export async function query(opts: QueryOpts): Promise<Page> {
  const ctx: CursorCtx = {
    index: opts.index,
    pk: opts.pk,
    skPrefix: opts.skPrefix,
    ascending: opts.ascending ?? true,
  };
  const pkName = opts.index ? `${opts.index}PK` : "PK";
  const skName = opts.index ? `${opts.index}SK` : "SK";

  const names: Record<string, string> = { "#pk": pkName };
  const values: Record<string, unknown> = { ":pk": opts.pk };
  let expr = "#pk = :pk";

  if (opts.skPrefix) {
    names["#sk"] = skName;
    values[":skp"] = opts.skPrefix;
    expr += " AND begins_with(#sk, :skp)";
  }

  const out = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: opts.index,
      KeyConditionExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      Limit: opts.limit ?? 50,
      ScanIndexForward: opts.ascending ?? true,
      ExclusiveStartKey: decodeCursor(opts.cursor, ctx),
    }),
  );

  return {
    items: cleanAll(out.Items as Item[]),
    cursor: encodeCursor(out.LastEvaluatedKey as Item | undefined, ctx),
  };
}
