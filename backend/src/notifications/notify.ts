import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { getBus } from '../realtime/RealtimeBus.js';
import { userRoom } from '../messaging/notifications.js';
import { persistNotification, rowToDTO, type PersistNotificationInput } from './store.js';

// Durable write + best-effort in-app push. Emits only when a NEW row was inserted,
// so retries and double-fired socket handlers never double-notify.
// NOTE (SANDBOX): when env.SANDBOX is on, sandboxDialect makes the insert report
// inserted:false, so no push fires — accepted read-only-dev behavior. Emit is
// deliberately coupled to a successful durable write; a failed insert also
// suppresses the push, and the next getNotifications fetch is the recovery path.
export async function notify(
  db: Kysely<DB>,
  input: PersistNotificationInput,
): Promise<void> {
  const createdAt = input.createdAt ?? new Date();
  const { inserted } = await persistNotification(db, { ...input, createdAt });
  if (!inserted) return;
  const dto = rowToDTO({
    type: input.type,
    dedupe_key: input.dedupeKey,
    payload: input.payload,
    created_at: createdAt,
    read_at: null,
  });
  getBus().emit('notification_received', userRoom(input.userId), dto);
}
