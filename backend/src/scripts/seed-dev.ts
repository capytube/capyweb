/**
 * Seed the dev table with catalog data so the public read API has something to serve.
 * Idempotent: every item has a fixed id, so re-running overwrites rather than duplicates.
 *
 *   AWS_PROFILE=capy AWS_DEFAULT_REGION=ap-southeast-1 \
 *   TABLE_MAIN=capyapp-capyweb-dev-main \
 *   node --experimental-strip-types backend/src/scripts/seed-dev.ts
 *
 * Content mirrors demo/app.js so the prototype and the API tell the same story.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { pk, sk, gsi1, gsi2, ts, META } from "../lib/keys.ts";

const TABLE = process.env.TABLE_MAIN;
if (!TABLE) throw new Error("TABLE_MAIN is required");

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const now = ts();
const items: Record<string, unknown>[] = [];

// -- capybaras ----------------------------------------------------------------
const capybaras = [
  { id: "magnus", name: "Magnus", gender: "male", bio: "A very tame capybara from the north of Thailand.", personality: "Unbothered. Professionally relaxed.", fun_fact: "Sits like a beanbag under the climbing wall.", favorite_activities: ["soaking", "snacking", "sitting"], awake_from: "08:00", awake_to: "11:00" },
  { id: "elon", name: "Elon", gender: "male", bio: "Looks at the high holds and thinks about it.", personality: "Ambitious, briefly.", fun_fact: "Has never actually climbed anything.", favorite_activities: ["planning", "napping"], awake_from: "09:00", awake_to: "12:00" },
  { id: "einstein", name: "Einstein", gender: "male", bio: "Always planning something.", personality: "Contemplative.", fun_fact: "Stares at the feeder until it opens.", favorite_activities: ["thinking", "watermelon"], awake_from: "07:00", awake_to: "10:00" },
];
for (const c of capybaras) {
  items.push({ PK: pk.capy(c.id), SK: META, entity: "Capybara", createdAt: now, updatedAt: now, ...c, ...gsi1.allCapybaras(c.name) });
}

// -- streams ------------------------------------------------------------------
const streams = [
  { id: "main-cam", title: "Main cam", access_type: "public", is_live: false, start_time: "2026-09-26T08:00:00.000Z", capybara_ids: ["magnus"], fallback_reel: "capytube-stream.mp4", viewer_count: 0 },
  { id: "food-cam", title: "Food cam", access_type: "public", is_live: false, start_time: "2026-09-26T09:00:00.000Z", capybara_ids: ["einstein"], fallback_reel: "capytube-stream.mp4", viewer_count: 0 },
  { id: "wall-cam", title: "Climbing wall cam", access_type: "private", is_live: false, start_time: "2026-09-26T10:00:00.000Z", capybara_ids: ["elon"], price_per_10_sec: 1, fallback_reel: "capytube-stream.mp4", viewer_count: 0 },
];
for (const s of streams) {
  items.push({
    PK: pk.stream(s.id), SK: META, entity: "LiveStream", createdAt: now, updatedAt: now, ...s,
    ratingCounts: { capylove: 0, capylike: 0, capywow: 0, capyangry: 0, capyfire: 0 },
    ...gsi1.streamsByAccess(s.access_type, s.start_time, s.id),
  });
}

// -- interactions (nested under their capybara) -------------------------------
const interactions = [
  { id: "snack-vote-1", capybara_id: "magnus", interaction_type: "vote", title: "Pick Magnus's snack", description: "Four options. The winner gets fed on camera.", session_date: "2026-09-27", vote_cost: 1, custom_request_cost: 5,
    options: [
      { id: "carrots", title: "Carrots", description: "Sweet crunchy baby carrots" },
      { id: "pandan", title: "Pandan leaf", description: "Fresh tips from Chiang Mai" },
      { id: "watermelon", title: "Watermelon", description: "Chilled, for a thirsty capy" },
      { id: "grass", title: "Timothy grass", description: "Silky and aromatic" },
    ],
    rules: ["One vote costs 1 coin", "Custom requests cost 5 and need staff approval"] },
  { id: "wall-bid-1", capybara_id: "elon", interaction_type: "bid", title: "Name the next climbing hold", description: "Highest bid names a hold on the wall.", session_date: "2026-09-28", current_bid: 20,
    rules: ["Bids are in play coins", "Staff may reject any name"] },
];
for (const i of interactions) {
  items.push({
    PK: pk.capy(i.capybara_id), SK: sk.interaction(i.interaction_type, i.session_date, i.id),
    entity: "Interaction", createdAt: now, updatedAt: now, ...i, ...gsi1.interactionById(i.id),
  });
}

// -- shop catalog (NFT passes) ------------------------------------------------
const passes = [
  { id: "capy-1234", name: "Capy #1234", rarity: "ultra_rare", price: 5, is_for_sale: 1, image_url: "media/pass-chalk.png", labels: ["Capybara", "Chalk Bonus"], properties: [{ key: "Chalk powder", value: "+5 bidding bonus" }, { key: "Climbing gym", value: "+10 minutes on a call" }] },
  { id: "capy-5687", name: "Capy #5687", rarity: "rare", price: 6, is_for_sale: 1, image_url: "media/pass-cafe.png", labels: ["Capybara", "Cafe"], properties: [{ key: "Chalk powder", value: "+5 bidding bonus" }] },
  { id: "capy-632574", name: "Capy #632574", rarity: "epic", price: 3, is_for_sale: 0, image_url: "media/pass-trail.png", labels: ["Capybara", "Trail"], owner_id: "seed-user-1", properties: [{ key: "Climbing gym", value: "+10 minutes on a call" }] },
];
for (const n of passes) {
  items.push({
    PK: pk.nft(n.id), SK: META, entity: "NFT", createdAt: now, updatedAt: now, ...n,
    ...gsi1.nftBySale(n.is_for_sale as 0 | 1, n.price, n.id),
    ...(n.owner_id ? gsi2.nftByOwner(n.owner_id, n.id) : {}),
  });
}

// -- offers and activity on one pass, to exercise the sub-resources -----------
items.push({
  PK: pk.nft("capy-1234"), SK: sk.offer(4, "offer-1"), entity: "Offer", id: "offer-1",
  nftId: "capy-1234", from: "seed-user-1", price: 4, createdAt: now, expires_at: "2026-10-05",
  ...gsi1.userOffer("seed-user-1", now, "offer-1"),
});
items.push({
  PK: pk.nft("capy-1234"), SK: sk.offer(7, "offer-2"), entity: "Offer", id: "offer-2",
  nftId: "capy-1234", from: "seed-user-2", price: 7, createdAt: now, expires_at: "2026-10-06",
  ...gsi1.userOffer("seed-user-2", now, "offer-2"),
});
items.push({
  PK: pk.nft("capy-1234"), SK: sk.activityLog("2026-09-20T10:00:00.000Z", "log-1"), entity: "ActivityLog",
  id: "log-1", nftId: "capy-1234", event: "Minted", price: 0, from: "system", to: "seed-user-1",
  timestamp: "2026-09-20T10:00:00.000Z", ...gsi1.userActivity("system", "2026-09-20T10:00:00.000Z", "log-1"),
});
items.push({
  PK: pk.nft("capy-1234"), SK: sk.activityLog("2026-09-22T14:30:00.000Z", "log-2"), entity: "ActivityLog",
  id: "log-2", nftId: "capy-1234", event: "Listed", price: 5, from: "seed-user-1", to: "seed-user-1",
  timestamp: "2026-09-22T14:30:00.000Z", ...gsi1.userActivity("seed-user-1", "2026-09-22T14:30:00.000Z", "log-2"),
});

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
console.log(`seeded ${items.length} items into ${TABLE}`);
