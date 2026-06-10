/** scriptureread domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';
import {
  lookup,
  lookupReference,
  generateReference,
  type LanguageCode,
} from 'scripture-guide';

// ─── lang normalisation (mirrors legacy BomScripture/BomPage) ────────────────

function toScriptureGuideLang(lang: string): LanguageCode {
  const nolangs = ['eng', 'en', 'dev'];
  return (nolangs.includes(lang) ? 'en' : lang) as LanguageCode;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReadLineRow {
  ref: string;
  /** Raw string from generateReference(...).split(':').pop() — may be non-numeric (Korean). */
  verse_num: string;
  verse_id: number;
  text: string;
  format: string | null;
}

export interface ReadUnitRow {
  ref: string;
  verse_id: number;
  verse_count: number;
  verse_ids: number[];
  person_slug: string | null;
  voice: string | null;
  lines: ReadLineRow[];
}

export interface ReadSectionRow {
  ref: string;
  heading: string | null;
  verse_id: number;
  verse_count: number;
  blocks: ReadUnitRow[];
}

export interface ReadBlockRow {
  ref: string;
  verse_id: number;
  verse_count: number;
  prev_ref: string | null;
  next_ref: string | null;
  sections: ReadSectionRow[];
}

// ─── read helpers ─────────────────────────────────────────────────────────────

/** Heading loader: mirrors loadHeadings in BomScripture.ts / scripture.ts */
async function loadHeadings(
  db: Kysely<DB>,
  verse_ids: number[],
  langCode: LanguageCode,
): Promise<{ verse_id: number; text: string | null }[]> {
  const firstVerse = verse_ids[0] ?? 0;
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

/**
 * Main read fetcher. Mirrors legacy BomPage.ts read resolver (lines 235–336).
 * Builds sections → blocks → lines from lds_scriptures_lines with heading
 * grouping from lds_scriptures_headings.
 */
export async function fetchRead(
  db: Kysely<DB>,
  lang: string,
  ref: string,
): Promise<ReadBlockRow> {
  const langCode = toScriptureGuideLang(lang);

  // Resolve verse_ids — legacy uses lookupReference (which accepts single ref)
  const { verse_ids, ref: resolvedRef } = lookupReference(ref, langCode);

  // Load lines (mirrors loadLines in BomScripture.ts)
  const lineRows = await db
    .selectFrom('lds_scriptures_lines')
    .selectAll()
    .where('verse_id', 'in', verse_ids)
    .execute();

  // Overlay Korean translations for lines (bom_translation refkey=text and line_num)
  if (langCode !== 'en') {
    const guids = lineRows.map((l) => l.guid);
    if (guids.length) {
      const translations = await db
        .selectFrom('bom_translation')
        .select(['guid', 'refkey', 'value'])
        .where('guid', 'in', guids)
        .where('lang', '=', langCode)
        .execute();
      for (const line of lineRows) {
        const textTrans = translations.find((t) => t.guid === line.guid && t.refkey === 'text');
        const numTrans = translations.find((t) => t.guid === line.guid && t.refkey === 'line_num');
        if (textTrans) (line as { text: string | null }).text = textTrans.value;
        if (numTrans) {
          (line as { line_num: string | number | null }).line_num = numTrans.value as unknown as number;
        }
      }
    }
  }

  // Filter ∅ lines, sort by verse_id then line_num
  const lines = lineRows
    .filter((l) => l.text !== '∅')
    .sort((a, b) => {
      const aKey = `${a.verse_id}.${a.line_num}`;
      const bKey = `${b.verse_id}.${b.line_num}`;
      return aKey > bKey ? 1 : -1;
    });

  // Load headings for section grouping (mirrors loadVerses → findHeading)
  const headingRows = await loadHeadings(db, verse_ids, langCode);

  // findHeading: latest heading at or before a given verse_id (mirrors BomScripture.ts loadVerses)
  const findHeading = (verseId: number): string | null => {
    const relevant = headingRows.filter((h) => h.verse_id <= verseId);
    if (!relevant.length) return null;
    const latest = relevant.reduce((best, cur) =>
      cur.verse_id > best.verse_id ? cur : best,
    );
    return latest.text ?? null;
  };

  // Build headingMap per verse_id (mirrors legacy scripture array reduce)
  const headingMap = new Map<number, string | null>();
  for (const vid of verse_ids) {
    headingMap.set(vid, findHeading(vid));
  }

  // Compute prev/next refs (mirrors legacy BomPage.ts lines 249–255)
  // Note: for Korean, replace(/:\d+$/, '') does nothing — intentional parity
  const currentChapter = generateReference(verse_ids[0] as number, langCode).replace(/:\d+$/, '');
  const currentChapterLookup = lookup(currentChapter, langCode);
  const currentChapterVerseIds = currentChapterLookup.verse_ids ?? [];

  const firstChapterVerse = currentChapterVerseIds[0] ?? verse_ids[0] as number;
  const lastChapterVerse =
    currentChapterVerseIds[currentChapterVerseIds.length - 1] ?? verse_ids[verse_ids.length - 1] as number;

  let prevRef: string | null = generateReference(firstChapterVerse - 1, langCode).replace(
    /:\d+$/,
    '',
  );
  let nextRef: string | null = generateReference(lastChapterVerse + 1, langCode).replace(
    /:\d+$/,
    '',
  );

  // Boundary checks: 1 Nephi 1 starts at 31103; Moroni 10 ends at 37706
  if (firstChapterVerse <= 31103) prevRef = null;
  if (lastChapterVerse >= 37706) nextRef = null;

  // Build sections/blocks/lines (mirrors legacy BomPage.ts lines 265–326)
  const sections: ReadSectionRow[] = [];
  let currentSection: ReadSectionRow | null = null;
  let lastPersonSlug: string | null | undefined = undefined;
  let lastVoice: string | null | undefined = undefined;

  for (const line of lines) {
    const lineVerseId = line.verse_id as number;
    const thisSection = headingMap.get(lineVerseId) ?? null;

    if (!currentSection || currentSection.heading !== thisSection) {
      currentSection = {
        ref: resolvedRef,
        heading: thisSection,
        verse_id: lineVerseId,
        verse_count: 0,
        blocks: [],
      };
      sections.push(currentSection);
    }

    const currentBlock =
      currentSection.blocks.length > 0
        ? currentSection.blocks[currentSection.blocks.length - 1]
        : null;

    if (!currentBlock || line.person_slug !== lastPersonSlug || line.voice !== lastVoice) {
      currentSection.blocks.push({
        ref: resolvedRef,
        verse_id: lineVerseId,
        verse_count: 0,
        verse_ids: [],
        person_slug: line.person_slug ?? null,
        voice: line.voice ?? null,
        lines: [],
      });
      lastPersonSlug = line.person_slug;
      lastVoice = line.voice;
    }

    const block = currentSection.blocks[currentSection.blocks.length - 1] as ReadUnitRow;
    const lineRef = generateReference(lineVerseId, langCode);

    block.lines.push({
      ref: lineRef,
      // Legacy: lineRef.split(':').pop() — may be full string in Korean (no colon)
      verse_num: lineRef.split(':').pop() as string,
      verse_id: lineVerseId,
      text: (line.text ?? '') as string,
      format: line.format ?? null,
    });

    // Update block verse tracking
    if (!block.verse_ids.includes(lineVerseId)) {
      block.verse_ids.push(lineVerseId);
    }
    block.verse_count = block.verse_ids.length;

    // Section verse_count is SUM of block verse_counts (mirrors legacy:
    // currentSection.blocks.map(b => b.verse_count).reduce((a,b)=>a+b,0))
    // NOTE: blocks can share verse_ids so this is NOT a unique count.
    currentSection.verse_count = currentSection.blocks.reduce(
      (acc, b) => acc + b.verse_count,
      0,
    );
  }

  // Finalise section/block refs (mirrors legacy BomPage.ts lines 319–326)
  for (const section of sections) {
    for (const block of section.blocks) {
      block.ref = generateReference(block.verse_ids, langCode);
    }
    const sectionVerseIds = Array.from(
      new Set(section.blocks.flatMap((b) => b.verse_ids)),
    ).sort((a, b) => a - b);
    section.ref = generateReference(sectionVerseIds, langCode);
  }

  return {
    ref: resolvedRef,
    verse_id: verse_ids[0] as number,
    verse_count: verse_ids.length,
    prev_ref: prevRef,
    next_ref: nextRef,
    sections,
  };
}

// ─── lookup helpers ───────────────────────────────────────────────────────────

export interface LookupTextRow {
  guid: string;
  page: string | null;
  link: number | null;
  heading: string | null;
  parent: string | null;
}

/**
 * Fetch text blocks for lookup refs.
 * Mirrors legacy BomPage.ts lookup resolver (lines 212–233):
 * bom_lookup -> bom_text by verse_ids.
 */
export async function fetchLookup(
  db: Kysely<DB>,
  lang: string,
  refs: string[],
): Promise<LookupTextRow[]> {
  const langCode = toScriptureGuideLang(lang);

  // Resolve all verse_ids for all refs
  const verseIdSets = refs.map((r) => {
    const result = lookupReference(r, langCode);
    return result.verse_ids ?? [];
  });
  const allVerseIds = verseIdSets.flat();
  if (!allVerseIds.length) return [];

  // bom_lookup.verse_id is a STRING column
  const verseIdStrings = allVerseIds.map(String);

  const lookupRows = await db
    .selectFrom('bom_lookup')
    .select(['text_guid'])
    .where('verse_id', 'in', verseIdStrings)
    .execute();

  if (!lookupRows.length) return [];

  const textGuids = lookupRows.map((r) => r.text_guid);

  const textRows = await db
    .selectFrom('bom_text')
    .select(['guid', 'page', 'link', 'heading', 'parent'])
    .where('guid', 'in', textGuids)
    .execute();

  return textRows;
}

// ─── versehighlights helpers ──────────────────────────────────────────────────

export interface VerseHighlightRow {
  bom_verse_id: number;
  bible_verse_id: number;
  bom_highlight: string[] | null;
  bible_highlight: string[] | null;
  isQuote: boolean | null;
}

/**
 * Fetch scripture highlights for verse_pairs.
 * Mirrors legacy BomScripture.ts loadVerseHighlights (lines 111–134).
 * verse_pairs is [[bomId, bibleId], ...]
 */
export async function fetchVerseHighlights(
  db: Kysely<DB>,
  verse_pairs: [number, number][],
): Promise<VerseHighlightRow[]> {
  if (!verse_pairs.length) return [];

  const bomIds = verse_pairs.map((p) => p[0]);
  const bibleIds = verse_pairs.map((p) => p[1]);

  const rows = await db
    .selectFrom('bom_data_bible')
    .selectAll()
    .where('bom_verse_id', 'in', bomIds)
    .where('bible_verse_id', 'in', bibleIds)
    .where('src', '=', 'hardy')
    .execute();

  return rows.map((row) => {
    // bom_highlight and bible_highlight are JSON columns (arrays)
    const bomHighlight = row.bom_highlight as unknown;
    const bibleHighlight = row.bible_highlight as unknown;
    return {
      bom_verse_id: row.bom_verse_id as number,
      bible_verse_id: row.bible_verse_id as number,
      bom_highlight: Array.isArray(bomHighlight) ? (bomHighlight as string[]) : null,
      bible_highlight: Array.isArray(bibleHighlight) ? (bibleHighlight as string[]) : null,
      isQuote: row.quote === 1 ? true : row.quote === 0 ? false : null,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function scripturereadLoaders(db: Kysely<DB>, lang: string, core: Loaders) {
  // Expose db so resolvers can call fetchRead/fetchLookup/fetchVerseHighlights
  return { _scripturereadDb: db };
}
