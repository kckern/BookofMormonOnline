/** scriptureextras domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
import { generateReference, type LanguageCode } from 'scripture-guide';
import { split } from 'sentence-splitter';
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import {
  type ChiasmusRow,
  type CommentaryRow,
  type ImageRow,
  reduceChiasmusLines,
} from '../../data/loaders/scriptureextras.js';

// ─── lang normalisation ────────────────────────────────────────────────────────

function toLangCode(lang: string): LanguageCode {
  const nolangs = ['eng', 'en', 'dev'];
  return (nolangs.includes(lang) ? 'en' : lang) as LanguageCode;
}

// ─── Commentary.preview ───────────────────────────────────────────────────────

function buildPreview(text: string, isNote: number): string | null {
  if ([-1, 1].includes(isNote)) {
    return text.replace(/(<([^>]+)>)/gi, '');
  }

  const stripped = text
    .replace(/(<([^>]+)>)/gi, '')
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = split(stripped)
    .map((x) => x.raw)
    .filter((x) => {
      if (/[()]/.test(x)) return false;
      if (/[\[\]]/.test(x)) return false;
      if (/p\.\s*\d+/.test(x)) return false;
      if (x.split(';').length > 2) return false;
      return true;
    })
    .join('')
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
    chiasmus_id: (parent) => (parent as unknown as ChiasmusRow).chiasmus_id ?? null,
    reference:   (parent) => (parent as unknown as ChiasmusRow).reference ?? null,
    scheme:      (parent) => (parent as unknown as ChiasmusRow).scheme ?? null,
    title:       (parent) => (parent as unknown as ChiasmusRow).title ?? null,

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
      // title field: not selected in passagenotes query; is selected in commentary query
      // For passagenotes where preview may be null-stripped (is_note=0 but text too short)
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

    objects: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;

      const textGuids = await ctx.loaders.fetchTextGuidsForVerseIds(verseIds);

      const [fromVerseIds, ...fromTextGuids] = await Promise.all([
        ctx.loaders.loadObjectsFromVerseIds(verseIds),
        ...textGuids.map((guid) => ctx.loaders.loadObjectsFromTextGuid(guid)),
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

      // Legacy passagenotes reduce:
      //   reference = generateReference([item.verse_id], lang) — only first matched line's verse_id
      //   scheme = item.line_key — only first matched line_key
      //   title = item.getDataValue('title') — first matched line's title
      // We do NOT need allLines here — only what the first matched line provides.
      const seen = new Set<string>();
      const result: {
        chiasmus_id: string;
        reference: string;
        scheme: string;
        title: string | null;
        lines: never[];
      }[] = [];

      for (const line of matchedLines) {
        const cid = line.chiasmus_id;
        if (!cid || seen.has(cid)) continue;
        seen.add(cid);

        const refVerseId = line.verse_id ?? 0;
        result.push({
          chiasmus_id: cid,
          reference: generateReference([refVerseId], langCode),
          scheme: line.line_key ?? '',
          title: line.title ?? null,
          lines: [],
        });
      }

      return result as unknown as never[];
    },

    refs: async (parent) => {
      const { verseIds, ctx } = parent as unknown as PassageNotesCtx;
      const rows = await ctx.loaders.fetchRefsForVerseIds(verseIds);
      return rows as unknown as never[];
    },
  },
};
