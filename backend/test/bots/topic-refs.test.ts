/**
 * test/bots/topic-refs.test.ts
 *
 * Unit tests for buildTopicRefs — the pure helper that converts a bom_ai_topic
 * passage_ref into { anchor, references } ready to pass to postMessage.
 *
 * All tests are pure (no DB, no network).  The resolveFn is stubbed.
 */

process.env['MYSQL_HOST'] ||= 'test'; // pragma: allowlist secret
process.env['MYSQL_USER'] ||= 'test'; // pragma: allowlist secret
process.env['MYSQL_PASSWORD'] ||= 'test'; // pragma: allowlist secret
process.env['SANDBOX'] ||= '1';

import { describe, it, expect } from 'vitest';
import { buildTopicRefs } from '../../src/bots/topicRefs.js';

// ─── Stub helpers ─────────────────────────────────────────────────────────────

const alma3221Display = { slug: 'alma-32', ordinal: 21, text: 'Faith is not to have a perfect knowledge of things.' };

/** Stub resolveFn that returns display for known verse ids, null for unknown. */
const stubResolve = async (verseId: number) =>
  verseId > 0 ? alma3221Display : null;

const nullResolve = async (_verseId: number) => null;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildTopicRefs', () => {
  it('returns anchor + subject reference for a valid passage_ref', async () => {
    const result = await buildTopicRefs('Alma 32:21', stubResolve);
    expect(result.anchor).toBe('alma-32');
    expect(result.references).toHaveLength(1);
    expect(result.references[0]).toMatchObject({
      type: 'verse',
      role: 'subject',
    });
    expect(typeof result.references[0]!.id).toBe('number');
    expect((result.references[0]!.id as number)).toBeGreaterThan(0);
  });

  it('returns anchor=undefined and references=[] for an unparseable passage_ref', async () => {
    const result = await buildTopicRefs('not a scripture reference at all', stubResolve);
    expect(result.anchor).toBeUndefined();
    expect(result.references).toEqual([]);
  });

  it('returns anchor=undefined and references=[] for an empty passage_ref', async () => {
    const result = await buildTopicRefs('', stubResolve);
    expect(result.anchor).toBeUndefined();
    expect(result.references).toEqual([]);
  });

  it('returns anchor=undefined when resolveVerseDisplay returns null, but still includes the reference', async () => {
    const result = await buildTopicRefs('Alma 32:21', nullResolve);
    // verseIds resolved fine, but display returned null → anchor undefined
    expect(result.anchor).toBeUndefined();
    // reference still recorded so the post is linked to the verse
    expect(result.references).toHaveLength(1);
    expect(result.references[0]).toMatchObject({ type: 'verse', role: 'subject' });
  });
});
