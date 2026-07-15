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
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';

// 17 people = 1 featured + 7 face cards + 9 view-all mosaic thumbs;
// 12 places = 3 cards + 9 mosaic thumbs.
const PEOPLE_COUNT = 17;
const PLACES_COUNT = 12;
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
  // ROBUSTNESS: the loader's order is weight-only with no tiebreak and is NOT
  // stable across calls; sort by slug so the modulo pick is deterministic.
  const sorted = rows
    // pages>0 filters out metadata-only entries (e.g. 'poetic') whose page
    // assets don't exist — an imageless facsimile tile is dead weight.
    .filter((r) => !r.hide && Number(r.pages) > 0)
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  return sorted.length ? sorted[seed % sorted.length] : null;
};

const sampleCommentary = async (ctx: AppContext, seed: number) => {
  // ROBUSTNESS: filter on CHAR_LENGTH(text) — the exact measure the test asserts
  // (text.length > 500) — rather than the stored `length` column.
  const rows = await ctx.db
    .selectFrom('bom_xtras_commentary')
    .selectAll()
    .where(sql<boolean>`CHAR_LENGTH(text) > ${MIN_COMMENTARY_CHARS}`)
    .orderBy(seededOrder('id', seed))
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

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
const sampleHistory = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_xtras_history')
    .selectAll()
    .where(sql<boolean>`teaser IS NOT NULL AND CHAR_LENGTH(teaser) > 30`)
    .where('aspect', 'is not', null)
    .orderBy(seededOrder('id', seed))
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

const samplers: Record<string, (ctx: AppContext, seed: number) => Promise<unknown>> = {
  people: samplePeople,
  places: samplePlaces,
  fax: sampleFax,
  commentary: sampleCommentary,
  contents: sampleContents,
  section: sampleSection,
  sectionNext: sampleSectionNext,
  history: sampleHistory,
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
