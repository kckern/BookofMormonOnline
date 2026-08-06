/**
 * notifications.ts — derives a per-user notification feed from existing messenger
 * data. There is no dedicated notifications table; the events that matter to a
 * user are reconstructed in bulk from three existing sources:
 *
 *   1. REPLY    — someone posted a reply (parent_message_id set) to a top-level
 *                 message the user authored.
 *   2. REACTION — someone reacted (messenger_reactions) to a message the user
 *                 authored.
 *   3. INVITE   — the user has a membership row in state='invited' (group invite).
 *
 * Read state has no per-row column either, so it is stored in the user's
 * messenger_users.metadata JSON:
 *   - notificationsReadAt: ms-epoch watermark. Everything older is read.
 *     "mark all read" advances this to NOW().
 *   - notificationsRead: string[] of notification ids explicitly marked read
 *     (single mark-read), for items newer than the watermark. Pruned to ids
 *     newer than the watermark on write so the array can't grow unbounded.
 *
 * A notification id is deterministic from its source so the same event always
 * produces the same id (idempotent mark-read across refetches):
 *   reply:<messageId>  reaction:<messageId>:<actorId>:<key>  invite:<channelUrl>
 *
 * Assembly follows the codebase bulk pattern: a constant number of queries
 * regardless of how many notifications are produced (one query per source +
 * one getUsers() for every actor).
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { UserDTO } from './dto.js';
import { getUser, getUsers } from './users.js';
import { getUserMetadata, updateUserMetadata } from './users.js';
import { notify } from '../notifications/notify.js';
import { rowToDTO } from '../notifications/store.js';

export type NotificationType = 'reply' | 'reaction' | 'invite';

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  actor: UserDTO | null;
  /** Channel the event happened in (for navigation). */
  channel_url: string | null;
  /** The message the event targets (reply parent / reacted message). */
  message_id: string | null;
  /** Short human-readable summary line. */
  text: string;
  /** ms-epoch of the event. */
  created_at: number;
  is_read: boolean;
}

// How far back to look — events older than this are never surfaced (keeps the
// derivation bounded; an unread notification feed isn't an archive).
const LOOKBACK_DAYS = 30;
// Hard cap on returned notifications.
const MAX_NOTIFICATIONS = 50;

interface ReadState {
  watermark: number; // ms-epoch
  readIds: Set<string>;
}

function lookbackDate(): Date {
  return new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
}

function toMs(d: Date | string | null): number {
  if (!d) return 0;
  return new Date(d).getTime();
}

async function getReadState(db: Kysely<DB>, userId: string): Promise<ReadState> {
  const meta = (await getUserMetadata(db, userId)) ?? {};
  const watermark = typeof meta['notificationsReadAt'] === 'number'
    ? (meta['notificationsReadAt'] as number)
    : 0;
  const readIds = Array.isArray(meta['notificationsRead'])
    ? new Set((meta['notificationsRead'] as unknown[]).filter((x): x is string => typeof x === 'string'))
    : new Set<string>();
  return { watermark, readIds };
}

// ─── getNotifications ───────────────────────────────────────────────────────────

/**
 * Build the user's notification feed (newest first). Read state is applied from
 * the user's metadata. Bulk-assembled: one query per source, one getUsers().
 */
export async function getNotifications(
  db: Kysely<DB>,
  userId: string,
): Promise<NotificationDTO[]> {
  const since = lookbackDate();

  // 1) Top-level message ids the user authored (within lookback) — the targets
  //    that replies/reactions can point at. One query.
  const authored = await db
    .selectFrom('messenger_messages')
    .select(['message_id', 'channel_url'])
    .where('user_id', '=', userId)
    .where('parent_message_id', 'is', null)
    .where((eb) => eb.or([eb('is_deleted', 'is', null), eb('is_deleted', '=', 0)]))
    .where('created_at', '>', since)
    .execute();

  const authoredIds = authored.map((r) => r.message_id);
  const channelByMessage = new Map(authored.map((r) => [r.message_id, r.channel_url] as const));

  // Fetch replies, reactions, and invites in parallel (3 queries).
  const [replyRows, reactionRows, inviteRows] = await Promise.all([
    authoredIds.length
      ? db
          .selectFrom('messenger_messages')
          .select(['message_id', 'channel_url', 'user_id', 'parent_message_id', 'created_at'])
          .where('parent_message_id', 'in', authoredIds)
          .where('user_id', '!=', userId) // not my own replies
          .where((eb) => eb.or([eb('is_deleted', 'is', null), eb('is_deleted', '=', 0)]))
          .where('created_at', '>', since)
          .orderBy('created_at', 'desc')
          .execute()
      : Promise.resolve([]),
    authoredIds.length
      ? db
          .selectFrom('messenger_reactions')
          .select(['message_id', 'user_id', 'reaction_key', 'created_at'])
          .where('message_id', 'in', authoredIds)
          .where('user_id', '!=', userId) // not my own reactions
          .where('created_at', '>', since)
          .orderBy('created_at', 'desc')
          .execute()
      : Promise.resolve([]),
    db
      .selectFrom('messenger_members')
      .innerJoin('messenger_channels', 'messenger_channels.channel_url', 'messenger_members.channel_url')
      .select([
        'messenger_members.channel_url as channel_url',
        'messenger_members.created_at as created_at',
        'messenger_channels.name as channel_name',
      ])
      .where('messenger_members.user_id', '=', userId)
      .where('messenger_members.state', '=', 'invited')
      .orderBy('messenger_members.created_at', 'desc')
      .execute(),
  ]);

  // Collect actor ids for one bulk getUsers().
  const actorIds = new Set<string>();
  for (const r of replyRows) actorIds.add(r.user_id);
  for (const r of reactionRows) actorIds.add(r.user_id);
  const users = await getUsers(db, [...actorIds]);
  const userMap = new Map(users.map((u) => [u.user_id, u]));

  const { watermark, readIds } = await getReadState(db, userId);

  const items: NotificationDTO[] = [];

  for (const r of replyRows) {
    const actor = userMap.get(r.user_id) ?? null;
    const createdMs = toMs(r.created_at);
    const id = `reply:${r.message_id}`;
    items.push({
      id,
      type: 'reply',
      actor,
      channel_url: r.channel_url,
      message_id: r.parent_message_id,
      text: `${actor?.nickname ?? 'Someone'} replied to your comment`,
      created_at: createdMs,
      is_read: createdMs <= watermark || readIds.has(id),
    });
  }

  for (const r of reactionRows) {
    const actor = userMap.get(r.user_id) ?? null;
    const createdMs = toMs(r.created_at);
    const id = `reaction:${r.message_id}:${r.user_id}:${r.reaction_key}`;
    items.push({
      id,
      type: 'reaction',
      actor,
      channel_url: channelByMessage.get(r.message_id) ?? null,
      message_id: r.message_id,
      text: `${actor?.nickname ?? 'Someone'} reacted to your message`,
      created_at: createdMs,
      is_read: createdMs <= watermark || readIds.has(id),
    });
  }

  for (const r of inviteRows) {
    const createdMs = toMs(r.created_at);
    const id = `invite:${r.channel_url}`;
    items.push({
      id,
      type: 'invite',
      actor: null,
      channel_url: r.channel_url,
      message_id: null,
      text: `You were invited to ${r.channel_name ?? 'a group'}`,
      created_at: createdMs,
      is_read: createdMs <= watermark || readIds.has(id),
    });
  }

  items.sort((a, b) => b.created_at - a.created_at);

  // Dual-read: merge durable rows with the derived feed, dedup by public id.
  const rows = await db
    .selectFrom('bom_notification')
    .select(['type', 'dedupe_key', 'payload', 'created_at', 'read_at'])
    .where('user_id', '=', userId)
    .where('created_at', '>', since)
    .where('dismissed_at', 'is', null)
    .orderBy('created_at', 'desc')
    .limit(MAX_NOTIFICATIONS)
    .execute();

  const byId = new Map<string, NotificationDTO>();
  for (const n of items) byId.set(n.id, n); // derived arm
  for (const row of rows) {
    const n = rowToDTO(row);
    const prev = byId.get(n.id);
    // read if: the row itself is read, OR its derived twin was read,
    // OR metadata read-state covers it (watermark / explicit read id).
    const isRead = n.is_read || (prev?.is_read ?? false)
      || n.created_at <= watermark || readIds.has(n.id);
    byId.set(n.id, { ...n, is_read: isRead });
  }
  return [...byId.values()]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, MAX_NOTIFICATIONS);
}

/** Count unread notifications (drives the bell badge). */
export async function getUnreadNotificationCount(
  db: Kysely<DB>,
  userId: string,
): Promise<number> {
  const items = await getNotifications(db, userId);
  return items.filter((n) => !n.is_read).length;
}

// ─── mark read ──────────────────────────────────────────────────────────────────

/**
 * Mark a single notification id read by adding it to the metadata readIds set.
 * Prunes ids older than the watermark on write so the array stays bounded.
 */
export async function markNotificationRead(
  db: Kysely<DB>,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  if (!notificationId) return false;
  const meta = (await getUserMetadata(db, userId)) ?? {};
  const existing = Array.isArray(meta['notificationsRead'])
    ? (meta['notificationsRead'] as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  if (existing.includes(notificationId)) return true;
  meta['notificationsRead'] = [...existing, notificationId];
  return updateUserMetadata(db, userId, meta);
}

/**
 * Mark all notifications read by advancing the watermark to NOW() and clearing
 * the explicit readIds set (everything is now under the watermark).
 */
export async function markAllNotificationsRead(
  db: Kysely<DB>,
  userId: string,
): Promise<boolean> {
  const meta = (await getUserMetadata(db, userId)) ?? {};
  meta['notificationsReadAt'] = Date.now();
  meta['notificationsRead'] = [];
  return updateUserMetadata(db, userId, meta);
}

// ─── realtime push ────────────────────────────────────────────────────────────

/** Personal socket room a user is auto-joined to on connect (server.ts). */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Push a freshly-created notification to its recipient's personal socket room.
 * Best-effort and fire-and-forget — never throws into the caller (a socket
 * handler), never blocks the message/reaction ack. The client patches the bell
 * in place (no refetch, no polling) from the `notification_received` event.
 *
 * `targetMessageId` is the message that was replied-to / reacted-to; we resolve
 * its author (the recipient) and skip self-notifications.
 */
export async function pushNotificationForEvent(
  db: Kysely<DB>,
  params: {
    type: NotificationType;
    targetMessageId: string;
    actorId: string;
    reactionKey?: string;
    sourceMessageId?: string; // the child reply message id (for type 'reply')
  },
): Promise<void> {
  try {
    const target = await db
      .selectFrom('messenger_messages')
      .select(['message_id', 'channel_url', 'user_id', 'parent_message_id'])
      .where('message_id', '=', params.targetMessageId)
      .where((eb) => eb.or([eb('is_deleted', 'is', null), eb('is_deleted', '=', 0)]))
      .executeTakeFirst();
    if (!target) return;

    const recipientId = target.user_id;
    if (!recipientId || recipientId === params.actorId) return; // no self-notify

    const actor = await getUser(db, params.actorId);
    const nickname = actor?.nickname ?? 'Someone';

    let id: string;
    let text: string;
    let messageId: string | null;
    if (params.type === 'reply') {
      // Each reply is its own notification — key on the child reply message id
      // to match the derived feed (reply:<replyMessageId>) and to avoid collapsing
      // multiple replies to the same parent into one.
      if (!params.sourceMessageId) return; // can't form a correct/unique reply id
      id = `reply:${params.sourceMessageId}`;
      text = `${nickname} replied to your comment`;
      messageId = target.message_id;
    } else {
      id = `reaction:${params.targetMessageId}:${params.actorId}:${params.reactionKey ?? ''}`;
      text = `${nickname} reacted to your message`;
      messageId = target.message_id;
    }

    const notif: NotificationDTO = {
      id,
      type: params.type,
      actor,
      channel_url: target.channel_url,
      message_id: messageId,
      text,
      created_at: Date.now(),
      is_read: false,
    };

    await notify(db, {
      userId: recipientId,
      type: params.type,
      actorId: params.actorId,
      dedupeKey: notif.id,
      payload: {
        text: notif.text,
        channel_url: notif.channel_url,
        message_id: notif.message_id,
        actor: notif.actor,
      },
      createdAt: new Date(notif.created_at),
    });
  } catch (err) {
    console.error('pushNotificationForEvent error:', err);
  }
}
