/**
 * realtime-pingpong.test.js — two independent users / two sockets witnessing a
 * conversation in real time, BOTH directions (the "ping-pong"). This is the home-
 * feed event-bus guarantee: when one party acts, the other sees it pushed — no
 * polling, no refresh.
 *
 *   ping   op  --send_message-->  member receives message_received
 *   pong   member --send_message--> op receives message_received
 *   react  op --add_reaction(member's msg)--> member receives reaction_changed
 *   delete op --delete_message--> member receives message_deleted
 *
 * Setup: op creates a __wftest__ open channel, member joins it, BOTH connect
 * (the server joins each socket to its channel rooms on connect). Teardown:
 * guarded channel delete.
 *
 * Run: cd <repo> && ALLOW_PROD_WRITES=1 STAFF_TOKEN=<op> [MEMBER_TOKEN=<mem>] \
 *   npx jest --config tests/jest.config.js tests/mutations/realtime-pingpong.test.js
 */
const { MARKER, runId, operatorToken, memberToken } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const { gql, whoami } = require('./lib/gql');
const { WsClient } = require('./lib/ws');
const db = require('./lib/db');

const created = new Set();
const createdUsers = new Set(); // messenger_users rows we seeded (for teardown)
let channelUrl = null;
let opUserId = null;
let memberUserId = null;
let memberUsername = null;
const op = new WsClient('op');
const member = new WsClient('member');

const idOf = (m) => m.message_id ?? m.messageId ?? m.id;

beforeAll(async () => {
  assertProdWriteGuards();
  expect(memberToken).toBeTruthy(); // regression account from .env.test

  const a = await whoami(operatorToken); const b = await whoami(memberToken);
  expect(a.isSuccess && b.isSuccess).toBe(true);
  opUserId = a.userId; memberUserId = b.userId; memberUsername = b.user;

  // The regression account may have no messenger_users row (never used messaging);
  // its socket can't authenticate without one. Seed it (tracked for teardown).
  const seed = await db.ensureMessengerUser(memberUserId, memberUsername, 'Regression Test');
  if (seed.created) createdUsers.add(memberUserId);

  // op creates an open channel
  const name = `${MARKER}${runId} pingpong`;
  const { data } = await gql(
    `mutation { messengerCreateChannel(name:${JSON.stringify(name)}, customType:"open", operatorIds:[${JSON.stringify(opUserId)}]){ channel_url } }`,
    { token: operatorToken },
  );
  channelUrl = data.messengerCreateChannel.channel_url;
  created.add(channelUrl);

  // member joins, THEN both connect (so each socket joins the channel room)
  await gql(`mutation { joinOpenGroup(token:"${memberToken}", url:"${channelUrl}"){ isSuccess } }`);
  await op.connect(operatorToken);
  await member.connect(memberToken);
}, 30000);

afterAll(async () => {
  op.disconnect(); member.disconnect();
  if (channelUrl) { try { await db.deleteChannelCascade(channelUrl, created); } catch { /* gone */ } }
  for (const uid of createdUsers) { try { await db.deleteMessengerUser(uid, createdUsers); } catch { /* keep */ } }
  await db.close();
});

let opMsgId = null;
let memberMsgId = null;

test('PING: op sends → member receives it in real time', async () => {
  const text = `ping-${runId}`;
  const t0 = Date.now();
  op.emit('send_message', { channelUrl, message: text });
  const got = await member.waitFor('message_received', (p) => p.channel_url === channelUrl && p.message === text, { since: t0 });
  expect(got).toBeTruthy();
  opMsgId = idOf(got);
  expect(opMsgId).toBeTruthy();
});

test('PONG: member sends → op receives it in real time', async () => {
  const text = `pong-${runId}`;
  const t0 = Date.now();
  member.emit('send_message', { channelUrl, message: text });
  const got = await op.waitFor('message_received', (p) => p.channel_url === channelUrl && p.message === text, { since: t0 });
  expect(got).toBeTruthy();
  memberMsgId = idOf(got);
  expect(memberMsgId).toBeTruthy();
});

test('REACT: op reacts to member\'s message → member sees reaction_changed', async () => {
  const t0 = Date.now();
  op.emit('add_reaction', { channelUrl, messageId: memberMsgId, reactionKey: 'like' });
  const got = await member.waitFor('reaction_changed',
    (p) => idOf(p) === memberMsgId && JSON.stringify(p.reactions || []).includes('like'), { since: t0 });
  expect(got).toBeTruthy();
});

test('DELETE: op deletes its message → member sees message_deleted', async () => {
  const t0 = Date.now();
  op.emit('delete_message', { channelUrl, messageId: opMsgId });
  const got = await member.waitFor('message_deleted', (p) => idOf(p) === opMsgId, { since: t0 });
  expect(got).toBeTruthy();
});
