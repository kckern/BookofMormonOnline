/**
 * test/graphql/mutations.test.ts
 *
 * Coverage for the REMAINING mutable GraphQL surface beyond the community
 * mutations (those live in test/messaging/community-graphql-auth.test.ts):
 *   - Auth/user (token ARG):  signup · signout · changePassword · editProfile ·
 *                             uploadProfileImage · log
 *   - Messenger (bearer HDR): create/update channel, update user/metadata,
 *                             member role, remove member, invite, accept/decline
 *   - Utils:                  shortlink
 *
 * We can't validate persistence here (the dev DB user is read-only and SANDBOX=1
 * suppresses query-builder writes at the driver — see src/data/sandboxDialect.ts).
 * So these assert what IS deterministic and what "the backend handles it well" means:
 *   1. Validation / auth gates: missing or malformed args → a graceful false/null
 *      (or a typed GraphQLError), NEVER an unhandled crash.
 *   2. Valid input → a well-formed response of the right shape, no GraphQL errors
 *      leaking a DB exception to the client.
 *
 * Auth resolvers read the token from a GraphQL ARG; messenger resolvers read it
 * from the Authorization BEARER header — the yoga context wires both.
 */

import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const TOKEN = process.env['MESSENGER_TEST_TOKEN'] ?? ''; // a real member token; see .env
const TEST_CHANNEL = process.env['MESSENGER_TEST_CHANNEL'] ?? ''; // a channel the token's user belongs to
// These suites exercise mutations with a REAL token — only run them when the
// sandbox driver is suppressing writes, or they would mutate live data (e.g.
// changePassword would really change the test account's password).
const SANDBOX_ON = process.env['SANDBOX'] !== '0';
const describeAuth = TOKEN && SANDBOX_ON ? describe : describe.skip;

const db = getDb();
const yoga = createYoga({
  schema: buildSchema(),
  // bearer header → ctx.bearerToken (messenger mutations); auth mutations use the token arg.
  context: ({ request }) =>
    buildContext(db, 'en', '', request.headers.get('authorization')?.replace(/^Bearer /, '') || undefined),
});

async function exec(source: string, variables: Record<string, unknown> = {}, bearer?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  if (bearer) headers['authorization'] = `Bearer ${bearer}`;
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: source, variables }),
  });
  return (await res.json()) as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
}

/** Assert the resolver returned cleanly (no DB exception leaked to the client). */
function expectNoServerError(r: { errors?: Array<{ message: string }> }) {
  const leaked = (r.errors ?? []).filter((e) => /denied|ER_|sql|Cannot return null/i.test(e.message));
  expect(leaked, `resolver leaked a server error: ${JSON.stringify(leaked)}`).toEqual([]);
}

afterAll(async () => {
  await closeDb();
});

// ─── Auth / user mutations (token as ARG) ─────────────────────────────────────

describe('auth mutations — validation/auth gates', () => {
  it('signup with missing username/password returns isSuccess:false (not a crash)', async () => {
    const r = await exec(
      `mutation { signup(token: "anon-x", username: "", password: "") { isSuccess msg } }`,
    );
    expectNoServerError(r);
    const s = r.data?.['signup'] as { isSuccess: boolean } | null;
    expect(s).toBeTruthy();
    expect(s?.isSuccess).toBe(false);
  });

  it('signout without a token returns false', async () => {
    const r = await exec(`mutation { signout(token: "") }`);
    expectNoServerError(r);
    expect(r.data?.['signout']).toBe(false);
  });

  it('changePassword without token or password returns false', async () => {
    const a = await exec(`mutation { changePassword(password: "x") }`); // no token
    const b = await exec(`mutation { changePassword(token: "x") }`); // no password
    expectNoServerError(a);
    expectNoServerError(b);
    expect(a.data?.['changePassword']).toBe(false);
    expect(b.data?.['changePassword']).toBe(false);
  });

  it('editProfile without a token returns an empty/falsy user (no crash)', async () => {
    const r = await exec(`mutation { editProfile(name: "X") { user name } }`);
    expectNoServerError(r);
    // resolver returns {} when no token → name is absent
    expect((r.data?.['editProfile'] as Record<string, unknown> | null)?.['name'] ?? null).toBeNull();
  });

  it('uploadProfileImage with an invalid token is rejected (error + null, not a false success)', async () => {
    const r = await exec(
      `mutation { uploadProfileImage(token: "not-a-real-token", imageData: "x") }`,
    );
    // The resolver throws a GraphQLError (UNAUTHORIZED); yoga may mask the message under
    // test env, so assert the rejection shape rather than the text.
    expect(r.errors?.length).toBeGreaterThan(0);
    expect(r.data?.['uploadProfileImage'] ?? null).toBeNull();
  });

  it('log returns a well-formed { logged } shape', async () => {
    const r = await exec(`mutation { log(token: "anon-x", key: "test", val: "v") { logged } }`);
    expectNoServerError(r);
    const l = r.data?.['log'] as { logged: boolean } | null;
    expect(l).toBeTruthy();
    expect(typeof l?.logged).toBe('boolean');
  });
});

describeAuth('auth mutations — valid input (token from env)', () => {
  it('changePassword with a valid token + password resolves to a boolean', async () => {
    const r = await exec(`mutation ($t: String) { changePassword(token: $t, password: "Sandbox-Pw-123") }`, { t: TOKEN });
    expectNoServerError(r);
    expect(typeof r.data?.['changePassword']).toBe('boolean');
  });

  it('editProfile with a valid token returns the user', async () => {
    const r = await exec(`mutation ($t: String) { editProfile(token: $t, zip: "84604") { name email } }`, { t: TOKEN });
    expectNoServerError(r);
    expect(r.data?.['editProfile']).toBeTruthy();
  });

  it('signup resolves to a SignIn shape without leaking a DB error', async () => {
    const r = await exec(
      `mutation ($t: String) { signup(token: $t, username: "sandbox_probe_user", password: "p", name: "P", email: "p@example.com") { isSuccess msg } }`,
      { t: TOKEN },
    );
    expectNoServerError(r);
    expect(typeof (r.data?.['signup'] as { isSuccess: boolean } | null)?.isSuccess).toBe('boolean');
  });
});

// ─── Utils ────────────────────────────────────────────────────────────────────

describe('shortlink', () => {
  it('returns a { hash, string } pair (find-or-create, well-formed under sandbox)', async () => {
    const r = await exec(`mutation { shortlink(string: "/test/sandbox/path") { hash string } }`);
    expectNoServerError(r);
    const sl = r.data?.['shortlink'] as { hash: string; string: string } | null;
    expect(sl).toBeTruthy();
    expect(typeof sl?.hash).toBe('string');
    expect((sl?.hash ?? '').length).toBeGreaterThan(0);
  });
});

// ─── Messenger mutations (bearer header) — validation gates ───────────────────

describe('messenger mutations — validation/auth gates', () => {
  it('messengerCreateChannel with no name returns null', async () => {
    const r = await exec(`mutation { messengerCreateChannel(name: null) { channel_url } }`, {}, TOKEN || 'x');
    expectNoServerError(r);
    expect(r.data?.['messengerCreateChannel']).toBeNull();
  });

  it('messengerUpdateChannel with no channelUrl returns null', async () => {
    const r = await exec(`mutation { messengerUpdateChannel(name: "x") { channel_url } }`, {}, TOKEN || 'x');
    expectNoServerError(r);
    expect(r.data?.['messengerUpdateChannel']).toBeNull();
  });

  it('messengerUpdateUserMetadata with malformed JSON returns false', async () => {
    const r = await exec(
      `mutation { messengerUpdateUserMetadata(userId: "u", metadata: "not-json{") }`,
      {},
      TOKEN || 'x',
    );
    expectNoServerError(r);
    expect(r.data?.['messengerUpdateUserMetadata']).toBe(false);
  });

  it('messengerUpdateMemberRole with an invalid role returns false', async () => {
    const r = await exec(
      `mutation { messengerUpdateMemberRole(channelUrl: "c", userId: "u", role: "superadmin") }`,
      {},
      TOKEN || 'x',
    );
    expectNoServerError(r);
    expect(r.data?.['messengerUpdateMemberRole']).toBe(false);
  });

  it('messengerRemoveMember with missing args returns false', async () => {
    const r = await exec(`mutation { messengerRemoveMember(channelUrl: "c") }`, {}, TOKEN || 'x');
    expectNoServerError(r);
    expect(r.data?.['messengerRemoveMember']).toBe(false);
  });

  it('messengerInviteMembers with empty userIds returns false', async () => {
    const r = await exec(`mutation { messengerInviteMembers(channelUrl: "c", userIds: []) }`, {}, TOKEN || 'x');
    expectNoServerError(r);
    expect(r.data?.['messengerInviteMembers']).toBe(false);
  });

  it('messengerAcceptInvitation / messengerDeclineInvitation with missing args return false', async () => {
    const a = await exec(`mutation { messengerAcceptInvitation(channelUrl: "c") }`, {}, TOKEN || 'x');
    const d = await exec(`mutation { messengerDeclineInvitation(channelUrl: "c") }`, {}, TOKEN || 'x');
    expectNoServerError(a);
    expectNoServerError(d);
    expect(a.data?.['messengerAcceptInvitation']).toBe(false);
    expect(d.data?.['messengerDeclineInvitation']).toBe(false);
  });
});

describeAuth('messenger mutations — valid input under sandbox (no persistence, no crash)', () => {
  it('messengerUpdateUser resolves to a user shape (sandbox suppresses the write)', async () => {
    const r = await exec(
      `mutation { messengerUpdateUser(nickname: "Sandbox Name") { user_id nickname } }`,
      {},
      TOKEN,
    );
    expectNoServerError(r);
    // acting user resolved from bearer; getUser re-read succeeds (reads pass through).
    expect(r.data?.['messengerUpdateUser']).toBeTruthy();
  });

  it.skipIf(!TEST_CHANNEL)(
    'messengerInviteMembers returns true (write suppressed at the driver, no error)',
    async () => {
      const r = await exec(
        `mutation ($c: String) { messengerInviteMembers(channelUrl: $c, userIds: ["sandbox_invitee"]) }`,
        { c: TEST_CHANNEL },
        TOKEN,
      );
      expectNoServerError(r);
      expect(r.data?.['messengerInviteMembers']).toBe(true);
    },
  );
});
