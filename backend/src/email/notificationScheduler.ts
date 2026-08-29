import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { env } from '../config/env.js';
import type { PersistNotificationInput } from '../notifications/store.js';
import { emailPreferenceAllows, enqueueEmail } from './outbox.js';
import { renderTransactionalTemplate, type TransactionalTemplateKey } from './templates.js';

type NotificationCategory = 'reply' | 'mention' | 'invite' | 'direct_message';

const POLICY: Record<NotificationCategory, { graceMinutes: number; holdMinutes: number; template: TransactionalTemplateKey }> = {
  reply: { graceMinutes: 5, holdMinutes: 30, template: 'notification-reply' },
  mention: { graceMinutes: 2, holdMinutes: 30, template: 'notification-mention' },
  invite: { graceMinutes: 0, holdMinutes: 0, template: 'notification-invite' },
  direct_message: { graceMinutes: 2, holdMinutes: 20, template: 'notification-direct-message' },
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONLINE_DEFERRAL_MS = 15 * 60 * 1000;

function isCategory(value: string): value is NotificationCategory {
  return Object.hasOwn(POLICY, value);
}

function targetUrl(input: PersistNotificationInput): string {
  const channel = input.payload.channel_url;
  const message = input.payload.message_id;
  const path = channel
    ? `/group/${encodeURIComponent(channel)}${message ? `/${encodeURIComponent(message)}` : ''}`
    : '/home';
  return new URL(path, env.APP_BASE_URL).toString();
}

function groupKey(input: PersistNotificationInput): string {
  if (input.type === 'invite') return input.payload.channel_url ?? input.dedupeKey;
  if (input.type === 'direct_message') return input.payload.channel_url ?? input.dedupeKey;
  return `${input.payload.channel_url ?? 'unknown'}:${input.payload.message_id ?? input.dedupeKey}`;
}

/** Persist a future email decision. This never sends and optional email remains explicit opt-in. */
export async function queueNotificationEmail(db: Kysely<DB>, input: PersistNotificationInput): Promise<void> {
  if (!isCategory(input.type) || !env.MAIL_NOTIFICATIONS_ENABLED) return;
  const recipient = await db.selectFrom('messenger_users')
    .innerJoin('bom_user', 'bom_user.user', 'messenger_users.bom_user_id')
    .select(['bom_user.user as user', 'bom_user.email as email', 'bom_user.lang as lang'])
    .where('messenger_users.user_id', '=', input.userId)
    .executeTakeFirst();
  if (!recipient?.email || !(await emailPreferenceAllows(db, recipient.user, input.type))) return;
  const eventAt = input.createdAt ?? new Date();
  const policy = POLICY[input.type];
  await db.insertInto('bom_email_notification_queue').ignore().values({
    notification_key: input.dedupeKey,
    user_id: recipient.user,
    notification_user_id: input.userId,
    category: input.type,
    group_key: groupKey(input),
    channel_url: input.payload.channel_url,
    recipient_email: recipient.email,
    lang: recipient.lang ?? 'en',
    actor_name: input.payload.actor?.nickname ?? null,
    target_url: targetUrl(input),
    event_at: eventAt,
    eligible_at: new Date(eventAt.getTime() + policy.graceMinutes * 60_000),
  }).execute();
}

async function underNotificationCap(db: Kysely<DB>, userId: string): Promise<boolean> {
  const [hour, day] = await Promise.all([
    db.selectFrom('bom_email_outbox').select(({ fn }) => fn.countAll<number>().as('count'))
      .where('user_id', '=', userId).where('kind', '=', 'notification')
      .where('created_at', '>=', new Date(Date.now() - 60 * 60 * 1000)).executeTakeFirst(),
    db.selectFrom('bom_email_outbox').select(({ fn }) => fn.countAll<number>().as('count'))
      .where('user_id', '=', userId).where('kind', '=', 'notification')
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000)).executeTakeFirst(),
  ]);
  return Number(hour?.count ?? 0) < env.MAIL_MAX_NOTIFICATIONS_PER_USER_HOUR
    && Number(day?.count ?? 0) < env.MAIL_MAX_NOTIFICATIONS_PER_USER_DAY;
}

async function suppressIfReadOrOnline(db: Kysely<DB>, row: Awaited<ReturnType<typeof claimOne>>): Promise<'send' | 'suppress' | 'defer'> {
  if (!row) return 'suppress';
  const notification = await db.selectFrom('bom_notification').select(['read_at', 'dismissed_at'])
    .where('user_id', '=', row.notification_user_id)
    .where('dedupe_key', '=', row.notification_key).executeTakeFirst();
  if (!notification || notification.read_at || notification.dismissed_at) return 'suppress';
  if (row.channel_url) {
    const member = await db.selectFrom('messenger_members').select('last_read_at')
      .where('user_id', '=', row.notification_user_id).where('channel_url', '=', row.channel_url).executeTakeFirst();
    if (member?.last_read_at && member.last_read_at >= row.event_at) return 'suppress';
  }
  const presence = await db.selectFrom('messenger_users').select(['is_online', 'last_seen_at'])
    .where('user_id', '=', row.notification_user_id).executeTakeFirst();
  if (presence?.is_online === 1 && Date.now() - row.event_at.getTime() < ONLINE_DEFERRAL_MS) return 'defer';
  return 'send';
}

async function claimOne(db: Kysely<DB>) {
  const now = new Date();
  return db.transaction().execute(async (trx) => {
    const row = await trx.selectFrom('bom_email_notification_queue').selectAll()
      .where('status', '=', 'pending').where('eligible_at', '<=', now)
      .orderBy('eligible_at', 'asc').orderBy('id', 'asc').forUpdate().skipLocked().executeTakeFirst();
    if (!row) return undefined;
    await trx.updateTable('bom_email_notification_queue').set({ status: 'processing' }).where('id', '=', row.id).execute();
    return row;
  });
}

async function returnPending(db: Kysely<DB>, id: number, eligibleAt: Date): Promise<void> {
  await db.updateTable('bom_email_notification_queue').set({ status: 'pending', eligible_at: eligibleAt })
    .where('id', '=', id).execute();
}

async function processOne(db: Kysely<DB>): Promise<boolean> {
  const row = await claimOne(db);
  if (!row) return false;
  try {
    const disposition = await suppressIfReadOrOnline(db, row);
    if (disposition === 'suppress') {
      await db.updateTable('bom_email_notification_queue').set({ status: 'suppressed', processed_at: new Date() })
        .where('id', '=', row.id).execute();
      return true;
    }
    if (disposition === 'defer') {
      await returnPending(db, row.id, new Date(Date.now() + 5 * 60_000));
      return true;
    }
    if (!(await underNotificationCap(db, row.user_id))) {
      await returnPending(db, row.id, new Date(Date.now() + 60 * 60_000));
      return true;
    }

    const policy = POLICY[row.category as NotificationCategory];
    if (!policy) throw new Error(`Unknown notification category: ${row.category}`);
    const state = await db.selectFrom('bom_email_notification_state').selectAll()
      .where('user_id', '=', row.user_id).where('category', '=', row.category)
      .where('group_key', '=', row.group_key).executeTakeFirst();
    const now = new Date();
    const freshConversation = !state || now.getTime() - state.last_event_at.getTime() >= TWO_HOURS_MS;
    if (!freshConversation && state.hold_until && state.hold_until > now) {
      await returnPending(db, row.id, state.hold_until);
      await db.updateTable('bom_email_notification_state').set({ last_event_at: row.event_at })
        .where('user_id', '=', row.user_id).where('category', '=', row.category).where('group_key', '=', row.group_key).execute();
      return true;
    }

    const isSummary = !freshConversation && row.category !== 'invite';
    const pendingCandidates = isSummary
      ? await db.selectFrom('bom_email_notification_queue').selectAll()
        .where('user_id', '=', row.user_id).where('category', '=', row.category)
        .where('group_key', '=', row.group_key).where('status', 'in', ['pending', 'processing'])
        .where('eligible_at', '<=', now).execute()
      : [{ id: row.id }];
    const pending: Array<{ id: number }> = [];
    for (const candidate of pendingCandidates) {
      if (!isSummary || await suppressIfReadOrOnline(db, candidate as typeof row) === 'send') {
        pending.push({ id: candidate.id });
      } else {
        await db.updateTable('bom_email_notification_queue').set({ status: 'suppressed', processed_at: now })
          .where('id', '=', candidate.id).execute();
      }
    }
    if (!pending.length) return true;
    const variables: Record<string, string | number> = isSummary
      ? { activityCount: pending.length, targetUrl: row.target_url }
      : row.category === 'invite'
        ? { targetUrl: row.target_url }
        : { actorName: row.actor_name ?? '', targetUrl: row.target_url };
    const rendered = await renderTransactionalTemplate(
      db, isSummary ? 'notification-summary' : policy.template, row.lang, variables,
    );
    const result = await enqueueEmail(db, {
      kind: 'notification', category: row.category, recipientEmail: row.recipient_email,
      userId: row.user_id, templateKey: rendered.templateKey, templateVersion: rendered.templateVersion,
      locale: rendered.lang, variables, subject: rendered.subject, html: rendered.html, text: rendered.text,
      idempotencyKey: isSummary
        ? `notification-summary:${row.user_id}:${row.category}:${row.group_key}:${Math.floor(now.getTime() / TWO_HOURS_MS)}`
        : `notification:${row.notification_user_id}:${row.notification_key}`,
    });
    if (!result.inserted && !result.outboxId) {
      await db.updateTable('bom_email_notification_queue').set({ status: 'suppressed', processed_at: now })
        .where('id', 'in', pending.map((item) => item.id)).execute();
      return true;
    }
    await db.updateTable('bom_email_notification_queue').set({
      status: isSummary ? 'summarized' : 'immediate', outbox_id: result.outboxId ?? null, processed_at: now,
    }).where('id', 'in', pending.map((item) => item.id)).execute();
    const holdUntil = new Date(now.getTime() + (isSummary ? 120 : policy.holdMinutes) * 60_000);
    await db.insertInto('bom_email_notification_state').values({
      user_id: row.user_id, category: row.category, group_key: row.group_key,
      recipient_email: row.recipient_email, last_event_at: row.event_at,
      last_immediate_at: isSummary ? null : now, last_summary_at: isSummary ? now : null,
      hold_until: holdUntil, backoff_level: isSummary ? 1 : 0,
    }).onDuplicateKeyUpdate({
      recipient_email: row.recipient_email, last_event_at: row.event_at,
      ...(isSummary ? { last_summary_at: now, backoff_level: 1 } : { last_immediate_at: now, backoff_level: 0 }),
      hold_until: holdUntil,
    }).execute();
    return true;
  } catch (error) {
    console.error('[notification-email] scheduling failed:', error);
    await returnPending(db, row.id, new Date(Date.now() + 60_000));
    return true;
  }
}

export function startNotificationEmailScheduler(db: Kysely<DB>): () => void {
  if (!env.MAIL_SENDING_ENABLED || !env.MAIL_NOTIFICATIONS_ENABLED) return () => undefined;
  const owner = `${process.pid}:${randomUUID()}`;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (let i = 0; i < 25 && await processOne(db); i += 1) { /* drain bounded batch */ }
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), Math.max(1000, env.MAIL_WORKER_INTERVAL_MS));
  timer.unref();
  void tick();
  console.info(`[notification-email] scheduler active owner=${owner}`);
  return () => clearInterval(timer);
}
