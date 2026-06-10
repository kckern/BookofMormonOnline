/**
 * messages.ts — Kysely port of Messenger.postMessage/getMessage/getMessages/
 * getThread/getThreadInfo/updateMessage/deleteMessage (src/library/messenger.ts:401-648).
 *
 * Accepts `db: Kysely<DB>` so callers (socket handlers, GraphQL resolvers, tests)
 * supply their own connection — no module-level singleton.
 *
 * `data` field on MessageDTO is assembled as a JSON string exactly as the legacy lib does:
 *   { links?: { [link_type]: link_target[.link_aux] }, highlights?: string[] }
 *
 * thread_info: null when the message has no replies; populated from a single query when
 * it does. most_replies: up to 3 unique repliers in reverse-chronological order (matches
 * legacy — see getThreadInfo in reference).
 *
 * user (UserDTO): loaded via a small local helper so this module has no coupling to
 * users.ts (which Task 1.2 owns). Seam: replace `loadUser` with `import { getUser }
 * from './users.js'` once that module is available; the signature is identical.
 */

import { type Kysely } from 'kysely';
import { nanoid } from 'nanoid';
import type { DB } from '../../codegen/db.js';
import type { MessageDTO, UserDTO, HighlightDTO } from './dto.js';

// ─── Local user-load seam ─────────────────────────────────────────────────────
// Avoids coupling to users.ts (Task 1.2). Replace with that module's getUser once
// it exists and deduplication matters more than coupling.

function rowToUserDTO(row: {
  user_id: string;
  nickname: string;
  profile_url: string | null;
  metadata: unknown;
  is_bot: number | null;
  is_online: number | null;
  last_seen_at: Date | null;
}): UserDTO {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata != null) {
    if (typeof row.metadata === 'string') {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        metadata = null;
      }
    } else if (typeof row.metadata === 'object') {
      metadata = row.metadata as Record<string, unknown>;
    }
  }
  return {
    user_id: row.user_id,
    nickname: row.nickname ?? row.user_id,
    profile_url: row.profile_url ?? '',
    metadata,
    is_online: Boolean(row.is_online),
    last_seen_at: row.last_seen_at ? new Date(row.last_seen_at).getTime() : null,
    is_bot: Boolean(row.is_bot),
  };
}

async function loadUser(db: Kysely<DB>, userId: string): Promise<UserDTO | null> {
  const row = await db
    .selectFrom('messenger_users')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return row ? rowToUserDTO(row) : null;
}

// ─── Data assembly helpers ────────────────────────────────────────────────────

/**
 * Build the `data` JSON string exactly as legacy toMessageDTO does:
 *   { links?: { [link_type]: link_target[.link_aux] }, highlights?: string[] }
 */
function buildDataString(
  linkType: string | null,
  linkTarget: string | null,
  linkAux: string | null,
  highlights: { ordinal: number; text: string }[],
): string {
  const obj: Record<string, unknown> = {};

  if (linkType && linkTarget) {
    const linkValue = linkAux ? `${linkTarget}.${linkAux}` : linkTarget;
    obj['links'] = { [linkType]: linkValue };
  }

  if (highlights.length > 0) {
    const sorted = [...highlights].sort((a, b) => a.ordinal - b.ordinal);
    obj['highlights'] = sorted.map((h) => h.text);
  }

  return JSON.stringify(obj);
}

/** Aggregate raw reaction rows into the MessageDTO.reactions shape. */
function aggregateReactions(
  reactions: { reaction_key: string; user_id: string }[],
): { key: string; user_ids: string[] }[] {
  const map: Record<string, string[]> = {};
  for (const r of reactions) {
    if (!map[r.reaction_key]) map[r.reaction_key] = [];
    map[r.reaction_key]!.push(r.user_id);
  }
  return Object.entries(map).map(([key, user_ids]) => ({ key, user_ids }));
}

// ─── getThreadInfo (internal) ─────────────────────────────────────────────────

/**
 * Legacy behaviour: no is_deleted filter on replies (mirrors messenger.ts:549).
 * Returns null when the message has no replies.
 * most_replies: up to 3 unique users from the most-recent replies.
 */
async function getThreadInfo(
  db: Kysely<DB>,
  messageId: string,
): Promise<{ reply_count: number; most_replies: UserDTO[] } | null> {
  const allReplies = await db
    .selectFrom('messenger_messages')
    .select(['user_id'])
    .where('parent_message_id', '=', messageId)
    .orderBy('created_at', 'asc')
    .execute();

  if (allReplies.length === 0) return null;

  // Legacy reverses the ordered list, then takes the first 3 unique user_ids
  const reversed = [...allReplies].reverse();
  const seen = new Set<string>();
  const uniqueRepliers: UserDTO[] = [];
  for (const r of reversed) {
    if (!seen.has(r.user_id) && uniqueRepliers.length < 3) {
      seen.add(r.user_id);
      const user = await loadUser(db, r.user_id);
      if (user) uniqueRepliers.push(user);
    }
  }

  return {
    reply_count: allReplies.length,
    most_replies: uniqueRepliers,
  };
}

// ─── Internal row type ────────────────────────────────────────────────────────

type RawMessage = {
  message_id: string;
  channel_url: string;
  user_id: string;
  message_type: 'MESG' | 'FILE' | 'ADMN';
  message: string;
  custom_type: string | null;
  link_type: string | null;
  link_target: string | null;
  link_aux: string | null;
  metadata: unknown;
  parent_message_id: string | null;
  is_deleted: number | null;
  created_at: Date | null;
  updated_at: Date | null;
};

/** Fully assemble a MessageDTO from a raw DB row (loads user, highlights, reactions, thread). */
async function assembleMessageDTO(
  db: Kysely<DB>,
  msg: RawMessage,
): Promise<MessageDTO> {
  const [user, highlights, reactions, threadInfo] = await Promise.all([
    loadUser(db, msg.user_id),
    db
      .selectFrom('messenger_highlights')
      .select(['id', 'message_id', 'ordinal', 'text'])
      .where('message_id', '=', msg.message_id)
      .orderBy('ordinal', 'asc')
      .execute(),
    db
      .selectFrom('messenger_reactions')
      .select(['reaction_key', 'user_id'])
      .where('message_id', '=', msg.message_id)
      .execute(),
    getThreadInfo(db, msg.message_id),
  ]);

  return {
    message_id: msg.message_id,
    channel_url: msg.channel_url,
    user,
    message_type: msg.message_type,
    message: msg.message,
    custom_type: msg.custom_type ?? '',
    data: buildDataString(msg.link_type, msg.link_target, msg.link_aux, highlights),
    parent_message_id: msg.parent_message_id ?? null,
    thread_info: threadInfo,
    reactions: aggregateReactions(reactions),
    created_at: msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
    updated_at: msg.updated_at ? new Date(msg.updated_at).getTime() : Date.now(),
  };
}

// ─── getMessage ───────────────────────────────────────────────────────────────

/**
 * Load a single MessageDTO by (channelUrl, messageId).
 * Returns null if the message doesn't exist or is soft-deleted (is_deleted = 1).
 */
export async function getMessage(
  db: Kysely<DB>,
  channelUrl: string,
  messageId: string,
): Promise<MessageDTO | null> {
  const msg = await db
    .selectFrom('messenger_messages')
    .selectAll()
    .where('message_id', '=', messageId)
    .where('channel_url', '=', channelUrl)
    .executeTakeFirst();

  // Treat is_deleted = 1 as gone; NULL or 0 = present
  if (!msg || msg.is_deleted === 1) return null;

  return assembleMessageDTO(db, msg as RawMessage);
}

// ─── postMessage ──────────────────────────────────────────────────────────────

/**
 * Insert a new message (and optional highlights), touch the channel updated_at,
 * then return the fully-assembled MessageDTO.
 */
export async function postMessage(
  db: Kysely<DB>,
  params: {
    channelUrl: string;
    userId: string;
    message: string;
    messageType?: 'MESG' | 'FILE' | 'ADMN';
    customType?: string;
    link?: { type: string; target: string; aux?: string };
    highlights?: string[];
    metadata?: Record<string, unknown>;
    parentMessageId?: string;
  },
): Promise<MessageDTO> {
  const messageId = nanoid(11);

  await db
    .insertInto('messenger_messages')
    .values({
      message_id: messageId,
      channel_url: params.channelUrl,
      user_id: params.userId,
      message_type: params.messageType ?? 'MESG',
      message: params.message,
      custom_type: params.customType ?? '',
      link_type: params.link?.type ?? null,
      link_target: params.link?.target ?? null,
      link_aux: params.link?.aux ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      parent_message_id: params.parentMessageId ?? null,
    })
    .execute();

  if (params.highlights?.length) {
    const highlightRows = params.highlights.map((text, i) => ({
      id: nanoid(11),
      message_id: messageId,
      ordinal: i,
      text,
    }));
    await db.insertInto('messenger_highlights').values(highlightRows).execute();
  }

  // Touch channel updated_at (mirrors legacy)
  await db
    .updateTable('messenger_channels')
    .set({ updated_at: new Date() })
    .where('channel_url', '=', params.channelUrl)
    .execute();

  const msg = await getMessage(db, params.channelUrl, messageId);
  if (!msg) {
    throw new Error(`postMessage: failed to reload message ${messageId} after insert`);
  }
  return msg;
}

// ─── getMessages ──────────────────────────────────────────────────────────────

/**
 * Paginated channel history (top-level messages only by default).
 * `before`: message_id of the oldest message already visible — returns messages
 * posted before that message's created_at timestamp.
 */
export async function getMessages(
  db: Kysely<DB>,
  channelUrl: string,
  options: {
    before?: string;
    limit?: number;
    includeReplies?: boolean;
  } = {},
): Promise<MessageDTO[]> {
  let query = db
    .selectFrom('messenger_messages')
    .selectAll()
    .where('channel_url', '=', channelUrl)
    .where((eb) => eb.or([eb('is_deleted', 'is', null), eb('is_deleted', '=', 0)]));

  if (!options.includeReplies) {
    query = query.where('parent_message_id', 'is', null);
  }

  if (options.before) {
    const beforeMsg = await db
      .selectFrom('messenger_messages')
      .select('created_at')
      .where('message_id', '=', options.before)
      .executeTakeFirst();
    if (beforeMsg?.created_at) {
      query = query.where('created_at', '<', beforeMsg.created_at);
    }
  }

  const rows = await query
    .orderBy('created_at', 'desc')
    .limit(options.limit ?? 30)
    .execute();

  return Promise.all(rows.map((r) => assembleMessageDTO(db, r as RawMessage)));
}

// ─── getThread ────────────────────────────────────────────────────────────────

/**
 * Return all non-deleted replies to a parent message, oldest-first.
 */
export async function getThread(
  db: Kysely<DB>,
  parentMessageId: string,
): Promise<MessageDTO[]> {
  const rows = await db
    .selectFrom('messenger_messages')
    .selectAll()
    .where('parent_message_id', '=', parentMessageId)
    .where((eb) => eb.or([eb('is_deleted', 'is', null), eb('is_deleted', '=', 0)]))
    .orderBy('created_at', 'asc')
    .execute();

  // Thread replies don't get thread_info of their own (matches legacy: null)
  return Promise.all(rows.map((r) => assembleMessageDTO(db, r as RawMessage)));
}

// ─── updateMessage ────────────────────────────────────────────────────────────

/**
 * Update message fields and/or replace highlights.
 * Only provided fields are updated (partial update semantics).
 * Returns the refreshed MessageDTO, or null if the message doesn't exist.
 */
export async function updateMessage(
  db: Kysely<DB>,
  channelUrl: string,
  messageId: string,
  params: {
    message?: string;
    customType?: string;
    link?: { type: string; target: string; aux?: string };
    highlights?: string[];
    metadata?: Record<string, unknown>;
  },
): Promise<MessageDTO | null> {
  const updateData: Record<string, unknown> = {};
  if (params.message !== undefined) updateData['message'] = params.message;
  if (params.customType !== undefined) updateData['custom_type'] = params.customType;
  if (params.link) {
    updateData['link_type'] = params.link.type;
    updateData['link_target'] = params.link.target;
    updateData['link_aux'] = params.link.aux ?? null;
  }
  if (params.metadata !== undefined) {
    updateData['metadata'] = JSON.stringify(params.metadata);
  }

  if (Object.keys(updateData).length > 0) {
    await db
      .updateTable('messenger_messages')
      .set(updateData)
      .where('message_id', '=', messageId)
      .where('channel_url', '=', channelUrl)
      .execute();
  }

  if (params.highlights !== undefined) {
    await db
      .deleteFrom('messenger_highlights')
      .where('message_id', '=', messageId)
      .execute();
    if (params.highlights.length > 0) {
      const highlightRows = params.highlights.map((text, i) => ({
        id: nanoid(11),
        message_id: messageId,
        ordinal: i,
        text,
      }));
      await db.insertInto('messenger_highlights').values(highlightRows).execute();
    }
  }

  return getMessage(db, channelUrl, messageId);
}

// ─── deleteMessage ────────────────────────────────────────────────────────────

/**
 * Soft-delete a message (is_deleted = 1). Returns true if a row was updated.
 */
export async function deleteMessage(
  db: Kysely<DB>,
  channelUrl: string,
  messageId: string,
): Promise<boolean> {
  const result = await db
    .updateTable('messenger_messages')
    .set({ is_deleted: 1 })
    .where('message_id', '=', messageId)
    .where('channel_url', '=', channelUrl)
    .execute();

  // Kysely UpdateResult.numUpdatedRows is BigInt
  return Number(result[0]?.numUpdatedRows ?? 0) > 0;
}

// ─── getHighlights (convenience export) ──────────────────────────────────────

/**
 * Return raw highlights for a message as HighlightDTOs.
 * Useful for callers that need just the highlights without the full MessageDTO.
 */
export async function getHighlights(
  db: Kysely<DB>,
  messageId: string,
): Promise<HighlightDTO[]> {
  const rows = await db
    .selectFrom('messenger_highlights')
    .selectAll()
    .where('message_id', '=', messageId)
    .orderBy('ordinal', 'asc')
    .execute();

  return rows.map((r) => ({
    id: r.id,
    message_id: r.message_id,
    ordinal: Number(r.ordinal),
    text: r.text,
  }));
}
