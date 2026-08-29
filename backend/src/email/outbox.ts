import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { env } from '../config/env.js';
import { normalizeEmail, REQUIRED_EMAIL_CATEGORIES } from './policy.js';
import type { RenderedEmail } from './render.js';

export interface EnqueueEmailInput extends RenderedEmail {
  kind: 'transactional' | 'notification';
  category: string;
  recipientEmail: string;
  userId?: string | null;
  templateKey: string;
  templateVersion: number;
  locale?: string;
  variables?: Record<string, unknown>;
  sensitive?: boolean;
  idempotencyKey: string;
  scheduledAt?: Date;
}

export async function isSuppressed(
  db: Kysely<DB>,
  email: string,
  kind: EnqueueEmailInput['kind'],
): Promise<boolean> {
  const now = new Date();
  const row = await db.selectFrom('bom_email_suppression')
    .select(['email_normalized', 'reason'])
    .where('email_normalized', '=', normalizeEmail(email))
    .where((eb) => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', now)]))
    .executeTakeFirst();
  if (!row) return false;
  if (row.reason === 'complaint' || row.reason === 'unsubscribe') return kind === 'notification';
  return true;
}

export async function emailPreferenceAllows(
  db: Kysely<DB>,
  userId: string | null | undefined,
  category: string,
): Promise<boolean> {
  if (REQUIRED_EMAIL_CATEGORIES.has(category) || !userId) return true;
  const pref = await db.selectFrom('bom_email_preference')
    .select(['enabled', 'cadence'])
    .where('user_id', '=', userId)
    .where('category', '=', category)
    .executeTakeFirst();
  // Optional notification email is opt-in: an absent row must never turn a
  // newly deployed producer into surprise email for the whole userbase.
  return !!pref && pref.enabled === 1 && pref.cadence === 'immediate';
}

export async function enqueueEmail(
  db: Kysely<DB>,
  input: EnqueueEmailInput,
): Promise<{ inserted: boolean; outboxId?: number; reason?: 'disabled' | 'suppressed' | 'preference' | 'rate_limit' }> {
  const email = normalizeEmail(input.recipientEmail);
  if (!env.MAIL_SENDING_ENABLED) return { inserted: false, reason: 'disabled' };
  if (input.kind === 'transactional' && !env.MAIL_SECURITY_ENABLED) return { inserted: false, reason: 'disabled' };
  if (input.kind === 'notification' && !env.MAIL_NOTIFICATIONS_ENABLED) return { inserted: false, reason: 'disabled' };
  if (await isSuppressed(db, email, input.kind)) return { inserted: false, reason: 'suppressed' };
  if (!(await emailPreferenceAllows(db, input.userId, input.category))) {
    return { inserted: false, reason: 'preference' };
  }
  if (input.kind === 'transactional') {
    const recent = await db.selectFrom('bom_email_outbox')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('recipient_email', '=', email)
      .where('kind', '=', 'transactional')
      .where('created_at', '>=', new Date(Date.now() - 60 * 60 * 1000))
      .executeTakeFirst();
    if (Number(recent?.count ?? 0) >= env.MAIL_MAX_TRANSACTIONAL_PER_RECIPIENT_HOUR) {
      return { inserted: false, reason: 'rate_limit' };
    }
  }
  const result = await db.insertInto('bom_email_outbox').ignore().values({
    kind: input.kind,
    category: input.category,
    user_id: input.userId ?? null,
    recipient_email: email,
    template_key: input.templateKey,
    template_version: input.templateVersion,
    locale: input.locale ?? 'en',
    variables: JSON.stringify(input.variables ?? {}),
    scrub_after_send: input.sensitive ? 1 : 0,
    rendered_subject: input.subject,
    rendered_html: input.html,
    rendered_text: input.text,
    idempotency_key: input.idempotencyKey,
    scheduled_at: input.scheduledAt ?? new Date(),
  }).executeTakeFirst();
  const inserted = Number(result.numInsertedOrUpdatedRows ?? 0n) > 0;
  if (inserted) return { inserted: true, outboxId: Number(result.insertId) };
  const existing = await db.selectFrom('bom_email_outbox').select('id')
    .where('idempotency_key', '=', input.idempotencyKey).executeTakeFirst();
  return { inserted: false, outboxId: existing?.id };
}

export async function setEmailPreference(db: Kysely<DB>, input: {
  userId: string; category: string; enabled: boolean; cadence: 'immediate' | 'daily' | 'never'; locale?: string;
}): Promise<void> {
  if (REQUIRED_EMAIL_CATEGORIES.has(input.category) && !input.enabled) {
    throw new Error(`${input.category} emails cannot be disabled`);
  }
  await db.insertInto('bom_email_preference').values({
    user_id: input.userId,
    category: input.category,
    enabled: input.enabled ? 1 : 0,
    cadence: input.cadence,
    locale: input.locale ?? null,
    source: 'user',
    unsubscribed_at: input.enabled ? null : new Date(),
  }).onDuplicateKeyUpdate({
    enabled: input.enabled ? 1 : 0,
    cadence: input.cadence,
    locale: input.locale ?? null,
    source: 'user',
    unsubscribed_at: input.enabled ? null : new Date(),
  }).execute();
}
