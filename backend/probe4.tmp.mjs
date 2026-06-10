import { getDb } from '/home/bom/BookofMormonOnline/backend/src/data/db.js';
const db = getDb();

// Check translations for image 1028 (check bom_translation table)
const trans = await db.selectFrom('bom_translation')
  .selectAll()
  .where('guid', '=', '1028')  // image id as string?
  .execute();
console.log('TRANS for guid=1028:', JSON.stringify(trans));

// Check section loader
const sec = await db.selectFrom('bom_section').selectAll().where('guid', '=', '4becc77f2dac2').execute();
console.log('SECTION:', JSON.stringify(sec[0]));

// Check bom_translation for section
const secTrans = await db.selectFrom('bom_translation').selectAll().where('guid', '=', '4becc77f2dac2').limit(5).execute();
console.log('SECTION TRANS:', JSON.stringify(secTrans));

await db.destroy();
