import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import { env } from '../../config/env.js';
import { recordDeliveryEvent, type DeliveryEvent } from '../../email/events.js';

type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? value as UnknownRecord : {};
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function parseSesEvent(body: string, queueMessageId: string): DeliveryEvent {
  const envelope = asRecord(JSON.parse(body));
  const rawMessage = typeof envelope.Message === 'string' ? envelope.Message : body;
  const payload = asRecord(JSON.parse(rawMessage));
  const mail = asRecord(payload.mail);
  const rawType = String(payload.eventType ?? payload.notificationType ?? 'unknown');
  const typeMap: Record<string, DeliveryEvent['type']> = {
    Send: 'send', Delivery: 'delivery', Bounce: 'bounce', Complaint: 'complaint',
    Reject: 'reject', DeliveryDelay: 'delay', RenderingFailure: 'rendering_failure',
  };
  const bounce = asRecord(payload.bounce);
  const complaint = asRecord(payload.complaint);
  const bounced = Array.isArray(bounce.bouncedRecipients)
    ? bounce.bouncedRecipients.map(asRecord).map((item) => item.emailAddress).filter((item): item is string => typeof item === 'string')
    : [];
  const complained = Array.isArray(complaint.complainedRecipients)
    ? complaint.complainedRecipients.map(asRecord).map((item) => item.emailAddress).filter((item): item is string => typeof item === 'string')
    : [];
  const timestamp = String(mail.timestamp ?? envelope.Timestamp ?? new Date().toISOString());
  return {
    id: String(envelope.MessageId ?? queueMessageId),
    providerMessageId: typeof mail.messageId === 'string' ? mail.messageId : undefined,
    type: typeMap[rawType] ?? rawType.toLowerCase(),
    recipients: bounced.length ? bounced : complained.length ? complained : strings(mail.destination),
    occurredAt: new Date(timestamp),
    payload,
  };
}

/** Long-polls SQS. AWS queue mechanics and payload shape are isolated here. */
export async function startSesEventConsumer(db: Kysely<DB>): Promise<() => void> {
  if (!env.MAIL_EVENT_QUEUE_URL) return () => undefined;
  const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = await import('@aws-sdk/client-sqs');
  const client = new SQSClient({ region: env.MAIL_REGION });
  let stopped = false;
  const loop = async () => {
    while (!stopped) {
      try {
        const result = await client.send(new ReceiveMessageCommand({
          QueueUrl: env.MAIL_EVENT_QUEUE_URL,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 60,
        }));
        for (const message of result.Messages ?? []) {
          if (!message.Body || !message.MessageId || !message.ReceiptHandle) continue;
          const event = parseSesEvent(message.Body, message.MessageId);
          await recordDeliveryEvent(db, event);
          await client.send(new DeleteMessageCommand({
            QueueUrl: env.MAIL_EVENT_QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle,
          }));
        }
      } catch (error) {
        console.error('[mailer:ses-events] poll failed:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  };
  void loop();
  return () => { stopped = true; };
}
