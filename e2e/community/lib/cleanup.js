/**
 * Guarded RW teardown — the only place this suite deletes rows from bom_prd.
 *
 * Two kinds of artifact the UI creates:
 *   1. Whole groups (solo-group creation) → delete the channel + its children,
 *      but ONLY if the channel name carries the MARKER.
 *   2. Individual messages posted into a SHARED channel (study hall, a study
 *      page) → delete just those messages, ONLY if the message text carries the
 *      MARKER. Never touch the shared channel itself.
 *
 * Every delete is marker-gated; a hard cap aborts rather than mass-deleting if
 * the marker ever matches more rows than a correct run could create.
 */
const mysql = require('mysql2/promise');
const { MARKER, db: dbCfg } = require('./config');

const MAX_PURGE = 40; // a correct run creates far fewer marked rows than this

let pool = null;
function getPool() {
  if (!pool) {
    if (!dbCfg.user || !dbCfg.password || !dbCfg.database) {
      throw new Error('community-e2e/cleanup: missing RW creds in backend/.env');
    }
    pool = mysql.createPool({ ...dbCfg, connectionLimit: 4, waitForConnections: true });
  }
  return pool;
}
async function query(sql, params) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Delete a test channel + all its children. Guarded: name MUST contain MARKER. */
async function deleteGroupCascade(channelUrl) {
  if (!channelUrl) return { deleted: false, reason: 'no-url' };
  const rows = await query('SELECT name FROM messenger_channels WHERE channel_url = ? LIMIT 1', [channelUrl]);
  if (!rows.length) return { deleted: false, reason: 'already-gone' };
  if (!String(rows[0].name || '').includes(MARKER)) {
    throw new Error(`TEARDOWN REFUSED: channel ${channelUrl} name lacks ${MARKER} — refusing to delete a non-test group`);
  }
  const inMsgs = '(SELECT message_id FROM messenger_messages WHERE channel_url = ?)';
  await query(`DELETE FROM messenger_reactions  WHERE message_id IN ${inMsgs}`, [channelUrl]);
  await query(`DELETE FROM messenger_highlights WHERE message_id IN ${inMsgs}`, [channelUrl]);
  await query(`DELETE FROM messenger_files      WHERE message_id IN ${inMsgs}`, [channelUrl]);
  await query('DELETE FROM messenger_messages WHERE channel_url = ?', [channelUrl]);
  await query('DELETE FROM messenger_members  WHERE channel_url = ?', [channelUrl]);
  await query('DELETE FROM messenger_channels WHERE channel_url = ?', [channelUrl]);
  return { deleted: true };
}

/** Delete specific messages by id. Guarded: each message text MUST contain MARKER. */
async function deleteMessagesByIds(messageIds = []) {
  const ids = messageIds.filter(Boolean).map(String);
  if (!ids.length) return { deleted: 0 };
  const rows = await query(
    `SELECT message_id, message FROM messenger_messages WHERE message_id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  for (const r of rows) {
    if (!String(r.message || '').includes(MARKER)) {
      throw new Error(`TEARDOWN REFUSED: message ${r.message_id} text lacks ${MARKER} — refusing to delete a non-test message`);
    }
  }
  const found = rows.map((r) => String(r.message_id));
  if (!found.length) return { deleted: 0 };
  await query(`DELETE FROM messenger_reactions WHERE message_id IN (${found.map(() => '?').join(',')})`, found);
  // also delete any threaded replies whose parent is one of these (marker-gated children)
  await query(`DELETE FROM messenger_messages WHERE message_id IN (${found.map(() => '?').join(',')}) OR parent_message_id IN (${found.map(() => '?').join(',')})`, [...found, ...found]);
  return { deleted: found.length };
}

/**
 * Safety sweep: remove every MARKER-tagged group + message left anywhere (e.g.
 * after a crashed run). Capped — aborts instead of mass-deleting on overflow.
 */
async function sweepAllMarked() {
  const chans = await query('SELECT channel_url, name FROM messenger_channels WHERE name LIKE ?', [`%${MARKER}%`]);
  const msgs = await query('SELECT message_id FROM messenger_messages WHERE message LIKE ?', [`%${MARKER}%`]);
  if (chans.length + msgs.length > MAX_PURGE) {
    throw new Error(`SWEEP ABORTED: ${chans.length} groups + ${msgs.length} messages carry ${MARKER}, exceeds cap ${MAX_PURGE}. Inspect manually.`);
  }
  let groups = 0;
  for (const c of chans) {
    // eslint-disable-next-line no-await-in-loop
    const r = await deleteGroupCascade(c.channel_url);
    if (r.deleted) groups++;
  }
  // messages not already removed with their channel
  const remaining = await query('SELECT message_id FROM messenger_messages WHERE message LIKE ?', [`%${MARKER}%`]);
  await deleteMessagesByIds(remaining.map((r) => r.message_id));
  return { groups, messages: msgs.length };
}

/** Count marker-tagged artifacts still present (for a leave-no-trace assertion). */
async function countMarked() {
  const [{ c: groups }] = await query('SELECT COUNT(*) c FROM messenger_channels WHERE name LIKE ?', [`%${MARKER}%`]);
  const [{ c: messages }] = await query('SELECT COUNT(*) c FROM messenger_messages WHERE message LIKE ?', [`%${MARKER}%`]);
  return { groups, messages };
}

async function close() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { query, deleteGroupCascade, deleteMessagesByIds, sweepAllMarked, countMarked, close };
