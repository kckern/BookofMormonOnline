/**
 * homesampler — aggregate seeded random samples for the /home sampler page.
 * Design: docs/plans/2026-07-15-home-sampler-redesign-design.md
 *
 * Determinism: ORDER BY MD5(CONCAT(<pk>, ':', <seed>)) — stable for a given
 * seed regardless of storage-engine scan order (unlike seeded RAND()).
 *
 * Extensibility: add a field to schema/HomeSampler.graphql, a sampler here,
 * run codegen — nothing else changes.
 */
import { sql } from 'kysely';
import { generateReference } from 'scripture-guide';
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';

// 24 people = 1 featured + 11 face cards + 12 view-all mosaic thumbs (3×4);
// 17 places = 5 cards + a full 3×4 mosaic.
const PEOPLE_COUNT = 24;
const PLACES_COUNT = 17;
const MIN_COMMENTARY_CHARS = 500;
const MIN_PERSON_DESC_CHARS = 40;

const seededOrder = (column: string, seed: number) =>
  sql`MD5(CONCAT(${sql.ref(column)}, ':', ${seed}))`;

const samplePeople = (ctx: AppContext, seed: number) =>
  ctx.db
    .selectFrom('bom_people')
    .select([
      'slug', 'guid', 'name', 'title', 'classification', 'identification',
      'unit', 'date', 'description', 'weight',
    ])
    .where('description', 'is not', null)
    .where(sql<boolean>`CHAR_LENGTH(description) > ${MIN_PERSON_DESC_CHARS}`)
    .orderBy(seededOrder('slug', seed))
    .limit(PEOPLE_COUNT)
    .execute();

const samplePlaces = (ctx: AppContext, seed: number) =>
  ctx.db
    .selectFrom('bom_places')
    .selectAll()
    .where('name', 'is not', null)
    .orderBy(seededOrder('slug', seed))
    .limit(PLACES_COUNT)
    .execute();

const sampleFax = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.loaders.faxByFilter.load('');
  // ANY facsimile we hold with page images — not just the verse-indexed ones.
  // Pages carry scripture refs only for indexed editions (sampleFaxPages
  // degrades gracefully for the rest).
  // ROBUSTNESS: the loader's order is weight-only with no tiebreak and is NOT
  // stable across calls; sort by slug so the modulo pick is deterministic.
  const sorted = rows
    .filter((r) => !r.hide && Number(r.pages) > 0)
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  return sorted.length ? sorted[seed % sorted.length] : null;
};

// Two seeded pages OF THE SAMPLED FAX. For verse-indexed editions the pages
// carry a scripture reference; for the rest we show representative
// mid-document pages with no ref (the edition may simply not be indexed).
const sampleFaxPages = async (ctx: AppContext, seed: number) => {
  const fax = (await sampleFax(ctx, seed)) as { slug?: string; pages?: number } | null;
  if (!fax?.slug) return [];
  const rows = await ctx.db
    .selectFrom('bom_xtras_fax_index')
    .select(({ fn }) => ['page', fn.min<string>('verse_id').as('firstVerse')])
    .where('version', '=', String(fax.slug))
    .groupBy('page')
    .orderBy('page')
    .execute();
  if (rows.length) {
    const start = seed % rows.length;
    const picks = [rows[start], rows[(start + 1) % rows.length]]
      .filter((r, i, a) => r && a.findIndex((x) => x?.page === r.page) === i);
    return picks.map((r) => ({
      page: Number(r!.page),
      ref: generateReference([Number(r!.firstVerse)]),
    }));
  }
  // Un-indexed edition: two mid-document pages so the tile still shows content.
  const total = Number(fax.pages) || 0;
  if (total < 2) return [];
  const mid = Math.min(total - 1, Math.max(2, Math.floor(total * 0.4) + (seed % 7)));
  const pages = [mid, Math.min(total, mid + 1)].filter((v, i, a) => a.indexOf(v) === i);
  return pages.map((p) => ({ page: p, ref: null }));
};

// A few OTHER editions (beyond the sampled one) — the fax tile lists them as
// entry points so the sampler reads as "we hold a collection". Draws from the
// FULL catalog (any edition we have on file with a cover), not just the handful
// with page scans — the faxByFilter loader is fax=1 only, so query directly.
const sampleFaxMore = async (ctx: AppContext, seed: number) => {
  const current = (await sampleFax(ctx, seed)) as { slug?: string } | null;
  const rows = await ctx.db
    .selectFrom('bom_xtras_fax')
    .select(['slug', 'title', 'pages'])
    .where('hide', '=', 0)
    .where('lang', '=', 'en')
    .where('slug', 'is not', null)
    .where(sql<boolean>`pages > 0`) // real editions with scans/covers
    .orderBy(seededOrder('slug', seed))
    .execute();
  // a small RANDOM sample of other editions (the tile is a sampler, not the
  // whole /fax catalog) — four covers alongside the featured edition's pages
  return rows
    .filter((r) => String(r.slug) !== String(current?.slug))
    .slice(0, 4)
    .map((r) => ({ slug: r.slug, title: r.title, pages: Number(r.pages) || null }));
};

// Standalone artwork for image tiles — landscape-ish pieces read best in a
// tile, so prefer wider-than-tall; carry title/artist for the caption.
const sampleArt = async (ctx: AppContext, seed: number) => {
  // JOIN the piece's location to bom_text so we can show the scripture it
  // illustrates (heading) and deep-link into that passage.
  const rows = await ctx.db
    .selectFrom('bom_xtras_image')
    .leftJoin('bom_text', 'bom_text.guid', 'bom_xtras_image.location_guid')
    .select([
      'bom_xtras_image.id as id',
      'bom_xtras_image.title as title',
      'bom_xtras_image.artist as artist',
      'bom_xtras_image.width as width',
      'bom_xtras_image.height as height',
      'bom_text.heading as ref',
    ])
    .where('bom_xtras_image.file', 'is not', null)
    .where(sql<boolean>`bom_xtras_image.width > 0 AND bom_xtras_image.height > 0`)
    .orderBy(seededOrder('bom_xtras_image.id', seed))
    .limit(8)
    .execute();
  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title || null,
    artist: r.artist || null,
    width: Number(r.width) || null,
    height: Number(r.height) || null,
    ref: r.ref || null,
  }));
};

// Book of Mormon witness statements (Harris, Cowdery, the Whitmers, the Three
// Witnesses…) from the 'witnesses' history archive. Returns the principal, a
// short statement, and a source line. No portrait assets exist for these
// figures, so the tile renders a monogram — see docs if that changes.
// principal → the Witnesses-view slug (portraits live at
// /history/witnesses/people/<slug>.jpg, deep link at /history/witnesses/<slug>)
const WITNESS_SLUG: Record<string, string> = {
  'Martin Harris': 'martin-harris',
  'Oliver Cowdery': 'oliver-cowdery',
  'David Whitmer': 'david-whitmer',
  'John Whitmer': 'john-whitmer',
  'Hyrum Smith': 'hyrum-smith',
  'Samuel H. Smith': 'samuel-smith',
};
const WITNESS_PRINCIPALS = Object.keys(WITNESS_SLUG);
const sampleWitnesses = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_xtras_history')
    .select(['slug', 'principal', 'author', 'citation', 'teaser', 'transcript', 'metadata'])
    .where('archive', '=', 'witnesses')
    .where('principal', 'in', WITNESS_PRINCIPALS)
    .where(sql<boolean>`(CHAR_LENGTH(teaser) > 20 OR CHAR_LENGTH(transcript) > 40)`)
    .orderBy(seededOrder('slug', seed))
    .limit(40)
    .execute();
  // one statement per principal → variety, not three Whitmers in a row
  const byPrincipal = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!byPrincipal.has(String(r.principal))) byPrincipal.set(String(r.principal), r);
  }
  return [...byPrincipal.values()].slice(0, 3).map((r) => {
    let reference: string | null = null;
    try {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata as Record<string, unknown> | null);
      reference = (meta?.reference as string) || null;
    } catch { /* metadata may be absent/invalid */ }
    return {
      slug: r.slug,
      witnessSlug: WITNESS_SLUG[String(r.principal)] || null,
      principal: r.principal,
      statement: r.teaser || r.transcript || null,
      source: reference || r.citation || r.author || null,
    };
  });
};

const countRows = (table: 'bom_people' | 'bom_places') => async (ctx: AppContext) => {
  const r = await ctx.db
    .selectFrom(table)
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .executeTakeFirst();
  return Number(r?.n ?? 0);
};

// Three commentaries per page, guaranteed VARIETY: distinct sources and
// non-overlapping passages (seeded pool of 30, first 3 that qualify).
// ROBUSTNESS: filter on CHAR_LENGTH(text) — the exact measure the test asserts
// (text.length > 500) — rather than the stored `length` column. Sources are
// restricted to the request language and to G-rated publications (R-rated
// sources exist for the research views, not the front door).
// ctx.lang mirrors the endpoint path (/en, /fr…); non-language paths like
// /graphql or /dev must not silently filter out every source.
const sampleCommentaries = async (ctx: AppContext, seed: number) => {
  const lang = !ctx.lang || !/^[a-z]{2,3}$/.test(ctx.lang) || ctx.lang === 'dev' ? 'en' : ctx.lang;
  const rows = await ctx.db
    .selectFrom('bom_xtras_commentary')
    .innerJoin('bom_xtras_source', 'bom_xtras_source.source_id', 'bom_xtras_commentary.source')
    .selectAll('bom_xtras_commentary')
    // one author can publish under several source_ids (e.g. Royal Skousen) —
    // variety means distinct AUTHORS, so carry source_name into the dedupe
    .select('bom_xtras_source.source_name as _author')
    .where(sql<boolean>`CHAR_LENGTH(bom_xtras_commentary.text) > ${MIN_COMMENTARY_CHARS}`)
    .where('bom_xtras_source.source_lang', '=', lang)
    .where('bom_xtras_source.source_rating', '=', 'G')
    .orderBy(seededOrder('bom_xtras_commentary.id', seed))
    .limit(30)
    .execute();
  type Row = (typeof rows)[number];
  const spanOf = (r: Row) => {
    const start = Number(r.verse_id) || 0;
    return [start, start + Math.max(1, Number(r.verse_range) || 1) - 1] as const;
  };
  const picked: Row[] = [];
  for (const r of rows) {
    if (picked.length === 3) break;
    if (picked.some((p) => p.source === r.source || (p._author && p._author === r._author))) continue;
    const [s1, e1] = spanOf(r);
    if (picked.some((p) => { const [s2, e2] = spanOf(p); return s1 <= e2 && s2 <= e1; })) continue;
    picked.push(r);
  }
  return picked;
};

const sampleCommentary = async (ctx: AppContext, seed: number) =>
  (await sampleCommentaries(ctx, seed))[0] ?? null;

const sampleContents = async (ctx: AppContext, seed: number) => {
  const divisions = await ctx.services.contents.divisions(null);
  return divisions.length ? divisions[seed % divisions.length] : null;
};

// One random section, served as a Section parent — the existing Section field
// resolvers (slug, rows→narration) do the rest. Powers the narration tile.
const sampleSection = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_section')
    .selectAll()
    .where('title', 'is not', null)
    .orderBy(seededOrder('guid', seed))
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

// The sampled section's next sibling (same page, next weight) — the narration
// tile appends it when the first section leaves room.
const sampleSectionNext = async (ctx: AppContext, seed: number) => {
  const current = (await sampleSection(ctx, seed)) as { parent: string | null; weight: number | null } | null;
  if (!current?.parent || current.weight == null) return null;
  const rows = await ctx.db
    .selectFrom('bom_section')
    .selectAll()
    .where('parent', '=', current.parent)
    .where('weight', '>', current.weight)
    .orderBy('weight', 'asc')
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

// One featured historical document (must have a teaser + a renderable thumb).
// Pinned to the reception archive: the /history/:slug view only loads that
// archive, so a doc sampled from any other would deep-link to an empty popup.
const sampleHistory = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_xtras_history')
    .selectAll()
    .where('archive', '=', 'reception')
    .where(sql<boolean>`teaser IS NOT NULL AND CHAR_LENGTH(teaser) > 30`)
    .where('aspect', 'is not', null)
    .orderBy(seededOrder('id', seed))
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

// One full text block (scripture + narration + page/section context — the
// feed's TextInFeed shape). Substantive content only.
const sampleText = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_text')
    .selectAll()
    .where('heading', 'is not', null)
    .where(sql<boolean>`CHAR_LENGTH(content) > 300`)
    .orderBy(seededOrder('guid', seed))
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

const samplers: Record<string, (ctx: AppContext, seed: number) => Promise<unknown>> = {
  people: samplePeople,
  places: samplePlaces,
  fax: sampleFax,
  commentary: sampleCommentary,
  commentaries: sampleCommentaries,
  contents: sampleContents,
  section: sampleSection,
  sectionNext: sampleSectionNext,
  history: sampleHistory,
  text: sampleText,
  faxPages: sampleFaxPages,
  faxMore: sampleFaxMore,
  art: sampleArt,
  witnesses: sampleWitnesses,
  peopleCount: countRows('bom_people'),
  placesCount: countRows('bom_places'),
};

export const homesamplerResolvers: Resolvers = {
  Query: {
    homesampler: async (_root, args, ctx: AppContext) => {
      const argSeed = args.seed as number | null | undefined;
      const seed =
        typeof argSeed === 'number' && Number.isInteger(argSeed) && argSeed > 0
          ? argSeed
          : Math.floor(Math.random() * (2 ** 31 - 1)) + 1;

      const entries = await Promise.all(
        Object.entries(samplers).map(async ([key, fn]) => {
          try {
            return [key, await fn(ctx, seed)] as const;
          } catch (error) {
            console.error(`homesampler ${key} error:`, error);
            return [key, null] as const;
          }
        }),
      );

      return { seed, ...Object.fromEntries(entries) } as never;
    },
  },
};
