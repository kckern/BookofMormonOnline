/** mediamisc domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import type {
  FaxRow,
  FaxIndexPageRow,
  TimelineRow,
  MarkdownRow,
  TextSlimRow,
} from '../../data/loaders/mediamisc.js';

/** getSlugTip: incoming slug args may be paths — take the last segment. */
function getSlugTip(slug: string): string {
  return slug.split('/').pop() ?? slug;
}

const translated = async (
  ctx: AppContext,
  guid: string,
  refkey: string,
  base: string | null,
): Promise<string | null> => (await ctx.loaders.translation.load({ guid, refkey })) ?? base;

export const mediamiscResolvers: Resolvers = {
  Query: {
    /**
     * fax(filter: String): [Fax]
     *
     * filter='pdf' → where com=0, hide=0, lang=<req lang>
     * anything else (incl. absent or 'printer') → where fax=1, lang=<req lang>
     * If no rows and lang≠en, fall back to lang='en' (both rows and titles).
     *
     * The filter arg is NOT a slug — it's a mode ('pdf' vs anything else).
     * Titles/info are NOT translated for the fallback (en rows stay English).
     */
    fax: (_root, args, ctx) => {
      const c = ctx as AppContext;
      const filter = (args.filter as string | null | undefined) ?? '';
      return c.loaders.faxByFilter.load(filter) as any;
    },

    /**
     * faxIndex(slug: String): FaxIndex
     *
     * Returns { slug, pages: [[first_verse_id, verse_count, ?1], ...] }
     * where the optional 1 at index 2 indicates the first verse starts the page
     * content (not shared with the previous page).
     */
    faxIndex: async (_root, args, ctx) => {
      const c = ctx as AppContext;
      const slug = args.slug ? getSlugTip(String(args.slug)) : '';
      if (!slug) return null;
      const items: FaxIndexPageRow[] = await c.loaders.faxIndexBySlug.load(slug);
      return {
        slug,
        pages: items.map((x, i) => {
          const prev = items[i - 1];
          const firstWholeVerseIsFirstContent =
            !prev || prev.last_verse_id !== x.first_verse_id;
          const vals: number[] = [
            Number(x.first_verse_id),
            Number(x.verse_count),
          ];
          if (firstWholeVerseIsFirstContent) vals.push(1);
          return vals;
        }),
      };
    },

    /**
     * timeline(slug?: [String]): [Event]
     *
     * Returns all timeline events ordered by y (legacy ORDER BY ['y']).
     * Slug arg is currently supported by legacy but the suite only tests all.
     * text field is resolved lazily via a field resolver.
     */
    timeline: async (_root, _args, ctx) => {
      const c = ctx as AppContext;
      const rows: TimelineRow[] = await c.loaders.allTimeline.load('all');
      return rows as any;
    },

    /**
     * markdown(slug?: [String]): [Markdown]
     *
     * With slug arg: fetches only those slugs (translated via bom_translation).
     * Without slug arg: returns all markdown rows (untranslated — legacy did
     * not pass lang to includeTranslation in the no-arg branch).
     */
    markdown: async (_root, args, ctx) => {
      const c = ctx as AppContext;
      if (args.slug && (args.slug as (string | null)[]).some((s) => s !== null)) {
        const slugs = (args.slug as (string | null)[])
          .filter((s): s is string => s !== null)
          .map(getSlugTip);
        if (!slugs.length) return [];
        return c.loaders.markdownBySlugs(slugs) as any;
      }
      // No arg: return all (no slug filter)
      return c.loaders.markdownBySlugs([]) as any;
    },
  },

  // ── Fax field resolvers ───────────────────────────────────────────────────

  Fax: {
    /**
     * title/info: translated via bom_translation keyed by fax slug (PK).
     *
     * IMPORTANT: when the fax rows were fetched with the en-fallback path
     * (lang was non-en but no rows exist for that lang), the titles come from
     * the English DB columns and should NOT be translated back through the
     * request lang — the ko baseline pins English titles for all fax items.
     * The translation loader returns null for ko (no ko translations exist for
     * fax), so `?? base` falls back to the English base string. This means the
     * translation attempt is harmless: we get English either way.
     */
    title: (parent, _args, ctx) => {
      const f = parent as unknown as FaxRow;
      // Skip translation when rows were fetched with en-fallback (no ko/etc rows exist).
      if (f._noTranslation) return f.title;
      return translated(ctx as AppContext, f.slug, 'title', f.title);
    },
    info: (parent, _args, ctx) => {
      const f = parent as unknown as FaxRow;
      if (f._noTranslation) return f.info;
      return translated(ctx as AppContext, f.slug, 'info', f.info);
    },
    /**
     * index: legacy always returns ["0"] — a single-element array with the
     * string "0". This is a stub in the Fax resolver (BomNotes.ts line 462).
     */
    index: () => ['0'],
  },

  // ── Event (timeline) field resolvers ─────────────────────────────────────

  Event: {
    /**
     * p (Boolean): DB stores 0/1 as integer; cast to bool for GraphQL.
     */
    p: (parent) => {
      const t = parent as unknown as TimelineRow;
      return Boolean(t.p);
    },

    /**
     * grid: tile-grid placement for the new Timeline UI. Null until the
     * bom_timeline grid backfill is applied (grid_row IS NULL → no placement).
     */
    grid: (parent) => {
      const t = parent as unknown as TimelineRow;
      if (t.grid_row == null) return null;
      return {
        row: t.grid_row,
        col: t.grid_col,
        rowSpan: t.grid_h,
        colSpan: t.grid_w,
        bg: t.grid_bg,
        anchor: t.label_anchor ?? null,
        tier: t.grid_tier ?? null,
        dir: t.grid_dir ?? null,
        icon: t.grid_icon ?? null,
      };
    },

    /**
     * label: translated short display label for the grid tile, routed by
     * label_category — reusing existing people/place translations:
     *   people → bom_people.name, translated by slug   (refkey 'name')
     *   place  → bom_places.name, translated by guid   (refkey 'name')
     *   event  → bom_timeline.heading, translated by id (refkey 'heading')
     * Falls back to the base value (and to heading) when nothing translated.
     */
    label: async (parent, _args, ctx) => {
      const t = parent as unknown as TimelineRow;
      const c = ctx as AppContext;
      const base = t.heading;
      if (t.label_category === 'people' && t.slug) {
        const p = await c.loaders.peopleBySlug.load(t.slug);
        return (
          (await c.loaders.translation.load({ guid: t.slug, refkey: 'name' })) ??
          (p && p.name) ??
          base
        );
      }
      if (t.label_category === 'place' && t.slug) {
        const pl = await c.loaders.placesBySlugLoader.load(t.slug);
        if (pl && pl.guid) {
          return (
            (await c.loaders.translation.load({ guid: pl.guid, refkey: 'name' })) ??
            pl.name ??
            base
          );
        }
        return (pl && pl.name) ?? base;
      }
      // event (or uncategorized) → translated heading, keyed by the row id
      return (await c.loaders.translation.load({ guid: t.id, refkey: 'heading' })) ?? base;
    },

    /**
     * text: resolves the bom_text row referenced by bom_timeline.reference.
     * When reference is empty, no text exists → return null.
     * The slug field on the returned TextBlock is resolved by the core
     * TextBlock.slug resolver (page slug + "/" + link).
     */
    text: async (parent, _args, ctx) => {
      const t = parent as unknown as TimelineRow;
      if (!t.reference) return null;
      const c = ctx as AppContext;
      const textRow: TextSlimRow | null = await c.loaders.textSlimByGuid.load(t.reference);
      if (!textRow) return null;
      // Return a minimal TextRow-compatible object with just enough fields for
      // slug resolution. The core TextBlock.slug resolver uses page + link.
      return {
        guid: textRow.guid,
        page: textRow.page,
        link: textRow.link,
        parent: null,
        heading: null,
        content: null,
        chrono: null,
        duration: null,
      } as any;
    },
  },

  // ── Markdown field resolvers ──────────────────────────────────────────────

  Markdown: {
    /**
     * markdown: translated via bom_translation keyed by markdown guid.
     * Legacy uses translatedValue(item, 'markdown') with the request lang.
     */
    markdown: (parent, _args, ctx) => {
      const m = parent as unknown as MarkdownRow;
      return translated(ctx as AppContext, m.guid, 'markdown', m.markdown);
    },
  },
};
