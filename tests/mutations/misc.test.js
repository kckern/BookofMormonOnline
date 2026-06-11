/**
 * misc.test.js — remaining mutations: shortlink (find-or-create) and ping
 * (analytics beacon). ping forwards to Clicky when sandbox is off — a single
 * test pageview; acceptable, flagged.
 */
const { MARKER, operatorToken } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const { gql } = require('./lib/gql');
const db = require('./lib/db');

const createdHashes = [];

beforeAll(async () => { assertProdWriteGuards(); });
afterAll(async () => {
  for (const h of createdHashes) { try { await db.query('DELETE FROM bom_shortlinks WHERE hash=? LIMIT 1', [h]); } catch { /* */ } }
  await db.close();
});

test('shortlink find-or-create returns a hash and persists it', async () => {
  const string = `${MARKER}misc/${Date.now()}`;
  const { data } = await gql(`mutation { shortlink(string:${JSON.stringify(string)}){ hash string } }`);
  expect(data.shortlink.hash).toBeTruthy();
  expect(data.shortlink.string).toBe(string);
  createdHashes.push(data.shortlink.hash);
  const row = await db.query('SELECT string FROM bom_shortlinks WHERE hash=?', [data.shortlink.hash]);
  expect(row.length).toBe(1);
  expect(row[0].string).toBe(string);

  // find-or-create: same string returns the same hash (no duplicate)
  const again = await gql(`mutation { shortlink(string:${JSON.stringify(string)}){ hash } }`);
  expect(again.data.shortlink.hash).toBe(data.shortlink.hash);
});

test('ping returns a boolean (analytics beacon accepted)', async () => {
  const payload = Buffer.from('type=pageview&href=/__wftest__').toString('base64');
  const { data } = await gql(`mutation { ping(data:${JSON.stringify(payload)}) }`);
  expect(typeof data.ping).toBe('boolean');
});
