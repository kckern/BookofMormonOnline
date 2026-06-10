import { getDb } from '/home/bom/BookofMormonOnline/backend/src/data/db.js';
const db = getDb();

// Verify image ordering for batch
const imgs = await db.selectFrom('bom_xtras_image').selectAll()
  .where('id', 'in', [1028, 2075, 2624])
  .execute();
console.log('IMAGES ORDER:', imgs.map(i => i.id));

// Verify commentary ordering for batch
const coms = await db.selectFrom('bom_xtras_commentary').selectAll()
  .where('id', 'in', [1000001101, 1000018101, 1000307101])
  .execute();
console.log('COMMENTARY ORDER:', coms.map(c => c.id));

// Verify publications ordering for ko (first 3)
const pubs = await db.selectFrom('bom_xtras_source').selectAll()
  .where('source_lang', '=', 'ko')
  .limit(3)
  .execute();
console.log('PUBS KO ORDER (first 3 ids):', pubs.map(s => s.source_id));

// publications for en ordering (first 3)
const pubsEn = await db.selectFrom('bom_xtras_source').selectAll()
  .where('source_lang', '=', 'en')
  .limit(3)
  .execute();
console.log('PUBS EN ORDER (first 3 ids):', pubsEn.map(s => s.source_id));

await db.destroy();
