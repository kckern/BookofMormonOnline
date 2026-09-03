// One-off: seed the LIVE unlisted Reformers channel (981706be…) with the
// current-bot discussion that currently lives only in the private archive
// (36eddcfa…). COPIES messages (new message_ids, remapped parent_message_id) so
// the archive stays intact; rollback = DELETE FROM messenger_messages WHERE
// channel_url = LIVE (the live channel is empty until this runs).
//
// Scope: only threads ROOTED by a current live-channel member are copied, plus
// their descendants authored by current members. Purely-legacy threads and
// current replies hanging under legacy roots are skipped (they would orphan).
//
// Dry-run by default. Pass --apply to write. Reads DB creds from the systemd
// runtime env file (never printed).
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

const APPLY = process.argv.includes('--apply');
const LIVE = '981706be763a135623f56e621e39f9b9';
const ARCHIVE = '36eddcfa954553c01a2b8bacb6ff86f4';

const env = {};
for (const l of readFileSync('/run/user/1003/bom-dev.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const conn = await mysql.createConnection({ host: env.MYSQL_HOST, port: +(env.MYSQL_PORT || 3306), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DB }); // pragma: allowlist secret
const q = async (s, a) => { const [r] = await conn.query(s, a); return r; };

// 0. Safety: live channel must be empty (guards against double-run).
const liveCount = (await q('SELECT COUNT(*) c FROM messenger_messages WHERE channel_url=?', [LIVE]))[0].c;
console.log(`LIVE channel current message count: ${liveCount}`);
if (liveCount > 0 && APPLY) { console.error('ABORT: live channel is not empty; refusing to double-seed.'); process.exit(1); }

// 1. Current members of the live channel = the identities we migrate.
const members = new Set((await q('SELECT user_id FROM messenger_members WHERE channel_url=?', [LIVE])).map(r => r.user_id));

// 2. All live, non-deleted MESG messages in the archive, oldest-first.
const rows = await q(
  "SELECT message_id,user_id,message_type,message,custom_type,link_type,link_target,link_aux,metadata,parent_message_id,created_at,updated_at FROM messenger_messages WHERE channel_url=? AND message_type='MESG' AND (is_deleted=0 OR is_deleted IS NULL) ORDER BY created_at ASC",
  [ARCHIVE]);
const byId = new Map(rows.map(r => [r.message_id, r]));

// 3. Include a message iff it is authored by a current member AND (it is a root
//    OR its parent is already included). Iterate to fixpoint for nested replies.
const include = new Set();
const isCurrent = (r) => members.has(r.user_id);
for (const r of rows) if (r.parent_message_id == null && isCurrent(r)) include.add(r.message_id);
let changed = true;
while (changed) {
  changed = false;
  for (const r of rows) {
    if (include.has(r.message_id)) continue;
    if (!isCurrent(r)) continue;
    if (r.parent_message_id != null && include.has(r.parent_message_id)) { include.add(r.message_id); changed = true; }
  }
}

const migrate = rows.filter(r => include.has(r.message_id));
const skippedLegacy = rows.filter(r => !isCurrent(r));
const skippedOrphan = rows.filter(r => isCurrent(r) && !include.has(r.message_id));
const roots = migrate.filter(r => r.parent_message_id == null);

// 4. New id map + remap parents. message_id is varchar(11) and the frontend
//    permalink route is :messageId(\d+) — digits ONLY. Generate collision-free
//    NUMERIC ids sequentially above the current global max (all existing numeric
//    ids are <= base, so base+k never collides; non-numeric ids differ by charset).
const base = Number((await q('SELECT MAX(CAST(message_id AS UNSIGNED)) mx FROM messenger_messages'))[0].mx);
if (base + migrate.length > 99999999999) { console.error('ABORT: new ids would exceed varchar(11).'); process.exit(1); }
const idMap = new Map();
migrate.forEach((r, i) => idMap.set(r.message_id, String(base + i + 1)));

console.log(`\n=== MIGRATION PLAN (${APPLY ? 'APPLY' : 'DRY RUN'}) ===`);
console.log(`  live members (current identities): ${members.size}`);
console.log(`  archive live MESG messages       : ${rows.length}`);
console.log(`  -> migrate (current threads)     : ${migrate.length}  (${roots.length} roots + ${migrate.length - roots.length} replies)`);
console.log(`  -> skip legacy-authored          : ${skippedLegacy.length}`);
console.log(`  -> skip current-under-legacy     : ${skippedOrphan.length}`);
console.log('\n  first 3 roots to appear in the feed:');
for (const r of roots.slice(0, 3)) console.log(`    [${r.created_at.toISOString?.() || r.created_at}] ${byId.get(r.message_id).user_id.slice(0,8)} :: ${String(r.message).replace(/\s+/g,' ').slice(0,70)}`);

if (!APPLY) { console.log('\n(dry run — no writes. Re-run with --apply to insert.)'); await conn.end(); process.exit(0); }

// 5. Insert copies in a transaction.
await conn.beginTransaction();
try {
  let n = 0;
  for (const r of migrate) {
    await q(
      'INSERT INTO messenger_messages (message_id,channel_url,user_id,message_type,message,custom_type,link_type,link_target,link_aux,metadata,parent_message_id,is_deleted,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?)',
      [idMap.get(r.message_id), LIVE, r.user_id, r.message_type, r.message, r.custom_type, r.link_type, r.link_target, r.link_aux, r.metadata == null ? null : JSON.stringify(r.metadata), r.parent_message_id == null ? null : idMap.get(r.parent_message_id), r.created_at, r.updated_at]);
    n++;
  }
  await conn.commit();
  console.log(`\nAPPLIED: inserted ${n} messages into LIVE ${LIVE}.`);
  const check = (await q('SELECT COUNT(*) c, SUM(parent_message_id IS NULL) roots FROM messenger_messages WHERE channel_url=?', [LIVE]))[0];
  console.log(`  verify: live now has ${check.c} messages (${check.roots} roots).`);
} catch (e) { await conn.rollback(); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
await conn.end();
