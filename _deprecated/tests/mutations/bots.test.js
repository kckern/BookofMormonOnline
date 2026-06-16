/**
 * bots.test.js — full bot-reply roundtrip.
 *   addBot → human posts a trigger message → botResponder loads the persona and
 *   (via the STUB_LLM_REPLY gateway) posts a reply → the operator's socket
 *   receives the bot's message_received. Then removeBot.
 *
 * Requires the backend running with STUB_LLM_REPLY set (deterministic reply, no
 * real LLM key). The bot must have a persona row in bom_virtualgroup_prompts.
 *
 * Run: cd <repo> && ALLOW_PROD_WRITES=1 STAFF_TOKEN=<tok> npx jest --config tests/jest.config.js tests/mutations/bots.test.js
 */
const { MARKER, runId, operatorToken } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const { gql, whoami } = require('./lib/gql');
const { WsClient } = require('./lib/ws');
const db = require('./lib/db');

const STUB = '__wftest__ bot reply ok';
const created = new Set();
let op = null;
let botId = null;
let channelUrl = null;
const opSock = new WsClient('op');

beforeAll(async () => {
  assertProdWriteGuards();
  op = await whoami(operatorToken);
  expect(op.isSuccess).toBe(true);
  // Any bot user works — getPersona falls back to a default prompt for every bot.
  const rows = await db.query('SELECT user_id FROM messenger_users WHERE is_bot=1 LIMIT 1');
  if (rows.length) botId = rows[0].user_id;
}, 30000);

afterAll(async () => {
  opSock.disconnect();
  if (channelUrl) { try { await db.deleteChannelCascade(channelUrl, created); } catch { /* */ } }
  await db.close();
});

test('a bot user exists to test with', () => {
  expect(botId).toBeTruthy();
});

test('addBot → bot becomes a channel member', async () => {
  const name = `${MARKER}${runId} bots ${Math.floor(Math.random() * 1e6)}`;
  const { data } = await gql(`mutation { messengerCreateChannel(name:${JSON.stringify(name)}, customType:"open", operatorIds:[${JSON.stringify(op.userId)}]){ channel_url } }`, { token: operatorToken });
  channelUrl = data.messengerCreateChannel.channel_url;
  created.add(channelUrl);
  await opSock.connect(operatorToken); // after create → joins the room

  const ok = (await gql(`mutation { addBot(token:"${operatorToken}", channel:"${channelUrl}", bot:"${botId}") }`)).data.addBot;
  expect(ok).toBe(true);
  const m = await db.query('SELECT user_id FROM messenger_members WHERE channel_url=? AND user_id=?', [channelUrl, botId]);
  expect(m.length).toBe(1);
});

test('FULL REPLY: human posts → bot replies → operator sees the bot message live', async () => {
  const t0 = Date.now();
  opSock.emit('send_message', { channelUrl, message: `trigger-${runId}` });
  // wait for the bot's reply: a message_received from the bot (is_bot) with the stub text.
  const reply = await opSock.waitFor('message_received',
    (p) => p.message === STUB && (p.user?.is_bot || p.user?.user_id === botId), { since: t0, timeout: 15000 });
  expect(reply).toBeTruthy();
  expect(reply.message).toBe(STUB);
});

test('removeBot → bot removed from the channel', async () => {
  const ok = (await gql(`mutation { removeBot(token:"${operatorToken}", channel:"${channelUrl}", bot:"${botId}") }`)).data.removeBot;
  expect(ok).toBe(true);
  const m = await db.query('SELECT user_id FROM messenger_members WHERE channel_url=? AND user_id=?', [channelUrl, botId]);
  expect(m.length).toBe(0);
});
