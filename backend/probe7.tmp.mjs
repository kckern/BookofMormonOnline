import { getDb } from '/home/bom/BookofMormonOnline/backend/src/data/db.js';
const db = getDb();
// Get some random image IDs
const imgs = await db.selectFrom('bom_xtras_image').select('id').orderBy('id', 'asc').limit(20).offset(10).execute();
console.log('IMAGE IDS:', imgs.map(i => i.id));
// Get some random commentary IDs
const coms = await db.selectFrom('bom_xtras_commentary').select('id').orderBy('id', 'asc').limit(5).offset(50).execute();
console.log('COMMENTARY IDS:', coms.map(c => c.id));
await db.destroy();
