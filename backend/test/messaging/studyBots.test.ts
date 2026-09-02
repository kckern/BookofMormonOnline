/**
 * test/messaging/studyBots.test.ts
 *
 * Study-bot picker scoping (bot_class + lang on bom_bot).
 * See docs/plans/2026-06-11-study-bot-enrichment-design.md.
 *
 * normalizeBotLang is pure and always runs. listStudyBots tests target the
 * real bom_prd DB (connection mirrors users.test.ts) and are skipped with a
 * BLOCKED message until the bot_class/lang migration has been applied.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Kysely, MysqlDialect, sql, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { listStudyBots, normalizeBotLang } from '../../src/messaging/users.js';

function buildDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user = process.env['MYSQL_USER'] ?? 'root';
  const password = process.env['MYSQL_PASSWORD'] ?? '';

  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({ host, port, database, user, password, connectionLimit: 2 }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

describe('normalizeBotLang', () => {
  it('passes plain language codes through lowercased', () => {
    expect(normalizeBotLang('en')).toBe('en');
    expect(normalizeBotLang('KO')).toBe('ko');
    expect(normalizeBotLang('tgl')).toBe('tgl');
  });

  it('maps English editions to en', () => {
    for (const edition of ['rlds', 'covoc', 'str', 'plain', 'easy', 'concise']) {
      expect(normalizeBotLang(edition)).toBe('en');
    }
  });

  it('defaults missing lang to en', () => {
    expect(normalizeBotLang(undefined)).toBe('en');
    expect(normalizeBotLang(null)).toBe('en');
    expect(normalizeBotLang('')).toBe('en');
  });
});

describe('listStudyBots (live DB)', () => {
  let db: Kysely<DB>;
  let ready = false; // DB reachable AND migration applied

  beforeAll(async () => {
    db = buildDb();
    try {
      const probe = await sql<{ n: number }>`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bom_bot' AND COLUMN_NAME IN ('bot_class','lang')
      `.execute(db);
      ready = Number(probe.rows[0]?.n) === 2;
      if (!ready) console.warn('BLOCKED: bom_bot.bot_class/lang missing — run /tmp/bot-class-lang.sql first');
    } catch (err) {
      console.warn(`BLOCKED: DB unreachable (${(err as Error).message})`);
    }
  });

  afterAll(async () => {
    await db?.destroy();
  });

  it('en returns only study bots, never community bots or junk rows', async (ctx) => {
    if (!ready) return ctx.skip();
    const bots = await listStudyBots(db, 'en');
    const ids = bots.map((bot) => bot.user_id).filter((id): id is string => !!id);
    const registrations = ids.length
      ? await db.selectFrom('bom_bot').select(['bot_id', 'bot_class', 'lang'])
        .where('bot_id', 'in', ids).execute()
      : [];
    expect(registrations).toHaveLength(ids.length);
    expect(registrations.every((bot) => bot.bot_class === 'study')).toBe(true);
    expect(registrations.every((bot) => bot.lang == null || bot.lang === 'en')).toBe(true);
  });

  it('scopes by language', async (ctx) => {
    if (!ready) return ctx.skip();
    const de = await listStudyBots(db, 'de');
    expect(de.map((b) => b.nickname)).toContain('SchriftStudierBot');
    expect(de.map((b) => b.nickname)).not.toContain('StudyBuddy');
  });

  it('English editions read the en study bots', async (ctx) => {
    if (!ready) return ctx.skip();
    const plain = await listStudyBots(db, 'plain');
    expect(plain.map((b) => b.nickname)).toContain('StudyBuddy');
  });

  it('lang-NULL bots appear in every language', async (ctx) => {
    if (!ready) return ctx.skip();
    const eo = await listStudyBots(db, 'eo'); // no Esperanto study bot exists
    const names = eo.map((b) => b.nickname);
    expect(names).toContain('Help Desk');
    expect(names).toContain('Linguist Agent');
    expect(names).not.toContain('StudyBuddy');
  });
});
