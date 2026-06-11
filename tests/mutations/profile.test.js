/**
 * profile.test.js — user/profile mutations, all reversible round-trips.
 *   editProfile (name) · messengerUpdateUser (nickname) ·
 *   messengerUpdateUserMetadata (metadata) on the Staff account;
 *   signout→signin token round-trip on the regression account (Staff has no
 *   password here). Excludes signup + changePassword per directive.
 */
const { operatorToken, memberToken, memberUsername, memberPassword } = require('./lib/config');
const { assertProdWriteGuards } = require('./lib/preflight');
const { gql, whoami } = require('./lib/gql');
const db = require('./lib/db');

let staff = null;

beforeAll(async () => {
  assertProdWriteGuards();
  staff = await whoami(operatorToken);
  expect(staff.isSuccess).toBe(true);
});
afterAll(async () => { await db.close(); });

test('editProfile: name round-trip (restored)', async () => {
  const before = (await gql(`{ tokensignin(token:"${operatorToken}"){ user { name email zip } } }`)).data.tokensignin.user;
  const tmp = `Staff WT ${Date.now()}`;
  const email = before.email || '';
  const zip = before.zip || '';
  await gql(`mutation { editProfile(token:"${operatorToken}", name:${JSON.stringify(tmp)}, email:${JSON.stringify(email)}, zip:${JSON.stringify(zip)}){ name } }`);
  let now = (await gql(`{ tokensignin(token:"${operatorToken}"){ user { name } } }`)).data.tokensignin.user.name;
  expect(now).toBe(tmp);
  await gql(`mutation { editProfile(token:"${operatorToken}", name:${JSON.stringify(before.name)}, email:${JSON.stringify(email)}, zip:${JSON.stringify(zip)}){ name } }`);
  now = (await gql(`{ tokensignin(token:"${operatorToken}"){ user { name } } }`)).data.tokensignin.user.name;
  expect(now).toBe(before.name);
});

test('messengerUpdateUser: nickname round-trip (restored)', async () => {
  const before = (await db.query('SELECT nickname FROM messenger_users WHERE user_id=?', [staff.userId]))[0].nickname;
  const tmp = `Staff Nick ${Date.now()}`;
  await gql(`mutation { messengerUpdateUser(userId:"${staff.userId}", nickname:${JSON.stringify(tmp)}){ user_id nickname } }`, { token: operatorToken });
  expect((await db.query('SELECT nickname FROM messenger_users WHERE user_id=?', [staff.userId]))[0].nickname).toBe(tmp);
  await gql(`mutation { messengerUpdateUser(userId:"${staff.userId}", nickname:${JSON.stringify(before)}){ user_id } }`, { token: operatorToken });
  expect((await db.query('SELECT nickname FROM messenger_users WHERE user_id=?', [staff.userId]))[0].nickname).toBe(before);
});

test('messengerUpdateUserMetadata: round-trip (restored)', async () => {
  const before = (await db.query('SELECT metadata FROM messenger_users WHERE user_id=?', [staff.userId]))[0].metadata;
  const beforeStr = before == null ? null : (typeof before === 'string' ? before : JSON.stringify(before));
  const tmp = JSON.stringify({ wftest: true, at: Date.now() });
  await gql(`mutation { messengerUpdateUserMetadata(userId:"${staff.userId}", metadata:${JSON.stringify(tmp)}) }`, { token: operatorToken });
  const after = (await db.query('SELECT metadata FROM messenger_users WHERE user_id=?', [staff.userId]))[0].metadata;
  expect(JSON.stringify(after)).toContain('wftest');
  // restore (set back to the prior value, or empty object if it was null)
  await gql(`mutation { messengerUpdateUserMetadata(userId:"${staff.userId}", metadata:${JSON.stringify(beforeStr ?? '{}')}) }`, { token: operatorToken });
});

test('signout → signin token round-trip (regression account)', async () => {
  expect(memberToken && memberUsername && memberPassword).toBeTruthy();
  // signout deletes the token row
  const out = (await gql(`mutation { signout(token:"${memberToken}") }`)).data.signout;
  expect(out).toBe(true);
  expect((await gql(`{ tokensignin(token:"${memberToken}"){ isSuccess } }`)).data.tokensignin.isSuccess).toBeFalsy();
  // signin re-mints the same token (upsert bom_user_token)
  const si = (await gql(`{ signin(username:${JSON.stringify(memberUsername)}, password:${JSON.stringify(memberPassword)}, token:"${memberToken}"){ isSuccess } }`)).data.signin;
  expect(si.isSuccess).toBe(true);
  expect((await gql(`{ tokensignin(token:"${memberToken}"){ isSuccess } }`)).data.tokensignin.isSuccess).toBe(true);
});
