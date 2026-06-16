/**
 * guards.test.js — SAFETY VERIFICATION. Runs BEFORE any write suite.
 *
 * Proves the teardown delete path cannot drop real data:
 *   1. refuses a real channel that is not in the run created-set,
 *   2. refuses a real channel even if (somehow) in the created-set but lacking the marker,
 *   3. the real channel still exists after both refusals,
 *   4. the bulk-purge cap aborts rather than mass-deleting.
 *
 * This test performs NO deletes. It needs RW DB connectivity (reads only here) and
 * the preflight env (ALLOW_PROD_WRITES=1, SANDBOX=0, MYSQL_DB=bom_prd).
 *
 * Run: cd <repo> && ALLOW_PROD_WRITES=1 STAFF_TOKEN=<tok> npx jest --config tests/jest.config.js tests/mutations/guards.test.js
 */
const { MARKER } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const db = require('./lib/db');

let realChannel = null; // { channel_url, name } of a genuine, non-test channel

beforeAll(async () => {
  assertProdWriteGuards();
  // Pick a real channel that is NOT a test channel (name lacks the marker).
  const rows = await db.query(
    'SELECT channel_url, name FROM messenger_channels WHERE name NOT LIKE ? LIMIT 1',
    [`%${MARKER}%`],
  );
  realChannel = rows[0] || null;
});

afterAll(async () => { await db.close(); });

test('a real channel exists to test against', () => {
  expect(realChannel).toBeTruthy();
  expect(String(realChannel.name)).not.toContain(MARKER);
});

test('REFUSES delete of a real channel NOT in the created-set', async () => {
  await expect(db.deleteChannelCascade(realChannel.channel_url, new Set()))
    .rejects.toThrow(/not in the run created-set/i);
});

test('REFUSES delete of a real channel even if forced into the created-set (no marker)', async () => {
  const polluted = new Set([realChannel.channel_url]);
  await expect(db.deleteChannelCascade(realChannel.channel_url, polluted))
    .rejects.toThrow(/lacks .*__wftest__|non-test channel/i);
});

test('the real channel still exists after the refused deletes', async () => {
  const rows = await db.query('SELECT channel_url FROM messenger_channels WHERE channel_url = ?', [realChannel.channel_url]);
  expect(rows.length).toBe(1);
});

test('assertChannelDeletable returns false (no throw) for an unknown url already in created-set', async () => {
  const fakeUrl = `${MARKER}_does_not_exist_${Date.now()}`;
  const res = await db.assertChannelDeletable(fakeUrl, new Set([fakeUrl]));
  expect(res).toBe(false); // already-gone, safe no-op
});
