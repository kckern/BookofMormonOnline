/**
 * Field-level resolvers backed by per-request DataLoaders: GraphQL executes
 * only the selected fields, so unrequested branches are never queried, and
 * each tree edge batches into one query per request (no N+1).
 *
 * Resolvers stay thin: parent rows come from repositories/loaders; the only
 * logic here is field mapping plus documented legacy-compat rules.
 */
import type { Resolvers } from '../../codegen/graphql.js';
import type { AppContext } from './context.js';
import { scriptureResolvers } from './resolvers/scripture.js';
import { scripturereadResolvers } from './resolvers/scriptureread.js';
import { scriptureextrasResolvers } from './resolvers/scriptureextras.js';
import { peopleplacesResolvers } from './resolvers/peopleplaces.js';
import { mapsResolvers } from './resolvers/maps.js';
import { objectsResolvers } from './resolvers/objects.js';
import { mediaResolvers } from './resolvers/media.js';
import { mediamiscResolvers } from './resolvers/mediamisc.js';
import { feedsmiscResolvers } from './resolvers/feedsmisc.js';
import { searchhistResolvers } from './resolvers/searchhist.js';
import { communityResolvers } from './resolvers/community.js';
import { messengerResolvers } from './resolvers/messenger.js';
import { userauthResolvers } from './resolvers/userauth.js';
import { userprofileResolvers } from './resolvers/userprofile.js';
import { useractivityResolvers } from './resolvers/useractivity.js';

/** Shallow per-type merge: each domain contributes whole type maps; Query fields union. */
function mergeResolverMaps(...maps: Resolvers[]): Resolvers {
  const out: Record<string, Record<string, unknown>> = {};
  for (const map of maps) {
    for (const [typeName, fields] of Object.entries(map as Record<string, Record<string, unknown>>)) {
      out[typeName] = { ...(out[typeName] ?? {}), ...fields };
    }
  }
  return out as Resolvers;
}
import {
  SKIP_HEADING_TRANSLATION,
  type CapsulationRow,
  type ConnectionRow,
  type NarrationRow,
  type PageRow,
  type SectionRow,
  type SectionrowRow,
  type TextRow,
} from '../data/loaders.js';
import type { DivisionRow } from '../data/contentsRepository.js';

const HAS_DIGIT = /[0-9]/;

const translated = async (
  ctx: AppContext,
  guid: string,
  refkey: string,
  base: string | null,
): Promise<string | null> => (await ctx.loaders.translation.load({ guid, refkey })) ?? base;

/**
 * Legacy TextBlock.heading rule (BomPage.ts:518-553): digitless headings get a
 * "[<quoting text heading>] " prefix from their quote group; when no group
 * exists, legacy CRASHES per-field — the baselines pin the (lang-dependent)
 * error message and null heading, so the crash is replicated. COMPAT.
 */
async function resolveHeading(t: TextRow, ctx: AppContext): Promise<string | null> {
  // Domain modules tag rows whose legacy path skipped heading translation
  // entirely (locations, lookup results) — raw heading, no prefix/crash rules.
  if ((t as unknown as Record<symbol, unknown>)[SKIP_HEADING_TRANSLATION]) return t.heading ?? null;
  const own = await translated(ctx, t.guid, 'heading', t.heading);
  if (own !== null && HAS_DIGIT.test(own)) return own;
  const quotingGuid = t.parent ? await ctx.loaders.quotingGuidByGroup.load(t.parent) : null;
  if (!quotingGuid) {
    const prop = ctx.lang && ctx.lang !== 'en' ? 'textParent.guid' : 'textParent.heading';
    throw new Error(`Cannot read properties of null (reading '${prop}')`);
  }
  const base = await ctx.loaders.textHeadingByGuid.load(quotingGuid);
  const prefix =
    ctx.lang && ctx.lang !== 'en'
      ? ((await ctx.loaders.translation.load({ guid: quotingGuid, refkey: 'heading' })) ?? base)
      : base;
  return `[${prefix}] ${own}`;
}

const coreResolvers: Resolvers = {
  Query: {
    labels: (_root, _args, ctx) => ctx.services.labels.list(),
    division: (_root, args, ctx) =>
      ctx.services.contents.divisions(args.slug?.filter((s): s is string => s !== null) ?? null),
    page: (_root, args, ctx) =>
      ctx.services.pages.bySlugs(args.slug?.filter((s): s is string => s !== null) ?? null),
  },

  Division: {
    title: async (parent, _args, ctx) => {
      const d = parent as DivisionRow;
      const titlepage = await ctx.loaders.pageByGuid.load(d.page);
      return titlepage ? translated(ctx, titlepage.guid, 'title', titlepage.title) : null;
    },
    slug: (parent, _args, ctx) => ctx.loaders.slugPathByLink.load((parent as DivisionRow).page),
    description: (parent, _args, ctx) => {
      const d = parent as DivisionRow;
      return translated(ctx, d.guid, 'description', d.description);
    },
    pages: async (parent, _args, ctx) =>
      (await ctx.loaders.pagesByDivision.load((parent as DivisionRow).guid)).map((p) => ({
        ...p,
        sectionOrder: 'textlink' as const,
      })),
  },

  Page: {
    title: (parent, _args, ctx) => {
      const p = parent as PageRow;
      return translated(ctx, p.guid, 'title', p.title);
    },
    slug: (parent, _args, ctx) => ctx.loaders.slugPathByLink.load((parent as PageRow).guid),
    sections: async (parent, _args, ctx) => {
      const p = parent as PageRow;
      const sections = await ctx.loaders.sectionsByPage.load(p.guid);
      if (p.sectionOrder !== 'textlink') return sections; // page query: weight order
      // division tree: first-text-link order; textless sections lead (legacy
      // LEFT JOIN sorted their NULL link first)
      const { sectionOrder } = await ctx.loaders.textAggByPage.load(p.guid);
      const rank = new Map(sectionOrder.map((g, i) => [g, i]));
      const textless = sections.filter((s) => !rank.has(s.guid));
      const ordered = [...sections.filter((s) => rank.has(s.guid))].sort(
        (a, b) => (rank.get(a.guid) ?? 0) - (rank.get(b.guid) ?? 0),
      );
      return [...textless, ...ordered];
    },
    counts: (parent, _args, ctx) =>
      ctx.loaders.textAggByPage.load((parent as PageRow).guid).then((a) => a.counts),
  },

  Section: {
    title: (parent, _args, ctx) => {
      const s = parent as SectionRow;
      return translated(ctx, s.guid, 'title', s.title);
    },
    slug: (parent, _args, ctx) => ctx.loaders.slugPathByLink.load((parent as SectionRow).guid),
    rows: (parent, _args, ctx) => ctx.loaders.rowsBySection.load((parent as SectionRow).guid),
  },

  Row: {
    // Row.type gates children exactly like legacy (N/C/O).
    narration: (parent, _args, ctx) => {
      const r = parent as SectionrowRow;
      return r.type === 'N' ? ctx.loaders.narrationByRow.load(r.guid) : null;
    },
    connection: (parent, _args, ctx) => {
      const r = parent as SectionrowRow;
      return r.type === 'C' ? ctx.loaders.connectionByRow.load(r.guid) : null;
    },
    capsulation: (parent, _args, ctx) => {
      const r = parent as SectionrowRow;
      return r.type === 'O' ? ctx.loaders.capsulationByRow.load(r.guid) : null;
    },
  },

  Narration: {
    description: (parent, _args, ctx) => {
      const n = parent as NarrationRow;
      return translated(ctx, n.guid, 'description', n.description);
    },
    text: (parent, _args, ctx) => ctx.loaders.textByNarration.load((parent as NarrationRow).guid),
  },

  Conn: {
    isPage: () => null, // no column/resolver in legacy → stripped
    text: (parent, _args, ctx) => {
      const c = parent as ConnectionRow;
      return translated(ctx, c.guid, 'text', c.text);
    },
    link: (parent, _args, ctx) => ctx.loaders.slugPathByGuid.load((parent as ConnectionRow).link),
    slug: (parent, _args, ctx) => ctx.loaders.slugPathByGuid.load((parent as ConnectionRow).link),
  },

  Caps: {
    description: (parent, _args, ctx) => {
      const c = parent as CapsulationRow;
      return translated(ctx, c.guid, 'description', c.description);
    },
    reference: (parent, _args, ctx) => {
      const c = parent as CapsulationRow;
      return translated(ctx, c.guid, 'reference', c.reference);
    },
    slug: (parent, _args, ctx) => ctx.loaders.slugPathByGuid.load((parent as CapsulationRow).link),
  },

  TextBlock: {
    slug: async (parent, _args, ctx) => {
      const t = parent as TextRow;
      if (!t.page) return null;
      const path = await ctx.loaders.slugPathByLink.load(t.page);
      return path ? `${path}/${t.link}` : null;
    },
    heading: (parent, _args, ctx) => resolveHeading(parent as TextRow, ctx),
    content: (parent, _args, ctx) => {
      const t = parent as TextRow;
      return translated(ctx, t.guid, 'content', t.content);
    },
    quotes: (parent, _args, ctx) => ctx.loaders.quotesByText.load((parent as TextRow).guid),
    people: (parent, _args, ctx) => {
      const t = parent as TextRow;
      return ctx.loaders.peopleByText.load({ guid: t.guid, narrationGuid: t.parent });
    },
    places: (parent, _args, ctx) => {
      const t = parent as TextRow;
      return ctx.loaders.placesByText.load({ guid: t.guid, narrationGuid: t.parent });
    },
    refs: (parent, _args, ctx) => ctx.loaders.refsByText.load((parent as TextRow).guid),
    // English-only by legacy design (BomPage.ts:767-771)
    notes: (parent, _args, ctx) =>
      ctx.lang && ctx.lang !== 'en' ? [] : ctx.loaders.notesByText.load((parent as TextRow).guid),
  },

  People: {
    // bom_people's PK is slug, so its translation rows key on the SLUG
    // (legacy hasMany defaulted foreignKey 'guid' → source PK).
    name: (parent, _args, ctx) => {
      const p = parent as { slug: string; name: string | null };
      return translated(ctx, p.slug, 'name', p.name);
    },
    title: (parent, _args, ctx) => {
      const p = parent as { slug: string; title: string | null };
      return translated(ctx, p.slug, 'title', p.title);
    },
  },

  Place: {
    name: (parent, _args, ctx) => {
      const p = parent as { guid: string | null; slug: string; name: string | null };
      return p.guid ? translated(ctx, p.guid, 'name', p.name) : (p.name ?? null);
    },
    info: (parent, _args, ctx) => {
      const p = parent as { guid: string | null; slug: string; info: string | null };
      return p.guid ? translated(ctx, p.guid, 'info', p.info) : (p.info ?? null);
    },
  },
};

export const resolvers: Resolvers = mergeResolverMaps(
  coreResolvers,
  scriptureResolvers,
  scripturereadResolvers,
  scriptureextrasResolvers,
  peopleplacesResolvers,
  mapsResolvers,
  objectsResolvers,
  mediaResolvers,
  mediamiscResolvers,
  feedsmiscResolvers,
  searchhistResolvers,
  communityResolvers,
  messengerResolvers,
  userauthResolvers,
  userprofileResolvers,
  useractivityResolvers,
);
