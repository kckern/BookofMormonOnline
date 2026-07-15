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

const PEOPLE_COUNT = 8;
const PLACES_COUNT = 5;
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
    .filter((r) => !r.hide)
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

const samplers: Record<string, (ctx: AppContext, seed: number) => Promise<unknown>> = {
  people: samplePeople,
  places: samplePlaces,
  fax: sampleFax,
  commentary: sampleCommentary,
  contents: sampleContents,
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
