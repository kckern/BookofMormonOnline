/**
 * Leave-no-trace test: trigger one bot discussion round on the reformers channel
 * via runNewPrompt (the scheduler's exported entry point), verify the bots posted
 * a prompt + Mastra-generated comments, then delete the posted messages and reset
 * the prompt so the channel is left exactly as found.
 *
 * Run with BOT_LLM_MOCK so generation goes THROUGH each bot's Mastra agent without
 * a live key:  BOT_LLM_MOCK=1 npx tsx scripts/test-reformers-mastra.ts
 */
process.env['BOT_LLM_MOCK'] = process.env['BOT_LLM_MOCK'] || '1';

import { getDb } from '../src/data/db.js';
import { runNewPrompt } from '../src/bots/scheduler.js';
import { sql } from 'kysely';

const CH = '36eddcfa954553c01a2b8bacb6ff86f4'; // protestant reformers channel

function fail(msg: string): never {
  console.error('FAIL:', msg);
  process.exit(1);
}

async function main() {
  const db = getDb();

  // snapshot existing messages + the prompt(s) currently unposted, so we can diff
  const before = await db.selectFrom('messenger_messages').select('message_id').where('channel_url', '=', CH).execute();
  const beforeIds = new Set(before.map((r) => String(r.message_id)));

  console.log(`[setup] channel has ${beforeIds.size} messages before the test`);

  const result = await runNewPrompt(db, CH);
  console.log('[runNewPrompt]', JSON.stringify(result));
  if (result.posted < 2) fail(`expected a prompt + ≥1 comment, got posted=${result.posted} (reason=${result.reason ?? 'none'})`);

  // collect what was posted (newest first), join author info
  const after = await db
    .selectFrom('messenger_messages as m')
    .innerJoin('messenger_users as u', 'u.user_id', 'm.user_id')
    .leftJoin('bom_bot as b', 'b.bot_id', 'm.user_id')
    .select(['m.message_id', 'm.user_id', 'm.message', 'm.custom_type', 'm.parent_message_id', 'u.is_bot', 'u.nickname', 'b.display_name', 'b.tags'])
    .where('m.channel_url', '=', CH)
    .execute();
  const posted = after.filter((r) => !beforeIds.has(String(r.message_id)));
  console.log(`[verify] ${posted.length} new messages posted by the round`);

  const prompt = posted.find((r) => r.custom_type === 'bot_prompt');
  const comments = posted.filter((r) => r.custom_type === 'bot_comment');
  if (!prompt) fail('no bot_prompt opener was posted');
  if (comments.length < 1) fail('no bot_comment replies were posted');

  // every posted message must be authored by a bot that is tagged "reformers"
  for (const m of posted) {
    if (m.is_bot !== 1) fail(`message ${m.message_id} authored by non-bot ${m.user_id}`);
    const tags = typeof m.tags === 'string' ? JSON.parse(m.tags) : m.tags;
    if (!Array.isArray(tags) || !tags.includes('reformers')) fail(`bot ${m.display_name} is not tagged reformers (tags=${JSON.stringify(m.tags)})`);
  }

  // every comment must be the Mastra agent output, threaded under the prompt
  for (const c of comments) {
    if (String(c.parent_message_id) !== String(prompt.message_id)) fail(`comment ${c.message_id} not threaded under the prompt`);
    if (!/reflection on the passage\. \[mock\]/.test(c.message)) fail(`comment ${c.message_id} is not the Mastra mock output: "${c.message}"`);
    if (!c.message.startsWith(`As ${c.display_name},`)) fail(`comment voice mismatch: "${c.message}" not spoken by ${c.display_name}`);
  }

  console.log('\n  ✓ opener  :', prompt.display_name, '→', JSON.stringify(prompt.message.slice(0, 70)));
  for (const c of comments) console.log('  ✓ comment :', c.display_name, '→', JSON.stringify(c.message.slice(0, 70)));
  console.log(`\nPASS — ${comments.length} reformer bots commented via their Mastra agents.`);

  // ── leave no trace ──────────────────────────────────────────────────────────
  const postedIds = posted.map((r) => String(r.message_id));
  await db.deleteFrom('messenger_messages').where('channel_url', '=', CH).where('message_id', 'in', postedIds).execute();
  if (result.promptGuid) {
    await db.updateTable('bom_virtualgroup_prompts').set({ thread_id: null }).where('guid', '=', result.promptGuid).execute();
  }
  // also un-thread any prompt that points at a now-deleted opener (belt + braces)
  await db.updateTable('bom_virtualgroup_prompts').set({ thread_id: null }).where('thread_id', 'in', postedIds).execute();

  const leftover = await db.selectFrom('messenger_messages').select('message_id').where('channel_url', '=', CH).where('message_id', 'in', postedIds).execute();
  if (leftover.length) fail(`cleanup incomplete — ${leftover.length} test messages remain`);
  console.log('[cleanup] removed', postedIds.length, 'test messages + reset prompt thread_id — channel restored.');

  await db.destroy();
  process.exit(0);
}

main().catch((e) => fail(e?.stack || e?.message || String(e)));
