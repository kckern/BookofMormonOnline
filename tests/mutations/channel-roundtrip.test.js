/**
 * channel-roundtrip.test.js — create→verify→delete leave-no-trace proof, with a
 * FULLY-POPULATED channel (name, description, cover image, type, operators), not
 * a bare-bones one. Verifies every field round-trips through the mutation into
 * the DB and back out through the read path (homegroups), then deletes it via
 * the guarded teardown and confirms zero residue.
 *
 * Run: cd <repo> && ALLOW_PROD_WRITES=1 STAFF_TOKEN=<tok> npx jest --config tests/jest.config.js tests/mutations/channel-roundtrip.test.js
 */
const { MARKER, runId, operatorToken } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const { gql, whoami } = require('./lib/gql');
const db = require('./lib/db');

const created = new Set();
let channelUrl = null;
let operatorUserId = null;

// The full field set we create + assert round-trips.
const spec = {
  name: `${MARKER}${runId} Full Channel`,
  description: 'A fully-populated test channel for the mutation write-suite.',
  coverUrl: 'https://assets.bookofmormon.online/test/__wftest__cover.jpg',
  customType: 'open',
  lang: 'en',
};

beforeAll(async () => {
  assertProdWriteGuards();
  const me = await whoami(operatorToken);
  expect(me.isSuccess).toBe(true);
  operatorUserId = me.userId;
});

afterAll(async () => {
  if (channelUrl) {
    try { await db.deleteChannelCascade(channelUrl, created); } catch { /* already gone */ }
  }
  await db.close();
});

test('create a fully-populated channel (name, description, cover, type, operator)', async () => {
  const { data } = await gql(
    `mutation { messengerCreateChannel(
        name:${JSON.stringify(spec.name)},
        description:${JSON.stringify(spec.description)},
        coverUrl:${JSON.stringify(spec.coverUrl)},
        customType:${JSON.stringify(spec.customType)},
        operatorIds:[${JSON.stringify(operatorUserId)}]
      ){ channel_url name description cover_url custom_type members { user_id role } } }`,
    { token: operatorToken },
  );
  const ch = data.messengerCreateChannel;
  expect(ch).toBeTruthy();
  expect(ch.channel_url).toBeTruthy();
  channelUrl = ch.channel_url;
  created.add(channelUrl);

  // mutation echo carries the fields the ChannelDTO exposes.
  // NOTE: ChannelDTO has no `description` field, so the echo omits it even though
  // it persists (verified via DB below). Flagged as a backend gap.
  expect(ch.name).toBe(spec.name);
  expect(ch.cover_url).toBe(spec.coverUrl);
  expect(ch.custom_type).toBe(spec.customType);
  const op = (ch.members || []).find((m) => m.user_id === operatorUserId);
  expect(op).toBeTruthy();
  expect(op.role).toBe('operator');
});

test('every field persisted to messenger_channels', async () => {
  const rows = await db.query(
    'SELECT name, description, cover_url, custom_type, lang FROM messenger_channels WHERE channel_url = ?',
    [channelUrl],
  );
  expect(rows.length).toBe(1);
  const r = rows[0];
  expect(r.name).toBe(spec.name);
  expect(r.description).toBe(spec.description);
  expect(r.cover_url).toBe(spec.coverUrl);
  expect(r.custom_type).toBe(spec.customType);
  expect(r.lang).toBe(spec.lang);
});

test('operator member persisted (role=operator, state=joined)', async () => {
  const rows = await db.query(
    'SELECT user_id, role, state FROM messenger_members WHERE channel_url = ?',
    [channelUrl],
  );
  const op = rows.find((m) => m.user_id === operatorUserId);
  expect(op).toBeTruthy();
  expect(op.role).toBe('operator');
  expect(op.state).toBe('joined');
});

test('the channel surfaces through the read path (homegroups) with name/privacy/picture', async () => {
  // Use grouping:"my_groups" (cap 60) — the default homegroups view caps at 6 and a
  // brand-new empty channel sorts last, so it only reliably surfaces in the full list.
  const { data } = await gql(
    `{ homegroups(token:"${operatorToken}", grouping:"my_groups"){ url name description privacy picture } }`,
  );
  const g = (data.homegroups || []).find((x) => x.url === channelUrl);
  expect(g).toBeTruthy();
  expect(g.name).toBe(spec.name);
  expect(g.privacy).toBe(spec.customType);
  expect(g.picture).toBe(spec.coverUrl);
  // Fixed: assembleChannelDTO now merges the description column into data JSON.
  expect(g.description).toBe(spec.description);
});

test('guarded teardown deletes the channel + members cleanly (no residue)', async () => {
  const res = await db.deleteChannelCascade(channelUrl, created);
  expect(res.deleted).toBe(true);
  const chRows = await db.query('SELECT channel_url FROM messenger_channels WHERE channel_url = ?', [channelUrl]);
  expect(chRows.length).toBe(0);
  const memRows = await db.query('SELECT user_id FROM messenger_members WHERE channel_url = ?', [channelUrl]);
  expect(memRows.length).toBe(0);
  channelUrl = null;
});
