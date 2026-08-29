import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { normalizeEmail } from './policy.js';

export interface DeliveryEvent {
  id: string;
  providerMessageId?: string;
  type: 'send' | 'delivery' | 'bounce' | 'complaint' | 'reject' | 'delay' | 'rendering_failure' | string;
  recipients: string[];
  occurredAt: Date;
  payload: unknown;
}

export async function recordDeliveryEvent(db: Kysely<DB>, event: DeliveryEvent): Promise<void> {
  const outbox = event.providerMessageId
    ? await db.selectFrom('bom_email_outbox').select('id')
      .where('provider_message_id', '=', event.providerMessageId).executeTakeFirst()
    : null;
  const inserted = await db.insertInto('bom_email_event').ignore().values({
    provider_event_id: event.id,
    provider_message_id: event.providerMessageId ?? null,
    outbox_id: outbox?.id ?? null,
    event_type: event.type,
    recipient_email: event.recipients[0] ? normalizeEmail(event.recipients[0]) : null,
    payload: JSON.stringify(event.payload ?? {}),
    occurred_at: event.occurredAt,
  }).executeTakeFirst();
  if (Number(inserted.numInsertedOrUpdatedRows ?? 0n) === 0) return;

  if (event.type !== 'bounce' && event.type !== 'complaint') return;
  for (const recipient of event.recipients) {
    const normalized = normalizeEmail(recipient);
    await db.insertInto('bom_email_suppression').values({
      email_normalized: normalized,
      reason: event.type,
      source: 'delivery_provider',
      detail: JSON.stringify({ eventId: event.id, providerMessageId: event.providerMessageId }),
    }).onDuplicateKeyUpdate({
      reason: event.type,
      source: 'delivery_provider',
      detail: JSON.stringify({ eventId: event.id, providerMessageId: event.providerMessageId }),
      expires_at: null,
    }).execute();
  }
}
