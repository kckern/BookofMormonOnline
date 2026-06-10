import { getDb } from '/home/bom/BookofMormonOnline/backend/src/data/db.js';
const db = getDb();

// Check if there's a translation for the text guid heading
const trans = await db.selectFrom('bom_translation')
  .selectAll()
  .where('guid', '=', '4becc77f2f45a')
  .where('lang', '=', 'ko')
  .execute();
console.log('TRANS for text guid 4becc77f2f45a ko:', JSON.stringify(trans));

// Also check for 4becc77f76be9 (commentary location)
const trans2 = await db.selectFrom('bom_translation')
  .selectAll()
  .where('guid', '=', '4becc77f76be9')
  .where('lang', '=', 'ko')
  .execute();
console.log('TRANS for com text guid ko:', JSON.stringify(trans2));

await db.destroy();
