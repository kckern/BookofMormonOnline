/** Select a real bom_text block for a managed discussion. */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { generateReference, type LanguageCode } from 'scripture-guide';
import type { DB } from '../../codegen/db.js';

export type PassageBucket = 'discourse_poetry' | 'narrative';
export type SelectionMode = 'unrestricted' | 'window';
export const BUCKET_WEIGHTS: Record<PassageBucket, number> = { discourse_poetry: 85, narrative: 15 };
const BUCKET_STYLES: Record<PassageBucket, string[]> = {
  discourse_poetry: ['discourse', 'poetry'], narrative: ['narrative'],
};
export const BOM_FIRST_VERSE_ID = 31_103;
export const BOM_LAST_VERSE_ID = 37_706;
export const PASSAGE_HISTORY_DAYS = 90;

export interface PassageRange {
  ordinal: number; passageRef: string; minVerseId: number; maxVerseId: number;
}
export interface PassageWindow {
  windowKey: string; sequence: number; label: string; ranges: PassageRange[];
}
export interface PickedPassage {
  textGuid: string; pageGuid: string; ordinal: number; minVerseId: number;
  bucket: PassageBucket; style: string; passageRef: string;
  blockVerseIds: number[]; matchedVerseIds: number[];
  selectionMode: SelectionMode; window: PassageWindow | null;
  matchedRange: PassageRange | null; historyRelaxed: boolean; fallbackReason?: string;
}
export interface PassagePickerOptions {
  channelUrl?: string; timeZone?: string; lang?: string; now?: Date; random?: () => number;
}
interface CandidateRow {
  textGuid: string; pageGuid: string; ordinal: number; minVerseId: number;
  style: string; blockVerseIds: string; translatedContent: string | null;
}

export function pickBucket(random: () => number = Math.random): PassageBucket {
  const entries = Object.entries(BUCKET_WEIGHTS) as [PassageBucket, number][];
  let cursor = random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [bucket, weight] of entries) { cursor -= weight; if (cursor < 0) return bucket; }
  return entries[0]![0];
}

export function localDateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values['year']}-${values['month']}-${values['day']}`;
}

function isMissingSchema(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR';
}

async function activeWindow(
  db: Kysely<DB>, channelUrl: string, localDate: string,
): Promise<{ window: PassageWindow | null; fallbackReason?: string }> {
  try {
    const result = await sql<{ windowKey: string; sequence: number; label: string }>`
      SELECT window_key AS windowKey, sequence_no AS sequence, label
      FROM bom_ai_passage_window
      WHERE channel_url = ${channelUrl} AND enabled = 1
        AND starts_on <= ${localDate} AND ends_on >= ${localDate}
      ORDER BY sequence_no, window_key
    `.execute(db);
    if (!result.rows.length) return { window: null };
    if (result.rows.length !== 1) return { window: null, fallbackReason: 'overlapping-active-windows' };
    const row = result.rows[0]!;
    const ranges = await db.selectFrom('bom_ai_passage_range')
      .select(['ordinal', 'passage_ref', 'min_verse_id', 'max_verse_id'])
      .where('window_key', '=', row.windowKey).orderBy('ordinal').execute();
    const mapped = ranges.map((range) => ({
      ordinal: Number(range.ordinal), passageRef: range.passage_ref,
      minVerseId: Number(range.min_verse_id), maxVerseId: Number(range.max_verse_id),
    }));
    const valid = mapped.length > 0 && mapped.every((range) =>
      range.minVerseId >= BOM_FIRST_VERSE_ID && range.maxVerseId <= BOM_LAST_VERSE_ID
      && range.minVerseId <= range.maxVerseId);
    if (!valid) return { window: null, fallbackReason: 'invalid-active-window' };
    return { window: { windowKey: row.windowKey, sequence: Number(row.sequence), label: row.label, ranges: mapped } };
  } catch (error) {
    if (isMissingSchema(error)) return { window: null };
    throw error;
  }
}

async function recentTextGuids(db: Kysely<DB>, channelUrl?: string, now = new Date()): Promise<Set<string>> {
  if (!channelUrl) return new Set();
  try {
    const cutoff = new Date(now.getTime() - PASSAGE_HISTORY_DAYS * 86_400_000);
    const rows = await db.selectFrom('bom_ai_passage_use').select('text_guid')
      .where('channel_url', '=', channelUrl).where('used_at', '>=', cutoff).execute();
    return new Set(rows.map((row) => row.text_guid));
  } catch (error) {
    if (isMissingSchema(error)) return new Set();
    throw error;
  }
}

async function candidatesForBucket(
  db: Kysely<DB>, bucket: PassageBucket, lang: string,
): Promise<Array<CandidateRow & { verseIds: number[] }>> {
  const result = await sql<CandidateRow>`
    SELECT t.guid AS textGuid, t.page AS pageGuid, t.link AS ordinal,
      t.min_verse_id AS minVerseId, s.style AS style,
      GROUP_CONCAT(DISTINCT CAST(l.verse_id AS UNSIGNED)
        ORDER BY CAST(l.verse_id AS UNSIGNED) SEPARATOR ',') AS blockVerseIds,
      CASE WHEN ${lang} = 'en' THEN t.content ELSE (
        SELECT tr.value FROM bom_translation tr
        WHERE tr.guid = t.guid AND tr.lang = ${lang} AND tr.refkey = 'content'
        ORDER BY tr.id DESC LIMIT 1
      ) END AS translatedContent
    FROM bom_text t
    INNER JOIN bom_lookup l ON l.text_guid = t.guid
    INNER JOIN (SELECT DISTINCT verse_id, style FROM lds_scriptures_lines) s
      ON s.verse_id = t.min_verse_id
    WHERE t.page IS NOT NULL AND t.link IS NOT NULL
      AND t.min_verse_id BETWEEN ${BOM_FIRST_VERSE_ID} AND ${BOM_LAST_VERSE_ID}
      AND s.style IN (${sql.join(BUCKET_STYLES[bucket])})
      AND CAST(l.verse_id AS UNSIGNED) BETWEEN ${BOM_FIRST_VERSE_ID} AND ${BOM_LAST_VERSE_ID}
    GROUP BY t.guid, t.page, t.link, t.min_verse_id, s.style, t.content
  `.execute(db);
  return result.rows.filter((row) => lang === 'en' || !!row.translatedContent).map((row) => ({
    ...row, minVerseId: Number(row.minVerseId), ordinal: Number(row.ordinal),
    verseIds: String(row.blockVerseIds).split(',').map(Number).filter(Number.isFinite),
  }));
}

export function rangeMatch(verseIds: number[], window: PassageWindow | null): PassageRange | null {
  if (!window) return null;
  return window.ranges.find((range) =>
    verseIds.some((id) => id >= range.minVerseId && id <= range.maxVerseId)) ?? null;
}

/** Select a block. The legacy function-valued second argument remains supported. */
export async function pickStyleWeightedPassage(
  db: Kysely<DB>, input: PassagePickerOptions | (() => number) = {},
): Promise<PickedPassage | null> {
  const opts = typeof input === 'function' ? { random: input } : input;
  const random = opts.random ?? Math.random;
  const lang = opts.lang || 'en';
  const localDate = localDateInTimeZone(opts.now ?? new Date(), opts.timeZone || 'UTC');
  const configured = opts.channelUrl
    ? await activeWindow(db, opts.channelUrl, localDate)
    : { window: null as PassageWindow | null, fallbackReason: undefined as string | undefined };
  const recent = await recentTextGuids(db, opts.channelUrl, opts.now);
  const first = pickBucket(random);
  const buckets: PassageBucket[] = [first, first === 'narrative' ? 'discourse_poetry' : 'narrative'];
  const loaded = new Map<PassageBucket, Awaited<ReturnType<typeof candidatesForBucket>>>();
  const load = async (bucket: PassageBucket) => {
    const cached = loaded.get(bucket);
    if (cached) return cached;
    const rows = await candidatesForBucket(db, bucket, lang);
    loaded.set(bucket, rows);
    return rows;
  };
  let scope = configured.window;
  let fallbackReason = configured.fallbackReason;
  let historyRelaxed = false;

  const choose = async (ignoreHistory: boolean) => {
    for (const bucket of buckets) {
      const eligible = (await load(bucket)).filter((row) =>
        (!scope || !!rangeMatch(row.verseIds, scope))
        && (ignoreHistory || !recent.has(row.textGuid)));
      if (eligible.length) {
        const row = eligible[Math.floor(random() * eligible.length)]!;
        return { ...row, bucket };
      }
    }
    return undefined;
  };

  let picked = await choose(false);
  if (!picked && recent.size) { historyRelaxed = true; picked = await choose(true); }
  if (!picked && scope) {
    fallbackReason = 'active-window-has-no-eligible-blocks';
    scope = null; historyRelaxed = false; picked = await choose(false);
    if (!picked && recent.size) { historyRelaxed = true; picked = await choose(true); }
  }
  if (!picked) return null;
  const matchedRange = rangeMatch(picked.verseIds, scope);
  const matchedVerseIds = matchedRange
    ? picked.verseIds.filter((id) => id >= matchedRange.minVerseId && id <= matchedRange.maxVerseId)
    : picked.verseIds;
  return {
    textGuid: picked.textGuid, pageGuid: picked.pageGuid, ordinal: picked.ordinal,
    minVerseId: picked.minVerseId, bucket: picked.bucket, style: picked.style,
    passageRef: generateReference(matchedVerseIds, lang as LanguageCode),
    blockVerseIds: picked.verseIds, matchedVerseIds,
    selectionMode: scope ? 'window' : 'unrestricted', window: scope, matchedRange,
    historyRelaxed, ...(fallbackReason ? { fallbackReason } : {}),
  };
}
