/**
 * Seed the dev table with catalog data so the public read API has something to serve.
 * Idempotent: every item has a fixed id, so re-running overwrites rather than duplicates.
 *
 *   AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 \
 *   TABLE_MAIN=capyapp-capyweb-dev-main \
 *   node --experimental-strip-types backend/src/scripts/seed-dev.ts
 *
 * Production (TABLE_MAIN=capyapp-capyweb-prod-main) needs CAPYWEB_PROD_GO=1 and gets the catalog only
 * (seedItems' catalogOnly: no seed users' offers, activity or passes).
 *
 * Content mirrors demo/app.js so the prototype and the API tell the same story.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ts } from "../lib/keys.ts";
import { seedItems } from "./seed-data.ts";

const TABLE = process.env.TABLE_MAIN;
if (!TABLE) throw new Error("TABLE_MAIN is required");
const PROD = TABLE.includes("-prod-");
if (PROD && process.env.CAPYWEB_PROD_GO !== "1") throw new Error("production needs herdr-master's go: set CAPYWEB_PROD_GO=1");

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const now = ts();
const items = seedItems(now, { catalogOnly: PROD });

const CHUNK = 25; // BatchWriteItem hard limit

/** BatchWriteItem can partially succeed: unwritten items come back rather than throwing. */
async function writeBatch(batch: Record<string, unknown>[]): Promise<void> {
  let pending = batch.map((Item) => ({ PutRequest: { Item } }));
  for (let attempt = 0; pending.length > 0 && attempt < 5; attempt++) {
    const out = await doc.send(new BatchWriteCommand({ RequestItems: { [TABLE]: pending } }));
    pending = (out.UnprocessedItems?.[TABLE] ?? []) as typeof pending;
    if (pending.length > 0) {
      await new Promise((r) => setTimeout(r, 200 * 2 ** attempt)); // table has a 20 WRU ceiling
      console.log(`  retrying ${pending.length} throttled item(s)`);
    }
  }
  if (pending.length > 0) throw new Error(`${pending.length} item(s) never written`);
}

for (let i = 0; i < items.length; i += CHUNK) {
  await writeBatch(items.slice(i, i + CHUNK));
  console.log(`wrote ${Math.min(i + CHUNK, items.length)}/${items.length}`);
}
const kinds = new Map<string, number>();
for (const i of items) kinds.set(String(i.entity), (kinds.get(String(i.entity)) ?? 0) + 1);
console.log(`seeded ${items.length} items into ${TABLE}${PROD ? " (catalog only)" : ""}:`, Object.fromEntries(kinds));
