/**
 * channel-mgmt.test.js — channel-level mutations beyond create/delete:
 *   messengerUpdateChannel (name + description) and DM-type creation.
 */
const { MARKER, runId, operatorToken } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const { gql, whoami } = require('./lib/gql');
const db = require('./lib/db');

const created = new Set();
let op = null;

async function createChannel(customType) {
  const name = `${MARKER}${runId} ${customType} mgmt ${Math.floor(Math.random() * 1e6)}`;
  const { data } = await gql(`mutation { messengerCreateChannel(name:${JSON.stringify(name)}, customType:"${customType}", operatorIds:[${JSON.stringify(op.userId)}]){ channel_url } }`, { token: operatorToken });
  const url = data.messengerCreateChannel.channel_url;
  created.add(url);
  return url;
}

beforeAll(async () => { assertProdWriteGuards(); op = await whoami(operatorToken); expect(op.isSuccess).toBe(true); });
afterAll(async () => {
  for (const url of created) { try { await db.deleteChannelCascade(url, created); } catch { /* */ } }
  await db.close();
});

test('messengerUpdateChannel updates name + description', async () => {
  const url = await createChannel('open');
  const newName = `${MARKER}${runId} renamed ${Math.floor(Math.random() * 1e6)}`;
  const newDesc = 'updated description for the write suite';
  await gql(`mutation { messengerUpdateChannel(channelUrl:"${url}", name:${JSON.stringify(newName)}, description:${JSON.stringify(newDesc)}){ channel_url name } }`, { token: operatorToken });
  const r = (await db.query('SELECT name, description FROM messenger_channels WHERE channel_url=?', [url]))[0];
  expect(r.name).toBe(newName);
  expect(r.description).toBe(newDesc);
});

test('messengerCreateChannel supports DM type', async () => {
  const url = await createChannel('DM');
  const r = (await db.query('SELECT custom_type FROM messenger_channels WHERE channel_url=?', [url]))[0];
  expect(r.custom_type).toBe('DM');
});
