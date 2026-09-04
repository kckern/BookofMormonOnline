// One controlled managed-discussion thread (smoke test / operator run-once).
// Does NOT start the interval scheduler — generates exactly one root + schedules
// its delayed turns. Run: cd backend && node node_modules/tsx/dist/cli.mjs scripts/run-once-discussion.mts <channel_url?>
import 'dotenv/config';
import { getDb } from '../src/data/db.js';
import { runNewPrompt } from '../src/bots/scheduler.js';
const CH = process.argv[2] || '981706be763a135623f56e621e39f9b9';
const db = getDb();
console.log('provider:', !!process.env.OPENAI_API_KEY, '| reasoning effort:', process.env.BOT_LLM_REASONING_EFFORT || 'high');
const t0 = Date.now();
const res = await runNewPrompt(db, CH);
console.log('result:', JSON.stringify(res), '| took', ((Date.now() - t0) / 1000).toFixed(1) + 's');
process.exit(0);
