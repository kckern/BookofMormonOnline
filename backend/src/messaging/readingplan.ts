/**
 * readingplan — port of legacy lib.ts loadReadingPlan (+ loadPlanData,
 * completedGuids, scoreSegment). Returns the ReadingPlan GQL shape consumed by
 * the frontend <ReadingPlan slug="cfm2024" /> widget on /home.
 *
 * Read-only: the legacy version back-filled bom_readingplan_seg.sectionGuids
 * via UPDATE when missing. We compute sectionGuids on the fly instead (the dev
 * DB is read-only and the column is just a cache).
 */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { DB, JsonValue } from '../../codegen/db.js';
import { parsePlanConfig } from '../readingplan/types.js';

const COMPLETE_THRESHOLD = Number(process.env.PERCENT_TO_COUNT_AS_COMPLETE ?? 40);

export interface ReadingPlanUserInfo {
  /** bom_user.user (or the raw token for anon) used to score bom_log credit. */
  queryBy: string;
}

interface PlanRow {
  guid: string | null;
  slug: string | null;
  title: string | null;
  startdate: Date | string | null;
  duedate: Date | string | null;
  status: string | null;
  config: JsonValue | null;
  enddate: Date | string | null;
}

interface SegmentRow {
  guid: string | null;
  period: string | null;
  ref: string | null;
  title: string | null;
  duedate: Date | string | null;
  start: number | null;
  end: number | null;
  sectionGuids: string[];
}

/** Format a DB date as YYYY-MM-DD in local time (matches legacy moment()). */
function fmtDate(d: Date | string | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * completedGuids — bom_log block-credit values the user has completed since
 * `cutOff` (the plan start). One row per distinct text guid (latest credit).
 * Legacy _common.ts:386.
 */
async function completedGuids(db: Kysely<DB>, queryBy: string, cutOff: number): Promise<string[]> {
  const rows = await db
    .selectFrom('bom_log')
    .select('value')
    .where('user', '=', queryBy)
    .where('type', '=', 'block')
    .where('timestamp', '>', cutOff || 0)
    .where('credit', '>=', COMPLETE_THRESHOLD)
    .groupBy('value')
    .execute();
  return rows.map((r) => r.value);
}

/**
 * loadPlanData — bom_readingplan + its ordered segments. Each segment's
 * sectionGuids (the bom_text.section guids spanned by start..end) is read from
 * the cached column, or computed from bom_lookup→bom_text when absent.
 * Legacy lib.ts:375.
 */
async function loadPlanData(db: Kysely<DB>, slug: string): Promise<{ plan: PlanRow; segments: SegmentRow[] } | null> {
  const plan = await db
    .selectFrom('bom_readingplan')
    .select(['guid', 'slug', 'title', 'startdate', 'duedate', 'status', 'config', 'enddate'])
    .where('slug', '=', slug)
    .executeTakeFirst();
  if (!plan) return null;

  const rawSegments = await db
    .selectFrom('bom_readingplan_seg')
    .select(['guid', 'period', 'ref', 'title', 'duedate', 'start', 'end', 'sectionGuids'])
    .where('plan', '=', plan.slug)
    .orderBy('start', 'asc')
    .execute();

  const segments: SegmentRow[] = await Promise.all(
    rawSegments.map(async (seg) => {
      let sectionGuids: string[] = [];
      if (seg.sectionGuids) {
        try {
          const parsed = JSON.parse(seg.sectionGuids) as unknown;
          if (Array.isArray(parsed)) sectionGuids = parsed as string[];
        } catch {
          /* malformed cache → recompute below */
        }
      }
      if (!sectionGuids.length && seg.start != null && seg.end != null) {
        // Distinct bom_text.section guids spanned by this segment's verse range,
        // ordered by first appearance (min verse_id) — mirrors legacy subquery.
        const rows = await db
          .selectFrom('bom_lookup')
          .innerJoin('bom_text', 'bom_lookup.text_guid', 'bom_text.guid')
          .select(['bom_text.section as section'])
          .where(sql<boolean>`bom_lookup.verse_id BETWEEN ${seg.start} AND ${seg.end}`)
          .groupBy('bom_text.section')
          .orderBy(sql`MIN(bom_lookup.verse_id + 0)`, 'asc')
          .execute();
        sectionGuids = rows.map((r) => r.section).filter((s): s is string => !!s);
      }
      return { ...seg, sectionGuids };
    }),
  );

  return { plan, segments };
}

/** scoreSegment — completion ratio of a segment's text blocks. Legacy lib.ts:440. Pure. */
function scoreSegment(
  sectionGuids: string[],
  allTextBlocks: { guid: string; section: string | null }[],
  history: Set<string>,
): { items: number; completed: number; progress: number } {
  if (!sectionGuids.length) return { items: 0, completed: 0, progress: 0 };
  const sectionSet = new Set(sectionGuids);
  const segmentBlocks = allTextBlocks.filter((b) => b.section && sectionSet.has(b.section));
  const completedBlocks = segmentBlocks.filter((b) => history.has(b.guid));
  const progress = segmentBlocks.length
    ? Math.round((completedBlocks.length / segmentBlocks.length) * 10000) / 100
    : 0;
  return { items: segmentBlocks.length, completed: completedBlocks.length, progress };
}

/**
 * loadReadingPlan — assemble the full ReadingPlan for `slug`, scored against the
 * user's completed blocks. Plan-level progress counts only non-future segments
 * (so the bar reflects "to date"). Translations override period/ref/title when
 * a non-default lang is requested. Legacy lib.ts:456.
 */
export async function loadReadingPlan(
  db: Kysely<DB>,
  slug: string | null,
  userInfo: ReadingPlanUserInfo,
  lang: string | null,
): Promise<Record<string, unknown> | null> {
  let planSlug = slug;
  if (!planSlug) {
    if (!userInfo.queryBy) return null;
    const active = await db.selectFrom('bom_readingplan').select('slug')
      .where('owner', '=', userInfo.queryBy).where('status', '=', 'active').limit(1).executeTakeFirst();
    if (!active?.slug) return null;
    planSlug = active.slug;
  }
  const data = await loadPlanData(db, planSlug);
  if (!data) return null;
  const { plan, segments: planSegments } = data;

  const cfg = plan.config ? parsePlanConfig(typeof plan.config === 'string' ? plan.config : JSON.stringify(plan.config)) : null;
  const startUnix = plan.startdate
    ? Math.floor((plan.startdate instanceof Date ? plan.startdate : new Date(plan.startdate)).getTime() / 1000)
    : 0;
  const creditFloor = cfg?.credit === 'alltime' ? 0 : startUnix;
  const completed = new Set(await completedGuids(db, userInfo.queryBy, creditFloor));

  const allTextBlocks = await db.selectFrom('bom_text').select(['guid', 'section']).execute();

  // Batch translations for the plan + all segment guids (only for non-en langs).
  const useLang = lang && lang !== 'en' && lang !== 'dev' ? lang : null;
  const translationGuids = [plan.guid, ...planSegments.map((s) => s.guid)].filter((g): g is string => !!g);
  const translations = useLang && translationGuids.length
    ? await db
        .selectFrom('bom_translation')
        .select(['guid', 'refkey', 'value'])
        .where('guid', 'in', translationGuids)
        .where('refkey', 'in', ['title', 'ref', 'period'])
        .where('lang', '=', useLang)
        .execute()
    : [];
  const tr = (guid: string | null, refkey: string): string | null =>
    (guid && translations.find((t) => t.guid === guid && t.refkey === refkey)?.value) || null;

  const todayStr = fmtDate(new Date()) ?? '';
  let toDateItems = 0;
  let toDateCompleted = 0;
  const segments = planSegments.map((seg) => {
    const dueStr = fmtDate(seg.duedate) ?? '';
    const isFuture = dueStr > todayStr; // YYYY-MM-DD compares lexically
    const score = scoreSegment(seg.sectionGuids, allTextBlocks, completed);
    if (!isFuture) {
      toDateItems += score.items;
      toDateCompleted += score.completed;
    }
    return {
      guid: seg.guid,
      period: tr(seg.guid, 'period') ?? seg.period,
      ref: tr(seg.guid, 'ref') ?? seg.ref,
      title: tr(seg.guid, 'title') ?? seg.title,
      duedate: dueStr,
      progress: score.progress,
      start: seg.start,
      end: seg.end,
    };
  });

  const progress = toDateItems ? Math.round((toDateCompleted / toDateItems) * 10000) / 100 : 0;

  // Server-authoritative active-segment index (frontend does no date math).
  const hasDates = segments.some((s) => !!s.duedate);
  let current: number;
  if (hasDates) {
    const idx = segments.findIndex((s) => s.duedate && s.duedate >= todayStr);
    current = idx === -1 ? Math.max(0, segments.length - 1) : idx; // plan over → last, never -1
  } else {
    const idx = segments.findIndex((s) => Number(s.progress) < 100);
    current = idx === -1 ? Math.max(0, segments.length - 1) : idx; // all done → last
  }

  // PR-1 fix: loadReadingPlan is a read — it must not issue writes.
  // When progress reaches 100 % we surface status='completed' in the response as
  // a *derived* value only; the actual DB row is persisted by the explicit
  // endReadingPlan mutation (callers that need persistence must call that path).
  // This keeps the function idempotent, safe to cache, and sandbox-transparent.
  // Previously an UPDATE was issued here; that bypassed the sandbox write-guard
  // and made any GQL query a hidden mutation — removed 2026-08-05.
  const status = (progress >= 100 && (plan.status ?? null) === 'active')
    ? 'completed'
    : (plan.status ?? null);

  return {
    guid: plan.guid,
    slug: planSlug,
    title: tr(plan.guid, 'title') ?? plan.title,
    startdate: fmtDate(plan.startdate),
    duedate: fmtDate(plan.duedate),
    progress,
    status,
    config: plan.config ? (typeof plan.config === 'string' ? plan.config : JSON.stringify(plan.config)) : null,
    current,
    segments,
  };
}
