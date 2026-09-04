import { describe, expect, test } from 'vitest';
import { hasVerbatimOverlap, retrieveChunks, retrieveDiscussionPacket } from '../../src/bots/mastra/rag.js';
import type { SearchHit } from '../../src/search/types.js';

const fakeHits: SearchHit[] = [
  { type: 'verse', entity_id: '1', score: 0.9, text: 'first chunk', ref: null, slug: null, version: null },
  { type: 'verse', entity_id: '2', score: 0.8, text: 'second chunk', ref: null, slug: null, version: null },
];

describe('retrieveChunks', () => {
  test('returns the text of hits from the injected retriever', async () => {
    const chunks = await retrieveChunks('faith', async () => fakeHits);
    expect(chunks).toEqual(['first chunk', 'second chunk']);
  });
  test('returns [] when the retriever throws (RAG must never break the bot)', async () => {
    const chunks = await retrieveChunks('faith', async () => { throw new Error('qdrant down'); });
    expect(chunks).toEqual([]);
  });
});

describe('hasVerbatimOverlap', () => {
  test('detects a copied ten-word span despite punctuation and case', () => {
    const source = 'Faith alone receives mercy, and conscience then rests in the promise of Christ.';
    const output = 'He argues that FAITH alone receives mercy and conscience then rests in the promise—of Christ.';
    expect(hasVerbatimOverlap(output, [source])).toBe(true);
  });

  test('permits independent paraphrase', () => {
    expect(hasVerbatimOverlap(
      'He locates assurance in trusting divine mercy rather than in accumulating merit.',
      ['Faith alone receives mercy, and conscience then rests in the promise of Christ.'],
    )).toBe(false);
  });
});

describe('retrieveDiscussionPacket', () => {
  test('ranks a matching life event and keeps topic evidence in one packet', async () => {
    const packet = await retrieveDiscussionPacket({
      passageText: 'A prophet is condemned and dies for his testimony.',
      passageRef: 'Mosiah 17',
      candidates: [
        { botId: 'martyr', displayName: 'Witness', lifeSketch: [{ year: 1536, event: 'Executed for translating scripture and refusing to recant his testimony.' }] },
        { botId: 'scholar', displayName: 'Scholar', lifeSketch: [{ year: 1559, event: 'Founded an academy for education.' }] },
      ],
    }, async () => [{ ...fakeHits[0]!, text: 'prophecy testimony martyrdom' }]);
    expect(packet.topicEvidence).toHaveLength(1);
    expect(packet.candidates[0]?.botId).toBe('martyr');
    expect(packet.candidates[0]?.biographyEvidence.length).toBeGreaterThan(0);
  });

  test('degrades to sketch-only scoring when vector retrieval fails', async () => {
    const packet = await retrieveDiscussionPacket({
      passageText: 'education and learning',
      candidates: [{ botId: 'teacher', displayName: 'Teacher', lifeSketch: [{ event: 'Founded a school for education.' }] }],
    }, async () => { throw new Error('offline'); });
    expect(packet.topicEvidence).toEqual([]);
    expect(packet.candidates[0]?.relevanceScore).toBeGreaterThan(0);
  });

  test('never ranks a candidate excluded by group policy', async () => {
    const packet = await retrieveDiscussionPacket({
      passageText: 'martyrdom',
      candidates: [
        { botId: 'excluded', displayName: 'Excluded', eligible: false, lifeSketch: [{ event: 'Died in martyrdom.' }] },
        { botId: 'member', displayName: 'Member', eligible: true, lifeSketch: [] },
      ],
    }, async () => []);
    expect(packet.candidates.map((candidate) => candidate.botId)).toEqual(['member']);
  });
});
