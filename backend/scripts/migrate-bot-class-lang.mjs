/**
 * Add bot_class + lang to bom_bot and backfill the bot registry. Idempotent.
 *
 * See docs/plans/2026-06-11-study-bot-enrichment-design.md.
 *
 *   - ALTER bom_bot: bot_class ENUM('study','community') DEFAULT 'community',
 *     lang VARCHAR(12) NULL (NULL = all languages)
 *   - existing rows (the reformers) stay 'community' via the column default
 *   - upsert a 'study' row for every messenger_users bot that carries a
 *     metadata.lang + welcome payload (the per-language study bots)
 *   - upsert Help Desk + Linguist Agent as 'study' with lang NULL
 *
 * Run (backend on RW creds): node backend/scripts/migrate-bot-class-lang.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function env(p) {
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
    let v = m[2].trim(); if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

// Pluggable assistants with no language scope (visible in every language).
const UNSCOPED_STUDY_BOTS = [
  'd7fb4f2fdc1f9e57a5d2b9f70c4d1386', // Help Desk
  'a39730b7d46d6c38f1f28c832ea18e12', // Linguist Agent
];

(async () => {
  const e = env(path.join(REPO, 'backend/.env'));
  const db = await mysql.createConnection({ host: e.MYSQL_HOST, port: Number(e.MYSQL_PORT || 3306), user: e.MYSQL_USER, password: e.MYSQL_PASSWORD, database: e.MYSQL_DB });

  // 1. Columns (idempotent via information_schema probe).
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bom_bot'`,
  );
  const have = new Set(cols.map(c => c.COLUMN_NAME));
  if (!have.has('bot_class')) {
    await db.query(`ALTER TABLE bom_bot ADD COLUMN bot_class ENUM('study','community') NOT NULL DEFAULT 'community' AFTER display_name`);
    console.log('added bom_bot.bot_class');
  } else console.log('bom_bot.bot_class already present');
  if (!have.has('lang')) {
    await db.query(`ALTER TABLE bom_bot ADD COLUMN lang VARCHAR(12) NULL DEFAULT NULL AFTER bot_class`);
    console.log('added bom_bot.lang');
  } else console.log('bom_bot.lang already present');

  // 2. Language-scoped study bots: derive from messenger_users metadata
  //    (lang + welcome payload identifies the per-language study bots).
  const [users] = await db.query(
    `SELECT user_id, nickname, metadata FROM messenger_users WHERE is_bot = 1`,
  );
  const upserts = [];
  for (const u of users) {
    const meta = typeof u.metadata === 'string' ? JSON.parse(u.metadata || 'null') : u.metadata;
    if (meta?.lang && meta?.welcome) upserts.push({ botId: u.user_id, name: u.nickname, lang: meta.lang });
    else if (UNSCOPED_STUDY_BOTS.includes(u.user_id)) upserts.push({ botId: u.user_id, name: u.nickname, lang: null });
  }

  for (const b of upserts) {
    await db.query(
      `INSERT INTO bom_bot (bot_id, display_name, bot_class, lang, enabled)
       VALUES (?, ?, 'study', ?, 1)
       ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), bot_class='study', lang=VALUES(lang), enabled=1`,
      [b.botId, b.name, b.lang],
    );
    console.log(`study bot upserted: ${b.name} (${b.lang ?? 'all languages'})`);
  }

  const [summary] = await db.query(
    `SELECT bot_class, lang, COUNT(*) n FROM bom_bot GROUP BY bot_class, lang ORDER BY bot_class, lang`,
  );
  console.table(summary);
  await db.end();
})().catch(err => { console.error(err); process.exit(1); });
