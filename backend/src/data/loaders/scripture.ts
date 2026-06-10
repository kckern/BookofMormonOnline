/** scripture domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';
import {
  generateReference,
  lookup,
  type LanguageCode,
} from 'scripture-guide';

/** Resolved scripture verse (from lds_scriptures_verses + translation overlay). */
export interface ScriptureVerseRow {
  verse_id: number;
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

/** A single heading row from lds_scriptures_headings. */
export interface ScriptureHeadingRow {
  verse_id: number;
  text: string | null;
}

/** A passage grouping (one heading → N verses). */
export interface PassageRow {
  reference: string;
  heading: string;
  meta: MetaRow[];
  verses: PassageVerseRow[];
}

export interface PassageVerseRow {
  verse: number;
  verse_id: number;
  text: string;
}

export interface MetaRow {
  verse_id: number;
  key: string;
  value: string;
}

/** Full ScriptureResults object returned by the `scripture` query. */
export interface ScriptureResultsRow {
  ref: string;
  passages: PassageRow[];
  verses: ScriptureVerseRow[];
}

/** A flat verse row returned by the `verses` query. */
export interface VerseFlatRow {
  verse_id: number;
  reference: string;
  heading: string | null;
  text: string;
}

// ─── lang normalisation (mirrors legacy BomUtils.ts) ────────────────────────

/** Convert the request lang to a scripture-guide LanguageCode.
 *  Legacy passes null for en/eng/dev, which scripture-guide treats as 'en'. */
function toScriptureGuideLang(lang: string): LanguageCode {
  const nolangs = ['eng', 'en', 'dev'];
  return (nolangs.includes(lang) ? 'en' : lang) as LanguageCode;
}

// ─── heading loader helper ───────────────────────────────────────────────────

/** Load headings for a set of verse_ids with lang + en fallback. */
async function loadHeadings(
  db: Kysely<DB>,
  verse_ids: number[],
  lang: string,
): Promise<ScriptureHeadingRow[]> {
  const langCode = toScriptureGuideLang(lang);
  const firstVerse: number = verse_ids[0]!;
  const idList = sql.join(verse_ids);

  let rows = await sql<{ verse_id: number; text: string | null }>`
    (SELECT verse_id, text
       FROM lds_scriptures_headings
      WHERE verse_id <= ${firstVerse}
        AND lang = ${langCode}
      ORDER BY verse_id DESC
      LIMIT 1)
    UNION
    (SELECT verse_id, text
       FROM lds_scriptures_headings
      WHERE verse_id IN (${idList})
        AND lang = ${langCode}
      ORDER BY verse_id)
  `.execute(db).then((r) => r.rows);

  // en fallback when no rows found
  if (!rows.length && langCode !== 'en') {
    rows = await sql<{ verse_id: number; text: string | null }>`
      (SELECT verse_id, text
         FROM lds_scriptures_headings
        WHERE verse_id <= ${firstVerse}
          AND lang = 'en'
        ORDER BY verse_id DESC
        LIMIT 1)
      UNION
      (SELECT verse_id, text
         FROM lds_scriptures_headings
        WHERE verse_id IN (${idList})
          AND lang = 'en'
        ORDER BY verse_id)
    `.execute(db).then((r) => r.rows);
  }

  // Deduplicate by verse_id (keep first occurrence)
  const seen = new Set<number>();
  const deduped = rows.filter((r) => {
    if (seen.has(r.verse_id)) return false;
    seen.add(r.verse_id);
    return true;
  });

  if (!deduped.length) {
    return [{ verse_id: firstVerse, text: null }];
  }

  return deduped.sort((a, b) => a.verse_id - b.verse_id);
}

// ─── scripture (ScriptureResults) ───────────────────────────────────────────

export async function fetchScripture(
  db: Kysely<DB>,
  lang: string,
  ref: string | null | undefined,
  arg_verse_ids: number[] | null | undefined,
  version = 'LDS',
): Promise<ScriptureResultsRow> {
  const langCode = toScriptureGuideLang(lang);

  // Resolve verse_ids + ref
  let verse_ids: number[];
  let resolvedRef: string;

  if (arg_verse_ids && arg_verse_ids.length) {
    verse_ids = arg_verse_ids;
    resolvedRef = generateReference(verse_ids as number[], langCode);
  } else {
    const looked = ref ? lookup(ref, langCode) : null;
    if (!looked || !looked.verse_ids || !looked.verse_ids.length) {
      return {
        ref: (ref ?? '') + ' not found',
        passages: [],
        verses: [],
      };
    }
    verse_ids = looked.verse_ids as number[];
    resolvedRef = (looked.ref ?? ref) as string;
  }

  // Fetch base verse rows
  const verseRows = await db
    .selectFrom('lds_scriptures_verses')
    .select(['verse_id', 'book_id', 'chapter', 'verse', 'verse_scripture'])
    .where('verse_id', 'in', verse_ids)
    .execute();

  if (!verseRows.length) {
    return { ref: resolvedRef, passages: [], verses: [] };
  }

  // Overlay translation if non-english
  const textByVerseId = new Map<number, string>(
    verseRows.map((v) => [v.verse_id, v.verse_scripture]),
  );

  if (langCode !== 'en') {
    const transRows = await db
      .selectFrom('lds_scriptures_translations')
      .select(['verse_id', 'text'])
      .where('verse_id', 'in', verse_ids)
      .where('lang', '=', langCode)
      .execute();
    for (const t of transRows) {
      textByVerseId.set(t.verse_id, t.text);
    }
  }

  // Build ScriptureVerse array
  const verses: ScriptureVerseRow[] = verseRows.map((v) => ({
    verse_id: v.verse_id,
    book: String(v.book_id),
    chapter: v.chapter,
    verse: v.verse,
    text: textByVerseId.get(v.verse_id) ?? v.verse_scripture,
  }));

  // Split verse_ids into contiguous groups
  const groups: number[][] = verse_ids.reduce<number[][]>((acc, vid) => {
    const last = acc[acc.length - 1];
    if (!last || last[last.length - 1] !== vid - 1) {
      acc.push([vid]);
    } else {
      last.push(vid);
    }
    return acc;
  }, []);

  // Build passages for each contiguous group
  const passagesNested = await Promise.all(
    groups.map((groupIds) =>
      buildPassages(db, groupIds, verses, lang, langCode, version),
    ),
  );

  return { ref: resolvedRef, passages: passagesNested.flat(), verses };
}

async function buildPassages(
  db: Kysely<DB>,
  verse_ids: number[],
  allVerses: ScriptureVerseRow[],
  lang: string,
  langCode: LanguageCode,
  version: string,
): Promise<PassageRow[]> {
  const headingData = await loadHeadings(db, verse_ids, lang);

  // Fetch meta rows for this group
  const meta: MetaRow[] = (
    await db
      .selectFrom('lds_scriptures_meta')
      .select(['verse_id', 'type', 'text'])
      .where('verse_id', 'in', verse_ids)
      .where('version', '=', version)
      .execute()
  ).map((m) => ({ verse_id: m.verse_id, key: m.type, value: m.text }));

  return headingData.map((item, i) => {
    const startVerse = Math.max(item.verse_id, Math.min(...verse_ids));
    const endVerse: number = headingData[i + 1]?.verse_id ?? verse_ids[verse_ids.length - 1] ?? startVerse;
    const passageVerses = allVerses.filter(
      (v) => v.verse_id >= startVerse && v.verse_id <= endVerse,
    );
    const passageVerseIds = passageVerses.map((v) => v.verse_id);
    const reference = generateReference(passageVerseIds, langCode);
    const rawHeading = item.text?.replace(/｢\d+｣/g, '').trim() ?? null;
    const heading = rawHeading || reference;
    return {
      reference,
      heading,
      meta,
      verses: passageVerses.map((v) => ({
        verse: v.verse,
        verse_id: v.verse_id,
        text: v.text,
      })),
    };
  });
}

// ─── verses (flat verse rows) ─────────────────────────────────────────────────

export async function fetchVerses(
  db: Kysely<DB>,
  lang: string,
  verse_ids: number[],
): Promise<VerseFlatRow[]> {
  const langCode = toScriptureGuideLang(lang);

  const verseRows = await db
    .selectFrom('lds_scriptures_verses')
    .select(['verse_id', 'verse_scripture', 'verse_title'])
    .where('verse_id', 'in', verse_ids)
    .execute();

  // Overlay translation
  const textByVerseId = new Map<number, string>(
    verseRows.map((v) => [v.verse_id, v.verse_scripture]),
  );
  if (langCode !== 'en') {
    const transRows = await db
      .selectFrom('lds_scriptures_translations')
      .select(['verse_id', 'text'])
      .where('verse_id', 'in', verse_ids)
      .where('lang', '=', langCode)
      .execute();
    for (const t of transRows) {
      textByVerseId.set(t.verse_id, t.text);
    }
  }

  // Load headings
  const headingData = await loadHeadings(db, verse_ids, lang);

  // For each verse, find the most recent heading at or before it
  const findHeading = (verseId: number): string | null => {
    const relevant = headingData.filter((h) => h.verse_id <= verseId);
    if (!relevant.length) return null;
    const latest = relevant.reduce((best, cur) =>
      cur.verse_id > best.verse_id ? cur : best,
    );
    return latest.text ?? null;
  };

  return verseRows.map((v) => {
    const rawHeading = findHeading(v.verse_id);
    // Strip the annotation markers from headings (e.g. "Nephi₁'s Introduction ｢360｣")
    // NOTE: do NOT strip these — the baseline has them: "Nephi₁'s Introduction ｢360｣"
    return {
      verse_id: v.verse_id,
      reference: v.verse_title,
      heading: rawHeading ?? null,
      text: textByVerseId.get(v.verse_id) ?? v.verse_scripture,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function scriptureLoaders(db: Kysely<DB>, lang: string, core: Loaders) {
  // Expose the db instance so resolvers can call fetchScripture/fetchVerses
  return { _scriptureDb: db, _scriptureLang: lang };
}
