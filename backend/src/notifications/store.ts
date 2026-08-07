import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { NotificationDTO } from '../messaging/notifications.js';
import type { UserDTO } from '../messaging/dto.js';  // UserDTO has user_id, NOT id

export interface NotificationPayload {
  text: string;
  channel_url: string | null;
  message_id: string | null;
  actor: UserDTO | null;
}

export interface PersistNotificationInput {
  userId: string;      // recipient (md5)
  type: string;        // 'reply' | 'reaction' | 'invite' | ...
  actorId: string | null;
  dedupeKey: string;   // deterministic public id; also NotificationDTO.id
  payload: NotificationPayload;
  createdAt?: Date;    // defaults to now
}

// Idempotent write. Duplicate (user_id, dedupe_key) is a no-op (INSERT IGNORE).
export async function persistNotification(
  db: Kysely<DB>,
  input: PersistNotificationInput,
): Promise<{ inserted: boolean }> {
  const result = await db
    .insertInto('bom_notification')
    .ignore()
    .values({
      user_id: input.userId,
      type: input.type,
      actor_id: input.actorId,
      dedupe_key: input.dedupeKey,
      payload: JSON.stringify(input.payload),
      created_at: input.createdAt ?? new Date(),
    })
    .executeTakeFirst();
  return { inserted: Number(result.numInsertedOrUpdatedRows ?? 0n) > 0 };
}

// A stored row → the same DTO shape the derived feed returns. Public id = dedupe_key.
export function rowToDTO(row: {
  type: string; dedupe_key: string; payload: unknown;
  created_at: Date | null; read_at: Date | null;
}): NotificationDTO {
  const p = (typeof row.payload === 'string'
    ? JSON.parse(row.payload) : row.payload) as NotificationPayload;
  return {
    id: row.dedupe_key,
    type: row.type,
    actor: p.actor,
    channel_url: p.channel_url,
    message_id: p.message_id,
    text: p.text,
    created_at: (row.created_at ?? new Date()).getTime(),
    is_read: row.read_at != null,
  };
}
