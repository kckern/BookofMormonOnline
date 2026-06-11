/**
 * queue — port of legacy lib.ts getBlocksToQueue() and its helper chain, which
 * builds the Theater playback queue. Given an items[] selector (slug / reference
 * / reading-plan / explicit blocks) or nothing (token-based / default), it
 * resolves an ordered list of bom_text blocks, grouped by page slug.
 *
 * The resolver (scripturereadResolvers.queue) then fetches the bom_text rows for
 * those (slug, blocks) and returns them as TextRow[]; the core + media TextBlock
 * field resolvers (content, narration, heading, slug, people, places, duration…)
 * handle the rest off each row's guid/page/link/section.
 *
 * Read-only: no writes (legacy back-filled bom_readingplan_seg.sectionGuids and
 * bom_text.queue_weight; we read what's there).
 */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import { lookup } from 'scripture-guide';

const COMPLETE_THRESHOLD = Number(process.env.PERCENT_TO_COUNT_AS_COMPLETE ?? 40);
const DEFAULT_PAGE_GUID = '4becc77f2d75f';
const MAX_QUEUE = 40;

export interface QueueItemInput {
  slug?: string | null;
  blocks?: number[] | null;
  reference?: string | null;
  plan?: string | null;
}

export interface QueueSlugBlocks {
  slug: string;
  blocks: number[];
}

interface BlockRow {
  guid: string;
  section: string | null;
  page: string | null;
  link: number | null;
}

/** token → { queryBy, finished }. Anonymous users log under the raw token. */
async function getUserForLog(
  db: Kysely<DB>,
  token: string | null | undefined,
): Promise<{ queryBy: string | null; finished: number }> {
  if (!token) return { queryBy: null, finished: 0 };
  const row = await db
    .selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select(['bom_user.user as user', 'bom_user.finished as finished'])
    .where('bom_user_token.token', '=', token)
    .limit(1)
    .executeTakeFirst();
  if (!row) return { queryBy: token, finished: 0 };
  return { queryBy: row.user, finished: Number(row.finished ?? 0) };
}

/** Distinct text-block guids the user has completed (credit > threshold) since `finished`. */
async function loadCompletedBlocks(
  db: Kysely<DB>,
  queryBy: string | null,
  finished: number,
): Promise<Set<string>> {
  if (!queryBy) return new Set();
  const rows = await db
    .selectFrom('bom_log')
    .select('value')
    .distinct()
    .where('user', '=', queryBy)
    .where('type', '=', 'block')
    .where('timestamp', '>', finished || 0)
    .where('credit', '>', COMPLETE_THRESHOLD)
    .execute();
  return new Set(rows.map((r) => r.value));
}

/** Every text block (guid, section, page, link) in queue order. */
async function loadAllBlocks(db: Kysely<DB>): Promise<BlockRow[]> {
  const rows = await db
    .selectFrom('bom_text')
    .select(['guid', 'section', 'page', 'link'])
    // queue_weight is a numeric-valued varchar; order numerically (legacy ORDER BY queue_weight).
    .orderBy(sql`queue_weight + 0`, 'asc')
    .execute();
  return rows as unknown as BlockRow[];
}

/** Group an ordered block list into [{ slug, blocks }] by page slug. */
async function resolveQueueFromTextBlocks(
  db: Kysely<DB>,
  blocks: BlockRow[],
): Promise<QueueSlugBlocks[]> {
  if (!blocks.length) return [];
  const pageGuids = [...new Set(blocks.map((b) => b.page).filter((p): p is string => !!p))];
  const slugRows = pageGuids.length
    ? await db.selectFrom('bom_slug').select(['link', 'slug']).where('link', 'in', pageGuids).execute()
    : [];
  const slugByLink = new Map(slugRows.map((s) => [s.link, s.slug]));
  const output: QueueSlugBlocks[] = [];
  for (const pageGuid of pageGuids) {
    output.push({
      slug: slugByLink.get(pageGuid) ?? pageGuid,
      blocks: blocks.filter((b) => b.page === pageGuid).map((b) => b.link).filter((l): l is number => l != null),
    });
  }
  return output;
}

/**
 * Walk sections starting at sectionGuid, skipping fully-completed sections
 * (unless forceSection), accumulating up to ~40 blocks. Legacy buildQueueFromSection.
 */
async function buildQueueFromSection(
  db: Kysely<DB>,
  sectionGuid: string | null,
  token: string | null | undefined,
  forceSection: boolean,
): Promise<QueueSlugBlocks[]> {
  if (!sectionGuid) return [];
  const { queryBy, finished } = await getUserForLog(db, token);
  const allBlocks = await loadAllBlocks(db);
  const sectionOrder = [...new Set(allBlocks.map((b) => b.section).filter((s): s is string => !!s))];
  let sectionIndex = sectionOrder.findIndex((s) => s === sectionGuid);
  if (sectionIndex < 0) return [];
  const completed = await loadCompletedBlocks(db, queryBy, finished);

  let queue: string[] = [];
  // Bound the walk by the number of sections so we can't loop forever.
  for (let steps = 0; steps <= sectionOrder.length; steps++) {
    const sec = sectionOrder[sectionIndex];
    sectionIndex = (sectionIndex + 1) % sectionOrder.length;
    if (!sec) break;
    const guids = allBlocks.filter((b) => b.section === sec).map((b) => b.guid);
    const sectionDone = guids.length > 0 && guids.every((g) => completed.has(g));
    if (sectionDone && !forceSection) continue;
    const tmp = [...queue, ...guids];
    if (tmp.length > MAX_QUEUE && queue.length > 1) break;
    queue = tmp;
    if (queue.length >= MAX_QUEUE) break;
    forceSection = false; // only the starting section is force-included
  }

  const queueSet = new Set(queue);
  return resolveQueueFromTextBlocks(db, allBlocks.filter((b) => queueSet.has(b.guid)));
}

/** First section of a page → queue. Legacy getBlocksFromPage. */
async function getBlocksFromPage(
  db: Kysely<DB>,
  pageGuid: string,
  token: string | null | undefined,
): Promise<QueueSlugBlocks[]> {
  const section = await db
    .selectFrom('bom_section')
    .select('guid')
    .where('parent', '=', pageGuid)
    .orderBy('guid', 'asc')
    .executeTakeFirst();
  return buildQueueFromSection(db, section?.guid ?? null, token, true);
}

const getBlocksByDefault = (db: Kysely<DB>) => getBlocksFromPage(db, DEFAULT_PAGE_GUID, null);

/** A "pageSlug/link" text block → its section → queue. Legacy getBlocksFromTextBlock. */
async function getBlocksFromTextBlock(
  db: Kysely<DB>,
  slug: string,
  token: string | null | undefined,
  force: boolean,
): Promise<QueueSlugBlocks[]> {
  const [blocknum, pageslug] = slug.split('/').reverse();
  if (!pageslug || !blocknum) return getBlocksByDefault(db);
  const pageSlug = await db
    .selectFrom('bom_slug')
    .select('link')
    .where('slug', '=', pageslug)
    .where('type', '=', 'PG')
    .executeTakeFirst();
  if (!pageSlug) return getBlocksByDefault(db);
  const block = await db
    .selectFrom('bom_text')
    .select('section')
    .where('link', '=', Number(blocknum))
    .where('page', '=', pageSlug.link)
    .executeTakeFirst();
  if (!block) return getBlocksByDefault(db);
  return buildQueueFromSection(db, block.section, token, force);
}

/** A slug (numeric block, section, or page) → queue. Legacy getBlocksFromSlug. */
async function getBlocksFromSlug(
  db: Kysely<DB>,
  slug: string,
  token: string | null | undefined,
): Promise<QueueSlugBlocks[]> {
  const lastItem = slug.split('/').pop() ?? slug;
  if ((parseInt(lastItem, 10) || 0) > 0) {
    return getBlocksFromTextBlock(db, slug, token, true);
  }
  const slugData = await db
    .selectFrom('bom_slug')
    .select(['type', 'link'])
    .where('slug', '=', lastItem)
    .executeTakeFirst();
  if (slugData?.type === 'SC') return buildQueueFromSection(db, slugData.link, token, true);
  if (slugData?.type === 'PG') return getBlocksFromPage(db, slugData.link, token);
  return getBlocksByDefault(db);
}

/** A scripture reference → its first text block → queue. Legacy getBlocksFromReference. */
async function getBlocksFromReference(
  db: Kysely<DB>,
  reference: string,
  token: string | null | undefined,
): Promise<QueueSlugBlocks[]> {
  const result = lookup(reference) as { verse_ids?: number[] };
  const firstVerseId = result?.verse_ids?.[0];
  if (firstVerseId == null) return getBlocksByDefault(db);
  const row = await db
    .selectFrom('bom_lookup')
    .innerJoin('bom_text', 'bom_text.guid', 'bom_lookup.text_guid')
    .innerJoin('bom_slug', 'bom_slug.link', 'bom_text.page')
    .select(['bom_text.link as link', 'bom_slug.slug as pageSlug'])
    .where('bom_lookup.verse_id', '=', String(firstVerseId))
    .orderBy(sql`bom_text.queue_weight + 0`, 'asc')
    .executeTakeFirst();
  if (!row) return getBlocksByDefault(db);
  return getBlocksFromTextBlock(db, `${row.pageSlug}/${row.link}`, token, false);
}

/** A reading-plan segment guid → its sections → queue. Legacy getBlocksFromReadingPlan. */
async function getBlocksFromReadingPlan(
  db: Kysely<DB>,
  plan: string,
  token: string | null | undefined,
): Promise<QueueSlugBlocks[]> {
  const seg = await db
    .selectFrom('bom_readingplan_seg')
    .select('sectionGuids')
    .where('guid', '=', plan)
    .orderBy('start', 'asc')
    .executeTakeFirst();
  let sectionGuids: string[] = [];
  try {
    const parsed = JSON.parse(seg?.sectionGuids ?? '[]') as unknown;
    if (Array.isArray(parsed)) sectionGuids = parsed as string[];
  } catch { /* malformed */ }
  if (!sectionGuids.length) return getBlocksByDefault(db);
  const allBlocks = await loadAllBlocks(db);
  const wanted = new Set(sectionGuids);
  const ordered: BlockRow[] = [];
  for (const sg of sectionGuids) {
    ordered.push(...allBlocks.filter((b) => b.section === sg));
  }
  void wanted;
  return resolveQueueFromTextBlocks(db, ordered);
}

/** Most-recent block the user studied → its section → queue. Legacy getBlocksFromToken. */
async function getBlocksFromToken(
  db: Kysely<DB>,
  token: string,
): Promise<QueueSlugBlocks[]> {
  const { queryBy, finished } = await getUserForLog(db, token);
  if (!queryBy) return getBlocksByDefault(db);
  const logEntry = await db
    .selectFrom('bom_log')
    .select('value')
    .where('user', '=', queryBy)
    .where('type', '=', 'block')
    .where('timestamp', '>', finished || 0)
    .orderBy('timestamp', 'desc')
    .executeTakeFirst();
  if (!logEntry) return getBlocksByDefault(db);
  const textRow = await db
    .selectFrom('bom_text')
    .select(['link', 'page'])
    .where('guid', '=', logEntry.value)
    .executeTakeFirst();
  if (!textRow?.page) return getBlocksByDefault(db);
  const pageSlug = await db
    .selectFrom('bom_slug')
    .select('slug')
    .where('link', '=', textRow.page)
    .executeTakeFirst();
  if (!pageSlug) return getBlocksByDefault(db);
  return getBlocksFromTextBlock(db, `${pageSlug.slug}/${textRow.link}`, token, false);
}

/**
 * getBlocksToQueue — top-level dispatch. Mirrors legacy precedence:
 * explicit {slug,blocks} → {slug} → {reference} → {plan} → token-based → default.
 */
export async function getBlocksToQueue(
  db: Kysely<DB>,
  token: string | null | undefined,
  items: QueueItemInput[] | null | undefined,
): Promise<QueueSlugBlocks[]> {
  const first = items?.[0];

  if (first?.slug && first?.blocks?.length) {
    return items!
      .filter((i) => i.slug)
      .map((i) => ({ slug: i.slug as string, blocks: (i.blocks ?? []).filter((b): b is number => b != null) }));
  }
  if (first?.slug) return getBlocksFromSlug(db, first.slug, token);
  if (first?.reference) return getBlocksFromReference(db, first.reference, token);
  if (first?.plan) return getBlocksFromReadingPlan(db, first.plan, token);
  if (token && !first) return getBlocksFromToken(db, token);
  return getBlocksByDefault(db);
}
