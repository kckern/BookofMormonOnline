import 'dotenv/config';
import { getDb, closeDb } from '../src/data/db.js';
import { reindexVerses } from '../src/search/indexer.js';

async function main() {
  const db = getDb();
  const n = await reindexVerses(db);
  // eslint-disable-next-line no-console
  console.log(`Reindexed ${n} verses into Qdrant.`);
  await closeDb();
}
main().catch((e) => { console.error(e); process.exit(1); });
