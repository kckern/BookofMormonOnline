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
import { getPageProgress } from './resolvers/../../data/loaders/ported_user.js';
import { scriptureResolvers } from './resolvers/scripture.js';
import { scripturereadResolvers } from './resolvers/scriptureread.js';
import { scriptureextrasResolvers } from './resolvers/scriptureextras.js';
import { peopleplacesResolvers } from './resolvers/peopleplaces.js';
import { mapsResolvers } from './resolvers/maps.js';
import { mattersResolvers } from './resolvers/matters.js';
import { mediaResolvers } from './resolvers/media.js';
import { mediamiscResolvers } from './resolvers/mediamisc.js';
import { feedsmiscResolvers } from './resolvers/feedsmisc.js';
import { searchhistResolvers } from './resolvers/searchhist.js';
import { communityResolvers } from './resolvers/community.js';
import { homesamplerResolvers } from './resolvers/homesampler.js';
import { messengerResolvers } from './resolvers/messenger.js';
import { userauthResolvers } from './resolvers/userauth.js';
import { userprofileResolvers } from './resolvers/userprofile.js';
import { useractivityResolvers } from './resolvers/useractivity.js';
// Ported legacy resolvers that were declared in the SDL but unimplemented
// (audit: docs/audits/2026-06-11-missing-graphql-resolvers.md).
import { portedUserResolvers } from './resolvers/ported_user.js';
import { portedCommunityResolvers } from './resolvers/ported_community.js';
import { portedMiscResolvers } from './resolvers/ported_misc.js';
import { socialsigninResolvers } from './resolvers/socialsignin.js';
import { readingplanResolvers } from './resolvers/readingplan.js';

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
 * "[<quoting text heading>] " prefix from their quote group. Some legitimate
 * title-page rows have no quote group; in that case their own heading is the
 * complete heading and must not turn the entire GraphQL response into an error.
 */
async function resolveHeading(t: TextRow, ctx: AppContext): Promise<string | null> {
  // Domain modules tag rows whose legacy path skipped heading translation
  // entirely (locations, lookup results) — raw heading, no prefix/crash rules.
  if ((t as unknown as Record<symbol, unknown>)[SKIP_HEADING_TRANSLATION]) return t.heading ?? null;
  const own = await translated(ctx, t.guid, 'heading', t.heading);
  if (own !== null && HAS_DIGIT.test(own)) return own;
  const quotingGuid = t.parent ? await ctx.loaders.quotingGuidByGroup.load(t.parent) : null;
  if (!quotingGuid) return own;
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
    // progress(token): aggregate the division's pages into one completed/started
    // score (legacy Division.progress via scoreSlugsfromUserInfo).
    progress: async (parent, args, ctx) => {
      const token = (args as { token?: string | null }).token ?? null;
      const pages = await ctx.loaders.pagesByDivision.load((parent as DivisionRow).guid);
      const slugs = await Promise.all(pages.map((p) => ctx.loaders.slugPathByLink.load(p.guid)));
      const scores = await getPageProgress(ctx.db, token, slugs.filter(Boolean));
      const count = scores.reduce((a, s) => a + (s.count || 0), 0);
      const comp = scores.reduce((a, s) => a + (s.completed_items?.length || 0), 0);
      const start = scores.reduce((a, s) => a + (s.started_items?.length || 0), 0);
      return {
        count,
        completed: count ? Math.round((comp * 1000) / count) / 10 : 0,
        started: count ? Math.round((start * 1000) / count) / 10 : 0,
        completed_items: [],
        started_items: [],
        active_items: [],
        summary: null,
      } as never;
    },
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
    // progress(token): per-page ProgressScore incl. completed/active item links
    // (powers the /user progress dots and the home Reading-Progress tile).
    progress: async (parent, args, ctx) => {
      const token = (args as { token?: string | null }).token ?? null;
      const slug = await ctx.loaders.slugPathByLink.load((parent as PageRow).guid);
      const scores = await getPageProgress(ctx.db, token, [slug]);
      return (scores[0] ?? null) as never;
    },
  },

  Section: {
    title: (parent, _args, ctx) => {
      const s = parent as SectionRow;
      return translated(ctx, s.guid, 'title', s.title);
    },
    slug: (parent, _args, ctx) => ctx.loaders.slugPathByLink.load((parent as SectionRow).guid),
    rows: (parent, _args, ctx) => ctx.loaders.rowsBySection.load((parent as SectionRow).guid),
    // sectionText: the section's text items in link order — heading + link, so
    // the /user progress dots (and the home tile) can position each item.
    sectionText: async (parent, _args, ctx) => {
      const rows = await ctx.db
        .selectFrom('bom_text')
        .select(['guid', 'heading', 'link'])
        .where('section', '=', (parent as SectionRow).guid)
        .orderBy('link', 'asc')
        .execute();
      return rows as never;
    },
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
  mattersResolvers,
  mediaResolvers,
  mediamiscResolvers,
  feedsmiscResolvers,
  searchhistResolvers,
  communityResolvers,
  homesamplerResolvers,
  messengerResolvers,
  userauthResolvers,
  userprofileResolvers,
  useractivityResolvers,
  portedUserResolvers,
  portedCommunityResolvers,
  portedMiscResolvers,
  socialsigninResolvers,
  readingplanResolvers,
);
