import { describe, expect, test } from 'vitest';

// Config validation runs on import of the resolver's dependency graph.
process.env.MYSQL_HOST ||= 'test';
process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test';
process.env.SANDBOX ||= '1';

const { feedAlgorithm } = await import('../../src/graphql/resolvers/community.js');

// Minimal MessageDTO factory — feedAlgorithm reads created_at/custom_type/data/
// message/thread_info/reactions/user; assembleHomeFeedItem maps them to a plain
// object (DB-free). created_at is a ms epoch (number).
const msg = (over: Partial<Record<string, unknown>>) => ({
  message_id: String(over.message_id ?? '1'),
  channel_url: 'c',
  user: { user_id: 'bot', nickname: 'Bot', profile_url: null, metadata: null, is_bot: true },
  message_type: 'MESG',
  message: 'x'.repeat(500), // long enough to pass the short-message heuristic
  custom_type: '',
  data: '{}',
  parent_message_id: null,
  thread_info: null,
  reactions: [],
  created_at: 0,
  updated_at: 0,
  ...over,
});

describe('feedAlgorithm ordering + unlisted unfiltered', () => {
  const newestNoType = msg({ message_id: 'A', created_at: 3000, custom_type: '' });
  const midWithType = msg({ message_id: 'B', created_at: 2000, custom_type: 'alma/32' });
  const oldWithType = msg({ message_id: 'C', created_at: 1000, custom_type: 'jesus' });
  const input = [oldWithType, newestNoType, midWithType]; // deliberately unsorted

  test('unfiltered: newest surfaces first even with no custom_type', () => {
    const feed = feedAlgorithm(input as never, null, { unfiltered: true });
    expect(feed.map((f) => f.id)).toEqual(['A', 'B', 'C']); // strict newest-first
    expect(feed.map((f) => f.timestamp)).toEqual([3000, 2000, 1000]);
  });

  test('default (filtered): no-custom_type dropped, remainder still newest-first', () => {
    const feed = feedAlgorithm(input as never, null);
    expect(feed.map((f) => f.id)).toEqual(['B', 'C']); // A excluded (no custom_type)
  });
});
