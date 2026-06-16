/**
 * membership.test.js — full group-membership lifecycle, op (Staff, operator) +
 * member (regression). Each flow is verified against the messenger_members row
 * (role/state/is_muted) and cleaned up. Covers:
 *   joinOpenGroup · requestToJoinGroup/processRequest/withdrawRequest ·
 *   messengerInviteMembers/AcceptInvitation/DeclineInvitation ·
 *   messengerUpdateMemberRole · messengerSetMute · messengerRemoveMember ·
 *   joinGroup(hash) · the user_joined realtime event.
 */
const { MARKER, runId, operatorToken, memberToken } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const { gql, whoami } = require('./lib/gql');
const { WsClient } = require('./lib/ws');
const db = require('./lib/db');

const createdChannels = new Set();
const createdUsers = new Set();
const createdHashes = [];
let op = null;
let member = null;

async function createChannel(customType) {
  const name = `${MARKER}${runId} ${customType} mem ${Math.floor(Math.random() * 1e6)}`;
  const { data } = await gql(
    `mutation { messengerCreateChannel(name:${JSON.stringify(name)}, customType:"${customType}", operatorIds:[${JSON.stringify(op.userId)}]){ channel_url } }`,
    { token: operatorToken },
  );
  const url = data.messengerCreateChannel.channel_url;
  createdChannels.add(url);
  return url;
}
async function memberRow(url, userId) {
  const r = await db.query('SELECT role, state, is_muted FROM messenger_members WHERE channel_url=? AND user_id=?', [url, userId]);
  return r[0] || null;
}

beforeAll(async () => {
  assertProdWriteGuards();
  expect(memberToken).toBeTruthy();
  op = await whoami(operatorToken); member = await whoami(memberToken);
  expect(op.isSuccess && member.isSuccess).toBe(true);
  const seed = await db.ensureMessengerUser(member.userId, member.user, 'Regression Test');
  if (seed.created) createdUsers.add(member.userId);
}, 30000);

afterAll(async () => {
  for (const url of createdChannels) { try { await db.deleteChannelCascade(url, createdChannels); } catch { /* gone */ } }
  for (const h of createdHashes) { try { await db.query('DELETE FROM bom_shortlinks WHERE hash=? LIMIT 1', [h]); } catch { /* */ } }
  for (const uid of createdUsers) { try { await db.deleteMessengerUser(uid, createdUsers); } catch { /* */ } }
  await db.close();
});

test('joinOpenGroup → state=joined (+ user_joined pushed to the operator)', async () => {
  const url = await createChannel('open');
  const opSock = new WsClient('op'); await opSock.connect(operatorToken); // connect AFTER create → joins this room
  try {
    const t0 = Date.now();
    await gql(`mutation { joinOpenGroup(token:"${memberToken}", url:"${url}"){ isSuccess } }`);
    expect((await memberRow(url, member.userId)).state).toBe('joined');
    const ev = await opSock.waitFor('user_joined', () => true, { since: t0, timeout: 6000 }).catch(() => null);
    expect(ev).toBeTruthy(); // event bus pushed the join
  } finally { opSock.disconnect(); }
});

test('requestToJoinGroup → requested; processRequest(grant) → joined', async () => {
  const url = await createChannel('public');
  await gql(`mutation { requestToJoinGroup(token:"${memberToken}", url:"${url}"){ isSuccess } }`);
  expect((await memberRow(url, member.userId)).state).toBe('requested');
  await gql(`mutation { processRequest(token:"${operatorToken}", channel:"${url}", user_id:"${member.userId}", grant:true) }`);
  expect((await memberRow(url, member.userId)).state).toBe('joined');
});

test('requestToJoinGroup → withdrawRequest → request gone', async () => {
  const url = await createChannel('public');
  await gql(`mutation { requestToJoinGroup(token:"${memberToken}", url:"${url}"){ isSuccess } }`);
  expect((await memberRow(url, member.userId)).state).toBe('requested');
  await gql(`mutation { withdrawRequest(token:"${memberToken}", url:"${url}"){ isSuccess } }`);
  expect(await memberRow(url, member.userId)).toBeNull();
});

test('messengerInviteMembers → invited; messengerAcceptInvitation → joined', async () => {
  const url = await createChannel('private');
  await gql(`mutation { messengerInviteMembers(channelUrl:"${url}", userIds:["${member.userId}"]) }`, { token: operatorToken });
  expect((await memberRow(url, member.userId)).state).toBe('invited');
  await gql(`mutation { messengerAcceptInvitation(channelUrl:"${url}", userId:"${member.userId}") }`, { token: memberToken });
  expect((await memberRow(url, member.userId)).state).toBe('joined');
});

test('messengerInviteMembers → messengerDeclineInvitation → removed', async () => {
  const url = await createChannel('private');
  await gql(`mutation { messengerInviteMembers(channelUrl:"${url}", userIds:["${member.userId}"]) }`, { token: operatorToken });
  expect((await memberRow(url, member.userId)).state).toBe('invited');
  await gql(`mutation { messengerDeclineInvitation(channelUrl:"${url}", userId:"${member.userId}") }`, { token: memberToken });
  expect(await memberRow(url, member.userId)).toBeNull();
});

test('messengerUpdateMemberRole → operator then member', async () => {
  const url = await createChannel('open');
  await gql(`mutation { joinOpenGroup(token:"${memberToken}", url:"${url}"){ isSuccess } }`);
  await gql(`mutation { messengerUpdateMemberRole(channelUrl:"${url}", userId:"${member.userId}", role:"operator") }`, { token: operatorToken });
  expect((await memberRow(url, member.userId)).role).toBe('operator');
  await gql(`mutation { messengerUpdateMemberRole(channelUrl:"${url}", userId:"${member.userId}", role:"member") }`, { token: operatorToken });
  expect((await memberRow(url, member.userId)).role).toBe('member');
});

test('messengerSetMute → muted then unmuted', async () => {
  const url = await createChannel('open');
  await gql(`mutation { joinOpenGroup(token:"${memberToken}", url:"${url}"){ isSuccess } }`);
  await gql(`mutation { messengerSetMute(channelUrl:"${url}", userId:"${member.userId}", muted:true) }`, { token: operatorToken });
  expect(Number((await memberRow(url, member.userId)).is_muted)).toBe(1);
  await gql(`mutation { messengerSetMute(channelUrl:"${url}", userId:"${member.userId}", muted:false) }`, { token: operatorToken });
  expect(Number((await memberRow(url, member.userId)).is_muted)).toBe(0);
});

test('messengerRemoveMember → membership removed', async () => {
  const url = await createChannel('open');
  await gql(`mutation { joinOpenGroup(token:"${memberToken}", url:"${url}"){ isSuccess } }`);
  expect((await memberRow(url, member.userId)).state).toBe('joined');
  await gql(`mutation { messengerRemoveMember(channelUrl:"${url}", userId:"${member.userId}") }`, { token: operatorToken });
  expect(await memberRow(url, member.userId)).toBeNull();
});

test('joinGroup(hash) → joined (via shortlink)', async () => {
  const url = await createChannel('open');
  const { data } = await gql(`mutation { shortlink(string:"${url}"){ hash string } }`);
  const hash = data.shortlink.hash;
  createdHashes.push(hash);
  await gql(`mutation { joinGroup(token:"${memberToken}", hash:"${hash}"){ isSuccess channel } }`);
  expect((await memberRow(url, member.userId)).state).toBe('joined');
});
