/**
 * Shared two-party scenario setup/teardown for the write suites.
 *
 * Creates a __wftest__ channel owned by the operator (Staff), optionally adds the
 * member (regression), seeds the member's messenger_users row when missing, and
 * (optionally) connects both sockets. teardown() removes everything the scenario
 * created — channel + messages/members + any seeded messenger_users row.
 */
const { MARKER, runId, operatorToken, memberToken } = require('./config');
const { assertProdWriteGuards } = require('./preflight');
const { gql, whoami } = require('./gql');
const { WsClient } = require('./ws');
const db = require('./db');

let opIdentity = null;
let memberIdentity = null;

async function identities() {
  if (!opIdentity) opIdentity = await whoami(operatorToken);
  if (!memberIdentity) memberIdentity = await whoami(memberToken);
  return { op: opIdentity, member: memberIdentity };
}

/**
 * @param {object} opts
 *   customType   'open' | 'public' | 'private' | 'solo' | 'DM'  (default 'open')
 *   addMember    seed member's messenger_users row + (for 'open') joinOpenGroup  (default true)
 *   connect      'both' | 'op' | 'member' | 'none'  (default 'none')
 *   label        extra text in the channel name
 */
async function setupChannel(opts = {}) {
  const { customType = 'open', addMember = true, connect = 'none', label = '' } = opts;
  assertProdWriteGuards();
  expect(operatorToken).toBeTruthy();

  const created = new Set();
  const createdUsers = new Set();
  const { op, member } = await identities();
  expect(op.isSuccess).toBe(true);

  if (addMember) {
    expect(memberToken).toBeTruthy();
    expect(member.isSuccess).toBe(true);
    const seed = await db.ensureMessengerUser(member.userId, member.user, 'Regression Test');
    if (seed.created) createdUsers.add(member.userId);
  }

  const name = `${MARKER}${runId} ${customType}${label ? ' ' + label : ''} ${Math.floor(Math.random() * 1e6)}`;
  const { data } = await gql(
    `mutation { messengerCreateChannel(name:${JSON.stringify(name)}, customType:"${customType}", operatorIds:[${JSON.stringify(op.userId)}]){ channel_url } }`,
    { token: operatorToken },
  );
  const channelUrl = data.messengerCreateChannel.channel_url;
  expect(channelUrl).toBeTruthy();
  created.add(channelUrl);

  if (addMember && customType === 'open') {
    await gql(`mutation { joinOpenGroup(token:"${memberToken}", url:"${channelUrl}"){ isSuccess } }`);
  }

  const sockets = {};
  // connect AFTER the member has joined so the server joins each socket to the room.
  if (connect === 'both' || connect === 'op') { sockets.op = new WsClient('op'); await sockets.op.connect(operatorToken); }
  if (connect === 'both' || connect === 'member') { sockets.member = new WsClient('member'); await sockets.member.connect(memberToken); }

  async function teardown() {
    if (sockets.op) sockets.op.disconnect();
    if (sockets.member) sockets.member.disconnect();
    try { await db.deleteChannelCascade(channelUrl, created); } catch { /* already gone */ }
    for (const uid of createdUsers) { try { await db.deleteMessengerUser(uid, createdUsers); } catch { /* keep */ } }
  }

  return {
    channelUrl, created, createdUsers,
    op, member, opUserId: op.userId, memberUserId: member.userId,
    opSocket: sockets.op, memberSocket: sockets.member,
    teardown,
  };
}

module.exports = { setupChannel, identities };
