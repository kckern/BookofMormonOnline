import { describe, expect, test } from 'vitest';

// Config validation runs on import of the resolver's dependency graph.
process.env.MYSQL_HOST ||= 'test';
process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test';
process.env.SANDBOX ||= '1';

const { refsToLink, refsToHighlights, feedAlgorithm } = await import('../../src/graphql/resolvers/community.js');

// ─── MessageDTO factory ───────────────────────────────────────────────────────

const msg = (over: Partial<Record<string, unknown>>) => ({
  message_id: String(over.message_id ?? '1'),
  channel_url: 'ch-test',
  user: { user_id: 'bot', nickname: 'Bot', profile_url: null, metadata: { isBot: true }, is_bot: true, is_online: false, last_seen_at: null },
  message_type: 'MESG' as const,
  message: 'Study note',
  custom_type: 'alma/32',
  data: '{}',
  anchor: null,
  references: [] as unknown[],
  parent_message_id: null,
  thread_info: null,
  reactions: [],
  created_at: 1000,
  updated_at: 1000,
  ...over,
});

// ─── refsToLink ───────────────────────────────────────────────────────────────

describe('refsToLink — verse subject ref', () => {
  test('verse ref with resolved display produces text link key + slug/ordinal val', () => {
    const refs = [{ type: 'verse', id: 42, role: 'subject' }];
    const resolvedVerses = new Map([[42, { slug: 'alma/32', ordinal: 21, text: 'And now as I said...' }]]);

    const link = refsToLink(refs as never, resolvedVerses);

    expect(link).toEqual({ key: 'text', val: 'alma/32/21' });
  });

  test('verse ref with missing resolution skips link (returns null)', () => {
    const refs = [{ type: 'verse', id: 99, role: 'subject' }];
    const resolvedVerses = new Map<number, { slug: string; ordinal: number; text: string }>();

    const link = refsToLink(refs as never, resolvedVerses);

    expect(link).toBeNull();
  });
});

describe('refsToLink — non-verse subject refs', () => {
  test('legacy_text ref produces text link', () => {
    const refs = [{ type: 'legacy_text', id: 'mosiah/2', role: 'subject', slug: 'mosiah/2', ordinal: 5 }];
    const link = refsToLink(refs as never, new Map());
    expect(link).toEqual({ key: 'text', val: 'mosiah/2/5' });
  });

  test('commentary ref produces com link', () => {
    const refs = [{ type: 'commentary', id: 14001, role: 'subject' }];
    const link = refsToLink(refs as never, new Map());
    expect(link).toEqual({ key: 'com', val: '14001' });
  });

  test('image ref produces img link', () => {
    const refs = [{ type: 'image', id: 77, role: 'subject' }];
    const link = refsToLink(refs as never, new Map());
    expect(link).toEqual({ key: 'img', val: '77' });
  });

  test('section ref produces section link with slug/id', () => {
    const refs = [{ type: 'section', id: 8, role: 'subject', slug: 'intro' }];
    const link = refsToLink(refs as never, new Map());
    expect(link).toEqual({ key: 'section', val: 'intro/8' });
  });

  test('fax ref produces fax link', () => {
    const refs = [{ type: 'fax', id: 3, role: 'subject' }];
    const link = refsToLink(refs as never, new Map());
    expect(link).toEqual({ key: 'fax', val: '3' });
  });
});

describe('refsToLink — role priority', () => {
  test('first subject role ref wins over a later non-highlight ref', () => {
    const refs = [
      { type: 'highlight', id: 1, role: 'highlight', span: { text: 'highlighted text' } },
      { type: 'commentary', id: 14001, role: 'subject' },
      { type: 'image', id: 2, role: 'subject' },
    ];
    const link = refsToLink(refs as never, new Map());
    expect(link).toEqual({ key: 'com', val: '14001' });
  });

  test('falls back to first non-highlight ref when no subject role exists', () => {
    const refs = [
      { type: 'highlight', id: 1, role: 'highlight', span: { text: 'hi' } },
      { type: 'image', id: 55, role: 'highlight' },
    ];
    // all highlight roles — no subject → first ref overall that isn't highlight-typed? per spec: first non-highlight ref
    // No non-highlight refs here, so should return null
    const link = refsToLink(refs as never, new Map());
    expect(link).toBeNull();
  });
});

// ─── refsToHighlights ─────────────────────────────────────────────────────────

describe('refsToHighlights', () => {
  test('highlight refs with span.text contribute to highlights array in order', () => {
    const refs = [
      { type: 'verse', id: 42, role: 'subject' },
      { type: 'verse', id: 42, role: 'highlight', span: { text: 'faith is not a perfect knowledge' } },
      { type: 'verse', id: 43, role: 'highlight', span: { text: 'hope for things which are not seen' } },
    ];
    const highlights = refsToHighlights(refs as never);
    expect(highlights).toEqual([
      'faith is not a perfect knowledge',
      'hope for things which are not seen',
    ]);
  });

  test('returns empty array when no highlight refs', () => {
    const refs = [{ type: 'verse', id: 42, role: 'subject' }];
    const highlights = refsToHighlights(refs as never);
    expect(highlights).toEqual([]);
  });

  test('skips highlight refs with no span.text', () => {
    const refs = [
      { type: 'verse', id: 42, role: 'highlight' }, // no span
      { type: 'verse', id: 43, role: 'highlight', span: { text: 'present' } },
    ];
    const highlights = refsToHighlights(refs as never);
    expect(highlights).toEqual(['present']);
  });
});

// ─── feedAlgorithm — references bridge ───────────────────────────────────────

describe('feedAlgorithm — renders from references when present', () => {
  test('verse subject ref produces text link via resolvedVerses', () => {
    const m = msg({
      references: [{ type: 'verse', id: 42, role: 'subject' }],
      data: '{}', // legacy data has no links
    });
    const resolvedVerses = new Map([[42, { slug: 'alma/32', ordinal: 21, text: 'And now...' }]]);
    const feed = feedAlgorithm([m] as never, null, { unfiltered: true, resolvedVerses });
    expect(feed[0].link).toEqual({ key: 'text', val: 'alma/32/21' });
  });

  test('highlight ref appears in highlights', () => {
    const m = msg({
      references: [
        { type: 'verse', id: 42, role: 'subject' },
        { type: 'verse', id: 42, role: 'highlight', span: { text: 'faith' } },
      ],
      data: '{}',
    });
    const resolvedVerses = new Map([[42, { slug: 'alma/32', ordinal: 21, text: 'And now...' }]]);
    const feed = feedAlgorithm([m] as never, null, { unfiltered: true, resolvedVerses });
    expect(feed[0].highlights).toEqual(['faith']);
  });
});

describe('feedAlgorithm — legacy fallback when references empty', () => {
  test('message with empty references falls back to legacy data.links', () => {
    const m = msg({
      references: [],
      custom_type: 'alma/32',
      data: JSON.stringify({ links: { text: '21' } }),
    });
    const feed = feedAlgorithm([m] as never, null, { unfiltered: true });
    expect(feed[0].link).toEqual({ key: 'text', val: 'alma/32/21' });
  });

  test('legacy highlights from data.highlights still work when no references', () => {
    const m = msg({
      references: [],
      data: JSON.stringify({ highlights: ['legacy text highlight'] }),
    });
    const feed = feedAlgorithm([m] as never, null, { unfiltered: true });
    expect(feed[0].highlights).toEqual(['legacy text highlight']);
  });
});
