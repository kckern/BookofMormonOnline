/**
 * Validate or apply a complete DB-owned flagship study-group configuration.
 * The JSON file is intentionally external to source control: it contains all
 * names, profiles, personas, prompts, model choices, topics, and optional corpus grants.
 *
 * Validate: npm run study-group:configure -- --file /secure/reformers.json
 * Apply:    npm run study-group:configure -- --file /secure/reformers.json --apply
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { sql } from 'kysely';
import { closeDb, getDb } from '../src/data/db.js';
import { validatePromptBundle, type DiscussionPromptBundle } from '../src/bots/discussionPrompts.js';

type Bot = {
  botId: string; displayName: string; nickname: string; profileUrl: string;
  persona: string; model: string; lang?: string; temperament?: string; tags?: string[];
};
type AudienceRespondent = Bot & { responseWeight: number; topicTriggers: string[] };
type Config = {
  archiveChannelUrl: string;
  channel: { channelUrl: string; name: string; description: string; coverUrl: string; ownerUserId: string; lang?: string };
  bots: Bot[];
  audienceRespondents: AudienceRespondent[];
  policy: {
    visibility: 'unlisted'; membershipPolicy: 'fixed'; rootPostPolicy: 'members';
    replyPolicy: 'authenticated'; reactionPolicy: 'authenticated';
  };
  discussion: {
    timezone: string; localStartTime: string; discursiveWeight: number; narrativeWeight: number;
    audienceResponseChance: number;
    minBotVoices: number; maxBotVoices: number; maxBotMessages: number; botWindowHours: number;
    minDelayMinutes: number; maxDelayMinutes: number; promptTemplate: string; responseGuardrails: string;
    promptBundle?: DiscussionPromptBundle;
  };
  topics: Array<{ topicId: string; passageRef: string; passageSlug?: string; passageKind: 'discursive' | 'narrative'; question: string; contextNote?: string }>;
  corpora: Array<{ corpusId: string; title: string; authorKey: string; sourceUri: string; sourceSha256?: string; rightsClass: 'citation_eligible' | 'inference_only' | 'blocked'; rightsNote: string; edition?: string; enabled?: boolean }>;
  botCorpora: Array<{ botId: string; corpusId: string; retrievalWeight?: number }>;
};

const args = process.argv.slice(2);
const file = args[args.indexOf('--file') + 1];
const apply = args.includes('--apply');
if (!file) throw new Error('pass --file <reviewed-config.json>');
const configFile = file as string;

function required(value: unknown, label: string): asserts value {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
}

function validate(config: Config): void {
  required(config.archiveChannelUrl, 'archiveChannelUrl');
  required(config.channel?.channelUrl, 'channel.channelUrl');
  required(config.channel?.ownerUserId, 'channel.ownerUserId');
  required(config.channel?.name, 'channel.name');
  if (config.archiveChannelUrl === config.channel.channelUrl) throw new Error('fresh channel must differ from the archive');
  if (config.bots?.length !== 10) throw new Error('the reviewed flagship member roster must contain exactly ten bots');
  if (!config.audienceRespondents?.length || config.audienceRespondents.length > 8) {
    throw new Error('the audience respondent bench must contain 1–8 bots');
  }
  const ids = new Set<string>();
  const channelLang = config.channel.lang || 'en';
  const reviewedBots: Array<{ bot: Bot; label: string }> = [
    ...config.bots.map((bot, index) => ({ bot, label: `bots[${index}]` })),
    ...config.audienceRespondents.map((bot, index) => ({ bot, label: `audienceRespondents[${index}]` })),
  ];
  for (const { bot, label } of reviewedBots) {
    for (const [key, value] of Object.entries({
      botId: bot.botId, displayName: bot.displayName, nickname: bot.nickname,
      profileUrl: bot.profileUrl, persona: bot.persona, model: bot.model,
    })) required(value, `${label}.${key}`);
    if (ids.has(bot.botId)) throw new Error(`duplicate botId ${bot.botId}`);
    if (bot.botId === config.channel.ownerUserId) throw new Error('the human owner cannot also be configured as a bot');
    if ((bot.lang || channelLang) !== channelLang) {
      throw new Error(`${label}.lang must exactly match channel.lang (${channelLang})`);
    }
    ids.add(bot.botId);
  }
  for (const [index, respondent] of config.audienceRespondents.entries()) {
    if (!Number.isFinite(respondent.responseWeight) || respondent.responseWeight <= 0) {
      throw new Error(`audienceRespondents[${index}].responseWeight must be positive`);
    }
    if (!respondent.topicTriggers?.length || respondent.topicTriggers.some((trigger) => !trigger.trim())) {
      throw new Error(`audienceRespondents[${index}].topicTriggers must contain reviewed strings`);
    }
  }
  const expected = JSON.stringify({
    visibility: 'unlisted', membershipPolicy: 'fixed', rootPostPolicy: 'members',
    replyPolicy: 'authenticated', reactionPolicy: 'authenticated',
  });
  if (JSON.stringify(config.policy) !== expected) throw new Error('flagship beta policy differs from the approved fixed-membership policy');
  if (config.discussion.discursiveWeight + config.discussion.narrativeWeight !== 100) throw new Error('topic weights must total 100');
  if (config.discussion.discursiveWeight !== 80) throw new Error('approved discursive weight is 80');
  if (!Number.isInteger(config.discussion.audienceResponseChance)
    || config.discussion.audienceResponseChance < 0 || config.discussion.audienceResponseChance > 100) {
    throw new Error('audience response chance must be an integer from 0–100');
  }
  if (config.discussion.minBotVoices !== 3 || config.discussion.maxBotVoices !== 5) throw new Error('approved voice range is 3–5');
  if (config.discussion.maxBotMessages !== 12 || config.discussion.botWindowHours !== 72) throw new Error('approved completion limits are 12 messages / 72 hours');
  try { new Intl.DateTimeFormat('en-US', { timeZone: config.discussion.timezone }).format(); }
  catch { throw new Error('discussion.timezone must be a valid IANA timezone'); }
  if (!/^([01]\d|2[0-3]):[0-5]\d:00$/.test(config.discussion.localStartTime)) {
    throw new Error('discussion.localStartTime must be HH:MM:00');
  }
  required(config.discussion.promptTemplate, 'discussion.promptTemplate');
  required(config.discussion.responseGuardrails, 'discussion.responseGuardrails');
  if (config.discussion.promptBundle || channelLang !== 'en') {
    const missing = validatePromptBundle(config.discussion.promptBundle);
    if (missing.length) throw new Error(`discussion.promptBundle is incomplete: ${missing.join(', ')}`);
  }
  if (config.discussion.minDelayMinutes < 1 || config.discussion.minDelayMinutes > config.discussion.maxDelayMinutes) throw new Error('discussion delays are invalid');
  if (!config.topics?.length || !config.topics.some((topic) => topic.passageKind === 'discursive') || !config.topics.some((topic) => topic.passageKind === 'narrative')) {
    throw new Error('discursive and narrative Book of Mormon topics are both required');
  }
  const topicIds = new Set<string>();
  for (const [index, topic] of config.topics.entries()) {
    required(topic.topicId, `topics[${index}].topicId`);
    required(topic.passageRef, `topics[${index}].passageRef`);
    required(topic.question, `topics[${index}].question`);
    if (topicIds.has(topic.topicId)) throw new Error(`duplicate topicId ${topic.topicId}`);
    topicIds.add(topic.topicId);
  }
  const seenCorpusIds = new Set<string>();
  for (const [index, corpus] of config.corpora.entries()) {
    required(corpus.corpusId, `corpora[${index}].corpusId`);
    required(corpus.title, `corpora[${index}].title`);
    required(corpus.authorKey, `corpora[${index}].authorKey`);
    required(corpus.sourceUri, `corpora[${index}].sourceUri`);
    required(corpus.rightsNote, `corpora[${index}].rightsNote`);
    if (seenCorpusIds.has(corpus.corpusId)) throw new Error(`duplicate corpusId ${corpus.corpusId}`);
    seenCorpusIds.add(corpus.corpusId);
    if (!corpus.sourceUri.startsWith('/') && !corpus.sourceUri.startsWith('file://')) throw new Error(`corpora[${index}].sourceUri must be absolute or file://`);
    if (corpus.enabled !== false && corpus.rightsClass !== 'blocked' && !/^[a-f0-9]{64}$/i.test(corpus.sourceSha256 || '')) {
      throw new Error(`corpora[${index}].sourceSha256 must be a reviewed SHA-256 before enablement`);
    }
  }
  const corpusIds = new Set(config.corpora.map((corpus) => corpus.corpusId));
  const seenGrants = new Set<string>();
  for (const grant of config.botCorpora) {
    if (!ids.has(grant.botId) || !corpusIds.has(grant.corpusId)) throw new Error('botCorpora contains an unknown bot/corpus');
    const grantKey = `${grant.botId}:${grant.corpusId}`;
    if (seenGrants.has(grantKey)) throw new Error(`duplicate botCorpora grant ${grantKey}`);
    seenGrants.add(grantKey);
    if (grant.retrievalWeight != null && (!Number.isFinite(grant.retrievalWeight) || grant.retrievalWeight <= 0)) throw new Error('botCorpora retrievalWeight must be positive');
  }
}

function nextLocalTime(timeZone: string, localTime: string): Date {
  const [wantedHour, wantedMinute] = localTime.split(':');
  const format = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let candidate = new Date(Math.ceil(Date.now() / 60_000) * 60_000);
  for (let i = 0; i < 60 * 48; i++) {
    const parts = Object.fromEntries(format.formatToParts(candidate).map((part) => [part.type, part.value]));
    if (parts['hour'] === wantedHour && parts['minute'] === wantedMinute) return candidate;
    candidate = new Date(candidate.getTime() + 60_000);
  }
  throw new Error(`could not resolve next ${localTime} in ${timeZone}`);
}

async function main(): Promise<void> {
  const config = JSON.parse(await readFile(configFile, 'utf8')) as Config;
  validate(config);
  const channelLang = config.channel.lang || 'en';
  console.log(`VALID: 10 member bots, ${config.audienceRespondents.length} audience bots, ${config.topics.length} topics, ${config.corpora.length} corpora, ${config.botCorpora.length} grants`);
  if (!apply) {
    console.log('DRY RUN: no database writes; pass --apply after operator review');
    return;
  }
  if (process.env['SANDBOX'] !== '0') {
    throw new Error('refusing a silent no-op: rerun with SANDBOX=0 when --apply is intended');
  }

  const db = getDb();
  try {
    await db.transaction().execute(async (trx) => {
      const owner = await trx.selectFrom('messenger_users').select(['bom_user_id', 'is_bot'])
        .where('user_id', '=', config.channel.ownerUserId).executeTakeFirst();
      if (!owner || owner.is_bot === 1 || !owner.bom_user_id) {
        throw new Error('configured owner must be an existing human messenger identity');
      }

      const existingChannel = await trx.selectFrom('messenger_channels').select('metadata')
        .where('channel_url', '=', config.channel.channelUrl).executeTakeFirst();
      if (existingChannel) {
        let metadata: Record<string, unknown> = {};
        try {
          metadata = typeof existingChannel.metadata === 'string'
            ? JSON.parse(existingChannel.metadata) as Record<string, unknown>
            : (existingChannel.metadata || {}) as Record<string, unknown>;
        } catch { /* handled by the refusal below */ }
        if (metadata['aiStudyGroup'] !== true) throw new Error('refusing to repurpose an existing non-managed channel');
      }
      const configuredBots = [...config.bots, ...config.audienceRespondents];
      const configuredBotIds = configuredBots.map((bot) => bot.botId);
      const botUsers = await trx.selectFrom('messenger_users').select(['user_id', 'is_bot'])
        .where('user_id', 'in', configuredBotIds).execute();
      if (botUsers.some((user) => user.is_bot !== 1)) {
        throw new Error('refusing to repurpose an existing human messenger identity as a bot');
      }
      const existingPolicies = await trx.selectFrom('messenger_channel_policy')
        .select(['channel_url', 'owner_user_id'])
        .where('channel_url', 'in', [config.archiveChannelUrl, config.channel.channelUrl]).execute();
      if (existingPolicies.some((policy) => policy.owner_user_id && policy.owner_user_id !== config.channel.ownerUserId)) {
        throw new Error('refusing to change an existing channel owner through bulk configuration');
      }

      await trx.insertInto('messenger_channels').values({
        channel_url: config.channel.channelUrl,
        name: config.channel.name,
        description: config.channel.description,
        cover_url: config.channel.coverUrl,
        custom_type: 'public',
        lang: config.channel.lang || 'en',
        metadata: JSON.stringify({ aiStudyGroup: true }),
      }).onDuplicateKeyUpdate({
        name: config.channel.name, description: config.channel.description,
        cover_url: config.channel.coverUrl, custom_type: 'public', lang: config.channel.lang || 'en',
      }).execute();
      await trx.insertInto('messenger_members').values({
        channel_url: config.channel.channelUrl, user_id: config.channel.ownerUserId, role: 'operator', state: 'joined',
      }).onDuplicateKeyUpdate({ role: 'operator', state: 'joined' }).execute();
      // The legacy archive was bot-owned. Bootstrap the reviewed human owner so
      // policy ownership is explicit without deleting or rewriting the archive.
      await trx.insertInto('messenger_members').values({
        channel_url: config.archiveChannelUrl, user_id: config.channel.ownerUserId, role: 'operator', state: 'joined',
      }).onDuplicateKeyUpdate({ role: 'operator', state: 'joined' }).execute();

      for (const bot of configuredBots) {
        await trx.insertInto('messenger_users').values({
          user_id: bot.botId, bom_user_id: null, nickname: bot.nickname,
          profile_url: bot.profileUrl, is_bot: 1,
          metadata: JSON.stringify({ aiStudyGroupBot: true }),
        }).onDuplicateKeyUpdate({
          nickname: bot.nickname, profile_url: bot.profileUrl, is_bot: 1,
        }).execute();
        await trx.insertInto('bom_bot').values({
          bot_id: bot.botId, display_name: bot.displayName, bot_class: 'study', lang: bot.lang || channelLang,
          persona: bot.persona, model: bot.model, temperament: bot.temperament || null,
          tags: JSON.stringify(bot.tags || ['reformers']), enabled: 1,
        }).onDuplicateKeyUpdate({
          display_name: bot.displayName, bot_class: 'study', lang: bot.lang || channelLang, persona: bot.persona,
          model: bot.model, temperament: bot.temperament || null,
          tags: JSON.stringify(bot.tags || ['reformers']), enabled: 1,
        }).execute();
      }
      for (const bot of config.bots) {
        await trx.insertInto('messenger_members').values({
          channel_url: config.channel.channelUrl, user_id: bot.botId, role: 'member', state: 'joined',
        }).onDuplicateKeyUpdate({ role: 'member', state: 'joined' }).execute();
      }
      const audienceIds = config.audienceRespondents.map((bot) => bot.botId);
      await trx.deleteFrom('messenger_members').where('channel_url', '=', config.channel.channelUrl)
        .where('user_id', 'in', audienceIds).execute();
      await trx.updateTable('bom_ai_audience_bot').set({ enabled: 0 })
        .where('channel_url', '=', config.channel.channelUrl).execute();
      for (const respondent of config.audienceRespondents) {
        const audienceRow = {
          response_weight: respondent.responseWeight,
          topic_triggers: JSON.stringify(respondent.topicTriggers),
          enabled: 1,
        };
        await trx.insertInto('bom_ai_audience_bot').values({
          channel_url: config.channel.channelUrl, bot_id: respondent.botId, ...audienceRow,
        }).onDuplicateKeyUpdate(audienceRow).execute();
      }

      const flagshipPolicy = {
        owner_user_id: config.channel.ownerUserId, visibility: 'unlisted' as const,
        membership_policy: 'fixed' as const, root_post_policy: 'members' as const,
        reply_policy: 'authenticated' as const, reaction_policy: 'authenticated' as const,
        outsider_comments_live: 1, listed: 0, enabled: 1,
      };
      await trx.insertInto('messenger_channel_policy').values({ channel_url: config.channel.channelUrl, ...flagshipPolicy })
        .onDuplicateKeyUpdate(flagshipPolicy).execute();
      await trx.updateTable('messenger_channels').set({ custom_type: 'private' })
        .where('channel_url', '=', config.archiveChannelUrl).execute();
      const archivePolicy = {
        owner_user_id: config.channel.ownerUserId, visibility: 'private' as const,
        membership_policy: 'fixed' as const, root_post_policy: 'nobody' as const,
        reply_policy: 'nobody' as const, reaction_policy: 'nobody' as const,
        outsider_comments_live: 0, listed: 0, enabled: 1,
      };
      await trx.insertInto('messenger_channel_policy').values({ channel_url: config.archiveChannelUrl, ...archivePolicy })
        .onDuplicateKeyUpdate(archivePolicy).execute();

      const d = config.discussion;
      const discussion = {
        enabled: 1, timezone: d.timezone, local_start_time: d.localStartTime,
        discursive_weight: d.discursiveWeight, narrative_weight: d.narrativeWeight,
        audience_response_chance: d.audienceResponseChance,
        min_bot_voices: d.minBotVoices, max_bot_voices: d.maxBotVoices,
        max_bot_messages: d.maxBotMessages, bot_window_hours: d.botWindowHours,
        min_delay_minutes: d.minDelayMinutes, max_delay_minutes: d.maxDelayMinutes,
        prompt_template: d.promptTemplate, response_guardrails: d.responseGuardrails,
        prompt_bundle: d.promptBundle ? JSON.stringify(d.promptBundle) : null,
      };
      await trx.insertInto('bom_ai_discussion_config').values({ channel_url: config.channel.channelUrl, ...discussion })
        .onDuplicateKeyUpdate(discussion).execute();
      await trx.updateTable('bom_ai_topic').set({ enabled: 0 })
        .where('channel_url', '=', config.channel.channelUrl).execute();
      for (const topic of config.topics) {
        await trx.insertInto('bom_ai_topic').values({
          topic_id: topic.topicId, channel_url: config.channel.channelUrl,
          passage_ref: topic.passageRef, passage_slug: topic.passageSlug || null,
          passage_kind: topic.passageKind, question: topic.question,
          context_note: topic.contextNote || null, enabled: 1,
        }).onDuplicateKeyUpdate({
          passage_ref: topic.passageRef, passage_slug: topic.passageSlug || null,
          passage_kind: topic.passageKind, question: topic.question,
          context_note: topic.contextNote || null, enabled: 1,
        }).execute();
      }
      for (const corpus of config.corpora) {
        const row = {
          title: corpus.title, author_key: corpus.authorKey, source_uri: corpus.sourceUri,
          source_sha256: corpus.sourceSha256 || null, rights_class: corpus.rightsClass,
          rights_note: corpus.rightsNote, edition: corpus.edition || null,
          enabled: corpus.enabled === false ? 0 : 1,
        };
        await trx.insertInto('bom_ai_corpus').values({ corpus_id: corpus.corpusId, ...row })
          .onDuplicateKeyUpdate(row).execute();
      }
      await trx.updateTable('bom_ai_bot_corpus').set({ enabled: 0 })
        .where('bot_id', 'in', configuredBotIds).execute();
      for (const grant of config.botCorpora) {
        await trx.insertInto('bom_ai_bot_corpus').values({
          bot_id: grant.botId, corpus_id: grant.corpusId,
          retrieval_weight: String(grant.retrievalWeight ?? 1), enabled: 1,
        }).onDuplicateKeyUpdate({ retrieval_weight: String(grant.retrievalWeight ?? 1), enabled: 1 }).execute();
      }
      const schedule = await trx.selectFrom('bom_bot_schedule').select('id')
        .where('channel_url', '=', config.channel.channelUrl)
        .where('action', '=', 'new_prompt').orderBy('id', 'asc').executeTakeFirst();
      const scheduleValues = {
        cron: `${Number(d.localStartTime.slice(3, 5))} ${Number(d.localStartTime.slice(0, 2))} * * *`,
        cadence_minutes: null, enabled: 1,
        next_run_at: nextLocalTime(d.timezone, d.localStartTime),
      };
      if (schedule) {
        await trx.updateTable('bom_bot_schedule').set(scheduleValues).where('id', '=', schedule.id).execute();
      } else {
        await trx.insertInto('bom_bot_schedule').values({
          channel_url: config.channel.channelUrl, action: 'new_prompt', ...scheduleValues,
        }).execute();
      }
      await trx.updateTable('bom_bot_schedule').set({ enabled: 0 })
        .where('channel_url', '=', config.archiveChannelUrl).execute();
      await sql`DELETE FROM messenger_members WHERE channel_url = ${config.channel.channelUrl} AND state = 'requested'`.execute(trx);
    });
    console.log(`APPLIED: fresh channel ${config.channel.channelUrl}; archive retained without message migration`);
  } finally {
    await closeDb();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
