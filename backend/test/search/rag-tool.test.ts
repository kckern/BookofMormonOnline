import { describe, expect, test } from 'vitest';
import { retrieveChunks } from '../../src/bots/mastra/rag.js';
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
