/** Offline route fixtures: seed keys drive ordering, and the real clean() shapes responses.
 * Run: node --experimental-strip-types web/tests/fixtures.mjs [--check]
 * Query strings are deliberately ignored by the fixture client; files are unfiltered snapshots.
 * Importing ddb constructs an SDK client but never sends a command.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { seedItems } from '../../backend/src/scripts/seed-data.ts';
import { clean } from '../../backend/src/lib/ddb.ts';
import { pk, prefix, META } from '../../backend/src/lib/keys.ts';

const root = fileURLToPath(new URL('../fixtures/', import.meta.url));
const items = seedItems('2026-09-26T00:00:00.000Z');
// DynamoDB string keys compare UTF-8 bytes, not locale-sensitive display names.
function query(partition, { index = false, starts = '', ascending = true } = {}) {
  const p = index ? 'GSI1PK' : 'PK';
  const s = index ? 'GSI1SK' : 'SK';
  return items.filter(i => i[p] === partition && i[s].startsWith(starts))
    .sort((a, b) => Buffer.compare(Buffer.from(a[s]), Buffer.from(b[s])) * (ascending ? 1 : -1));
}
const page = rows => ({ items: rows.map(clean), count: rows.length });
const merged = rows => ({ ...page(rows), truncated: false });
const capys = query('CAPY', { index: true });
const streams = ['public', 'private'].flatMap(a => query(`STREAM#${a}`, { index: true, ascending: false }));
const passes = [1, 0].flatMap(s => query(`NFT#SALE#${s}`, { index: true }));
assert.deepEqual(streams.map(s => s.id), ['food-cam', 'main-cam', 'wall-cam']);
const files = new Map([
  ['capybaras.json', page(capys)], ['streams.json', merged(streams)], ['nfts.json', merged(passes)],
]);
function singles(route, rows, partition) {
  for (const row of rows) {
    const item = items.find(i => i.PK === partition(row.id) && i.SK === META);
    assert.ok(item, `${route}/${row.id} metadata missing`);
    files.set(`${route}/${row.id}.json`, clean(item));
  }
}
singles('capybaras', capys, pk.capy);
singles('streams', streams, pk.stream);
singles('nfts', passes, pk.nft);
for (const c of capys) files.set(`capybaras/${c.id}/interactions.json`, page(query(pk.capy(c.id), { starts: prefix.interaction(), ascending: false })));
for (const n of passes) {
  files.set(`nfts/${n.id}/offers.json`, page(query(pk.nft(n.id), { starts: prefix.offer(), ascending: false })));
  files.set(`nfts/${n.id}/activity.json`, page(query(pk.nft(n.id), { starts: prefix.activityLog(), ascending: false })));
}
const check = process.argv.includes('--check');
for (const [name, value] of files) {
  const path = resolve(root, name);
  const expected = JSON.stringify(value, null, 2) + '\n';
  if (check) {
    let actual;
    try { actual = await readFile(path, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (actual !== expected) {
      console.error(`fixture differs or is missing: web/fixtures/${name}`);
      process.exitCode = 1;
    }
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, expected);
  }
}
console.log(`${check ? 'Checked' : 'Wrote'} ${files.size} catalog fixtures`);
