#!/usr/bin/env node
/**
 * 2026-09-01-claim-shadowed-avatars
 *
 * Repairs rows left behind by the bug in
 * docs/bugs/2026-09-01-profile-photo-reverts.md.
 *
 * uploadProfileImage used to write S3 only, but the read path resolves
 * `messenger_users.profile_url || <derived S3 key>`. Any row carrying an
 * inherited avatar (gravatar / api.dicebear.com, stored during the Sendbird
 * migration) therefore shadowed the object the user had just uploaded — the
 * upload succeeded and the photo "reverted" on the next page load.
 *
 * The resolver now claims the row on upload, so this only has to fix rows that
 * are already shadowing a real object. Whether an object exists is not
 * knowable from SQL, so each candidate is probed against the asset host with a
 * 1-byte ranged GET (the CDN 403s HEAD) and only rows with a live upload are
 * rewritten — a user whose gravatar is their ONLY picture keeps it.
 *
 * The new value carries the object's Last-Modified as the cache-busting
 * version, which makes re-running the migration idempotent.
 *
 *   node backend/migrations/2026-09-01-claim-shadowed-avatars.mjs           # dry run
 *   node backend/migrations/2026-09-01-claim-shadowed-avatars.mjs --apply
 */
import crypto from 'node:crypto';
import process from 'node:process';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const ASSET_BASE = (process.env.PROFILE_IMAGE_BASE_URL || 'https://assets.bookofmormon.online')
  .replace(/\/+$/, '');
const PROBE_TIMEOUT_MS = 5000;

const md5 = (value) => crypto.createHash('md5').update(value).digest('hex');

/** Mirrors messaging/users.ts deriveProfileKey: linked rows key off the username. */
const deriveKey = (row) => (row.bom_user_id ? md5(row.bom_user_id) : row.user_id);

async function connect() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB || 'bom_prd',
    ssl: { rejectUnauthorized: false },
  });
}

/**
 * Rows whose stored URL is NOT already the assets host. avatars.dicebear.com
 * is excluded: that host is dead (410) and the read path already scrubs it,
 * so those rows fall through to the derived key on their own.
 */
async function candidates(db) {
  const assetHost = new URL(ASSET_BASE).host;
  const [rows] = await db.query(
    `SELECT user_id, bom_user_id, profile_url
       FROM messenger_users
      WHERE profile_url IS NOT NULL
        AND profile_url <> ''
        AND profile_url NOT LIKE CONCAT('%', ?, '%')
        AND profile_url NOT LIKE '%avatars.dicebear.com%'`,
    [assetHost],
  );
  return rows;
}

/** Returns the object's Last-Modified epoch ms, or null when there is no upload. */
async function uploadedAt(key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${ASSET_BASE}/profiles/${key}.jpg`, {
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
    });
    if (res.status < 200 || res.status >= 300) return null;
    const lastModified = Date.parse(res.headers.get('last-modified') || '');
    return Number.isNaN(lastModified) ? Date.now() : lastModified;
  } catch {
    // Unreachable host: report "no upload" so a network blip can never wipe a
    // stored avatar. Re-run the migration once the host is reachable.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function plan(db) {
  const rows = await candidates(db);
  const shadowing = [];
  for (const row of rows) {
    const key = deriveKey(row);
    const at = await uploadedAt(key);
    if (at === null) continue;
    shadowing.push({
      user_id: row.user_id,
      stored_host: new URL(row.profile_url).host,
      next: `${ASSET_BASE}/profiles/${key}.jpg?v=${at}`,
    });
  }
  return { examined: rows.length, shadowing };
}

async function apply(db, shadowing) {
  await db.beginTransaction();
  try {
    for (const row of shadowing) {
      await db.query('UPDATE messenger_users SET profile_url=? WHERE user_id=?', [
        row.next,
        row.user_id,
      ]);
    }
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

const shouldApply = process.argv.includes('--apply');
const db = await connect();
try {
  const before = await plan(db);
  if (shouldApply && before.shadowing.length) await apply(db, before.shadowing);
  const after = shouldApply ? await plan(db) : before;
  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? 'apply' : 'check',
        examined: before.examined,
        shadowing: before.shadowing,
        remaining: shouldApply ? after.shadowing.length : before.shadowing.length,
      },
      null,
      2,
    ),
  );
  if (shouldApply && after.shadowing.length) process.exitCode = 1;
} finally {
  await db.end();
}
