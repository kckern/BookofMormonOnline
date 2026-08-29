import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { getBus } from '../realtime/RealtimeBus.js';
import { userRoom } from '../messaging/notifications.js';
import { persistNotification, rowToDTO, type PersistNotificationInput } from './store.js';
import { env } from '../config/env.js';
import { queueNotificationEmail } from '../email/notificationScheduler.js';

// Durable write + best-effort in-app push. Emits only when a NEW row was inserted,
// so retries and double-fired socket handlers never double-notify.
// NOTE (SANDBOX): when env.SANDBOX is on, sandboxDialect makes the insert always
// report inserted:false (writes are suppressed), so we can't distinguish a fresh
// event from a dup — emit unconditionally in sandbox so live UX still works.
// In production, emit is coupled to a successful durable write; a failed insert
// suppresses the push, and the next getNotifications fetch is the recovery path.
export async function notify(
  db: Kysely<DB>,
  input: PersistNotificationInput,
): Promise<void> {
  const createdAt = input.createdAt ?? new Date();
  const { inserted } = await persistNotification(db, { ...input, createdAt });
  if (!inserted && !env.SANDBOX) return; // in sandbox, still emit (insert is always suppressed there)
  const dto = rowToDTO({
    type: input.type,
    dedupe_key: input.dedupeKey,
    payload: input.payload,
    created_at: createdAt,
    read_at: null,
  });
  getBus().emit('notification_received', userRoom(input.userId), dto);
  // Email is deliberately optional and opt-in. Failure here must never roll
  // back or suppress the durable in-app notification.
  try {
    await queueNotificationEmail(db, input);
  } catch (error) {
    console.error('[notification-email] enqueue failed:', error);
  }
}
