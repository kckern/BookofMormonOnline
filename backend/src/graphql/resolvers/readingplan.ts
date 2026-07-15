// Reading-plan catalog, preview, history (+ mutations in a later task).
// Convention: queries/mutations never throw to the client — structured results.
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { generatePlanSegments } from '../../readingplan/generate.js';
import { parsePlanConfig } from '../../readingplan/types.js';

/** token → bom_user.user username (the plain username stored in bom_readingplan.owner). Null when anonymous. */
export async function resolveUsername(ctx: AppContext, token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const row = await ctx.db
    .selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select('bom_user.user as username')
    .where('bom_user_token.token', '=', token)
    .limit(1)
    .executeTakeFirst();
  return row?.username ?? null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function configToString(config: unknown): string {
  return typeof config === 'string' ? config : JSON.stringify(config);
}

export const readingplanResolvers: Resolvers = {
  Query: {
    readingplanprograms: async (_root, _args, ctx: AppContext) => {
      try {
        const rows = await ctx.db
          .selectFrom('bom_readingplan_program')
          .selectAll()
          .where('active', '=', 1)
          .orderBy('sort')
          .execute();
        return rows.map((r) => {
          const raw = configToString(r.config);
          const cfg = parsePlanConfig(raw);
          const pacing = cfg?.pacing;
          const durationLabel =
            pacing?.type === 'cadence' ? `${pacing.count} ${pacing.unit}s` :
            pacing?.type === 'calendar' ? `by ${pacing.due}` : 'self-paced';
          const scopeLabel =
            cfg?.scope.type === 'range' ? 'scripture range' :
            cfg?.scope.type === 'pages' ? `${cfg.scope.slugs.length} page(s)` : 'custom selection';
          return {
            slug: r.slug, title: r.title, description: r.description,
            config: raw, scopeLabel, durationLabel,
          };
        });
      } catch (err) {
        console.error('readingplanprograms error:', err);
        return [];
      }
    },

    readingplanpreview: async (_root, args, ctx: AppContext) => {
      const config = parsePlanConfig(args.config as string);
      if (!config) return { parts: 0, enddate: null, warnings: [{ code: 'INVALID_CONFIG', detail: null }], segments: [] };
      const startdate = (args.startdate as string | undefined) ?? todayISO();
      try {
        const { segments, warnings } = await generatePlanSegments(ctx.db, config, startdate);
        return {
          parts: segments.length,
          enddate: segments.length ? segments[segments.length - 1]!.duedate : null,
          warnings: warnings.map((w) => ({ code: w.code, detail: w.detail ?? null })),
          segments: segments.map((s) => ({
            period: s.period, ref: s.ref, duedate: s.duedate,
            blocks: s.sectionGuids.length,
          })),
        };
      } catch (err) {
        console.error('readingplanpreview error:', err);
        return { parts: 0, enddate: null, warnings: [{ code: 'GENERATION_FAILED', detail: null }], segments: [] };
      }
    },

    readingplanhistory: async (_root, args, ctx: AppContext) => {
      const username = await resolveUsername(ctx, args.token as string);
      if (!username) return [];
      try {
        const rows = await ctx.db
          .selectFrom('bom_readingplan')
          .select(['slug', 'title', 'status', 'startdate', 'enddate'])
          .where('owner', '=', username)
          .where('status', 'in', ['completed', 'abandoned'])
          .orderBy('enddate', 'desc')
          .execute();
        return rows.map((r) => ({
          slug: r.slug, title: r.title, status: r.status,
          startdate: r.startdate ? new Date(r.startdate).toISOString().slice(0, 10) : null,
          enddate: r.enddate ? new Date(r.enddate).toISOString().slice(0, 10) : null,
          // progress: null — history list omits per-plan progress to avoid N+1;
          // the active plan's progress comes from the readingplan query instead.
          progress: null,
        }));
      } catch (err) {
        console.error('readingplanhistory error:', err);
        return [];
      }
    },
  },
};
