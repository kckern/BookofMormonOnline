import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { ContentType, IndexPoint } from './types.js';
import { pointId } from './points.js';
import { embedBatch } from './embed.js';
import { getQdrant, ensureCollection, COLLECTION } from './qdrant.js';
import { textToSparse } from './sparse.js';
import { chunkText } from './chunk.js';

export interface VerseRow { verse_id: number; verse_scripture: string }

export interface SourceRow {
  entity_id: string;
  title: string | null;
  text: string;
  slug: string | null;
  ref: string | null;
}

export interface IndexUnit extends SourceRow {
  type: ContentType;
  chunkIndex: number;
}

export interface TypeConfig {
  type: ContentType;
  chunk: boolean;
  maxChars?: number;
}

/** Pure: one verse + its embedding → a single IndexPoint (verses are one chunk). */
export function verseToPoint(row: VerseRow, dense: number[], lang: string): IndexPoint {
  const entity_id = String(row.verse_id);
  return {
    id: pointId('verse', entity_id, 0),
    type: 'verse',
    entity_id,
    chunkIndex: 0,
    text: row.verse_scripture,
    title: null,
    ref: null,
    slug: null,
    lang,
    version: 'LDS',
    dense,
    sparse: textToSparse(row.verse_scripture),
  };
}

/** Convert rows into indexable units, optionally chunking long text. */
export function toUnits(cfg: TypeConfig, rows: SourceRow[]): IndexUnit[] {
  const units: IndexUnit[] = [];
  for (const row of rows) {
    const pieces = cfg.chunk
      ? chunkText(row.text, cfg.maxChars ?? 600)
      : (row.text.trim() ? [row.text.trim()] : []);
    pieces.forEach((text, chunkIndex) => units.push({ ...row, type: cfg.type, chunkIndex, text }));
  }
  return units;
}

/** Pure: one IndexUnit + its embedding → a single IndexPoint. */
export function unitToPoint(unit: IndexUnit, dense: number[], lang: string): IndexPoint {
  return {
    id: pointId(unit.type, unit.entity_id, unit.chunkIndex),
    type: unit.type,
    entity_id: unit.entity_id,
    chunkIndex: unit.chunkIndex,
    text: unit.text,
    title: unit.title,
    ref: unit.ref,
    slug: unit.slug,
    lang,
    version: null,
    dense,
    sparse: textToSparse(unit.text),
  };
}

/** Upsert points into Qdrant (dense + sparse keyword vectors + payload). */
export async function upsertPoints(points: IndexPoint[]): Promise<void> {
  if (!points.length) return;
  await getQdrant().upsert(COLLECTION, {
    wait: true,
    points: points.map((p) => {
      const { id, dense, sparse, ...payload } = p;
      return { id, vector: { dense, keywords: sparse }, payload };
    }),
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

/** Generic reindex for any content type: load rows, chunk, embed, upsert. */
export async function reindexType(
  db: Kysely<DB>,
  cfg: TypeConfig,
  load: (db: Kysely<DB>) => Promise<SourceRow[]>,
  lang = 'en',
  batchSize = 128,
): Promise<number> {
  await ensureCollection();
  const units = toUnits(cfg, await load(db));
  let count = 0;
  for (let i = 0; i < units.length; i += batchSize) {
    const batch = units.slice(i, i + batchSize);
    const vectors = await embedBatch(batch.map((u) => u.text));
    if (vectors.length !== batch.length) throw new Error(`embedBatch returned ${vectors.length} for ${batch.length}`);
    await upsertPoints(batch.map((u, j) => unitToPoint(u, vectors[j]!, lang)));
    count += batch.length;
  }
  return count;
}
