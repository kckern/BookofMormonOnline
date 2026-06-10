/**
 * Thin resolvers: map GraphQL fields to service calls, nothing else.
 * Services return response-shaped domain objects, so no per-field mapping
 * lives here. Unimplemented surface resolves to null until its slice lands
 * (delivery order: scripture → content → media → search → user → community).
 */
import type { Resolvers } from '../../codegen/graphql.js';

export const resolvers: Resolvers = {
  Query: {
    labels: (_root, _args, ctx) => ctx.services.labels.list(),
    division: (_root, args, ctx) =>
      ctx.services.contents.divisions(args.slug?.filter((s): s is string => s !== null) ?? null),
  },
};
