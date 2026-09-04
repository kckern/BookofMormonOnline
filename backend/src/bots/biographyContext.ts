import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';

export type LifeMilestone = { year?: number | string; event: string };

/** Future biography-RAG seam. The stored life sketch is authoritative today. */
export async function retrieveBiographyEvidence(
  _db: Kysely<DB>, _botId: string, _discussionText: string,
): Promise<string[]> {
  return [];
}

export async function loadBiographyContext(
  db: Kysely<DB>, botId: string, discussionText = '',
): Promise<string | null> {
  const bot = await db.selectFrom('bom_bot')
    .select(['birth_year', 'death_year', 'life_sketch'])
    .where('bot_id', '=', botId).executeTakeFirst();
  if (!bot) return null;
  const milestones = Array.isArray(bot.life_sketch) ? bot.life_sketch as LifeMilestone[] : [];
  const evidence = await retrieveBiographyEvidence(db, botId, discussionText);
  if (!milestones.length && !evidence.length) return null;
  const years = bot.birth_year || bot.death_year
    ? `Life dates: ${bot.birth_year ?? '?'}–${bot.death_year ?? '?'}.` : '';
  return [
    'BIOGRAPHICAL CONTEXT (use only when genuinely relevant; do not force autobiography):',
    years,
    ...milestones.map((item) => `${item.year ?? 'Undated'}: ${item.event}`),
    ...evidence,
    'Never invent an event, quotation, inner thought, or first-person memory beyond this supplied context.',
  ].filter(Boolean).join('\n');
}
