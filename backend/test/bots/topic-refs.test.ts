/**
 * test/bots/topic-refs.test.ts
 *
 * Unit tests for buildTopicRefs — the pure helper that converts a bom_ai_topic
 * passage_ref into { anchor, references, resolved } for postMessage.
 *
 * First-class requirement: an opener must LINK a page text block. buildTopicRefs
 * delegates resolution to a resolveBlockFn (stubbed here) and signals
 * `resolved: false` when no block is available so the scheduler skips the topic
 * instead of posting a bare mention.
 *
 * All tests are pure (no DB, no network). The resolveBlockFn is stubbed.
 */

process.env['MYSQL_HOST'] ||= 'test'; // pragma: allowlist secret
process.env['MYSQL_USER'] ||= 'test'; // pragma: allowlist secret
process.env['MYSQL_PASSWORD'] ||= 'test'; // pragma: allowlist secret
process.env['SANDBOX'] ||= '1';

import { describe, it, expect } from 'vitest';
import { buildTopicRefs } from '../../src/bots/topicRefs.js';
import type { PassageBlock } from '../../src/messaging/contentRefs.js';

// ─── Stub helpers ─────────────────────────────────────────────────────────────

const jacobBlock: PassageBlock = {
  pageSlug: 'jacobs-address',
  ordinal: 10,
  unitFirstVerseId: 32540,
  text: '<p>And now, my brethren…</p>',
};

const stubBlock = async (_ref: string): Promise<PassageBlock | null> => jacobBlock;
const nullBlock = async (_ref: string): Promise<PassageBlock | null> => null;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildTopicRefs', () => {
  it('links a page text block: anchor = page slug + enriched subject reference', async () => {
    const result = await buildTopicRefs('Jacob 2:23-35', stubBlock);
    expect(result.resolved).toBe(true);
    expect(result.anchor).toBe('jacobs-address');
    expect(result.references).toHaveLength(1);
    expect(result.references[0]).toMatchObject({
      type: 'verse',
      role: 'subject',
      slug: 'jacobs-address',
      ordinal: 10,
      id: 32540,
    });
  });

  it('returns resolved=false / no anchor / no refs when the passage has no page block', async () => {
    const result = await buildTopicRefs('Jacob 2:23-35', nullBlock);
    expect(result.resolved).toBe(false);
    expect(result.anchor).toBeUndefined();
    expect(result.references).toEqual([]);
  });
});
