/**
 * DB-backed test for getPageComments. Seeds throwaway channel/user/messages;
 * uses a REAL commentary row (content tables are stable) discovered at
 * runtime so no content id is hardcoded.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { getPageComments } from '../../src/messaging/pagecomments.js';
import { postMessage } from '../../src/messaging/messages.js';
import { SlugResolver } from '../../src/data/slugResolver.js';

function buildWriteDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user = process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root';
  const password = process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '';
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({ host, port, database, user, password, connectionLimit: 5 }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

let db: Kysely<DB>;
let canWrite = false;
const channelUrl = `test_ch_${nanoid(10)}`;
const userId = `test_u_${nanoid(10)}`;
const messageIds: string[] = [];

// Discovered at setup: a real commentary and the page/verse its location maps to.
let comId: number;
let pageSlug: string;
let verseNum: string;

beforeAll(async () => {
  db = buildWriteDb();
  try {
    await db.insertInto('messenger_users').values({ user_id: userId, nickname: 'T', profile_url: '', is_bot: 0 }).execute();
    await db.insertInto('messenger_channels').values({ channel_url: channelUrl, name: 'T', custom_type: 'private' }).execute();
    canWrite = true;
  } catch {
    canWrite = false; // read-only env: suite becomes a no-op
  }
  if (!canWrite) return;

  // Find a commentary whose location_guid (a bom_text.guid) resolves via
  // bom_text.{page,link} + SlugResolver to a "<page-slug>/<verse-num>" path.
  // Use 200 candidates to ensure we find one.
  const candidates = await db
    .selectFrom('bom_xtras_commentary')
    .select(['id', 'location_guid'])
    .where('location_guid', 'is not', null)
    .where('location_guid', '!=', '')
    .where('location_guid', '!=', '0')
    .where('location_guid', '!=', '-1')
    .where('location_guid', '!=', 'NULL')
    .limit(200)
    .execute();

  // Fetch bom_text rows for candidate location_guids
  const guids = candidates.map((c) => c.location_guid as string);
  const textRows = await db
    .selectFrom('bom_text')
    .select(['guid', 'page', 'link'])
    .where('guid', 'in', guids)
    .execute();
  const textByGuid = new Map(textRows.map((r) => [r.guid, r]));

  // Resolve page guids to slug paths via SlugResolver
  const pageGuids = [...new Set(textRows.map((r) => r.page).filter((p): p is string => !!p))];
  const pageSlugs = await new SlugResolver(db).pathsForLinks(pageGuids);

  for (const c of candidates) {
    const text = textByGuid.get(c.location_guid as string);
    if (!text?.page || text.link == null) continue;
    const pagePath = pageSlugs.get(text.page as string);
    if (!pagePath) continue;
    const fullSlug = `${pagePath}/${text.link}`;
    const m = fullSlug.match(/(.*?)\/(\d+)$/);
    if (m) {
      comId = Number(c.id);
      pageSlug = m[1];
      verseNum = m[2];
      break;
    }
  }
  expect(comId).toBeDefined();

  // Seed messages: postMessage with link: { type: 'com', target } so that the
  // assembled data JSON contains {"links":{"com":"<id>"}} as the service reads it.
  const seed = async (message: string, customType: string, comTarget?: number) => {
    const dto = await postMessage(db, {
      channelUrl,
      userId,
      message,
      customType,
      ...(comTarget != null ? { link: { type: 'com', target: String(comTarget) } } : {}),
    });
    messageIds.push(dto.message_id);
  };
  await seed('on this page w/ commentary', pageSlug, comId);
  await seed('on this page, plain', pageSlug);
  await seed('different page', 'some-other-page', comId);
});

afterAll(async () => {
  if (canWrite) {
    if (messageIds.length) await db.deleteFrom('messenger_messages').where('message_id', 'in', messageIds).execute();
    await db.deleteFrom('messenger_channels').where('channel_url', '=', channelUrl).execute();
    await db.deleteFrom('messenger_users').where('user_id', '=', userId).execute();
  }
  await db.destroy();
});

describe('getPageComments', () => {
  it('returns only page-scoped messages with server-resolved verse counts', async () => {
    if (!canWrite) return;
    const { messages, counts } = await getPageComments(db, channelUrl, pageSlug);
    const ids = messages.map((m) => m.message_id);
    expect(ids).toContain(messageIds[0]);
    expect(ids).toContain(messageIds[1]);
    expect(ids).not.toContain(messageIds[2]); // other page's message excluded in SQL
    expect(counts[verseNum]?.com).toContain(comId);
  });

  it('returns empty counts when no com/img links exist', async () => {
    if (!canWrite) return;
    const { counts } = await getPageComments(db, channelUrl, 'page-with-no-comments-xyz');
    expect(counts).toEqual({});
  });
});
