#!/usr/bin/env node
/**
 * 2026-09-02-merge-legacy-messenger-users
 *
 * Phase 1 of docs/plans/2026-09-01-identity-avatar-consolidation.md.
 *
 * The Sendbird import left 121 human rows in messenger_users keyed by the old
 * handle (`caspianrex`, `caspianrex_d540bc18`) alongside the md5 row the
 * current backend writes to (`user_id = MD5(bom_user_id)`). Those legacy rows
 * are not decorative: at planning time they owned 2,072 messages and 430
 * reactions, and 70 channels carried one in `metadata.created_by`. Every read
 * path keys on user_id alone, so one person's history was split across up to
 * three identities.
 *
 * This folds each legacy row into its md5 sibling and deletes it, establishing
 * invariant I1: every human row has user_id = MD5(bom_user_id).
 *
 * Every child FK on prod is ON DELETE CASCADE, so a missed repoint would be
 * destroyed by the final DELETE rather than rejected. The script therefore
 * proves each legacy id is unreferenced before deleting it and never trusts
 * the FK. Work is done one legacy row per transaction — a single 121-row
 * transaction would hold FK shared locks on messenger_users rows that the
 * presence writer touches on every socket disconnect.
 *
 * The planner (`planMerge`) is pure and unit-tested; the SQL is deliberately
 * boring. One statement per db.query() (multipleStatements stays off).
 *
 *   node backend/migrations/2026-09-02-merge-legacy-messenger-users.mjs           # dry run
 *   node backend/migrations/2026-09-02-merge-legacy-messenger-users.mjs --apply
 *
 * Take the mysqldump in Task 0.1 first. --apply exits 1 if any post-check
 * is off.
 */
import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const md5 = (value) => crypto.createHash('md5').update(value, 'utf8').digest('hex');
const isMd5 = (id) => /^[a-f0-9]{32}$/i.test(id);

/**
 * Decide what to do with every messenger_users row.
 *
 *   moves         legacy human rows → their md5 sibling (must already exist;
 *                 the planner never invents a target)
 *   deleteOrphans unlinked `test_*` fixtures left behind by integration tests
 *                 (bom_user_id NULL is the *bot* auth path in realtime/server.ts,
 *                 so these are also a small security cleanup)
 *   leftAlone     unlinked non-test humans — reported, never touched
 *
 * Bots and md5 rows are canonical already and are skipped.
 */
export function planMerge(rows) {
  const canonical = new Set(rows.filter((r) => isMd5(r.user_id)).map((r) => r.user_id.toLowerCase()));
  const moves = [];
  const deleteOrphans = [];
  const leftAlone = [];
  for (const r of rows) {
    if (isMd5(r.user_id) || r.is_bot) continue;
    if (!r.bom_user_id) {
      if (/^test_/.test(r.user_id)) deleteOrphans.push(r.user_id);
      else leftAlone.push(r.user_id);
      continue;
    }
    const to = md5(r.bom_user_id);
    if (!canonical.has(to)) throw new Error(`no md5 sibling for ${r.bom_user_id} (legacy row ${r.user_id})`);
    moves.push({ from: r.user_id, to });
  }
  return { moves, deleteOrphans, leftAlone };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB side
// ─────────────────────────────────────────────────────────────────────────────

async function connect() {
  dotenv.config({ path: new URL('../../.env', import.meta.url) });
  return mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB || 'bom_prd',
    ssl: { rejectUnauthorized: false },
  });
}

async function scalar(db, sql, params = []) {
  const [[row]] = await db.query(sql, params);
  return Number(Object.values(row)[0]);
}

async function loadRows(db) {
  const [rows] = await db.query('SELECT user_id, bom_user_id, is_bot FROM messenger_users');
  return rows;
}

/** Everything the dry run prints and --apply re-checks. */
async function checks(db, plan) {
  const legacy = [...plan.moves.map((m) => m.from), ...plan.deleteOrphans];
  const inLegacy = legacy.length ? legacy : ['__none__'];
  const [collisions] = await db.query(
    `SELECT COUNT(*) AS c FROM messenger_reactions r
      WHERE r.user_id IN (?) AND EXISTS (
        SELECT 1 FROM messenger_reactions x
         WHERE x.message_id=r.message_id AND x.reaction_key=r.reaction_key
           AND x.user_id = MD5((SELECT bom_user_id FROM messenger_users u WHERE u.user_id=r.user_id)))`,
    [inLegacy],
  );
  return {
    i1Violations: await scalar(
      db,
      `SELECT COUNT(*) FROM messenger_users
        WHERE (is_bot=0 OR is_bot IS NULL) AND bom_user_id IS NOT NULL AND bom_user_id<>''
          AND user_id<>MD5(bom_user_id)`,
    ),
    legacyRows: await scalar(db, 'SELECT COUNT(*) FROM messenger_users WHERE user_id IN (?)', [inLegacy]),
    messages: await scalar(db, 'SELECT COUNT(*) FROM messenger_messages'),
    reactions: await scalar(db, 'SELECT COUNT(*) FROM messenger_reactions'),
    members: await scalar(db, 'SELECT COUNT(*) FROM messenger_members'),
    files: await scalar(db, 'SELECT COUNT(*) FROM messenger_files'),
    legacyMessages: await scalar(db, 'SELECT COUNT(*) FROM messenger_messages WHERE user_id IN (?)', [inLegacy]),
    legacyReactions: await scalar(db, 'SELECT COUNT(*) FROM messenger_reactions WHERE user_id IN (?)', [inLegacy]),
    legacyMembers: await scalar(db, 'SELECT COUNT(*) FROM messenger_members WHERE user_id IN (?)', [inLegacy]),
    legacyFiles: await scalar(db, 'SELECT COUNT(*) FROM messenger_files WHERE user_id IN (?)', [inLegacy]),
    legacyBots: await scalar(db, 'SELECT COUNT(*) FROM bom_bot WHERE bot_id IN (?)', [inLegacy]),
    orphanMessages: await scalar(db, 'SELECT COUNT(*) FROM messenger_messages WHERE user_id IN (?)', [
      plan.deleteOrphans.length ? plan.deleteOrphans : ['__none__'],
    ]),
    reactionCollisions: Number(collisions[0].c),
    createdByChannels: await scalar(
      db,
      `SELECT COUNT(*) FROM messenger_channels WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.created_by')) IN (?)`,
      [inLegacy],
    ),
    orphanedMessages: await scalar(
      db,
      'SELECT COUNT(*) FROM messenger_messages m LEFT JOIN messenger_users u ON u.user_id=m.user_id WHERE u.user_id IS NULL',
    ),
    // Notification ids embed the actor id (notifications.ts:201). Moot on the
    // 2026-09 data (newest legacy reaction is from 2023) but a re-run on fresher
    // data must see these two numbers.
    recentLegacyReactions: await scalar(
      db,
      'SELECT COUNT(*) FROM messenger_reactions WHERE user_id IN (?) AND created_at > NOW() - INTERVAL 30 DAY',
      [inLegacy],
    ),
    notificationRowsWithLegacy: legacy.length
      ? await scalar(
          db,
          `SELECT COUNT(*) FROM bom_notification n WHERE ${legacy
            .map(() => '(n.dedupe_key LIKE CONCAT(\'%\',?,\'%\') OR n.payload LIKE CONCAT(\'%\',?,\'%\'))')
            .join(' OR ')}`,
          legacy.flatMap((id) => [id, id]),
        )
      : 0,
  };
}

async function withRetry(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error && error.code === 'ER_LOCK_DEADLOCK') return fn();
    throw error;
  }
}

async function refs(db, id) {
  return scalar(
    db,
    `SELECT (SELECT COUNT(*) FROM messenger_messages  WHERE user_id=?)
          + (SELECT COUNT(*) FROM messenger_reactions WHERE user_id=?)
          + (SELECT COUNT(*) FROM messenger_members   WHERE user_id=?)
          + (SELECT COUNT(*) FROM messenger_files     WHERE user_id=?)
          + (SELECT COUNT(*) FROM bom_bot             WHERE bot_id=?) AS refs`,
    [id, id, id, id, id],
  );
}

async function mergeOne(db, { from, to }) {
  await withRetry(async () => {
    await db.beginTransaction();
    try {
      await db.query('UPDATE messenger_messages SET user_id=?, updated_at=updated_at WHERE user_id=?', [to, from]);
      // Name every column: an unnamed INSERT…SELECT would reset created_at to
      // NOW() and resurface every repointed reaction in the 30-day lookback.
      await db.query(
        `INSERT IGNORE INTO messenger_reactions (message_id, user_id, reaction_key, created_at)
           SELECT message_id, ?, reaction_key, created_at FROM messenger_reactions WHERE user_id=?`,
        [to, from],
      );
      await db.query('DELETE FROM messenger_reactions WHERE user_id=?', [from]);
      await db.query(
        `UPDATE messenger_channels SET metadata=JSON_SET(metadata,'$.created_by',?), updated_at=updated_at
          WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.created_by'))=?`,
        [to, from],
      );
      // Picture carry-over: 0 rows affected on the 2026-09 data, kept so a
      // re-run can never downgrade someone to the generated face.
      await db.query(
        `UPDATE messenger_users md JOIN messenger_users lg ON lg.user_id=?
            SET md.profile_url=COALESCE(NULLIF(md.profile_url,''), NULLIF(lg.profile_url,'')), md.updated_at=md.updated_at
          WHERE md.user_id=?`,
        [from, to],
      );
      const remaining = await refs(db, from);
      if (remaining !== 0) throw new Error(`refusing to delete ${from}: ${remaining} rows still reference it`);
      await db.query('DELETE FROM messenger_users WHERE user_id=?', [from]);
      await db.commit();
    } catch (error) {
      await db.rollback();
      throw error;
    }
  });
}

async function deleteOrphan(db, id) {
  await withRetry(async () => {
    await db.beginTransaction();
    try {
      // Delete its messages explicitly rather than letting the cascade take them.
      await db.query('DELETE FROM messenger_messages WHERE user_id=?', [id]);
      const remaining = await refs(db, id);
      if (remaining !== 0) throw new Error(`refusing to delete orphan ${id}: ${remaining} rows still reference it`);
      await db.query('DELETE FROM messenger_users WHERE user_id=?', [id]);
      await db.commit();
    } catch (error) {
      await db.rollback();
      throw error;
    }
  });
}

async function dumpLegacyRows(db, plan) {
  const ids = [...plan.moves.map((m) => m.from), ...plan.deleteOrphans];
  if (!ids.length) return null;
  const [rows] = await db.query('SELECT * FROM messenger_users WHERE user_id IN (?)', [ids]);
  const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out');
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, '2026-09-02-legacy-messenger-users.json');
  writeFileSync(file, JSON.stringify(rows, null, 2));
  return file;
}

async function apply(db, plan) {
  const dumped = await dumpLegacyRows(db, plan);
  for (const move of plan.moves) await mergeOne(db, move);
  for (const id of plan.deleteOrphans) await deleteOrphan(db, id);
  return dumped;
}

async function main() {
  const shouldApply = process.argv.includes('--apply');
  const db = await connect();
  try {
    const plan = planMerge(await loadRows(db));
    const before = await checks(db, plan);
    let dumped = null;
    let after = null;
    let failures = [];
    if (shouldApply) {
      dumped = await apply(db, plan);
      after = await checks(db, planMerge(await loadRows(db)));
      const expectMessages = before.messages - before.orphanMessages;
      const expectReactions = before.reactions - before.reactionCollisions;
      if (after.i1Violations !== 0) failures.push(`I1 violations after: ${after.i1Violations}`);
      if (after.messages !== expectMessages) failures.push(`messages ${after.messages} != ${expectMessages}`);
      if (after.reactions !== expectReactions) failures.push(`reactions ${after.reactions} != ${expectReactions}`);
      if (after.members !== before.members) failures.push(`members ${after.members} != ${before.members}`);
      if (after.orphanedMessages !== 0) failures.push(`orphaned messages: ${after.orphanedMessages}`);
      if (after.createdByChannels !== 0) failures.push(`created_by still legacy: ${after.createdByChannels}`);
      const legacyLeft = await scalar(db, 'SELECT COUNT(*) FROM messenger_users WHERE user_id IN (?)', [
        [...plan.moves.map((m) => m.from), ...plan.deleteOrphans, '__none__'],
      ]);
      if (legacyLeft !== 0) failures.push(`legacy rows still present: ${legacyLeft}`);
    }
    console.log(
      JSON.stringify(
        {
          mode: shouldApply ? 'apply' : 'check',
          plan: {
            moves: plan.moves.length,
            deleteOrphans: plan.deleteOrphans,
            leftAlone: plan.leftAlone,
            distinctTargets: new Set(plan.moves.map((m) => m.to)).size,
          },
          before,
          after,
          dumped,
          failures,
        },
        null,
        2,
      ),
    );
    if (failures.length) process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
