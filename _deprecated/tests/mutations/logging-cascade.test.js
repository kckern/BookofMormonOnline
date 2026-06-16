/**
 * logging-cascade.test.js — the `log` mutation and its progress cascade.
 *
 * Logging a 'block' must: insert a bom_log row, bump bom_user.last_active, score
 * the block, and return updated progress (completed/started %). We verify all of
 * that on the Staff test account, then DELETE the exact bom_log row(s) we
 * inserted (the only non-reversible mutation, cleaned up per request).
 */
const { operatorToken } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const { gql, whoami } = require('./lib/gql');
const db = require('./lib/db');

let user = null;       // bom_user.user of the Staff account
let blockVal = null;   // "pageSlug/link" to log
let blockGuid = null;  // the bom_text.guid it resolves to
const insertedLogs = []; // { user, timestamp, type, value } rows to remove

beforeAll(async () => {
  assertProdWriteGuards();
  const me = await whoami(operatorToken);
  user = me.user;
  // a real, loggable block: "<pageSlug>/<link>" → bom_text.guid
  const rows = await db.query(
    `SELECT s.slug AS slug, t.link AS link, t.guid AS guid
       FROM bom_text t JOIN bom_slug s ON s.link = t.page
      WHERE t.link IS NOT NULL AND t.section IS NOT NULL AND s.type = 'PG'
      LIMIT 1`,
  );
  blockVal = `${rows[0].slug}/${rows[0].link}`;
  blockGuid = rows[0].guid;
});

afterAll(async () => {
  for (const r of insertedLogs) {
    try { await db.query('DELETE FROM bom_log WHERE user=? AND timestamp=? AND type=? AND value=? LIMIT 5', [r.user, r.timestamp, r.type, r.value]); } catch { /* */ }
  }
  await db.close();
});

test('log(block) returns logged + a progress score', async () => {
  const t0 = Math.round(Date.now() / 1000);
  const { data } = await gql(
    `mutation { log(token:"${operatorToken}", key:"block", val:"${blockVal}"){ logged progress { completed started } } }`,
  );
  expect(data.log).toBeTruthy();
  expect(data.log.logged).toBe(true);
  expect(typeof data.log.progress.completed).toBe('number');
  expect(typeof data.log.progress.started).toBe('number');
  // track the row(s) inserted around this timestamp for cleanup
  const rows = await db.query(
    'SELECT user, timestamp, type, value FROM bom_log WHERE user=? AND type=? AND value=? AND timestamp>=?',
    [user, 'block', blockGuid, t0 - 2],
  );
  rows.forEach((r) => insertedLogs.push(r));
  expect(rows.length).toBeGreaterThanOrEqual(1);
});

test('the cascade wrote a bom_log row + bumped last_active', async () => {
  const logged = await db.query('SELECT credit FROM bom_log WHERE user=? AND type=? AND value=? ORDER BY timestamp DESC LIMIT 1', [user, 'block', blockGuid]);
  expect(logged.length).toBe(1);
  const la = await db.query('SELECT last_active FROM bom_user WHERE user=?', [user]);
  expect(Number(la[0].last_active)).toBeGreaterThan(Math.round(Date.now() / 1000) - 120);
});

test('userprogress reflects a numeric completed/started after logging', async () => {
  const { data } = await gql(`{ userprogress(token:"${operatorToken}"){ completed started } }`);
  expect(data.userprogress).toBeTruthy();
  expect(typeof data.userprogress.completed).toBe('number');
  expect(typeof data.userprogress.started).toBe('number');
});

test('cleanup removes the inserted log row (leave-no-trace)', async () => {
  // run the same deletion the afterAll will, then assert it's gone
  for (const r of insertedLogs) {
    await db.query('DELETE FROM bom_log WHERE user=? AND timestamp=? AND type=? AND value=? LIMIT 5', [r.user, r.timestamp, r.type, r.value]);
  }
  const remaining = await db.query('SELECT 1 FROM bom_log WHERE user=? AND type=? AND value=? AND timestamp>=?', [user, 'block', blockGuid, insertedLogs[0].timestamp]);
  expect(remaining.length).toBe(0);
  insertedLogs.length = 0; // afterAll has nothing left to do
});
