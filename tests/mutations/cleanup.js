/**
 * Standalone teardown: purge every __wftest__ channel (+ its messages/members).
 * Use after an aborted run. Guarded by the MARKER + the MAX_PURGE cap.
 *   node tests/mutations/cleanup.js
 */
const db = require('./lib/db');
(async () => {
  const res = await db.purgeAllTestChannels();
  console.log(`purged ${res.length} __wftest__ channel(s)`);
  await db.close();
})().catch((e) => { console.error('cleanup failed:', e.message); process.exit(1); });
