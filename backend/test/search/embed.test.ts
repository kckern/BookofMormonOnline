import { describe, expect, test } from 'vitest';
import { MockEmbeddingModelV3 } from 'ai/test';
import { embedOne, embedBatch } from '../../src/search/embed.js';

// maxEmbeddingsPerCall defaults to 1 in V3, which causes the SDK to split
// batches into single-value calls; set it high enough to receive all values
// in one doEmbed call so the index-based vector generation works as intended.
const mock = new MockEmbeddingModelV3({
  maxEmbeddingsPerCall: 100,
  doEmbed: async ({ values }: { values: string[] }) => ({
    embeddings: values.map((_, i) => [i + 1, 0, 0]),
    usage: { tokens: values.length },
  }),
});

describe('embedOne / embedBatch', () => {
  test('embedOne returns a single vector', async () => {
    expect(await embedOne('faith', mock)).toEqual([1, 0, 0]);
  });
  test('embedBatch returns one vector per input, order preserved', async () => {
    expect(await embedBatch(['a', 'b'], mock)).toEqual([[1, 0, 0], [2, 0, 0]]);
  });
  test('embedBatch on empty input returns empty', async () => {
    expect(await embedBatch([], mock)).toEqual([]);
  });
});
