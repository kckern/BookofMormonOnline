import { QdrantClient } from '@qdrant/js-client-rest';
import { getSearchConfig } from './config.js';

export const COLLECTION = 'bom_content';
export const DENSE_SIZE = 1536; // text-embedding-3-small

let client: QdrantClient | null = null;
export function getQdrant(): QdrantClient {
  if (client) return client;
  const cfg = getSearchConfig();
  client = new QdrantClient({ url: cfg.qdrantUrl, apiKey: cfg.qdrantApiKey });
  return client;
}

/** Create the collection (named dense + sparse vectors) and payload indexes if absent. Idempotent. */
export async function ensureCollection(): Promise<void> {
  const q = getQdrant();
  const existing = await q.getCollections();
  if (existing.collections.some((c) => c.name === COLLECTION)) return;

  await q.createCollection(COLLECTION, {
    vectors: { dense: { size: DENSE_SIZE, distance: 'Cosine' } },
    sparse_vectors: { keywords: {} },
  });
  for (const field of ['type', 'lang', 'version'] as const) {
    await q.createPayloadIndex(COLLECTION, { field_name: field, field_schema: 'keyword' });
  }
}

/** True if the configured Qdrant answers within the timeout. */
export async function qdrantReachable(timeoutMs = 1500): Promise<boolean> {
  try {
    await Promise.race([
      getQdrant().getCollections(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
