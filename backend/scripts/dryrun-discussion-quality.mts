/**
 * Read/generate-only verification for the discussion-quality rebuild.
 * NO posting, NO scheduling — safe against prod DB.
 *   1. Style-weighted passage picker: distribution + resolution over N draws.
 *   2. One opener on a PICKED passage (dynamic flow + HIGHLIGHT, no header).
 *   3. One reply per discourse move (rotation variety, no rubber-stamps).
 * Run: cd backend && node node_modules/tsx/dist/cli.mjs scripts/dryrun-discussion-quality.mts
 */
import 'dotenv/config';
import { getDb } from '../src/data/db.js';
import { resolvePassageBlock } from '../src/messaging/contentRefs.js';
import { pickStyleWeightedPassage } from '../src/bots/passagePicker.js';
import { sampleReplyShape, replyLengthInstruction, OPENER_LENGTH_INSTRUCTION } from '../src/bots/replyShape.js';
import { moveInstruction, type DiscussionMove } from '../src/bots/discussionMoves.js';
import { parseOpenerHighlight, htmlToPlain } from '../src/bots/openerHighlight.js';
import { generateBotReply, type BotTurn } from '../src/bots/generate.js';
import { botLog, countSentences } from '../src/bots/logger.js';

const CH = '981706be763a135623f56e621e39f9b9';
const db = getDb();
const stripWordCount = (t?: string) => (t || '')
  .replace(/Keep the response between\s+\d+\s+and\s+\d+\s+words\.?/i, '').replace(/[ \t]{2,}/g, ' ').trim();

console.log('\n=== picker: 40 style-weighted draws ===');
const buckets: Record<string, number> = {};
const styles: Record<string, number> = {};
let unresolved = 0;
const samples: string[] = [];
for (let i = 0; i < 40; i++) {
  const p = await pickStyleWeightedPassage(db);
  if (!p) { unresolved++; continue; }
  buckets[p.bucket] = (buckets[p.bucket] || 0) + 1;
  styles[p.style] = (styles[p.style] || 0) + 1;
  if (!(await resolvePassageBlock(db, p.passageRef))) unresolved++;
  if (i < 12) samples.push(`${p.passageRef} [${p.style}]`);
}
console.log('buckets:', JSON.stringify(buckets), '| styles:', JSON.stringify(styles), '| unresolved:', unresolved);
console.log('sample passages:', samples.join('  ·  '));

const config = await db.selectFrom('bom_ai_discussion_config').select(['prompt_template', 'response_guardrails'])
  .where('channel_url', '=', CH).executeTakeFirst();
const baseInstr = [stripWordCount(config?.prompt_template), config?.response_guardrails].filter(Boolean).join('\n\n');
const bots = await db.selectFrom('messenger_members as m')
  .innerJoin('bom_bot as b', 'b.bot_id', 'm.user_id')
  .select(['b.bot_id', 'b.display_name', 'b.model'])
  .where('m.channel_url', '=', CH).where('m.state', '=', 'joined')
  .where('b.enabled', '=', 1).where('b.bot_class', '=', 'study').where('b.model', 'is not', null).limit(8).execute();

console.log('\n=== opener on a PICKED passage (dynamic + HIGHLIGHT, no header) ===');
let picked = await pickStyleWeightedPassage(db);
while (picked && picked.bucket !== 'discourse_poetry') picked = await pickStyleWeightedPassage(db); // show a meaty one
const block = picked ? await resolvePassageBlock(db, picked.passageRef) : null;
if (picked && block) {
  const openerInstr = [baseInstr, OPENER_LENGTH_INSTRUCTION,
    `HIGHLIGHT: after your argument, on a final separate line, write "HIGHLIGHT: " followed by the exact 3-10 word phrase, copied verbatim, from this linked passage text:\n"${htmlToPlain(block.text)}"`].join('\n\n');
  const raw = await generateBotReply(db, bots[0]!.bot_id, [
    { role: 'user', content: openerInstr },
    { role: 'user', content: `Passage: ${picked.passageRef}\nMake your opening argument about this passage.` },
  ], { log: botLog.child({ dryRun: true }), label: 'opener', model: bots[0]!.model ?? undefined });
  const parsed = parseOpenerHighlight(raw ?? '', block.text);
  console.log(`picked=${picked.passageRef} [${picked.style}] anchor=${block.pageSlug} | opener=${bots[0]!.display_name}`);
  console.log(`HIGHLIGHT: ${parsed.highlight ? '“' + parsed.highlight + '”' : '(none)'} | starts-with-ref? ${/^\s*\d?\s?\w+\s+\d+:\d/.test(parsed.body) ? 'YES(bad)' : 'no(good)'}`);
  console.log(parsed.body);
}

console.log('\n=== moves: one reply per discourse move (no rubber-stamps) ===');
const rootMsg = (await db.selectFrom('messenger_messages').select('message')
  .where('channel_url', '=', CH).where('custom_type', '=', 'bot_prompt')
  .orderBy('created_at', 'desc').executeTakeFirst())?.message ?? 'A passage worth discussing.';
const moves: DiscussionMove[] = ['expand', 'clarify', 'pushback', 'probe', 'reframe', 'concede_qualify', 'respond'];
for (let i = 0; i < moves.length; i++) {
  const move = moves[i]!;
  const bot = bots[(i + 1) % bots.length]!;
  const shape = sampleReplyShape();
  const convo: BotTurn[] = [
    { role: 'user', content: `${baseInstr}\n\n${moveInstruction(move)}\n\n${replyLengthInstruction(shape)}` },
    { role: 'user', content: rootMsg },
  ];
  const text = await generateBotReply(db, bot.bot_id, convo, { log: botLog.child({ dryRun: true, move }), label: move, model: bot.model ?? undefined });
  console.log(`\n--- [${move}] ${bot.display_name} | ${countSentences(text ?? '')} sent | opensWithAgree=${/^\s*I agree/i.test(text ?? '')}`);
  console.log(text);
}
console.log('\n[dry-run complete — nothing was posted]');
process.exit(0);
