/**
 * test/messaging/community-graphql-auth.test.ts
 *
 * Token-gated half of the Sendbird-dependent community GraphQL surface — the
 * authenticated reads + the membership/bot mutations. Companion to
 * community-graphql.test.ts (the public/no-token reads).
 *
 * Acting user: the test token below resolves to bom_user `b0c4b5` ("Staff"),
 * messenger user_id md5('b0c4b5'). In the seed they are an OPERATOR of several
 * channels and a member of many DMs — so `my_groups` / `homefeed` return real
 * data, and the operator-gated mutations are exercisable.
 *
 * READ tests run live (read-only path, works as the `reader` user) and prove the
 * token actually gates results (no-token → empty my_groups). WRITE tests
 * (joinGroup/joinOpenGroup/request+withdraw/addBot+removeBot/processRequest) are
 * guarded by `itWrite()` — they skip when only a read-only user is present and
 * run when MYSQL_WRITE_USER is set. Every write test is SELF-CLEANING: it undoes
 * its own membership/bot change so prod data is left exactly as found.
 */

import 'dotenv/config';
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { Kysely, MysqlDialect, sql, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';
import { md5 } from '../../src/auth/identity.js';

// A live bom_user_token is a bearer credential — NEVER hardcode it (public repo).
// Supply it via backend/.env (gitignored): MESSENGER_TEST_TOKEN=<token for a member user>.
// Absent → the whole suite skips. The seed token used in dev resolves to bom_user b0c4b5.
const TOKEN = process.env['MESSENGER_TEST_TOKEN'] ?? '';
const describeAuth = TOKEN ? describe : describe.skip;

// ─── Write-capable DB (mirrors channels.test.ts) ──────────────────────────────
function buildWriteDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user = process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root';
  const password = process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '';
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({ host, port, database, user, password, connectionLimit: 5 }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

const db = buildWriteDb();
const yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });

let canWrite = false;
let uid = '';
// discovered fixtures
let openNotJoined: string | null = null;
let publicNotJoined: string | null = null;
let operatorChannel: string | null = null;
let botNotInOpChannel: string | null = null;
let joinHash: string | null = null;
let joinHashChannel: string | null = null;
// rows this suite created, torn down in afterEach as a safety net
const cleanupMembers: Array<{ channel_url: string; user_id: string }> = [];

async function exec(source: string, variables: Record<string, unknown> = {}) {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: source, variables }),
  });
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
  return json.data as Record<string, unknown>;
}

async function isMember(channelUrl: string, userId: string): Promise<boolean> {
  const r = await db
    .selectFrom('messenger_members')
    .select('user_id')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return !!r;
}

beforeAll(async () => {
  // Resolve the acting user id from the token (robust to which user the token maps to).
  const who = await sql<{ user: string }>`
    SELECT bu.user FROM bom_user_token t JOIN bom_user bu ON bu.user = t.user WHERE t.token = ${TOKEN}`.execute(db);
  uid = who.rows[0] ? md5(who.rows[0].user) : '';

  // Write capability probe (no-op UPDATE matching zero rows — touches nothing).
  try {
    await sql`UPDATE messenger_members SET role = role WHERE channel_url = '__probe__' AND user_id = '__probe__'`.execute(db);
    canWrite = true;
  } catch {
    canWrite = false;
  }

  // Fixtures (all read-only discovery).
  const open = await sql<{ channel_url: string }>`
    SELECT channel_url FROM messenger_channels WHERE custom_type = 'open'
    AND channel_url NOT IN (SELECT channel_url FROM messenger_members WHERE user_id = ${uid}) LIMIT 1`.execute(db);
  openNotJoined = open.rows[0]?.channel_url ?? null;

  const pub = await sql<{ channel_url: string }>`
    SELECT channel_url FROM messenger_channels WHERE custom_type = 'public'
    AND channel_url NOT IN (SELECT channel_url FROM messenger_members WHERE user_id = ${uid}) LIMIT 1`.execute(db);
  publicNotJoined = pub.rows[0]?.channel_url ?? null;

  // A non-DM channel the user operates (for addBot/removeBot/processRequest).
  const op = await sql<{ channel_url: string }>`
    SELECT m.channel_url FROM messenger_members m JOIN messenger_channels c ON c.channel_url = m.channel_url
    WHERE m.user_id = ${uid} AND m.role = 'operator' AND c.custom_type IN ('open','public','private') LIMIT 1`.execute(db);
  operatorChannel = op.rows[0]?.channel_url ?? null;

  if (operatorChannel) {
    const bot = await sql<{ user_id: string }>`
      SELECT user_id FROM messenger_users WHERE is_bot = 1
      AND user_id NOT IN (SELECT user_id FROM messenger_members WHERE channel_url = ${operatorChannel}) LIMIT 1`.execute(db);
    botNotInOpChannel = bot.rows[0]?.user_id ?? null;
  }

  const sl = await sql<{ hash: string; string: string }>`
    SELECT s.hash, s.string FROM bom_shortlinks s JOIN messenger_channels c ON c.channel_url = s.string
    WHERE c.channel_url NOT IN (SELECT channel_url FROM messenger_members WHERE user_id = ${uid}) LIMIT 1`.execute(db);
  joinHash = sl.rows[0]?.hash ?? null;
  joinHashChannel = sl.rows[0]?.string ?? null;
});

afterEach(async () => {
  // Safety net: remove any membership rows the suite created.
  while (cleanupMembers.length) {
    const m = cleanupMembers.pop()!;
    try {
      await db.deleteFrom('messenger_members')
        .where('channel_url', '=', m.channel_url).where('user_id', '=', m.user_id).execute();
    } catch { /* best-effort */ }
  }
});

afterAll(async () => {
  await db.destroy();
});

// ─── Token-gated READS (run live, read-only) ──────────────────────────────────

describeAuth('homegroups (my_groups, token-gated)', () => {
  it('returns the acting user\'s channels and is empty without a token', async () => {
    expect(uid, 'token did not resolve to a user').toBeTruthy();

    const withTok = await exec(
      `query ($t: String) { homegroups(token: $t, grouping: "my_groups") { url name privacy } }`,
      { t: TOKEN },
    );
    const mine = withTok['homegroups'] as Array<Record<string, unknown>>;
    expect(Array.isArray(mine)).toBe(true);
    expect(mine.length).toBeGreaterThan(0); // b0c4b5 belongs to many channels in the seed

    // Same query WITHOUT a token → no personal groups (proves the token gates results).
    const noTok = await exec(`query { homegroups(grouping: "my_groups") { url } }`);
    expect((noTok['homegroups'] as unknown[]).length).toBe(0);
  });
});

describeAuth('homefeed (token-gated, includes own channels)', () => {
  it('merges the user\'s own channels into the feed', async () => {
    const data = await exec(
      `query ($t: String) { homefeed(token: $t) { groups { url name } feed { channel_url } } }`,
      { t: TOKEN },
    );
    const hf = data['homefeed'] as { groups: Array<Record<string, unknown>>; feed: unknown[] };
    expect(hf.groups.length).toBeGreaterThan(0);

    // The user's own channel set should be reflected in the merged groups.
    const myUrls = new Set(
      (await db.selectFrom('messenger_members').select('channel_url').where('user_id', '=', uid).execute())
        .map((r) => r.channel_url),
    );
    const groupUrls = hf.groups.map((g) => g['url'] as string);
    expect(groupUrls.some((u) => myUrls.has(u))).toBe(true);
  }, 30_000); // homefeed assembles a group + messages for EVERY one of the user's channels;
              // b0c4b5 is in many (lots of DMs), so it is legitimately slow for a heavy user.
});

// ─── Membership / bot MUTATIONS ───────────────────────────────────────────────
// Dual-mode: when the DB is writable, assert the happy path + self-clean. When the
// connection is read-only (the `reader` user), the write throws inside the resolver
// and we assert the GRACEFUL FAILURE the resolver returns — so the failure path is
// covered rather than skipped.

describeAuth('joinOpenGroup', () => {
  it('joins an open channel when writable, else returns graceful failure', async () => {
    expect(openNotJoined, 'no open channel the user is missing from').toBeTruthy();
    const url = openNotJoined!;

    const data = await exec(
      `mutation ($t: String, $u: String) { joinOpenGroup(token: $t, url: $u) { isSuccess msg channel user } }`,
      { t: TOKEN, u: url },
    );
    const jg = data['joinOpenGroup'] as Record<string, unknown>;

    if (canWrite) {
      cleanupMembers.push({ channel_url: url, user_id: uid });
      expect(jg['isSuccess']).toBe(true);
      expect(jg['channel']).toBe(url);
      expect(jg['user']).toBe(uid);
      expect(await isMember(url, uid)).toBe(true);
    } else {
      // addUserToChannel write is denied → resolver catch → isSuccess:false, nothing written.
      expect(jg['isSuccess']).toBe(false);
      expect(await isMember(url, uid)).toBe(false);
    }
  });
});

describeAuth('requestToJoinGroup + withdrawRequest', () => {
  it('requests + withdraws when writable; surfaces the masked-write quirk read-only', async () => {
    expect(publicNotJoined, 'no public channel the user is missing from').toBeTruthy();
    const url = publicNotJoined!;

    const req = await exec(
      `mutation ($t: String, $u: String) { requestToJoinGroup(token: $t, url: $u) { isSuccess } }`,
      { t: TOKEN, u: url },
    );
    const reqOk = (req['requestToJoinGroup'] as Record<string, unknown>)['isSuccess'];

    if (canWrite) {
      cleanupMembers.push({ channel_url: url, user_id: uid });
      expect(reqOk).toBe(true);
      const row = await db.selectFrom('messenger_members').select(['state'])
        .where('channel_url', '=', url).where('user_id', '=', uid).executeTakeFirst();
      expect(row?.state).toBe('requested');

      const wd = await exec(
        `mutation ($t: String, $u: String) { withdrawRequest(token: $t, url: $u) { isSuccess } }`,
        { t: TOKEN, u: url },
      );
      expect((wd['withdrawRequest'] as Record<string, unknown>)['isSuccess']).toBe(true);
      expect(await isMember(url, uid)).toBe(false);
    } else {
      // KNOWN QUIRK: requestToJoinGroup wraps its INSERT in an inner try/catch that treats
      // any failure as a duplicate → reports isSuccess:true even though the write was denied.
      expect(reqOk).toBe(true);
      expect(await isMember(url, uid)).toBe(false); // ...but nothing was actually inserted.
      // withdrawRequest's DELETE is NOT masked → it returns the graceful failure.
      const wd = await exec(
        `mutation ($t: String, $u: String) { withdrawRequest(token: $t, url: $u) { isSuccess } }`,
        { t: TOKEN, u: url },
      );
      expect((wd['withdrawRequest'] as Record<string, unknown>)['isSuccess']).toBe(false);
    }
  });
});

describeAuth('addBot + removeBot', () => {
  it('adds+removes a bot when writable, else returns false', async () => {
    expect(operatorChannel, 'user operates no non-DM channel').toBeTruthy();
    expect(botNotInOpChannel, 'no bot available outside the channel').toBeTruthy();
    const channel = operatorChannel!;
    const bot = botNotInOpChannel!;

    const add = await exec(
      `mutation ($t: String, $c: String, $b: String) { addBot(token: $t, channel: $c, bot: $b) }`,
      { t: TOKEN, c: channel, b: bot },
    );

    if (canWrite) {
      cleanupMembers.push({ channel_url: channel, user_id: bot });
      expect(add['addBot']).toBe(true);
      expect(await isMember(channel, bot)).toBe(true);

      const rm = await exec(
        `mutation ($t: String, $c: String, $b: String) { removeBot(token: $t, channel: $c, bot: $b) }`,
        { t: TOKEN, c: channel, b: bot },
      );
      expect(rm['removeBot']).toBe(true);
      expect(await isMember(channel, bot)).toBe(false);
    } else {
      // addBotToChannel write denied → resolver catch → false, nothing written.
      expect(add['addBot']).toBe(false);
      expect(await isMember(channel, bot)).toBe(false);
    }
  });
});

describeAuth('processRequest (operator denies a pending request)', () => {
  it('denies a request when writable, else returns false on the failed write', async () => {
    expect(operatorChannel, 'user operates no non-DM channel').toBeTruthy();
    expect(botNotInOpChannel, 'no spare user to stand in as requester').toBeTruthy();
    const channel = operatorChannel!;
    const requester = botNotInOpChannel!; // any real messenger_users row not already in the channel

    if (canWrite) {
      cleanupMembers.push({ channel_url: channel, user_id: requester });
      // Seed a pending request directly, then deny it through the resolver.
      await db.insertInto('messenger_members')
        .values({ channel_url: channel, user_id: requester, role: 'member', state: 'requested' }).execute();

      const data = await exec(
        `mutation ($t: String, $c: String, $u: String) { processRequest(token: $t, channel: $c, user_id: $u, grant: false) }`,
        { t: TOKEN, c: channel, u: requester },
      );
      expect(data['processRequest']).toBe(true);
      expect(await isMember(channel, requester)).toBe(false); // denial removed the row
    } else {
      // Operator gate passes (read), but the removeUserFromChannel write is denied → false.
      const data = await exec(
        `mutation ($t: String, $c: String, $u: String) { processRequest(token: $t, channel: $c, user_id: $u, grant: false) }`,
        { t: TOKEN, c: channel, u: requester },
      );
      expect(data['processRequest']).toBe(false);
    }
  });
});

describeAuth('joinGroup (via shortlink hash)', () => {
  it('joins a hash-resolved channel when writable, else returns graceful failure', async () => {
    expect(joinHash, 'no shortlink→channel the user is missing from').toBeTruthy();

    const data = await exec(
      `mutation ($t: String, $h: String) { joinGroup(token: $t, hash: $h) { isSuccess channel user } }`,
      { t: TOKEN, h: joinHash },
    );
    const jg = data['joinGroup'] as Record<string, unknown>;

    if (canWrite) {
      cleanupMembers.push({ channel_url: joinHashChannel!, user_id: uid });
      expect(jg['isSuccess']).toBe(true);
      expect(jg['channel']).toBe(joinHashChannel);
      expect(await isMember(joinHashChannel!, uid)).toBe(true);
    } else {
      expect(jg['isSuccess']).toBe(false);
      expect(await isMember(joinHashChannel!, uid)).toBe(false);
    }
  });
});
