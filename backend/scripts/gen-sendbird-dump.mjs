/**
 * gen-sendbird-dump.mjs
 *
 * Turns the Sendbird YAML export (/home/bom/sendbird/) into ONE manually-runnable
 * MySQL dump (backend/scripts/out/sendbird-seed.sql) that:
 *   A. CREATE TABLE bom_user_meta (the only schema change)
 *   B. TRUNCATEs the messenger_* test seed in FK order
 *   C. seeds messenger_users (thin human rows + full bot/orphan rows)
 *   D. upserts bom_user_meta for human users (bookmark/active_group/soft metadata)
 *   E. messenger_channels (skip SENDBIRD_DESK_CHANNEL_CUSTOM_TYPE)
 *   F. messenger_members
 *   G. messenger_messages (MESG / ADMM->ADMN / FILE)
 *   H. messenger_reactions
 *   I. messenger_highlights
 *   J. messenger_files
 *
 * The generator only READS the DB (to reverse-md5 the export user_id -> bom_user.user).
 * It does NOT execute any SQL. The user runs the produced .sql manually on prod.
 *
 * Decisions implemented (from docs/specs + docs/audits, 2026-06-10):
 *  - identity: messenger_users.user_id == md5(bom_user.user). Reverse-lookup builds
 *    bom_user_id. Non-matches are bots/orphans (bom_user_id NULL).
 *  - timestamps: channel/user created_at = SECONDS; message created_at, last_seen_at,
 *    joined_ts = MILLISECONDS. Emitted via FROM_UNIXTIME(s) / FROM_UNIXTIME(ms/1000).
 *  - ADMM -> ADMN. FILE inferred from non-empty file:{} (none exist in this export).
 *  - ADMM auto-events with no user{} block: author resolved to the channel's created_by
 *    user_id (so the NOT NULL messenger_messages.user_id FK is satisfied); the join-notice
 *    text is kept because the UI renders it. If no creator either, the message is skipped.
 *  - desk channels skipped entirely (and their members/messages).
 *  - data.links {key:value} -> link_type=key, link_target=String(value); link_aux from a
 *    dotted target if present. data.highlights[] -> messenger_highlights rows.
 *  - highlight id is deterministic (`<message_id>_<ordinal>` trimmed to 11) for stable reruns.
 *
 * Run: cd backend && npx tsx scripts/gen-sendbird-dump.mjs
 */

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const yaml = require('/home/bom/BookofMormonOnline/node_modules/js-yaml/index.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = '/home/bom/sendbird';
const OUT_DIR = path.join(__dirname, 'out');
const OUT_FILE = path.join(OUT_DIR, 'sendbird-seed.sql');

const md5 = (s) => createHash('md5').update(String(s)).digest('hex');

// ---- SQL emission helpers -------------------------------------------------

/** Escape a JS string for a single-quoted MySQL string literal. */
function sqlEsc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x00/g, '');
}
/** MySQL string literal or NULL. */
function S(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${sqlEsc(v)}'`;
}
/** Like S but keeps empty string as '' (for required NOT NULL text). */
function Sreq(v) {
  if (v === null || v === undefined) return "''";
  return `'${sqlEsc(v)}'`;
}
/** JSON value -> MySQL string literal that the JSON column parses, or NULL. */
function J(obj) {
  if (obj === null || obj === undefined) return 'NULL';
  // If already a JSON string, validate/normalize; else stringify.
  let jsonStr;
  if (typeof obj === 'string') {
    const t = obj.trim();
    if (t === '') return 'NULL';
    try {
      jsonStr = JSON.stringify(JSON.parse(t));
    } catch {
      // not valid JSON: store as a JSON string scalar
      jsonStr = JSON.stringify(t);
    }
  } else {
    jsonStr = JSON.stringify(obj);
  }
  return `'${sqlEsc(jsonStr)}'`;
}
/** seconds epoch -> FROM_UNIXTIME literal or NULL */
function TS_S(sec) {
  if (sec === null || sec === undefined || sec === '' || Number(sec) <= 0) return 'NULL';
  return `FROM_UNIXTIME(${Number(sec)})`;
}
/** ms epoch -> FROM_UNIXTIME(ms/1000) literal or NULL */
function TS_MS(ms) {
  if (ms === null || ms === undefined || ms === '' || Number(ms) <= 0) return 'NULL';
  return `FROM_UNIXTIME(${Number(ms)}/1000)`;
}
function N(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return String(Number(v));
}

/** Batched multi-row INSERT ... ON DUPLICATE KEY UPDATE emitter. */
function emitBatch(out, table, columns, rows, updateClause, batchSize = 200) {
  if (rows.length === 0) {
    out.push(`-- (no rows for ${table})`);
    return;
  }
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    out.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES`);
    out.push(chunk.map((r) => `  (${r.join(', ')})`).join(',\n') + '');
    out.push(`ON DUPLICATE KEY UPDATE ${updateClause};`);
  }
}

// ---- DB: build md5(user) -> user map --------------------------------------

async function buildUserMap() {
  const { getDb, closeDb } = await import('../src/data/db.js');
  const { sql } = await import('kysely');
  const db = getDb();
  const map = new Map(); // md5(user) -> user
  try {
    const res = await sql`SELECT user FROM bom_user`.execute(db);
    for (const row of res.rows) {
      const user = row.user;
      if (user == null) continue;
      map.set(md5(user), user);
    }
  } finally {
    await closeDb();
  }
  return map;
}

// ---- helpers --------------------------------------------------------------

const isHex32 = (s) => typeof s === 'string' && /^[0-9a-f]{32}$/.test(s);

function safeJsonParse(s) {
  if (s == null || typeof s !== 'string') return null;
  const t = s.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function listYml(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') && !f.startsWith('._'))
    .map((f) => path.join(dir, f));
}

/** Read + parse a YAML file; skip (warn) binary/AppleDouble forks gracefully. */
function loadYml(f) {
  const buf = readFileSync(f);
  if (buf.length && buf[0] === 0) {
    console.warn(`      [skip] binary/non-yaml file: ${path.basename(f)}`);
    return null;
  }
  try {
    return yaml.load(buf.toString('utf8'));
  } catch (e) {
    console.warn(`      [skip] unparseable yaml: ${path.basename(f)} (${e.reason || e.message})`);
    return null;
  }
}

// ---- main -----------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('[1/4] Connecting (read-only) to build md5(user)->user map...');
  const userMap = await buildUserMap();
  console.log(`      bom_user rows: ${userMap.size}`);

  // Collected emit rows
  const messengerUsers = new Map(); // user_id -> row array
  const bomUserMeta = new Map(); // username -> row array
  const channelRows = [];
  const memberRows = [];
  const messageRows = [];
  const reactionRows = [];
  const highlightRows = [];
  const fileRows = [];

  // de-dup keys
  const reactionSeen = new Set();
  const memberSeen = new Set();
  const messageSeen = new Set();

  const stats = {
    users: 0,
    humans: 0,
    bots: 0,
    orphans: 0,
    channelsKept: 0,
    channelsSkipped: 0,
    members: 0,
    msgMESG: 0,
    msgADMN: 0,
    msgFILE: 0,
    msgSkippedNoAuthor: 0,
    reactions: 0,
    highlights: 0,
    files: 0,
    syntheticUsers: 0,
  };

  // ---- C/D: parse users/*.yml ---------------------------------------------
  console.log('[2/4] Parsing users/*.yml ...');
  const userFiles = listYml(path.join(EXPORT_DIR, 'users'));

  /** Register a messenger_users row. nickname/profile from export for bots. */
  function registerUser(u, { fromMembers = false } = {}) {
    const uid = u.user_id;
    if (uid == null) return;
    if (messengerUsers.has(uid)) return; // first wins (users/*.yml authoritative)

    const username = userMap.get(uid);
    const isHuman = isHex32(uid) && username != null;

    if (isHuman) {
      // thin human row; nickname/profile resolved from bom_user at read time
      messengerUsers.set(uid, [
        Sreq(uid), // user_id
        S(username), // bom_user_id
        '0', // is_bot
        '0', // is_online
        u.last_seen_at != null ? TS_MS(u.last_seen_at) : 'NULL', // last_seen_at
        'NULL', // nickname
        'NULL', // profile_url
        'NULL', // metadata (humans' soft metadata -> bom_user_meta)
        u.created_at != null ? TS_S(u.created_at) : 'NULL', // created_at
      ]);
    } else {
      // bot or orphan (no bom_user). bot = non-32-hex id (short/staff handle).
      const isBot = !isHex32(uid) ? 1 : 0;
      // metadata bag for bots: keep their export metadata (activeCall etc.)
      const meta = u.metadata && Object.keys(u.metadata).length ? u.metadata : null;
      messengerUsers.set(uid, [
        Sreq(uid),
        'NULL', // bom_user_id
        String(isBot), // is_bot
        '0', // is_online
        u.last_seen_at != null ? TS_MS(u.last_seen_at) : 'NULL',
        Sreq(u.nickname ?? uid), // nickname (NOT NULL)
        S(u.profile_url), // profile_url
        J(meta), // metadata
        u.created_at != null ? TS_S(u.created_at) : 'NULL',
      ]);
      if (isBot) stats.bots++;
      else stats.orphans++;
    }
    stats.users++;
    if (fromMembers) stats.syntheticUsers++;
  }

  for (const f of userFiles) {
    const doc = loadYml(f);
    const u = doc && doc.user;
    if (!u || u.user_id == null) continue;

    const uid = u.user_id;
    const username = userMap.get(uid);
    const isHuman = isHex32(uid) && username != null;

    registerUser(u);

    if (isHuman) {
      stats.humans++;
      // D. bom_user_meta — humans only
      const m = u.metadata || {};
      const bookmark = m.bookmark; // already a JSON string
      const activeGroup = m.activeGroup && m.activeGroup !== '' ? m.activeGroup : null;
      const soft = {
        phone_number: u.phone_number || null,
        preferred_languages: u.preferred_languages || [],
        discovery_keys: u.discovery_keys || [],
        is_hide_me_from_friends: u.is_hide_me_from_friends ?? null,
        require_auth_for_profile_image: u.require_auth_for_profile_image ?? null,
        has_ever_logged_in: u.has_ever_logged_in ?? null,
        is_active: u.is_active ?? null,
      };
      bomUserMeta.set(username, [
        S(username), // user (PK / FK)
        bookmark ? J(bookmark) : 'NULL', // bookmark JSON
        S(activeGroup), // active_group
        J(soft), // metadata JSON
      ]);
    }
  }

  // ---- E..J: parse channels/*.yml -----------------------------------------
  console.log('[3/4] Parsing channels/*.yml ...');
  const channelFiles = listYml(path.join(EXPORT_DIR, 'channels'));

  for (const f of channelFiles) {
    const doc = loadYml(f);
    const ch = doc && doc.channel;
    if (!ch || !ch.channel_url) continue;

    if (ch.custom_type === 'SENDBIRD_DESK_CHANNEL_CUSTOM_TYPE') {
      stats.channelsSkipped++;
      continue;
    }
    stats.channelsKept++;

    const channelUrl = ch.channel_url;
    const createdBy = ch.created_by && ch.created_by.user_id ? ch.created_by.user_id : null;

    // E. channel
    const validTypes = new Set(['DM', 'private', 'public', 'open', 'solo']);
    const customType = validTypes.has(ch.custom_type) ? ch.custom_type : 'DM';
    const chMeta = {
      data: ch.data || '',
      is_distinct: ch.is_distinct ?? null,
      is_public: ch.is_public ?? null,
      has_bot: ch.has_bot ?? null,
      member_count: ch.member_count ?? null,
      created_by: createdBy,
    };
    channelRows.push([
      Sreq(channelUrl), // channel_url
      Sreq(ch.name ?? channelUrl), // name (NOT NULL)
      S(ch.cover_url), // cover_url
      `'${customType}'`, // custom_type
      'NULL', // description
      "'en'", // lang
      J(chMeta), // metadata
      ch.created_at != null ? TS_S(ch.created_at) : 'NULL', // created_at (seconds)
    ]);

    // F. members
    const members = doc.members || [];
    for (const mem of members) {
      const uid = mem.user_id;
      if (uid == null) continue;
      // ensure a messenger_users row exists for this member
      if (!messengerUsers.has(uid)) {
        registerUser(mem, { fromMembers: true });
      }
      const key = `${uid}|${channelUrl}`;
      if (memberSeen.has(key)) continue;
      memberSeen.add(key);

      const role = mem.role === 'operator' || uid === createdBy ? 'operator' : 'member';
      const state = mem.state === 'invited' ? 'invited' : 'joined';
      memberRows.push([
        Sreq(uid), // user_id
        Sreq(channelUrl), // channel_url
        `'${state}'`, // state
        `'${role}'`, // role
        'NULL', // last_read_at
        mem.joined_ts != null ? TS_MS(mem.joined_ts) : 'NULL', // created_at (ms)
      ]);
      stats.members++;
    }

    // G..J. messages
    const messages = doc.messages || [];
    for (const msg of messages) {
      const mid = msg.message_id;
      if (mid == null) continue;
      const messageId = String(mid);
      if (messageSeen.has(messageId)) continue;

      // message_type
      const hasFile = msg.file && typeof msg.file === 'object' && Object.keys(msg.file).length > 0;
      let messageType;
      if (hasFile) messageType = 'FILE';
      else if (msg.type === 'ADMM') messageType = 'ADMN';
      else messageType = 'MESG';

      // author resolution
      let authorId = msg.user && msg.user.user_id ? msg.user.user_id : null;
      if (authorId == null) {
        // ADMM auto-event with no user{} — fall back to channel creator
        authorId = createdBy;
      }
      if (authorId == null) {
        stats.msgSkippedNoAuthor++;
        continue;
      }
      // ensure author exists in messenger_users (orphan-safe)
      if (!messengerUsers.has(authorId)) {
        const synth = msg.user && msg.user.user_id ? msg.user : { user_id: authorId };
        registerUser(synth, { fromMembers: true });
      }

      messageSeen.add(messageId);

      // parse data for links + highlights
      const data = safeJsonParse(msg.data);
      let linkType = null,
        linkTarget = null,
        linkAux = null;
      if (data && data.links && typeof data.links === 'object') {
        const keys = Object.keys(data.links);
        if (keys.length > 0) {
          linkType = keys[0];
          const raw = String(data.links[keys[0]]);
          const dot = raw.indexOf('.');
          if (dot >= 0) {
            linkTarget = raw.slice(0, dot);
            linkAux = raw.slice(dot + 1);
          } else {
            linkTarget = raw;
          }
        }
      }

      messageRows.push([
        Sreq(messageId), // message_id
        Sreq(channelUrl), // channel_url
        Sreq(authorId), // user_id (NOT NULL)
        `'${messageType}'`, // message_type
        Sreq(msg.message ?? ''), // message (NOT NULL)
        S(msg.custom_type), // custom_type
        S(linkType), // link_type
        S(linkTarget), // link_target
        S(linkAux), // link_aux
        msg.parent_message_id != null ? Sreq(String(msg.parent_message_id)) : 'NULL', // parent_message_id
        msg.is_removed ? '1' : '0', // is_deleted
        'NULL', // metadata
        msg.created_at != null ? TS_MS(msg.created_at) : 'NULL', // created_at (ms)
      ]);
      if (messageType === 'MESG') stats.msgMESG++;
      else if (messageType === 'ADMN') stats.msgADMN++;
      else stats.msgFILE++;

      // H. reactions
      const reactions = msg.reactions || [];
      for (const r of reactions) {
        const rkey = r.key || r.reaction_key;
        const uids = r.user_ids || [];
        if (!rkey) continue;
        for (const ruid of uids) {
          const k = `${messageId}|${ruid}|${rkey}`;
          if (reactionSeen.has(k)) continue;
          reactionSeen.add(k);
          // ensure reacting user exists (orphan-safe)
          if (!messengerUsers.has(ruid)) {
            registerUser({ user_id: ruid }, { fromMembers: true });
          }
          reactionRows.push([
            Sreq(messageId), // message_id
            Sreq(ruid), // user_id
            Sreq(rkey), // reaction_key
            r.updated_at != null ? TS_MS(r.updated_at) : 'NULL', // created_at
          ]);
          stats.reactions++;
        }
      }

      // I. highlights
      if (data && Array.isArray(data.highlights)) {
        data.highlights.forEach((text, ordinal) => {
          if (text == null) return;
          // deterministic, collision-free id within varchar(11): base36(message_id)_ordinal
          // (message_id is 10-digit numeric -> <=7 base36 chars; ordinal 0..n).
          const b36 = /^\d+$/.test(messageId) ? Number(messageId).toString(36) : messageId.slice(0, 8);
          const id = `${b36}_${ordinal}`.slice(0, 11);
          highlightRows.push([
            Sreq(id), // id
            Sreq(messageId), // message_id
            String(ordinal), // ordinal
            Sreq(String(text)), // text
          ]);
          stats.highlights++;
        });
      }

      // J. files (FILE messages' file{})
      if (hasFile) {
        const file = msg.file;
        const fileId = `f_${messageId}`.slice(0, 21);
        fileRows.push([
          Sreq(fileId), // file_id
          Sreq(messageId), // message_id
          Sreq(authorId), // user_id
          Sreq(file.url || file.file_url || ''), // file_url
          Sreq(file.name || file.file_name || 'file'), // file_name
          S(file.type || file.file_type), // file_type
          file.size != null ? N(file.size) : 'NULL', // file_size
          'NULL', // thumbnail_url
          'NULL', // metadata
          msg.created_at != null ? TS_MS(msg.created_at) : 'NULL', // created_at
        ]);
        stats.files++;
      }
    }
  }

  // ---- emit .sql ----------------------------------------------------------
  console.log('[4/4] Emitting SQL ...');
  const out = [];
  out.push('-- =====================================================================');
  out.push('-- sendbird-seed.sql — generated by backend/scripts/gen-sendbird-dump.mjs');
  out.push(`-- Generated: ${new Date().toISOString()}`);
  out.push('-- Source: /home/bom/sendbird (users/*.yml, channels/*.yml)');
  out.push('-- Idempotent (INSERT ... ON DUPLICATE KEY UPDATE). Safe to re-run.');
  out.push('-- Run manually:  mysql -h <host> -u <writer> -p <db> < sendbird-seed.sql');
  out.push('-- =====================================================================');
  out.push('SET NAMES utf8mb4;');
  out.push('SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, "STRICT_TRANS_TABLES", ""));');
  out.push('');

  // A. Schema
  out.push('-- ---------------------------------------------------------------------');
  out.push('-- A. Schema: bom_user_meta (1:1 join-on metadata for bom_user)');
  out.push('-- ---------------------------------------------------------------------');
  out.push(`CREATE TABLE IF NOT EXISTS bom_user_meta (
  user VARCHAR(256) NOT NULL,
  bookmark JSON DEFAULT NULL,
  active_group VARCHAR(255) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user),
  CONSTRAINT fk_bom_user_meta_user FOREIGN KEY (user) REFERENCES bom_user(user) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  out.push('');

  // B. Clear test seed
  out.push('-- ---------------------------------------------------------------------');
  out.push('-- B. Clear the fabricated test seed (TRUNCATE in FK-safe order)');
  out.push('-- ---------------------------------------------------------------------');
  out.push('SET FOREIGN_KEY_CHECKS=0;');
  out.push('TRUNCATE TABLE messenger_files;');
  out.push('TRUNCATE TABLE messenger_reactions;');
  out.push('TRUNCATE TABLE messenger_highlights;');
  out.push('TRUNCATE TABLE messenger_messages;');
  out.push('TRUNCATE TABLE messenger_members;');
  out.push('TRUNCATE TABLE messenger_channels;');
  out.push('TRUNCATE TABLE messenger_users;');
  out.push('SET FOREIGN_KEY_CHECKS=1;');
  out.push('');

  // C. messenger_users
  out.push('-- ---------------------------------------------------------------------');
  out.push(`-- C. messenger_users — ${messengerUsers.size} rows ` +
    `(humans=${stats.humans}, bots=${stats.bots}, orphans=${stats.orphans}, synthetic=${stats.syntheticUsers})`);
  out.push('-- ---------------------------------------------------------------------');
  emitBatch(
    out,
    'messenger_users',
    ['user_id', 'bom_user_id', 'is_bot', 'is_online', 'last_seen_at', 'nickname', 'profile_url', 'metadata', 'created_at'],
    [...messengerUsers.values()],
    'bom_user_id=VALUES(bom_user_id), is_bot=VALUES(is_bot), last_seen_at=VALUES(last_seen_at), ' +
      'nickname=VALUES(nickname), profile_url=VALUES(profile_url), metadata=VALUES(metadata), created_at=VALUES(created_at)',
  );
  out.push('');

  // D. bom_user_meta
  out.push('-- ---------------------------------------------------------------------');
  out.push(`-- D. bom_user_meta — ${bomUserMeta.size} human rows (additive; bom_user untouched)`);
  out.push('-- ---------------------------------------------------------------------');
  emitBatch(
    out,
    'bom_user_meta',
    ['user', 'bookmark', 'active_group', 'metadata'],
    [...bomUserMeta.values()],
    'bookmark=VALUES(bookmark), active_group=VALUES(active_group), metadata=VALUES(metadata)',
  );
  out.push('');

  // E. messenger_channels
  out.push('-- ---------------------------------------------------------------------');
  out.push(`-- E. messenger_channels — ${channelRows.length} kept (${stats.channelsSkipped} desk channels skipped)`);
  out.push('-- ---------------------------------------------------------------------');
  emitBatch(
    out,
    'messenger_channels',
    ['channel_url', 'name', 'cover_url', 'custom_type', 'description', 'lang', 'metadata', 'created_at'],
    channelRows,
    'name=VALUES(name), cover_url=VALUES(cover_url), custom_type=VALUES(custom_type), ' +
      'lang=VALUES(lang), metadata=VALUES(metadata), created_at=VALUES(created_at)',
  );
  out.push('');

  // F. messenger_members
  out.push('-- ---------------------------------------------------------------------');
  out.push(`-- F. messenger_members — ${memberRows.length} rows`);
  out.push('-- ---------------------------------------------------------------------');
  emitBatch(
    out,
    'messenger_members',
    ['user_id', 'channel_url', 'state', 'role', 'last_read_at', 'created_at'],
    memberRows,
    'state=VALUES(state), role=VALUES(role), created_at=VALUES(created_at)',
  );
  out.push('');

  // G. messenger_messages
  out.push('-- ---------------------------------------------------------------------');
  out.push(`-- G. messenger_messages — ${messageRows.length} rows ` +
    `(MESG=${stats.msgMESG}, ADMN=${stats.msgADMN}, FILE=${stats.msgFILE}; ${stats.msgSkippedNoAuthor} skipped no-author)`);
  out.push('-- ---------------------------------------------------------------------');
  emitBatch(
    out,
    'messenger_messages',
    ['message_id', 'channel_url', 'user_id', 'message_type', 'message', 'custom_type',
      'link_type', 'link_target', 'link_aux', 'parent_message_id', 'is_deleted', 'metadata', 'created_at'],
    messageRows,
    'channel_url=VALUES(channel_url), user_id=VALUES(user_id), message_type=VALUES(message_type), ' +
      'message=VALUES(message), custom_type=VALUES(custom_type), link_type=VALUES(link_type), ' +
      'link_target=VALUES(link_target), link_aux=VALUES(link_aux), parent_message_id=VALUES(parent_message_id), ' +
      'is_deleted=VALUES(is_deleted), created_at=VALUES(created_at)',
  );
  out.push('');

  // H. messenger_reactions
  out.push('-- ---------------------------------------------------------------------');
  out.push(`-- H. messenger_reactions — ${reactionRows.length} rows`);
  out.push('-- ---------------------------------------------------------------------');
  emitBatch(
    out,
    'messenger_reactions',
    ['message_id', 'user_id', 'reaction_key', 'created_at'],
    reactionRows,
    'created_at=VALUES(created_at)',
  );
  out.push('');

  // I. messenger_highlights
  out.push('-- ---------------------------------------------------------------------');
  out.push(`-- I. messenger_highlights — ${highlightRows.length} rows`);
  out.push('-- ---------------------------------------------------------------------');
  emitBatch(
    out,
    'messenger_highlights',
    ['id', 'message_id', 'ordinal', 'text'],
    highlightRows,
    'message_id=VALUES(message_id), ordinal=VALUES(ordinal), text=VALUES(text)',
  );
  out.push('');

  // J. messenger_files
  out.push('-- ---------------------------------------------------------------------');
  out.push(`-- J. messenger_files — ${fileRows.length} rows`);
  out.push('-- ---------------------------------------------------------------------');
  emitBatch(
    out,
    'messenger_files',
    ['file_id', 'message_id', 'user_id', 'file_url', 'file_name', 'file_type', 'file_size', 'thumbnail_url', 'metadata', 'created_at'],
    fileRows,
    'file_url=VALUES(file_url), file_name=VALUES(file_name), file_type=VALUES(file_type), file_size=VALUES(file_size)',
  );
  out.push('');
  out.push('-- ===================== END OF SEED ===================================');

  writeFileSync(OUT_FILE, out.join('\n'), 'utf8');

  console.log('\n==================== FINAL COUNTS ====================');
  console.log(`messenger_users : ${messengerUsers.size}  (humans=${stats.humans}, bots=${stats.bots}, orphans=${stats.orphans}, synthetic=${stats.syntheticUsers})`);
  console.log(`bom_user_meta   : ${bomUserMeta.size} (humans only)`);
  console.log(`channels        : kept=${stats.channelsKept}, skipped(desk)=${stats.channelsSkipped}`);
  console.log(`members         : ${stats.members}`);
  console.log(`messages        : MESG=${stats.msgMESG}, ADMN=${stats.msgADMN}, FILE=${stats.msgFILE}, skipped(no author)=${stats.msgSkippedNoAuthor}`);
  console.log(`reactions       : ${stats.reactions}`);
  console.log(`highlights      : ${stats.highlights}`);
  console.log(`files           : ${stats.files}`);
  console.log(`\nWrote ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
