import 'dotenv/config';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureCollection, getQdrant, qdrantReachable, COLLECTION } from '../../src/search/qdrant.js';

let up = false;
beforeAll(async () => { up = await qdrantReachable(); });

describe('Qdrant collection bootstrap', () => {
  it('creates bom_content with dense + sparse vectors (or SKIPS if Qdrant down)', async () => {
    if (!up) { console.warn('BLOCKED: Qdrant unreachable at QDRANT_URL — skipping'); return; }
    await ensureCollection();
    const info = await getQdrant().getCollection(COLLECTION);
    expect(info.config.params.vectors).toHaveProperty('dense');
    expect(info.config.params.sparse_vectors).toHaveProperty('keywords');
  });

  it('ensureCollection is idempotent', async () => {
    if (!up) return;
    await ensureCollection();
    await expect(ensureCollection()).resolves.toBeUndefined(); // second call must not throw
  });
});
