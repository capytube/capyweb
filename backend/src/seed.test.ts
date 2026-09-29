import { test } from "node:test";
import assert from "node:assert/strict";
import { seedItems } from "./scripts/seed-data.ts";

const NOW = "2026-09-30T00:00:00.000Z";
const count = (items: Record<string, unknown>[]) => {
  const kinds: Record<string, number> = {};
  for (const i of items) kinds[String(i.entity)] = (kinds[String(i.entity)] ?? 0) + 1;
  return kinds;
};

test("the dev seed is unchanged: offers, activity and an owned pass exercise the sub-resources", () => {
  const items = seedItems(NOW);
  assert.deepEqual(count(items), { Capybara: 3, LiveStream: 3, Interaction: 2, NFT: 3, Offer: 2, ActivityLog: 2 });
  const owned = items.find((i) => i.id === "capy-632574")!;
  assert.equal(owned.owner_id, "seed-user-1");
  assert.ok(owned.GSI2PK, "the owner index is set");
});

test("the production seed is the catalog only: nothing stands for a person", () => {
  const items = seedItems(NOW, { catalogOnly: true });
  assert.deepEqual(count(items), { Capybara: 3, LiveStream: 3, Interaction: 2, NFT: 3 });
  const text = JSON.stringify(items);
  assert.doesNotMatch(text, /seed-user/);
  for (const i of items) {
    assert.equal(i.owner_id, undefined, `${i.id} has no owner`);
    assert.equal(i.GSI2PK, undefined, `${i.id} is in no owner index`);
  }
  // The catalog itself is the same as dev's, item for item, apart from the owner fields.
  const dev = new Map(seedItems(NOW).map((i) => [`${i.PK}|${i.SK}`, i]));
  for (const i of items) {
    const { owner_id, GSI2PK, GSI2SK, ...same } = dev.get(`${i.PK}|${i.SK}`)!;
    assert.deepEqual(i, same);
  }
});
