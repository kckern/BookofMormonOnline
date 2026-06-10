/** media domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import type { TextRow } from '../../data/loaders.js';
import type { ImageRow, CommentaryRow, SourceRow } from '../../data/loaders/media.js';
import { generateReference, type LanguageCode } from 'scripture-guide';

/**
 * Legacy compat flag: image/commentary location TextBlocks do NOT translate
 * their heading (legacy's Sequelize include for location omitted the heading
 * translation). Tag the row at the location resolver boundary; the CORE
 * TextBlock.heading resolver honors the shared symbol.
 */
import { SKIP_HEADING_TRANSLATION } from '../../data/loaders.js';

// ── lang helper (mirrors scripture.ts) ───────────────────────────────────────
function toScriptureGuideLang(lang: string): LanguageCode {
  const nolangs = ['eng', 'en', 'dev'];
  return (nolangs.includes(lang) ? 'en' : lang) as LanguageCode;
}

// ── content parsers ───────────────────────────────────────────────────────────

/** Parse [i]NNN[/i] markers from text content; return ids as strings. */
function parseImgIds(content: string | null): string[] {
  if (!content) return [];
  const matches = content.match(/\[i\](\d+)\[\/i\]/gi);
  if (!matches) return [];
  return matches.map((m) => String(parseInt(m.replace(/\D+/g, ''), 10)));
}

/**
 * Parse [c]NNN[/c] markers from text content.
 * Legacy returns null (not []) when no matches — preserve that so null-stripping
 * removes the field from the output when absent.
 */
function parseComIds(content: string | null): string[] | null {
  if (!content) return null;
  const matches = content.match(/\[c\](\d+)\[\/c\]/gi);
  if (!matches) return null;
  return matches.map((m) => String(parseInt(m.replace(/\D+/g, ''), 10)));
}

export const mediaResolvers: Resolvers = {
  Query: {
    // image(id: [String]): [Image]
    // Returns null if no id arg (matches legacy: `if ('id' in args) ... return null`).
    // The missing case (integer arg) triggers GraphQL schema-validation before resolver.
    image: (_root, args, ctx) => {
      if (!args.id) return null;
      const ids = (args.id as string[]).filter(Boolean);
      const numIds = ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));
      if (!numIds.length) return [];
      const c = ctx as AppContext;
      return Promise.all(numIds.map((id) => c.loaders.imageById.load(id)))
        .then((rows) => rows.filter((r): r is ImageRow => r !== null)) as any;
    },

    // commentary(id: [String]): [Commentary]
    commentary: (_root, args, ctx) => {
      if (!args.id) return null;
      const ids = (args.id as string[]).filter(Boolean);
      const numIds = ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));
      if (!numIds.length) return [];
      const c = ctx as AppContext;
      return Promise.all(numIds.map((id) => c.loaders.commentaryById.load(id)))
        .then((rows) => rows.filter((r): r is CommentaryRow => r !== null)) as any;
    },

    // publications: [Source] — filtered by request lang
    publications: (_root, _args, ctx) => {
      const c = ctx as AppContext;
      return c.loaders.publicationsByLang.load(c.lang) as any;
    },
  },

  // ── Image field resolvers ─────────────────────────────────────────────────
  Image: {
    id: (parent) => String((parent as any as ImageRow).id),
    title: async (parent, _args, ctx) => {
      const img = parent as any as ImageRow;
      const c = ctx as AppContext;
      const translated = await c.loaders.translation.load({
        guid: String(img.id),
        refkey: 'title',
      });
      return translated ?? img.title;
    },
    artist: (parent) => (parent as any as ImageRow).artist || null,
    link: (parent) => (parent as any as ImageRow).link || null,
    width: (parent) => (parent as any as ImageRow).width,
    height: (parent) => (parent as any as ImageRow).height,
    file: (parent) => (parent as any as ImageRow).file || null,
    location: (parent, _args, ctx) => {
      const guid = (parent as any as ImageRow).location_guid;
      if (!guid || guid === 'NULL') return null;
      const c = ctx as AppContext;
      return c.loaders.textByGuid.load(guid).then(
        (row) => row ? { ...row, [SKIP_HEADING_TRANSLATION]: true } : null
      ) as any;
    },
  },

  // ── Commentary field resolvers ────────────────────────────────────────────
  Commentary: {
    id: (parent) => String((parent as any as CommentaryRow).id),
    title: (parent) => (parent as any as CommentaryRow).title ?? null,
    text: (parent) => (parent as any as CommentaryRow).text ?? null,
    verse_id: (parent) => {
      const v = (parent as any as CommentaryRow).verse_id;
      return v !== null && v !== undefined ? String(v) : null;
    },
    verse_range: (parent) => String((parent as any as CommentaryRow).verse_range),
    reference: (parent, _args, ctx) => {
      const com = parent as any as CommentaryRow;
      const start = Number(com.verse_id);
      if (!start) return null;
      const range_count = Number(com.verse_range) || 1;
      const end = start + range_count - 1;
      const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      const langCode = toScriptureGuideLang((ctx as AppContext).lang);
      return generateReference(ids, langCode);
    },
    publication: (parent, _args, ctx) => {
      const com = parent as any as CommentaryRow;
      const sourceId = parseInt(com.source, 10);
      if (isNaN(sourceId)) return null;
      return (ctx as AppContext).loaders.sourceById.load(sourceId) as any;
    },
    location: (parent, _args, ctx) => {
      const guid = (parent as any as CommentaryRow).location_guid;
      if (!guid || guid === 'NULL') return null;
      const c = ctx as AppContext;
      return c.loaders.textByGuid.load(guid).then(
        (row) => row ? { ...row, [SKIP_HEADING_TRANSLATION]: true } : null
      ) as any;
    },
  },

  // ── Source field resolvers ────────────────────────────────────────────────
  Source: {
    source_id: (parent) => String((parent as any as SourceRow).source_id),
    source_rating: (parent) => (parent as any as SourceRow).source_rating ?? null,
    source_title: (parent) => (parent as any as SourceRow).source_title ?? null,
    source_name: (parent) => (parent as any as SourceRow).source_name ?? null,
    source_short: (parent) => (parent as any as SourceRow).source_short ?? null,
    source_slug: (parent) => (parent as any as SourceRow).source_slug ?? null,
    source_url: (parent) => (parent as any as SourceRow).source_url ?? null,
    source_description: (parent) => (parent as any as SourceRow).source_description ?? null,
    source_publisher: (parent) => (parent as any as SourceRow).source_publisher ?? null,
    source_year: (parent) => (parent as any as SourceRow).source_year ?? null,
    excerpt: (parent) => {
      const e = (parent as any as SourceRow).excerpt;
      return e !== null && e !== undefined ? String(e) : null;
    },
  },

  // ── TextBlock field resolvers (media-needed additions) ────────────────────
  // Extend the TextBlock block already in coreResolvers (resolvers.ts) with
  // the fields needed for image/commentary location trees. heading stays in
  // core — location rows carry SKIP_HEADING_TRANSLATION, honored there.
  TextBlock: {
    parent_page: (parent, _args, ctx) => {
      const t = parent as TextRow;
      if (!t.page) return null;
      return (ctx as AppContext).loaders.pageByGuid.load(t.page) as any;
    },
    parent_section: (parent, _args, ctx) => {
      const section = (parent as any).section as string | null;
      if (!section) return null;
      return (ctx as AppContext).loaders.sectionByGuid.load(section) as any;
    },
    narration: (parent, _args, ctx) => {
      const t = parent as TextRow;
      if (!t.parent) return null;
      return (ctx as AppContext).loaders.narrationByGuid.load(t.parent) as any;
    },
    imgIds: (parent) => {
      return parseImgIds((parent as TextRow).content);
    },
    comIds: (parent) => {
      return parseComIds((parent as TextRow).content);
    },
  },
};
