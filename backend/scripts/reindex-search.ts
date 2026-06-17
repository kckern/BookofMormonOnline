import 'dotenv/config';
import { getDb, closeDb } from '../src/data/db.js';
import { reindexVerses, reindexType } from '../src/search/indexer.js';
import { TYPE_CONFIGS } from '../src/search/adapters.js';

async function main() {
  const db = getDb();
  try {
    const verses = await reindexVerses(db);
    // eslint-disable-next-line no-console
    console.log(`Reindexed ${verses} verses.`);
    for (const { cfg, load } of TYPE_CONFIGS) {
      const n = await reindexType(db, cfg, load);
      // eslint-disable-next-line no-console
      console.log(`Reindexed ${n} ${cfg.type} points.`);
    }
  } finally {
    await closeDb();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
