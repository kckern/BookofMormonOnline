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
  if (!existing.collections.some((c) => c.name === COLLECTION)) {
    await q.createCollection(COLLECTION, {
      vectors: { dense: { size: DENSE_SIZE, distance: 'Cosine' } },
      sparse_vectors: { keywords: {} },
    });
  }
  // Keep indexes additive for existing collections as new content types gain
  // filter dimensions. Qdrant treats repeated index creation as idempotent.
  for (const field of ['type', 'lang', 'version', 'corpus_id', 'rights_class'] as const) {
    try {
      await q.createPayloadIndex(COLLECTION, { field_name: field, field_schema: 'keyword' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists|already indexed/i.test(message)) throw error;
    }
  }
}

/** True if the configured Qdrant answers within the timeout. */
export async function qdrantReachable(timeoutMs = 1500): Promise<boolean> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    timerId = setTimeout(() => rej(new Error('timeout')), timeoutMs);
  });
  try {
    await Promise.race([getQdrant().getCollections(), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timerId);
  }
}
