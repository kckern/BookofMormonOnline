/**
 * ported_misc resolvers — 5 Query fields that are declared in the SDL but had no
 * resolver in the green-field backend (so they silently returned null). Each is
 * ported faithfully from the legacy backend.
 *
 *   books(seed)        — legacy src/resolvers/BomUtils.ts: STUB returning [null].
 *                        (Real book data comes from the objects/preload path.)
 *   menu(slug)         — legacy BomUtils.ts: STUB returning [null].
 *   test               — legacy BomUtils.ts: returns true.
 *   peoplenetwork      — declared in legacy typeDefs but NEVER implemented (no
 *                        resolver existed), so it was always null. Kept null.
 *   mapstory           — REAL port. Green-field SDL contract is the FULL LIST of
 *                        all map stories (no args), each with its ordered moves.
 *
 * MapStory / MapMove field resolvers are already owned by src/graphql/resolvers/
 * maps.ts (translations, startPlace/endPlace, people, verse_ids). getAllMapStories
 * returns rows in that exact shape (MapStoryRow & { _moves }), so we do NOT
 * redeclare those type resolvers here — that would conflict with the maps domain.
 */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { getAllMapStories } from '../../data/loaders/ported_misc.js';

export const portedMiscResolvers: Resolvers = {
  Query: {
    /**
     * books(seed): [Book] — legacy BomUtils.ts STUB returning [null]. The real
     * book data is delivered through the objects/preload path, not this field.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    books: (): any => [null],

    /**
     * menu(slug): [Menu] — legacy BomUtils.ts STUB returning [null].
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    menu: (): any => [null],

    /**
     * test: Test — legacy BomUtils.ts returns `true`. (A truthy non-null value
     * satisfies the Test object type; the frontend only checks for presence.)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    test: (): any => true,

    /**
     * peoplenetwork: PeopleNetwork — was declared in the legacy typeDefs but a
     * resolver was NEVER implemented for it, so legacy always returned null.
     * Faithful port: return null.
     */
    peoplenetwork: () => null,

    /**
     * mapstory: [MapStory] — REAL port. The green-field SDL contract is the FULL
     * LIST of all map stories (the legacy mapstory(slug) findOne does not match
     * the green-field shape). Returns every bom_map_story with its ordered moves;
     * translations for title/description/travelers are applied by the MapStory /
     * MapMove field resolvers in maps.ts (ctx.loaders.translation, ctx.lang).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapstory: async (_root, _args, ctx: AppContext): Promise<any> => {
      return getAllMapStories(ctx.db);
    },
  },
};
