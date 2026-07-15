// Reading-plan catalog, preview, history + start/end mutations.
// Convention: queries/mutations never throw to the client — structured results.
import { randomBytes } from 'crypto';
import { nanoid } from 'nanoid';
import type { Kysely } from 'kysely';
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import type { DB } from '../../../codegen/db.js';
import { generatePlanSegments } from '../../readingplan/generate.js';
import { parsePlanConfig } from '../../readingplan/types.js';
import { loadReadingPlan } from '../../messaging/readingplan.js';

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

interface CreateArgs { programSlug?: string | null; title?: string | null; config?: string | null; startdate?: string | null; credit?: string | null }
interface PlanMutationResult { isSuccess: boolean; msg: string; slug?: string }

/** Testable core: create a plan for a resolved username. Enforces one active plan (spec D2). */
export async function createPlanForUser(db: Kysely<DB>, username: string, args: CreateArgs): Promise<PlanMutationResult> {
  let rawConfig = args.config ?? null;
  let title = args.title ?? null;
  if (args.programSlug) {
    const prog = await db.selectFrom('bom_readingplan_program').selectAll()
      .where('slug', '=', args.programSlug).where('active', '=', 1).executeTakeFirst();
    if (!prog) return { isSuccess: false, msg: 'INVALID_CONFIG' };
    rawConfig = typeof prog.config === 'string' ? prog.config : JSON.stringify(prog.config);
    title = title ?? prog.title;
  }
  const config = rawConfig ? parsePlanConfig(rawConfig) : null;
  if (!config) return { isSuccess: false, msg: 'INVALID_CONFIG' };
  if (args.credit === 'fresh' || args.credit === 'alltime') config.credit = args.credit;

  const active = await db.selectFrom('bom_readingplan').select('guid')
    .where('owner', '=', username).where('status', '=', 'active').executeTakeFirst();
  if (active) return { isSuccess: false, msg: 'ACTIVE_PLAN_EXISTS' };

  const startdate = args.startdate ?? todayISO();
  const gen = await generatePlanSegments(db, config, startdate);
  if (!gen.segments.length) return { isSuccess: false, msg: 'EMPTY_SCOPE' };

  const slug = `rp-${nanoid(10)}`;
  const last = gen.segments[gen.segments.length - 1]!;
  await db.transaction().execute(async (trx) => {
    await trx.insertInto('bom_readingplan').values({
      guid: randomBytes(16).toString('hex'),
      slug,
      title: title ?? 'Reading Plan',
      owner: username,
      startdate: new Date(`${startdate}T00:00:00Z`),
      duedate: last.duedate ? new Date(`${last.duedate}T00:00:00Z`) : null,
      status: 'active',
      config: JSON.stringify(config),
    }).execute();
    await trx.insertInto('bom_readingplan_seg').values(gen.segments.map((s) => ({
      guid: randomBytes(16).toString('hex'),
      plan: slug,
      period: s.period,
      ref: s.ref,
      title: null,
      duedate: s.duedate ? new Date(`${s.duedate}T00:00:00Z`) : null,
      start: s.start,
      end: s.end,
      sectionGuids: JSON.stringify(s.sectionGuids),
    }))).execute();
  });
  return { isSuccess: true, msg: 'OK', slug };
}

/** Testable core: end the active plan. */
export async function endPlanForUser(db: Kysely<DB>, username: string, action: 'COMPLETE' | 'ABANDON'): Promise<PlanMutationResult> {
  const active = await db.selectFrom('bom_readingplan').select(['guid', 'slug'])
    .where('owner', '=', username).where('status', '=', 'active').executeTakeFirst();
  if (!active) return { isSuccess: false, msg: 'NO_ACTIVE_PLAN' };
  await db.updateTable('bom_readingplan')
    .set({ status: action === 'COMPLETE' ? 'completed' : 'abandoned', enddate: new Date() })
    .where('guid', '=', active.guid!)
    .execute();
  return { isSuccess: true, msg: 'OK', slug: active.slug ?? undefined };
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

  Mutation: {
    startReadingPlan: async (_root, args, ctx: AppContext) => {
      const username = await resolveUsername(ctx, args.token as string);
      if (!username) return { isSuccess: false, msg: 'NOT_AUTHENTICATED', plan: null };
      const res = await createPlanForUser(ctx.db, username, args.input as CreateArgs);
      if (!res.isSuccess) return { isSuccess: false, msg: res.msg, plan: null };
      // Plan is committed; a reload failure must not report failure to the client.
      let plan: Awaited<ReturnType<typeof loadReadingPlan>> | null = null;
      try { plan = await loadReadingPlan(ctx.db, res.slug!, { queryBy: username }, ctx.lang); }
      catch (err) { console.error('startReadingPlan: post-create reload failed', err); }
      return { isSuccess: true, msg: 'OK', plan };
    },
    endReadingPlan: async (_root, args, ctx: AppContext) => {
      const username = await resolveUsername(ctx, args.token as string);
      if (!username) return { isSuccess: false, msg: 'NOT_AUTHENTICATED', plan: null };
      const res = await endPlanForUser(ctx.db, username, args.action as 'COMPLETE' | 'ABANDON');
      if (!res.isSuccess) return { isSuccess: false, msg: res.msg, plan: null };
      let plan: Awaited<ReturnType<typeof loadReadingPlan>> | null = null;
      try { plan = await loadReadingPlan(ctx.db, res.slug!, { queryBy: username }, ctx.lang); }
      catch (err) { console.error('endReadingPlan: post-end reload failed', err); }
      return { isSuccess: true, msg: 'OK', plan };
    },
  },
};
