import type { Kysely } from 'kysely';
import type { DB } from '../codegen/db.js';
import { getNotifications } from '../src/messaging/notifications.js';
import { persistNotification } from '../src/notifications/store.js';

// Seed durable rows from the derived feed for one user. Returns count of NEW rows.
// Idempotent: UNIQUE (user_id, dedupe_key) makes re-runs no-ops.
export async function backfillUser(db: Kysely<DB>, userId: string): Promise<number> {
  const derived = await getNotifications(db, userId);
  let inserted = 0;
  for (const n of derived) {
    const res = await persistNotification(db, {
      userId,
      type: n.type,
      actorId: n.actor?.user_id ?? null,   // UserDTO exposes user_id, NOT id
      dedupeKey: n.id,
      payload: { text: n.text, channel_url: n.channel_url, message_id: n.message_id, actor: n.actor },
      createdAt: new Date(n.created_at),
    });
    if (res.inserted) inserted++;
    // Stamp read state to match the derived feed.
    if (n.is_read) {
      await db.updateTable('bom_notification')
        .set({ read_at: new Date(n.created_at) })
        .where('user_id', '=', userId).where('dedupe_key', '=', n.id)
        .where('read_at', 'is', null).executeTakeFirst();
    }
  }
  return inserted;
}

// CLI: backfill every user with authored top-level messages in the lookback window.
// HELD — run deliberately as a rollout step; not part of automated test/CI.
async function main(): Promise<void> {
  const { getDb } = await import('../src/data/db.js');
  const db = getDb();
  const users = await db
    .selectFrom('messenger_messages')
    .select('user_id')
    .where('parent_message_id', 'is', null)
    .distinct()
    .execute();
  let total = 0;
  for (const u of users) total += await backfillUser(db, u.user_id);
  console.log(`backfill complete: ${total} new rows across ${users.length} users`);
  await db.destroy();
}

// Run as a script (not when imported by tests).
if (
  (process.argv[1] && process.argv[1].endsWith('backfill-notifications.ts')) ||
  (process.argv[1]?.endsWith('backfill-notifications.js'))
) {
  main().catch((e) => { console.error('backfill failed:', e); process.exit(1); });
}
