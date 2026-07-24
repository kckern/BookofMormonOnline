/** scriptureextras domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
import { generateReference, type LanguageCode } from 'scripture-guide';
import { sql } from 'kysely';
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import {
  type ChiasmusRow,
  type CommentaryRow,
  type ImageRow,
  reduceChiasmusLines,
  resolveChiasmusSpeakers,
} from '../../data/loaders/scriptureextras.js';

// ─── lang normalisation ────────────────────────────────────────────────────────

function toLangCode(lang: string): LanguageCode {
  const nolangs = ['eng', 'en', 'dev'];
  return (nolangs.includes(lang) ? 'en' : lang) as LanguageCode;
}

// ─── verse → reading-page index (Chiasmus.page) ─────────────────────────────────
// bom_text rows carry (min_verse_id, page); a reading page (bom_page + its
// bom_slug PG) spans from its first text row's verse to the next page's. We
// resolve a chiasm's page by the text row nearest at/below its verse, breaking
// min_verse_id ties toward the earlier-reading page (lowest weight) so the very
// first verse doesn't fall into a later page that also references it. Built once
// per process and cached.
type PageIdxEntry = { v: number; slug: string | null; title: string | null };
let pageIndexPromise: Promise<PageIdxEntry[]> | null = null;
function loadPageIndex(db: AppContext['db']): Promise<PageIdxEntry[]> {
  if (!pageIndexPromise) {
    pageIndexPromise = (async () => {
      const { rows } = await sql<{ v: number; title: string | null; weight: number; slug: string | null }>`
        SELECT t.min_verse_id AS v, p.title AS title, p.weight AS weight, s.slug AS slug
        FROM bom_text t
        JOIN bom_page p ON p.guid = t.page
        LEFT JOIN bom_slug s ON s.link = t.page AND s.type = 'PG'
        WHERE t.page IS NOT NULL AND t.min_verse_id > 0
      `.execute(db);
      const byV = new Map<number, PageIdxEntry & { weight: number }>();
      for (const r of rows) {
        const v = Number(r.v);
        const ex = byV.get(v);
        if (!ex || Number(r.weight) < ex.weight) {
          byV.set(v, { v, slug: r.slug ?? null, title: r.title ?? null, weight: Number(r.weight) });
        }
      }
      return [...byV.values()].sort((a, b) => a.v - b.v);
    })();
  }
  return pageIndexPromise;
}
function pageForVerse(idx: PageIdxEntry[], v: number): PageIdxEntry | null {
  let lo = 0, hi = idx.length - 1, ans: PageIdxEntry | null = null;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (idx[m].v <= v) { ans = idx[m]; lo = m + 1; } else hi = m - 1;
  }
  return ans;
}

// ─── verse → study page + section (title + slug) ────────────────────────────────
// Same nearest-at/below-verse resolution as the page index, but carries both the
// page (bom_page + PG slug) and the section (bom_section + SC slug) so a verse can
// show "Page ▸ Section" with study links. Built once per process and cached.
type StudyRef = { title: string | null; slug: string | null };
type StudyLocEntry = { v: number; weight: number; page: StudyRef; section: StudyRef };
let studyLocPromise: Promise<StudyLocEntry[]> | null = null;
function loadStudyLocIndex(db: AppContext['db']): Promise<StudyLocEntry[]> {
  if (!studyLocPromise) {
    studyLocPromise = (async () => {
      const { rows } = await sql<{
        v: number; weight: number;
        pageTitle: string | null; pageSlug: string | null;
        sectionTitle: string | null; sectionSlug: string | null;
      }>`
        SELECT t.min_verse_id AS v, p.weight AS weight,
               p.title AS pageTitle, ps.slug AS pageSlug,
               sec.title AS sectionTitle, ss.slug AS sectionSlug
        FROM bom_text t
        JOIN bom_page p ON p.guid = t.page
        LEFT JOIN bom_slug ps ON ps.link = t.page AND ps.type = 'PG'
        LEFT JOIN bom_section sec ON sec.guid = t.section
        LEFT JOIN bom_slug ss ON ss.link = t.section AND ss.type = 'SC'
        WHERE t.page IS NOT NULL AND t.min_verse_id > 0
      `.execute(db);
      const byV = new Map<number, StudyLocEntry>();
      for (const r of rows) {
        const v = Number(r.v);
        const weight = Number(r.weight);
        const ex = byV.get(v);
        if (!ex || weight < ex.weight) {
          byV.set(v, {
            v, weight,
            page: { title: r.pageTitle ?? null, slug: r.pageSlug ?? null },
            section: { title: r.sectionTitle ?? null, slug: r.sectionSlug ?? null },
          });
        }
      }
      return [...byV.values()].sort((a, b) => a.v - b.v);
    })();
  }
  return studyLocPromise;
}
function locForVerse(idx: StudyLocEntry[], v: number): StudyLocEntry | null {
  let lo = 0, hi = idx.length - 1, ans: StudyLocEntry | null = null;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const e = idx[m];
    if (e && e.v <= v) { ans = e; lo = m + 1; } else hi = m - 1;
  }
  return ans;
}

// ─── Commentary.preview ───────────────────────────────────────────────────────

export function buildPreview(text: string, isNote: number): string | null {
  if ([-1, 1].includes(isNote)) {
    return text.replace(/(<([^>]+)>)/gi, '');
  }

  const stripped = text
    .replace(/(<([^>]+)>)/gi, '')
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/\s+/g, ' ')
    .trim();

  // PERF: split sentences with a cheap regex, NOT the `sentence-splitter`
  // package — its split() builds a full AST (~3ms per call), and the theater
  // queue runs this over every commentary (~617 per request), so it alone cost
  // ~1.9s. A lookbehind on sentence-ending punctuation is ~240x faster and gives
  // an equivalent 50-word preview after the citation-sentence filtering.
  //
  // The boundary must not fire at abbreviation periods ("Jeffrey R.",
  // "Oct. 1999", "pp. 173"), or citation sentences fragment into pieces that
  // individually slip past the junk filters below (dangling "Elder Jeffrey R.",
  // leaked "1999, 6; or Ensign, Nov."). So: never split right after a
  // single-letter initial, and only split where an uppercase letter
  // (optionally behind an opening quote) starts the next sentence.
  const sentences = stripped
    .split(/(?<=[.!?]["”’']?)(?<!\b[A-Z]\.)\s+(?=["“‘']?[A-Z])/)
    .filter((x) => {
      if (/[()]/.test(x)) return false;
      if (/[\[\]]/.test(x)) return false;
      if (/p\.\s*\d+/.test(x)) return false;
      if (x.split(';').length > 2) return false;
      return true;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = sentences.split(' ');
  let preview = words.slice(0, 50).join(' ');
  if (words.length > 50) {
    preview = preview.trim() + '...';
  }
  return preview.replace(/\s+/g, ' ').trim() || null;
}

// ─── passagenotes arg handling ────────────────────────────────────────────────

function resolveVerseIds(args: {
  verse_ids?: (number | null)[] | null;
  start_verse_id?: number | null;
  end_verse_id?: number | null;
}): number[] {
  if (args.verse_ids && Array.isArray(args.verse_ids)) {
    return args.verse_ids.filter((v): v is number => v !== null);
  }
  if (args.start_verse_id != null && args.end_verse_id != null) {
    const start = args.start_verse_id;
    const end = args.end_verse_id;
    if (start <= end) {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
  } else if (args.start_verse_id != null) {
    return [args.start_verse_id];
  }
  return [];
}

/** Internal context object threaded through PassageNotes field resolvers. */
interface PassageNotesCtx {
  verseIds: number[];
  ctx: AppContext;
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

export const scriptureextrasResolvers: Resolvers = {
  Query: {
    /** Study page + section (title + slug) for each verse id (fax verse links). */
    faxVerseLocations: async (_root, args, ctx: AppContext) => {
      const ids = ((args.verseIds ?? []) as number[]).map(Number).filter(Number.isFinite);
      if (!ids.length) return [] as never;
      const idx = await loadStudyLocIndex(ctx.db);
      return ids.map((v) => {
        const e = locForVerse(idx, v);
        return { verse_id: v, page: e?.page ?? null, section: e?.section ?? null };
      }) as never;
    },

    /**
     * chiasmus — returns all chiasms (or filtered by id), lines resolved by
     * Chiasmus.lines field resolver.
     * Used for both `chiasmus` (no lines) and `chiasm` (with lines) query shapes.
     */
    chiasmus: async (_root, args, ctx: AppContext) => {
      const ids = (args.id ?? []).filter((s): s is string => s !== null);
      const allLines = await ctx.loaders.fetchChiasmusLines(ids.length ? ids : undefined);
      const langCode = toLangCode(ctx.lang);
      const chiasms = reduceChiasmusLines(
        allLines,
        allLines,
        (vids) => generateReference(vids, langCode),
        true,     // always populate lines array in the row object
        false,    // scheme from all lines (not passagenote single-key mode)
      );
      // Dominant speaker per chiasm — two batched selects total, no N+1.
      await resolveChiasmusSpeakers(chiasms, ctx.db);
      return chiasms as unknown as never[];
    },

    /**
     * passagenotes — returns a context object that PassageNotes field resolvers
     * use to lazily fetch each sub-type.
     */
    passagenotes: async (_root, args, ctx: AppContext) => {
      const verseIds = resolveVerseIds(args);
      if (!verseIds.length) return null;
      return { verseIds, ctx } as unknown as never;
    },
  },

  // ─── Chiasmus type resolvers ─────────────────────────────────────────────────

  Chiasmus: {
    chiasmus_id:    (parent) => (parent as unknown as ChiasmusRow).chiasmus_id ?? null,
    reference:      (parent) => (parent as unknown as ChiasmusRow).reference ?? null,
    scheme:         (parent) => (parent as unknown as ChiasmusRow).scheme ?? null,
    title:          (parent) => (parent as unknown as ChiasmusRow).title ?? null,
    start_verse_id: (parent) => (parent as unknown as ChiasmusRow).start_verse_id ?? null,
    verse_id:       (parent) => (parent as unknown as ChiasmusRow).verse_id ?? null,
    line_lengths:   (parent) => (parent as unknown as ChiasmusRow).line_lengths ?? null,
    speaker:        (parent) => ((parent as unknown as ChiasmusRow).speaker ?? null) as never,

    /** The reading page this chiasm sits on (verse → bom_text.page). */
    page: async (parent, _args, ctx: AppContext) => {
      const row = parent as unknown as ChiasmusRow;
      const v = row.verse_id ?? row.start_verse_id;
      if (v == null) return null;
      const idx = await loadPageIndex(ctx.db);
      const p = pageForVerse(idx, Number(v));
      return p && (p.slug || p.title) ? { slug: p.slug, title: p.title } : (null as never);
    },

    /**
     * Chiasmus.lines — populated by Query.chiasmus when includeLines=true.
     * The empty-array case (chiasmus query without lines selected) is fine:
     * graphql-js won't call this resolver if `lines` isn't in the selection.
     */
    lines: (parent) => {
      const p = parent as unknown as ChiasmusRow;
      return (p.lines ?? []) as unknown as never[];
    },
  },

  // ─── Commentary type resolvers ───────────────────────────────────────────────

  Commentary: {
    reference: (parent, _args, ctx: AppContext) => {
      const row = parent as unknown as CommentaryRow;
      const start = row.verse_id ?? 0;
      const end = start - 1 + (row.verse_range ?? 1);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      const langCode = toLangCode(ctx.lang);
      return generateReference(range, langCode);
    },

    preview: (parent) => {
      const row = parent as unknown as CommentaryRow;
      return buildPreview(row.text, row.is_note);
    },
  },

  // ─── Image type resolvers ────────────────────────────────────────────────────

  Image: {
    title: (parent) => {
      const row = parent as unknown as ImageRow;
      return row.title ?? null;
    },
  },

  // ─── PassageNotes type resolvers ─────────────────────────────────────────────

  PassageNotes: {
    commentary: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;
      const rows = await ctx.loaders.fetchCommentary(verseIds);
      return rows as unknown as never[];
    },

    people: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;

      // Get text_guids in integer-comparison order (legacy compat)
      const textGuids = await ctx.loaders.fetchTextGuidsForVerseIds(verseIds);

      // Legacy: [loadPeopleFromVerseIds, ...per-guid loadPeopleFromTextGuid].flat()
      const [fromVerseIds, ...fromTextGuids] = await Promise.all([
        ctx.loaders.loadPeopleFromVerseIds(verseIds),
        ...textGuids.map((guid) => ctx.loaders.loadPeopleFromTextGuid(guid)),
      ]);

      return [...fromVerseIds, ...fromTextGuids.flat()] as unknown as never[];
    },

    places: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;
      const rows = await ctx.loaders.loadPlacesFromVerseIds(verseIds);
      return rows as unknown as never[];
    },

    matters: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;

      const textGuids = await ctx.loaders.fetchTextGuidsForVerseIds(verseIds);

      const [fromVerseIds, ...fromTextGuids] = await Promise.all([
        ctx.loaders.loadMattersFromVerseIds(verseIds),
        ...textGuids.map((guid) => ctx.loaders.loadMattersFromTextGuid(guid)),
      ]);

      return [...fromVerseIds, ...fromTextGuids.flat()] as unknown as never[];
    },

    images: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;

      // Images use string verse_ids for lookup (to get distinct text_guids)
      // Legacy used its own textGuids fetch; for images, order doesn't matter
      // (sorted by id), so we can use either order.
      // Use string-IN here (same as the Sequelize images fetch):
      // BomLookup.findAll({ where: { verse_id: verse_ids } }) with integer array
      // → but since we sort by id, the textGuid order doesn't affect output.
      // Use fetchTextGuidsForVerseIds (integer) for consistency with legacy.
      const textGuids = await ctx.loaders.fetchTextGuidsForVerseIds(verseIds);
      const rows = await ctx.loaders.fetchImages(textGuids);
      return rows as unknown as never[];
    },

    chiasmus: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;

      // Fetch lines matching the verse_ids (passagenotes sub-chiasm)
      // Legacy: BomXtrasChiasmus.findAll({ where: { verse_id: verse_ids } })
      const matchedLines = await ctx.loaders.fetchChiasmusLinesForVerseIds(verseIds);
      if (!matchedLines.length) return [];

      const langCode = toLangCode(ctx.lang);

      // matchedLines only contains lines whose verse_id falls in the passage —
      // NOT every line of each chiasm. Reload ALL lines for the matched
      // chiasmus_ids so the reduce can compute the full scheme and full
      // reference span (legacy returned a single letter + single-verse ref).
      const matchedIds = [...new Set(
        matchedLines.map((l) => l.chiasmus_id).filter((c): c is string => !!c),
      )];
      if (!matchedIds.length) return [];
      const allLines = await ctx.loaders.fetchChiasmusLines(matchedIds);

      // matchedLines drives dedup + first-match ordering (unchanged semantics);
      // includeLines=false (panel doesn't need line payloads), full scheme.
      // Speakers are NOT resolved here — the panel doesn't show them.
      const result = reduceChiasmusLines(
        allLines,
        matchedLines,
        (vids) => generateReference(vids, langCode),
        false,
        false,
      );

      return result as unknown as never[];
    },

    refs: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;
      const rows = await ctx.loaders.fetchRefsForVerseIds(verseIds);
      return rows as unknown as never[];
    },
  },
};
