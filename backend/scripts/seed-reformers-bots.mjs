/**
 * Port the hardcoded `reformers` virtual-group config (src/api/virtualgroup.ts)
 * into the bot data model. Idempotent.
 *
 *   - mark the 10 reformer messenger_users as is_bot=1
 *   - upsert bom_bot (persona + tags:["reformers"]) for each
 *   - set messenger_channels.metadata.bot on the reformers channel
 *   - ensure a bom_bot_schedule row (daily new_prompt)
 *
 * Run (backend on RW creds): node backend/scripts/seed-reformers-bots.mjs
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

const TAG = 'reformers';
const CHANNEL = '36eddcfa954553c01a2b8bacb6ff86f4';
const COMMENTS = [2, 6];
const PROMPT_THREAD = [
  { role: 'user', content: 'I will first provide you with a scripture to consider, then give you context, then finally ask you a question about it.' },
  { role: 'assistant', content: 'Ready.  Please provide the scripture.' },
  { role: 'user', content: '[[scripture]]' },
  { role: 'assistant', content: 'What is the context of this scripture?' },
  { role: 'user', content: '[[context]]' },
  { role: 'assistant', content: 'What broader context is this scripture found in?' },
  { role: 'user', content: '[[synopsis]]' },
  { role: 'assistant', content: 'Are there any cross references that might help ground the answer in scripture?' },
  { role: 'user', content: '[[crossreferences]]' },
  { role: 'assistant', content: 'Has the audience seen the question before?' },
  { role: 'user', content: 'No, please include the substance of the question in your response.' },
  { role: 'assistant', content: 'How long should the response be?' },
  { role: 'user', content: 'Limit to a single paragraph.' },
  { role: 'assistant', content: 'May I refer to my own works, theology, sermons, or other publications?' },
  { role: 'user', content: 'Yes, please do.' },
  { role: 'assistant', content: 'Shall I speak as if I am responding to a question?' },
  { role: 'user', content: "No, speak as if you are commenting unprompted. Do not begin with 'In considering...'" },
  { role: 'assistant', content: 'Okay, I got it.  Please provide the prompt, and I will give my commentary in a brief paragraph.' },
  { role: 'user', content: '[[question]]' },
  { role: 'assistant', content: 'What a great question!  Here is my commentary:' },
];

// Extract the bots from the hardcoded config.
function extractBots() {
  const src = fs.readFileSync(path.join(REPO, 'src/api/virtualgroup.ts'), 'utf8');
  const re = /"([0-9a-f]{32})":\s*\{\s*nickname:\s*"([^"]+)",\s*persona:\s*`([\s\S]*?)`/g;
  const bots = []; let m;
  while ((m = re.exec(src)) !== null) {
    bots.push({ botId: m[1], nickname: m[2], persona: m[3].replace(/^\s+/gm, '').trim() });
  }
  return bots;
}

(async () => {
  const e = env(path.join(REPO, 'backend/.env'));
  const db = await mysql.createConnection({ host: e.MYSQL_HOST, port: Number(e.MYSQL_PORT || 3306), user: e.MYSQL_USER, password: e.MYSQL_PASSWORD, database: e.MYSQL_DB });
  const bots = extractBots();
  console.log(`extracted ${bots.length} bots from virtualgroup.ts`);

  for (const b of bots) {
    await db.query('UPDATE messenger_users SET is_bot=1, nickname=COALESCE(NULLIF(nickname,""),?) WHERE user_id=?', [b.nickname, b.botId]);
    await db.query(
      `INSERT INTO bom_bot (bot_id, display_name, persona, tags, enabled)
       VALUES (?, ?, ?, CAST(? AS JSON), 1)
       ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), persona=VALUES(persona), tags=VALUES(tags), enabled=1`,
      [b.botId, b.nickname, b.persona, JSON.stringify([TAG])],
    );
  }
  console.log('seeded bom_bot + is_bot flags');

  // channel metadata.bot — merge into existing metadata
  const [chRows] = await db.query('SELECT metadata FROM messenger_channels WHERE channel_url=?', [CHANNEL]);
  let meta = {};
  try { meta = chRows[0]?.metadata ? (typeof chRows[0].metadata === 'string' ? JSON.parse(chRows[0].metadata) : chRows[0].metadata) : {}; } catch { /* */ }
  meta.bot = { tag: TAG, comment_min: COMMENTS[0], comment_max: COMMENTS[1], prompt_thread: PROMPT_THREAD, enabled: true };
  await db.query('UPDATE messenger_channels SET metadata=CAST(? AS JSON) WHERE channel_url=?', [JSON.stringify(meta), CHANNEL]);
  console.log('set messenger_channels.metadata.bot for the reformers channel');

  // schedule — daily new_prompt (idempotent: one per channel+action)
  const [sched] = await db.query("SELECT id FROM bom_bot_schedule WHERE channel_url=? AND action='new_prompt'", [CHANNEL]);
  if (!sched.length) {
    await db.query("INSERT INTO bom_bot_schedule (channel_url, action, cron, cadence_minutes, enabled, next_run_at) VALUES (?, 'new_prompt', '0 14 * * *', 1440, 1, NULL)", [CHANNEL]);
    console.log('added bom_bot_schedule (daily new_prompt)');
  } else {
    console.log('bom_bot_schedule already present');
  }

  await db.end();
  console.log('DONE');
})().catch((err) => { console.error('seed failed:', err.message); process.exit(1); });
