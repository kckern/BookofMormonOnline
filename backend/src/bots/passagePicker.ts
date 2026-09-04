/**
 * bots/passagePicker.ts — style-weighted random passage selection.
 *
 * Replaces the curated bom_ai_topic list: every discussion draws a random Book
 * of Mormon passage from the whole corpus, weighted toward discourse+poetry
 * (doctrinal/literary, debate-rich) over narrative (chronicle). Style comes from
 * lds_scriptures_lines.style (populated from scripture.guide.tmp_authorship),
 * joined to the bom_text unit the bots render by verse_id = min_verse_id.
 *
 * Discourse and poetry share ONE bucket (not partitioned): poetry is ~1% of the
 * corpus, so uniform within-bucket picking gives it its natural rate instead of
 * oversampling 42 passages. Weights are the single tunable knob.
 */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { verseIdsToRef } from '../messaging/contentRefs.js';

export type PassageBucket = 'discourse_poetry' | 'narrative';

/** Target selection weights per bucket (the one tunable knob). */
export const BUCKET_WEIGHTS: Record<PassageBucket, number> = {
  discourse_poetry: 85,
  narrative: 15,
};
const BUCKET_STYLES: Record<PassageBucket, string[]> = {
  discourse_poetry: ['discourse', 'poetry'],
  narrative: ['narrative'],
};

const BOM_FIRST_VERSE_ID = 31_103;
const BOM_LAST_VERSE_ID = 37_706;
const MIN_SPAN = 4; // ensure enough substance for a discussion
const MAX_SPAN = 12; // don't over-broaden

export interface PickedPassage {
  minVerseId: number;
  bucket: PassageBucket;
  style: string;
  passageRef: string;
}

export function pickBucket(random: () => number = Math.random): PassageBucket {
  const entries = Object.entries(BUCKET_WEIGHTS) as [PassageBucket, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let cursor = random() * total;
  for (const [b, w] of entries) { cursor -= w; if (cursor < 0) return b; }
  return entries[0]![0];
}

/**
 * Pick one style-weighted BoM passage. Falls back to the other bucket if the
 * chosen one is unexpectedly empty. Returns null only if the corpus/join is
 * empty. `random` injectable for tests.
 */
export async function pickStyleWeightedPassage(
  db: Kysely<DB>,
  random: () => number = Math.random,
): Promise<PickedPassage | null> {
  const first = pickBucket(random);
  const order: PassageBucket[] = [first, first === 'narrative' ? 'discourse_poetry' : 'narrative'];

  let picked: { minVerseId: number; nextMin: number | null; style: string; bucket: PassageBucket } | undefined;
  for (const bucket of order) {
    const row = await db.selectFrom('bom_text as t')
      // Distinct verse→style (a verse has several lines; dedupe so multi-line
      // verses aren't over-weighted in the random draw).
      .innerJoin(
        (eb) => eb.selectFrom('lds_scriptures_lines').select(['verse_id', 'style']).distinct().as('s'),
        (join) => join.onRef('s.verse_id', '=', 't.min_verse_id'),
      )
      .select([
        't.min_verse_id as minVerseId',
        's.style as style',
        sql<number>`(select min(t2.min_verse_id) from bom_text t2 where t2.min_verse_id > t.min_verse_id)`.as('nextMin'),
      ])
      .where('s.style', 'in', BUCKET_STYLES[bucket])
      .where('t.min_verse_id', '>=', BOM_FIRST_VERSE_ID)
      .where('t.min_verse_id', '<=', BOM_LAST_VERSE_ID)
      .orderBy(sql`rand()`)
      .limit(1)
      .executeTakeFirst();
    if (row) { picked = { minVerseId: Number(row.minVerseId), nextMin: row.nextMin == null ? null : Number(row.nextMin), style: String(row.style), bucket }; break; }
  }
  if (!picked) return null;

  const start = picked.minVerseId;
  const unitEnd = picked.nextMin ? picked.nextMin - 1 : start + MIN_SPAN - 1;
  const end = Math.min(BOM_LAST_VERSE_ID, Math.max(unitEnd, start + MIN_SPAN - 1), start + MAX_SPAN - 1);
  const verseIds: number[] = [];
  for (let v = start; v <= end; v++) verseIds.push(v);
  const passageRef = verseIdsToRef(verseIds);
  if (!passageRef) return null;
  return { minVerseId: start, bucket: picked.bucket, style: picked.style, passageRef };
}
