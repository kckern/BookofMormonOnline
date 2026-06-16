import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { IndexPoint } from './types.js';
import { pointId } from './points.js';
import { embedBatch } from './embed.js';
import { getQdrant, ensureCollection, COLLECTION } from './qdrant.js';

export interface VerseRow { verse_id: number; verse_scripture: string }

/** Pure: one verse + its embedding → a single IndexPoint (verses are one chunk). */
export function verseToPoint(row: VerseRow, dense: number[], lang: string): IndexPoint {
  const entity_id = String(row.verse_id);
  return {
    id: pointId('verse', entity_id, 0),
    type: 'verse',
    entity_id,
    chunkIndex: 0,
    text: row.verse_scripture,
    ref: null,
    slug: null,
    lang,
    version: 'LDS',
    dense,
  };
}

/** Upsert points into Qdrant (dense vectors + payload). Sparse vectors are added at query time in Phase 1. */
export async function upsertPoints(points: IndexPoint[]): Promise<void> {
  if (!points.length) return;
  await getQdrant().upsert(COLLECTION, {
    wait: true,
    points: points.map((p) => ({
      id: p.id,
      vector: { dense: p.dense },
      payload: { type: p.type, entity_id: p.entity_id, ref: p.ref, slug: p.slug, lang: p.lang, version: p.version, text: p.text },
    })),
  });
}

/** Full reindex of BoM verses from MySQL → Qdrant, batched. */
export async function reindexVerses(db: Kysely<DB>, batchSize = 128): Promise<number> {
  await ensureCollection();
  const rows = (await db
    .selectFrom('lds_scriptures_verses')
    .select(['verse_id', 'verse_scripture'])
    .where('verse_id', '>=', 31103)
    .where('verse_id', '<=', 37706)
    .execute()) as VerseRow[];

  let count = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const vectors = await embedBatch(batch.map((r) => r.verse_scripture));
    if (vectors.length !== batch.length) {
      throw new Error(`embedBatch returned ${vectors.length} vectors for ${batch.length} inputs`);
    }
    const points = batch.map((r, j) => verseToPoint(r, vectors[j]!, 'en'));
    await upsertPoints(points);
    count += points.length;
  }
  return count;
}
