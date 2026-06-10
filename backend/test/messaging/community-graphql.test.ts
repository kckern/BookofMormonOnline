/**
 * test/messaging/community-graphql.test.ts
 *
 * End-to-end tests for the Sendbird-REST-dependent GraphQL surface — the
 * "homefeed family" the homepage / front-page list consumes (NOT the socket.io
 * realtime layer). Each test executes a real GraphQL operation against the yoga
 * schema (SDL → resolver → messaging service → seeded messenger_* tables).
 *
 * Operations covered (backend/schema/BomCommunity.graphql, resolvers in
 * src/graphql/resolvers/community.ts):
 *   botlist · homegroups · homefeed (multi + single-channel) · loadGroupsFromHash
 *   · homethread · requestedUsers
 *
 * Legacy Sendbird is down, so there is no golden to diff against — these assert
 * the green-field resolvers return well-formed, POPULATED data from the seed.
 * All queries here are READ-ONLY (the featured/public path needs no token), so
 * they run against the live DB with the read-only `reader` user. Fixtures are
 * discovered from the seed in beforeAll so the suite is resilient to data drift.
 */

import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { sql } from 'kysely';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
// Execute through yoga itself (not the `graphql` package) so the schema and the
// executor share one graphql instance — avoids vitest's cross-realm GraphQLSchema
// error and exercises the real HTTP → yoga → resolver path. `token` is a GraphQL
// argument on these resolvers (not a header), so the context only needs db + lang.
let yoga: ReturnType<typeof createYoga>;

// Live fixtures discovered from the seed.
let publicChannelUrl: string | null = null;
let publicChannelMsgCount = 0;
let shortlinkHash: string | null = null;
let shortlinkChannelUrl: string | null = null;
let threadChannelUrl: string | null = null;
let threadParentId: string | null = null;

/** Execute a GraphQL operation through yoga and return data (throws on errors). */
async function exec(
  source: string,
  variables: Record<string, unknown> = {},
) {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: source, variables }),
  });
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
  // Surface resolver errors loudly — a populated-data test must not silently pass on error.
  if (json.errors?.length) {
    throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  return json.data as Record<string, unknown>;
}

beforeAll(async () => {
  yoga = createYoga({
    schema: buildSchema(),
    context: () => buildContext(db, 'en'),
  });

  // Busiest public/open channel (homefeed/homegroups featured path, no token needed).
  const ch = await sql<{ channel_url: string; msgs: number }>`
    SELECT c.channel_url, COUNT(m.message_id) AS msgs
    FROM messenger_channels c JOIN messenger_messages m ON m.channel_url = c.channel_url
    WHERE c.custom_type IN ('public', 'open')
    GROUP BY c.channel_url ORDER BY msgs DESC LIMIT 1`.execute(db);
  if (ch.rows[0]) {
    publicChannelUrl = ch.rows[0].channel_url;
    publicChannelMsgCount = Number(ch.rows[0].msgs);
  }

  // A shortlink that resolves to a seeded channel (loadGroupsFromHash).
  const sl = await sql<{ hash: string; string: string }>`
    SELECT s.hash, s.string FROM bom_shortlinks s
    JOIN messenger_channels c ON c.channel_url = s.string LIMIT 1`.execute(db);
  if (sl.rows[0]) {
    shortlinkHash = sl.rows[0].hash;
    shortlinkChannelUrl = sl.rows[0].string;
  }

  // A threaded message whose channel is public/open (homethread, no token needed).
  const th = await sql<{ channel_url: string; parent_message_id: string }>`
    SELECT m.channel_url, m.parent_message_id
    FROM messenger_messages m JOIN messenger_channels c ON c.channel_url = m.channel_url
    WHERE m.parent_message_id IS NOT NULL AND c.custom_type IN ('public', 'open')
    GROUP BY m.channel_url, m.parent_message_id
    ORDER BY COUNT(*) DESC LIMIT 1`.execute(db);
  if (th.rows[0]) {
    threadChannelUrl = th.rows[0].channel_url;
    threadParentId = th.rows[0].parent_message_id;
  }
});

afterAll(async () => {
  await closeDb();
});

describe('botlist', () => {
  it('returns the seeded bots with display fields', async () => {
    const data = await exec(`query { botlist { id name description picture enabled } }`);
    const bots = data['botlist'] as Array<Record<string, unknown>>;
    expect(Array.isArray(bots)).toBe(true);
    expect(bots.length).toBeGreaterThan(0);
    for (const b of bots.slice(0, 5)) {
      expect(typeof b['id']).toBe('string');
      expect((b['id'] as string).length).toBeGreaterThan(0);
      expect(typeof b['name']).toBe('string');
      expect(typeof b['picture']).toBe('string'); // resolver guarantees a fallback avatar
    }
  });
});

describe('homegroups (featured, no token)', () => {
  it('returns populated HomeGroups for the featured/public path', async () => {
    const data = await exec(
      `query ($g: String) { homegroups(grouping: $g) { grouping url name privacy members { user_id } latest { msg } } }`,
      { g: 'featured_groups' },
    );
    const groups = data['homegroups'] as Array<Record<string, unknown>>;
    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBeGreaterThan(0);
    const g = groups[0];
    expect(typeof g['url']).toBe('string');
    expect(typeof g['name']).toBe('string');
    // At least one featured group should carry a latest message from the seed.
    expect(groups.some((x) => x['latest'] && (x['latest'] as Record<string, unknown>)['msg'])).toBe(true);
  });
});

describe('homefeed (multi-channel, no token)', () => {
  it('returns featured groups and a non-empty feed', async () => {
    const data = await exec(
      `query { homefeed { groups { url name } feed { channel_url msg user { user_id nickname } } } }`,
    );
    const hf = data['homefeed'] as { groups: unknown[]; feed: Array<Record<string, unknown>> };
    expect(hf.groups.length).toBeGreaterThan(0);
    expect(hf.feed.length).toBeGreaterThan(0);
    const item = hf.feed[0];
    expect(typeof item['channel_url']).toBe('string');
    expect(typeof item['msg']).toBe('string');
    expect(item['user']).toBeTruthy();
  });
});

describe('homefeed (single-channel mode)', () => {
  it('returns the channel group + its messages in the feed', async () => {
    expect(publicChannelUrl, 'no public channel with messages in seed').toBeTruthy();
    const data = await exec(
      `query ($c: [String]) { homefeed(channel: $c) { groups { url name } feed { channel_url msg } } }`,
      { c: [publicChannelUrl] },
    );
    const hf = data['homefeed'] as { groups: Array<Record<string, unknown>>; feed: unknown[] };
    expect(hf.groups.length).toBe(1);
    expect(hf.groups[0]['url']).toBe(publicChannelUrl);
    expect(hf.feed.length).toBeGreaterThan(0); // channel has >=1 seeded message
  });
});

describe('loadGroupsFromHash', () => {
  it('resolves a shortlink hash to its StudyGroup', async () => {
    expect(shortlinkHash, 'no shortlink→channel in seed').toBeTruthy();
    const data = await exec(
      `query ($h: [String]) { loadGroupsFromHash(hash: $h) { channel_url name member_count custom_type } }`,
      { h: [shortlinkHash] },
    );
    const groups = data['loadGroupsFromHash'] as Array<Record<string, unknown>>;
    expect(groups.length).toBe(1);
    expect(groups[0]['channel_url']).toBe(shortlinkChannelUrl);
    expect(typeof groups[0]['name']).toBe('string');
  });
});

describe('homethread (public channel)', () => {
  it('returns the reply items for a threaded message', async () => {
    expect(threadParentId, 'no threaded message in a public channel in seed').toBeTruthy();
    const data = await exec(
      `query ($c: String, $m: String) { homethread(channel: $c, message: $m) { id channel_url msg user { user_id } } }`,
      { c: threadChannelUrl, m: threadParentId },
    );
    const replies = data['homethread'] as Array<Record<string, unknown>>;
    expect(Array.isArray(replies)).toBe(true);
    expect(replies.length).toBeGreaterThan(0); // discovered parent has >=2 replies
    expect(replies[0]['channel_url']).toBe(threadChannelUrl);
  });
});

describe('requestedUsers', () => {
  it('executes and returns an array (seed has no pending requests)', async () => {
    // Without an operator token, the resolver returns []. This is a smoke test that
    // the operation is wired and gracefully empty — the seed has 0 'requested' members.
    expect(publicChannelUrl).toBeTruthy();
    const data = await exec(
      `query ($c: String) { requestedUsers(channel: $c) { user_id nickname } }`,
      { c: publicChannelUrl },
    );
    expect(Array.isArray(data['requestedUsers'])).toBe(true);
  });
});
