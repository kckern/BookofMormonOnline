import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { env } from '../config/env.js';
import { getMailer } from '../mail/mailer.js';
import { isRecipientAllowedInEnvironment } from './policy.js';
import { isSuppressed } from './outbox.js';

type Db = Kysely<DB> | Transaction<DB>;
type ClaimedEmail = Awaited<ReturnType<typeof claimEmails>>[number];

export async function claimEmails(db: Kysely<DB>, owner: string, limit: number) {
  if (!env.MAIL_SECURITY_ENABLED && !env.MAIL_NOTIFICATIONS_ENABLED) return [];
  const now = new Date();
  const leaseExpires = new Date(now.getTime() + 60_000);
  return db.transaction().execute(async (trx) => {
    let query = trx.selectFrom('bom_email_outbox').selectAll()
      .where((eb) => eb.or([
        eb.and([eb('status', 'in', ['pending', 'retry']), eb('scheduled_at', '<=', now)]),
        eb.and([eb('status', '=', 'leased'), eb('lease_expires_at', '<', now)]),
      ]));
    if (!env.MAIL_SECURITY_ENABLED) query = query.where('kind', '=', 'notification');
    if (!env.MAIL_NOTIFICATIONS_ENABLED) query = query.where('kind', '=', 'transactional');
    const rows = await query.orderBy('scheduled_at', 'asc').orderBy('id', 'asc')
      .limit(limit).forUpdate().skipLocked().execute();
    if (!rows.length) return rows;
    await trx.updateTable('bom_email_outbox').set({
      status: 'leased', lease_owner: owner, lease_expires_at: leaseExpires,
    }).where('id', 'in', rows.map((row) => row.id)).execute();
    return rows;
  });
}

async function markSuppressed(db: Db, row: ClaimedEmail, reason: string): Promise<void> {
  await db.updateTable('bom_email_outbox').set({
    status: 'suppressed', lease_owner: null, lease_expires_at: null, last_error: reason,
  }).where('id', '=', row.id).execute();
}

export async function deliverClaimedEmail(db: Kysely<DB>, row: ClaimedEmail): Promise<void> {
  if (!env.MAIL_SENDING_ENABLED) return;
  if (!isRecipientAllowedInEnvironment(row.recipient_email)) {
    await markSuppressed(db, row, 'recipient is not on the non-production allowlist');
    return;
  }
  if (await isSuppressed(db, row.recipient_email, row.kind as 'transactional' | 'notification')) {
    await markSuppressed(db, row, 'recipient is suppressed');
    return;
  }
  const result = await getMailer().send({
    to: row.recipient_email,
    subject: row.rendered_subject,
    html: row.rendered_html,
    text: row.rendered_text,
    tags: { outbox_id: String(row.id), category: row.category },
  });
  if (result.ok) {
    const sentValues = {
      status: 'sent', sent_at: new Date(), provider_message_id: result.id ?? null,
      lease_owner: null, lease_expires_at: null, last_error: null,
      ...(row.scrub_after_send === 1 ? { variables: '{}', rendered_html: '', rendered_text: '' } : {}),
    };
    await db.updateTable('bom_email_outbox').set(sentValues).where('id', '=', row.id).execute();
    return;
  }
  const attempts = row.attempt_count + 1;
  const terminal = attempts >= row.max_attempts;
  const backoffMinutes = Math.min(60, 2 ** attempts);
  await db.updateTable('bom_email_outbox').set({
    status: terminal ? 'failed' : 'retry',
    attempt_count: attempts,
    scheduled_at: new Date(Date.now() + backoffMinutes * 60_000),
    lease_owner: null,
    lease_expires_at: null,
    last_error: (result.error ?? 'unknown provider error').slice(0, 1000),
  }).where('id', '=', row.id).execute();
}

export function startEmailWorker(db: Kysely<DB>): () => void {
  if (!env.MAIL_SENDING_ENABLED) {
    console.info('[email-worker] disabled (MAIL_SENDING_ENABLED=false)');
    return () => undefined;
  }
  const owner = `${process.pid}:${randomUUID()}`;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const rows = await claimEmails(db, owner, env.MAIL_SENDS_PER_SECOND);
      for (const row of rows) await deliverClaimedEmail(db, row);
    } catch (error) {
      console.error('[email-worker] tick failed:', error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), env.MAIL_WORKER_INTERVAL_MS);
  timer.unref();
  void tick();
  console.info(`[email-worker] active owner=${owner} rate<=${env.MAIL_SENDS_PER_SECOND}/s`);
  return () => clearInterval(timer);
}
