import { getDb } from '/home/bom/BookofMormonOnline/backend/src/data/db.js';
const db = getDb();

// Check sources for ko
const sourcesKo = await db.selectFrom('bom_xtras_source').selectAll().where('source_lang', '=', 'ko').limit(3).execute();
console.log('SOURCES KO (3):', JSON.stringify(sourcesKo));

// Check all distinct source_lang values  
const langs = await db.selectFrom('bom_xtras_source').select('source_lang').distinct().execute();
console.log('SOURCE LANGS:', JSON.stringify(langs));

// Get source for commentary source_id "11"
const src = await db.selectFrom('bom_xtras_source').selectAll().where('source_id', '=', 11).execute();
console.log('SOURCE 11:', JSON.stringify(src[0]));

// What does the publications baseline ko look like?
// Check commentary 1000001101 source field
const com = await db.selectFrom('bom_xtras_commentary').selectAll().where('id', '=', 1000001101).execute();
console.log('COM source field:', com[0]?.source);

// Check commentary 1000307101
const com2 = await db.selectFrom('bom_xtras_commentary').selectAll().where('id', '=', 1000307101).execute();
console.log('COM 1000307101:', JSON.stringify({id:com2[0]?.id, source:com2[0]?.source, location_guid:com2[0]?.location_guid}));

// Check commentary 1000018101
const com3 = await db.selectFrom('bom_xtras_commentary').selectAll().where('id', '=', 1000018101).execute();
console.log('COM 1000018101:', JSON.stringify({id:com3[0]?.id, source:com3[0]?.source, location_guid:com3[0]?.location_guid}));

await db.destroy();
