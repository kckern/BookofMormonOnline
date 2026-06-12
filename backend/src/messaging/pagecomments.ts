/**
 * messaging/pagecomments.ts — page-scoped study comments + per-verse counts
 * in one unit of work (spec P1: docs/specs/2026-06-11-page-comments-best-in-class.md).
 *
 * Messages are SQL-filtered to custom_type = pageSlug (getMessages customTypes),
 * then com/img ids referenced in each message's data JSON `links` are resolved
 * to location slugs via SlugResolver and reduced to per-verse counts —
 * replacing the frontend's second commentaryLocations/imageLocations round
 * trip. Facsimile ("fax") counts stay client-side (they derive from the index
 * alone; no location lookup involved).
 *
 * Slug resolution path for commentary/image:
 *   entity.location_guid (= bom_text.guid)
 *   → bom_text.{page, link}   (page = page-entity guid; link = verse/block number)
 *   → SlugResolver.pathsForLinks([page_guid]) → page path (e.g. "promised-land")
 *   → full slug = page_path + "/" + link  (e.g. "promised-land/11")
 *
 * This mirrors the TextBlock.slug resolver in backend/src/graphql/resolvers.ts.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { getMessages } from './messages.js';
import type { MessageDTO } from './dto.js';
import { SlugResolver } from '../data/slugResolver.js';

export type PageCommentCounts = Record<string, { com?: number[]; img?: number[] }>;

const PAGE_COMMENTS_LIMIT = 500;

function collectLinkIds(messages: MessageDTO[]): { com: number[]; img: number[] } {
  const com = new Set<number>();
  const img = new Set<number>();
  for (const m of messages) {
    if (!m.data) continue;
    let meta: unknown;
    try {
      meta = JSON.parse(m.data);
    } catch {
      continue;
    }
    const links = (meta as { links?: Record<string, unknown> } | null)?.links;
    if (!links) continue;
    const c = Number(links['com']);
    if (Number.isFinite(c)) com.add(c);
    const i = Number(links['img']);
    if (Number.isFinite(i)) img.add(i);
  }
  return { com: [...com], img: [...img] };
}

/**
 * Fetch location_guid values for the given entity IDs, filtering out
 * null/empty/sentinel values.
 * Returns Map<entity_id, location_guid_string>.
 */
async function locationGuids(
  db: Kysely<DB>,
  table: 'bom_xtras_commentary' | 'bom_xtras_image',
  ids: number[],
): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const rows = await db
    .selectFrom(table)
    .select(['id', 'location_guid'])
    .where('id', 'in', ids)
    .execute();
  const out = new Map<number, string>();
  for (const r of rows) {
    const g = r.location_guid as string | null;
    if (g && g !== 'NULL' && g !== '' && g !== '0' && g !== '-1') out.set(Number(r.id), g);
  }
  return out;
}

/**
 * Resolve entity location_guids (which are bom_text.guid values) to full
 * page slugs and verse numbers.
 *
 * bom_text.guid → bom_text.{page, link}
 *   page guid → SlugResolver.pathsForLinks → page slug path
 *   full slug = page_slug_path + "/" + link
 *
 * Returns Map<entity_id, full_slug> e.g. 1013512101 → "promised-land/11"
 */
async function resolveEntitySlugs(
  db: Kysely<DB>,
  entityToTextGuid: Map<number, string>,
): Promise<Map<number, string>> {
  if (!entityToTextGuid.size) return new Map();

  const textGuids = [...new Set(entityToTextGuid.values())];
  const textRows = await db
    .selectFrom('bom_text')
    .select(['guid', 'page', 'link'])
    .where('guid', 'in', textGuids)
    .execute();

  const textByGuid = new Map<string, { page: string | null; link: number | null }>();
  for (const r of textRows) {
    textByGuid.set(r.guid, { page: r.page as string | null, link: r.link as number | null });
  }

  const pageGuids = [...new Set(textRows.map((r) => r.page).filter((p): p is string => !!p))];
  const pageSlugs = await new SlugResolver(db).pathsForLinks(pageGuids);

  const out = new Map<number, string>();
  for (const [entityId, textGuid] of entityToTextGuid) {
    const text = textByGuid.get(textGuid);
    if (!text?.page || text.link == null) continue;
    const pagePath = pageSlugs.get(text.page);
    if (!pagePath) continue;
    out.set(entityId, `${pagePath}/${text.link}`);
  }
  return out;
}

export async function getPageComments(
  db: Kysely<DB>,
  channelUrl: string,
  pageSlug: string,
): Promise<{ messages: MessageDTO[]; counts: PageCommentCounts }> {
  const messages = await getMessages(db, channelUrl, {
    customTypes: [pageSlug],
    limit: PAGE_COMMENTS_LIMIT,
  });

  const { com, img } = collectLinkIds(messages);
  const counts: PageCommentCounts = {};
  if (!com.length && !img.length) return { messages, counts };

  const [comLocs, imgLocs] = await Promise.all([
    locationGuids(db, 'bom_xtras_commentary', com),
    locationGuids(db, 'bom_xtras_image', img),
  ]);

  // Resolve entity location_guids (bom_text guids) to full page/verse slugs.
  const [comSlugs, imgSlugs] = await Promise.all([
    resolveEntitySlugs(db, comLocs),
    resolveEntitySlugs(db, imgLocs),
  ]);

  const tally = (slugMap: Map<number, string>, kind: 'com' | 'img') => {
    for (const [id, slug] of slugMap) {
      const m = slug.match(/(.*?)\/(\d+)$/);
      if (!m || m[1] !== pageSlug || !m[2]) continue; // located on a different page
      const verse: string = m[2];
      counts[verse] ??= {};
      const entry = counts[verse] as Record<string, number[]>;
      entry[kind] ??= [];
      entry[kind]!.push(id);
    }
  };
  tally(comSlugs, 'com');
  tally(imgSlugs, 'img');

  return { messages, counts };
}
