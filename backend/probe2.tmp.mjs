import { getDb } from '/home/bom/BookofMormonOnline/backend/src/data/db.js';
const db = getDb();

// Check text row for image 1028's location_guid
const t1 = await db.selectFrom('bom_text').selectAll().where('guid', '=', '4becc77f2f45a').execute();
console.log('TEXT for img 1028 location:', JSON.stringify(t1[0]));

// Check text row for commentary 1000001101's location_guid
const t2 = await db.selectFrom('bom_text').selectAll().where('guid', '=', '4becc77f76be9').execute();
console.log('TEXT for com 1000001101 location:', JSON.stringify(t2[0]));

// Check narration for text row
if (t1[0]) {
  const nar1 = await db.selectFrom('bom_narration').selectAll().where('parent', '=', t1[0].parent || '').execute();
  console.log('NARRATION for img text (parent as narration):', JSON.stringify(nar1[0]));
  
  // Get page for text
  if (t1[0].page) {
    const pg = await db.selectFrom('bom_page').selectAll().where('guid', '=', t1[0].page).execute();
    console.log('PAGE:', JSON.stringify(pg[0]));
    
    // Get section
    if (t1[0].section) {
      const sec = await db.selectFrom('bom_section').selectAll().where('guid', '=', t1[0].section).execute();
      console.log('SECTION:', JSON.stringify(sec[0]));
    }
    
    // Narration: bom_narration where parent = bom_text.parent
    const nar = await db.selectFrom('bom_narration').selectAll().where('guid', '=', t1[0].parent || '').execute();
    console.log('NARRATION by guid = text.parent:', JSON.stringify(nar[0]));
  }
}

await db.destroy();
