/**
 * Guarded RW DB access for teardown — the only place this suite deletes rows.
 *
 * SAFETY (this is bom_prd): a channel may be deleted only when it passes BOTH
 *   1. it is in the run's created-set (we created it this run), AND
 *   2. its messenger_channels.name contains the MARKER.
 * Either check failing → throw, delete nothing. The standalone purge path skips
 * the created-set (no run context) but still requires the MARKER via a LIKE.
 */
const mysql = require('mysql2/promise');
const { MARKER, db: dbCfg } = require('./config');

let pool = null;
function getPool() {
  if (!pool) {
    if (!dbCfg.user || !dbCfg.password || !dbCfg.database) {
      throw new Error('mutations/db: missing RW creds (backend/.env MYSQL_*)');
    }
    pool = mysql.createPool({ ...dbCfg, connectionLimit: 4, waitForConnections: true });
  }
  return pool;
}

async function query(sql, params) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Throw unless channelUrl is safe to delete (created-set member + MARKER in name). */
async function assertChannelDeletable(channelUrl, createdSet) {
  if (!createdSet || !createdSet.has(channelUrl)) {
    throw new Error(`TEARDOWN REFUSED: ${channelUrl} is not in the run created-set`);
  }
  const rows = await query('SELECT name FROM messenger_channels WHERE channel_url = ? LIMIT 1', [channelUrl]);
  if (!rows.length) return false; // already gone
  if (!String(rows[0].name || '').includes(MARKER)) {
    throw new Error(`TEARDOWN REFUSED: ${channelUrl} name lacks ${MARKER} — refusing to delete a non-test channel`);
  }
  return true;
}

/** Delete a test channel + all its messages/children/members. Guarded. */
async function deleteChannelCascade(channelUrl, createdSet) {
  const exists = await assertChannelDeletable(channelUrl, createdSet);
  if (!exists) return { deleted: false, reason: 'already-gone' };
  const inMsgs = '(SELECT message_id FROM messenger_messages WHERE channel_url = ?)';
  // children of messages
  await query(`DELETE FROM messenger_reactions  WHERE message_id IN ${inMsgs}`, [channelUrl]);
  await query(`DELETE FROM messenger_highlights WHERE message_id IN ${inMsgs}`, [channelUrl]);
  await query(`DELETE FROM messenger_files      WHERE message_id IN ${inMsgs}`, [channelUrl]);
  // messages, members, channel
  await query('DELETE FROM messenger_messages WHERE channel_url = ?', [channelUrl]);
  await query('DELETE FROM messenger_members  WHERE channel_url = ?', [channelUrl]);
  await query('DELETE FROM messenger_channels WHERE channel_url = ?', [channelUrl]);
  return { deleted: true };
}

// Hard cap: a correct run never creates this many test channels. If the marker
// query ever returns more, something is wrong — abort rather than mass-delete.
const MAX_PURGE = 25;

/** Standalone purge: every channel whose name carries the MARKER. No created-set. */
async function purgeAllTestChannels() {
  const rows = await query('SELECT channel_url, name FROM messenger_channels WHERE name LIKE ?', [`%${MARKER}%`]);
  if (rows.length > MAX_PURGE) {
    throw new Error(
      `PURGE ABORTED: ${rows.length} '${MARKER}' channels exceed cap ${MAX_PURGE}. ` +
      `Refusing to mass-delete; inspect manually.`,
    );
  }
  const results = [];
  for (const r of rows) {
    // Re-guard with a marker-only created-set so deleteChannelCascade's invariants hold.
    const markerSet = new Set([r.channel_url]);
    // eslint-disable-next-line no-await-in-loop
    const res = await deleteChannelCascade(r.channel_url, markerSet);
    results.push({ channel_url: r.channel_url, ...res });
  }
  return results;
}

/** Delete specific bom_log rows the suite inserted (exact user+timestamp+value match). */
async function deleteLogRows(rows) {
  let n = 0;
  for (const r of rows) {
    if (r.user == null || r.timestamp == null) continue;
    // eslint-disable-next-line no-await-in-loop
    const res = await query(
      'DELETE FROM bom_log WHERE user = ? AND timestamp = ? AND type = ? AND value = ? LIMIT 5',
      [r.user, r.timestamp, r.type ?? 'block', r.value ?? ''],
    );
    n += res.affectedRows || 0;
  }
  return n;
}

/**
 * Ensure a messenger_users row exists for a member so its socket can authenticate
 * (verifyToken needs it). Returns { created } — true only if we inserted it, so
 * teardown can remove exactly what we added.
 */
async function ensureMessengerUser(userId, bomUserId, nickname) {
  const rows = await query('SELECT user_id FROM messenger_users WHERE user_id = ? LIMIT 1', [userId]);
  if (rows.length) return { created: false };
  await query(
    'INSERT INTO messenger_users (user_id, bom_user_id, nickname, is_bot) VALUES (?, ?, ?, 0)',
    [userId, bomUserId, nickname || bomUserId || 'tester'],
  );
  return { created: true };
}

/** Delete a messenger_users row we created. Guarded: only when createdSet says we made it. */
async function deleteMessengerUser(userId, createdSet) {
  if (!createdSet || !createdSet.has(userId)) {
    throw new Error(`REFUSED: messenger_users ${userId} not created by this run`);
  }
  await query('DELETE FROM messenger_users WHERE user_id = ? LIMIT 1', [userId]);
}

async function close() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { query, assertChannelDeletable, deleteChannelCascade, purgeAllTestChannels, deleteLogRows, ensureMessengerUser, deleteMessengerUser, close };
