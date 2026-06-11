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

import { type Kysely, sql } from 'kysely';
import { nanoid } from 'nanoid';
import type { DB } from '../../codegen/db.js';
import type { MessageDTO, UserDTO, HighlightDTO } from './dto.js';
import { getUsers } from './users.js';

/**
 * Numeric, monotonic message_id (ms-timestamp based, like the legacy Sendbird
 * ids). MUST be numeric: the GraphQL HomeFeedItem.id is a Float and the frontend
 * route is /home/:channelId/:messageId(\d+) — a nanoid string id breaks both, so
 * a freshly-posted message/comment would throw on the feed/thread read.
 * Monotonic bump guarantees uniqueness within the process.
 */
// message_id is varchar(11); existing ids are ≤10-digit numbers. Centiseconds
// (Date.now()/100) is an 11-digit number that fits, stays numeric, and sorts
// after the legacy ids. Monotonic bump guarantees uniqueness within the process.
let _lastMessageTs = 0;
function nextMessageId(): string {
  const ts = Math.floor(Date.now() / 100);
  _lastMessageTs = ts > _lastMessageTs ? ts : _lastMessageTs + 1;
  return String(_lastMessageTs);
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

/**
 * Assemble many MessageDTOs with a CONSTANT number of queries, no matter how many
 * messages are passed: one bulk fetch each for highlights, reactions, and thread
 * replies (all keyed by `message_id IN (...)`), plus a single getUsers() for every
 * author + replier. The previous per-message assembler fired 4-7 of its OWN queries
 * (user + highlights + reactions + thread-info, plus a loadUser per replier), which
 * multiplied catastrophically when getMessages was called per-channel across a feed
 * (~50 channels × 30 messages × ~7 ≈ 10k queries). This collapses that to ~5.
 *
 * Authors/repliers come from getUsers(), so human display names resolve from
 * bom_user.name + the derived avatar (the thin-row coalesce) here too.
 */
async function assembleMessages(db: Kysely<DB>, msgs: RawMessage[]): Promise<MessageDTO[]> {
  if (msgs.length === 0) return [];
  const messageIds = msgs.map((m) => m.message_id);

  const [highlightRows, reactionRows, replyRows] = await Promise.all([
    db
      .selectFrom('messenger_highlights')
      .select(['message_id', 'ordinal', 'text'])
      .where('message_id', 'in', messageIds)
      .orderBy('ordinal', 'asc')
      .execute(),
    db
      .selectFrom('messenger_reactions')
      .select(['message_id', 'reaction_key', 'user_id'])
      .where('message_id', 'in', messageIds)
      .execute(),
    // Thread replies: no is_deleted filter (mirrors legacy getThreadInfo), ordered chrono.
    db
      .selectFrom('messenger_messages')
      .select(['parent_message_id', 'user_id'])
      .where('parent_message_id', 'in', messageIds)
      .orderBy('created_at', 'asc')
      .execute(),
  ]);

  const highlightsByMsg = new Map<string, { ordinal: number; text: string }[]>();
  for (const h of highlightRows) {
    const arr = highlightsByMsg.get(h.message_id) ?? [];
    arr.push({ ordinal: Number(h.ordinal), text: h.text });
    highlightsByMsg.set(h.message_id, arr);
  }

  const reactionsByMsg = new Map<string, { reaction_key: string; user_id: string }[]>();
  for (const r of reactionRows) {
    const arr = reactionsByMsg.get(r.message_id) ?? [];
    arr.push({ reaction_key: r.reaction_key, user_id: r.user_id });
    reactionsByMsg.set(r.message_id, arr);
  }

  // Replies grouped by parent, preserving chronological order.
  const repliersByParent = new Map<string, string[]>();
  for (const r of replyRows) {
    if (!r.parent_message_id) continue;
    const arr = repliersByParent.get(r.parent_message_id) ?? [];
    arr.push(r.user_id);
    repliersByParent.set(r.parent_message_id, arr);
  }

  // most_replies = up to 3 unique repliers, reverse-chronological (legacy semantics).
  const mostRepliersByParent = new Map<string, string[]>();
  const userIds = new Set<string>();
  for (const m of msgs) userIds.add(m.user_id);
  for (const [parent, repliers] of repliersByParent) {
    const seen = new Set<string>();
    const top: string[] = [];
    for (let i = repliers.length - 1; i >= 0 && top.length < 3; i--) {
      const id = repliers[i]!;
      if (!seen.has(id)) {
        seen.add(id);
        top.push(id);
        userIds.add(id);
      }
    }
    mostRepliersByParent.set(parent, top);
  }

  // Single batched user fetch (coalesces nickname/avatar from bom_user).
  const users = await getUsers(db, [...userIds]);
  const userMap = new Map(users.map((u) => [u.user_id, u]));

  return msgs.map((m) => {
    const highlights = highlightsByMsg.get(m.message_id) ?? [];
    const repliers = repliersByParent.get(m.message_id);
    const threadInfo =
      repliers && repliers.length > 0
        ? {
            reply_count: repliers.length,
            most_replies: (mostRepliersByParent.get(m.message_id) ?? [])
              .map((id) => userMap.get(id))
              .filter((u): u is UserDTO => !!u),
          }
        : null;
    return {
      message_id: m.message_id,
      channel_url: m.channel_url,
      user: userMap.get(m.user_id) ?? null,
      message_type: m.message_type,
      message: m.message,
      custom_type: m.custom_type ?? '',
      data: buildDataString(m.link_type, m.link_target, m.link_aux, highlights),
      parent_message_id: m.parent_message_id ?? null,
      thread_info: threadInfo,
      reactions: aggregateReactions(reactionsByMsg.get(m.message_id) ?? []),
      created_at: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
      updated_at: m.updated_at ? new Date(m.updated_at).getTime() : Date.now(),
    };
  });
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

  const [dto] = await assembleMessages(db, [msg as RawMessage]);
  return dto ?? null;
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
  const messageId = nextMessageId();

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

  return assembleMessages(db, rows as RawMessage[]);
}

// ─── getMessagesForChannels (batched, multi-channel) ──────────────────────────

/**
 * Fetch the latest `limitPerChannel` messages for MANY channels in ONE windowed
 * query (ROW_NUMBER per channel), then assemble them all in a single batched pass.
 * Returns a Map channel_url → MessageDTO[] (newest-first per channel).
 *
 * Replaces the homefeed/channel-list pattern of calling getMessages() once per
 * channel (N round-trips → a single windowed query + ~5 bulk-assembly queries).
 */
export async function getMessagesForChannels(
  db: Kysely<DB>,
  channelUrls: string[],
  limitPerChannel = 30,
  includeReplies = false,
): Promise<Map<string, MessageDTO[]>> {
  const result = new Map<string, MessageDTO[]>();
  if (channelUrls.length === 0) return result;

  const replyFilter = includeReplies ? sql`` : sql`AND parent_message_id IS NULL`;
  const rows = (
    await sql<RawMessage>`
      SELECT message_id, channel_url, user_id, message_type, message, custom_type,
             link_type, link_target, link_aux, metadata, parent_message_id, is_deleted,
             created_at, updated_at
      FROM (
        SELECT m.*, ROW_NUMBER() OVER (
                 PARTITION BY channel_url ORDER BY created_at DESC, message_id DESC
               ) AS rn
        FROM messenger_messages m
        WHERE channel_url IN (${sql.join(channelUrls)})
          AND (is_deleted IS NULL OR is_deleted = 0) ${replyFilter}
      ) ranked
      WHERE rn <= ${limitPerChannel}
    `.execute(db)
  ).rows;

  const dtos = await assembleMessages(db, rows as RawMessage[]); // ONE batched assembly for every channel
  for (const d of dtos) {
    const arr = result.get(d.channel_url) ?? [];
    arr.push(d);
    result.set(d.channel_url, arr);
  }
  // Preserve newest-first ordering per channel (ROW_NUMBER already ordered DESC).
  return result;
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
  return assembleMessages(db, rows as RawMessage[]);
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
