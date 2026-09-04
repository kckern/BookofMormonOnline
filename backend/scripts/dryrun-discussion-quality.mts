/**
 * Read/generate-only verification for the discussion-quality rebuild.
 * NO posting, NO scheduling — safe to run against prod DB.
 *   1. resolvePassageBlock for every enabled topic (WS1 opener linking).
 *   2. A few sample replies with the length histogram + link parsing (WS2/3/4).
 * Run: cd backend && node node_modules/tsx/dist/cli.mjs scripts/dryrun-discussion-quality.mts
 */
import 'dotenv/config';
import { getDb } from '../src/data/db.js';
import { resolvePassageBlock, refToVerseIds } from '../src/messaging/contentRefs.js';
import { sampleReplyShape, replyLengthInstruction } from '../src/bots/replyShape.js';
import { generateBotReply, type BotTurn } from '../src/bots/generate.js';
import { detectReferenceStrings } from '../src/bots/scriptureBridge.js';
import { botLog, countSentences } from '../src/bots/logger.js';

const CH = '981706be763a135623f56e621e39f9b9';
const BOM_FIRST = 31_103, BOM_LAST = 37_706;
const db = getDb();

console.log('\n=== WS1: opener block resolution for every topic ===');
const topics = await db.selectFrom('bom_ai_topic').select(['topic_id', 'passage_ref', 'passage_kind'])
  .where('channel_url', '=', CH).where('enabled', '=', 1).orderBy('topic_id').execute();
let resolved = 0;
for (const t of topics) {
  const b = await resolvePassageBlock(db, t.passage_ref ?? '');
  if (b) resolved++;
  console.log(`${b ? '✓' : '✗ UNRESOLVED'}  ${t.topic_id.padEnd(22)} ${(t.passage_ref ?? '').padEnd(16)} ${b ? `-> ${b.pageSlug}/${b.ordinal} (v${b.unitFirstVerseId})` : ''}`);
}
console.log(`resolved ${resolved}/${topics.length} topics`);

console.log('\n=== WS2/3/4: sample replies (length histogram + link + logs) ===');
const config = await db.selectFrom('bom_ai_discussion_config').select(['prompt_template', 'response_guardrails'])
  .where('channel_url', '=', CH).executeTakeFirst();
const bots = await db.selectFrom('messenger_members as m')
  .innerJoin('bom_bot as b', 'b.bot_id', 'm.user_id')
  .select(['b.bot_id', 'b.display_name', 'b.model'])
  .where('m.channel_url', '=', CH).where('m.state', '=', 'joined')
  .where('b.enabled', '=', 1).where('b.bot_class', '=', 'study')
  .where('b.model', 'is not', null).limit(4).execute();
const root = await db.selectFrom('messenger_messages').select('message')
  .where('channel_url', '=', CH).where('custom_type', '=', 'bot_prompt')
  .orderBy('created_at', 'desc').executeTakeFirst();
const rootMsg = root?.message ?? 'Jacob 2 warns against pride in riches.';

// Mirror scheduler.managedTurnInstructions: strip the hardcoded word count so the
// per-reply length instruction governs.
const stripWordCount = (t?: string) => (t || '')
  .replace(/Keep the response between\s+\d+\s+and\s+\d+\s+words\.?/i, '')
  .replace(/[ \t]{2,}/g, ' ').trim();
const baseInstr = [stripWordCount(config?.prompt_template), config?.response_guardrails].filter(Boolean).join('\n\n');
for (let i = 0; i < Math.min(4, bots.length); i++) {
  const bot = bots[i]!;
  const shape = sampleReplyShape();
  const log = botLog.child({ dryRun: true, botId: bot.bot_id });
  const convo: BotTurn[] = [
    { role: 'user', content: `${baseInstr}\n\n${replyLengthInstruction(shape)}` },
    { role: 'user', content: rootMsg },
  ];
  const text = await generateBotReply(db, bot.bot_id, convo, { log, label: `dry#${i}`, model: bot.model ?? undefined });
  const sentences = countSentences(text ?? '');
  let linkInfo = '';
  if (shape.wantsLink && text) {
    const ref = detectReferenceStrings(text).find((r) => { const ids = refToVerseIds(r); return ids.length > 0 && ids[0]! >= BOM_FIRST && ids[0]! <= BOM_LAST; });
    const block = ref ? await resolvePassageBlock(db, ref) : null;
    linkInfo = block ? ` | LINKED ${ref} -> ${block.pageSlug}/${block.ordinal}` : ` | wanted-link, none-resolved (${ref ?? 'no BoM ref cited'})`;
  }
  console.log(`\n--- ${bot.display_name} | target=${shape.targetSentences} cap=${shape.cap} wantsLink=${shape.wantsLink} | actual=${sentences} sentences${linkInfo}`);
  console.log(text);
}
console.log('\n[dry-run complete — nothing was posted]');
process.exit(0);
