/**
 * messaging/channels.ts — Kysely port of Messenger channel operations
 * (src/library/messenger.ts:207-343).
 *
 * Accepts `db: Kysely<DB>` so callers (socket handlers, GraphQL resolvers,
 * tests) supply their own connection — no module-level singleton.
 *
 * ChannelDTO assembly:
 *   members       — loaded via getChannelMembers() from members.ts
 *   member_count  — members.length
 *   last_message  — fetched inline with a small query (getLastMessage); avoids
 *                   importing full assembleMessageDTO heavy logic and only the
 *                   channel-level last_message is needed for the channel list.
 *                   Uses getMessages() from messages.ts (limit 1) which already
 *                   handles soft-deletes and assembles a full MessageDTO.
 *   unread_message_count — STUBBED 0 (readstate is Task 1.5)
 *   data          — JSON.stringify(metadata ?? {}) — back-compat per legacy
 *                   toChannelDTO (messenger.ts:764)
 *   metadata      — JSON column; mysql2 may deliver pre-parsed or as string
 *   created_at    — ms epoch
 *   lang          — defaults 'en' when null
 */

import { nanoid } from 'nanoid';
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { ChannelDTO } from './dto.js';
import { getChannelMembers, getChannelMembersBulk } from './members.js';
import { getMessages, getMessagesForChannels } from './messages.js';
import { getUnreadCount, getUnreadCounts } from './readstate.js';
import type { MemberDTO, MessageDTO } from './dto.js';

// ─── Metadata helper ──────────────────────────────────────────────────────────

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Internal row type ────────────────────────────────────────────────────────

type RawChannel = {
  channel_url: string;
  name: string;
  cover_url: string | null;
  custom_type: 'DM' | 'open' | 'private' | 'public' | 'solo';
  description: string | null;
  lang: string | null;
  metadata: unknown;
  created_at: Date | null;
  updated_at: Date | null;
};

// ─── DTO assembler ────────────────────────────────────────────────────────────

async function assembleChannelDTO(
  db: Kysely<DB>,
  row: RawChannel,
  viewerUserId?: string,
): Promise<ChannelDTO> {
  const metadata = parseMetadata(row.metadata);

  const [members, messages, unreadCount] = await Promise.all([
    getChannelMembers(db, row.channel_url),
    getMessages(db, row.channel_url, { limit: 1 }),
    viewerUserId
      ? getUnreadCount(db, row.channel_url, viewerUserId)
      : Promise.resolve(0),
  ]);

  return {
    channel_url: row.channel_url,
    name: row.name,
    cover_url: row.cover_url ?? '',
    custom_type: row.custom_type,
    // Top-level description: the GraphQL schema declares MessengerChannel.description
    // and every client selects it; omitting it from the DTO returned null, so the
    // admin "Edit profile" form never prefilled the saved description.
    description: row.description ?? '',
    // Merge the description column into the data JSON: createChannel/updateChannel
    // write the `description` column, but readers (assembleHomeGroup) parse
    // data.description — without this, group descriptions never surfaced.
    data: JSON.stringify({ ...(metadata ?? {}), ...(row.description != null ? { description: row.description } : {}) }), // back-compat: mirrors legacy toChannelDTO
    metadata,
    members,
    member_count: members.length,
    unread_message_count: unreadCount,
    last_message: messages[0] ?? null,
    created_at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    lang: row.lang ?? 'en',
  };
}

/** Build a ChannelDTO from a row + already-fetched members/last-message/unread (no queries). */
function buildChannelDTO(
  row: RawChannel,
  members: MemberDTO[],
  lastMessage: MessageDTO | null,
  unreadCount: number,
): ChannelDTO {
  const metadata = parseMetadata(row.metadata);
  return {
    channel_url: row.channel_url,
    name: row.name,
    cover_url: row.cover_url ?? '',
    custom_type: row.custom_type,
    // Top-level description: see assembleChannelDTO — schema declares it and clients
    // select it, so it must be populated here too (bulk channel-list/homefeed path).
    description: row.description ?? '',
    // Merge the description column into the data JSON: createChannel/updateChannel
    // write the `description` column, but readers (assembleHomeGroup) parse
    // data.description — without this, group descriptions never surfaced.
    data: JSON.stringify({ ...(metadata ?? {}), ...(row.description != null ? { description: row.description } : {}) }),
    metadata,
    members,
    member_count: members.length,
    unread_message_count: unreadCount,
    last_message: lastMessage,
    created_at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    lang: row.lang ?? 'en',
  };
}

/**
 * Assemble MANY ChannelDTOs with a constant number of queries: bulk members
 * (one query + one getUsers), bulk last-messages (one windowed query), and the
 * viewer's unread counts in parallel. Replaces per-channel assembleChannelDTO
 * fan-out in the channel-list / homefeed paths.
 */
async function assembleChannels(
  db: Kysely<DB>,
  rows: RawChannel[],
  viewerUserId?: string,
): Promise<ChannelDTO[]> {
  if (rows.length === 0) return [];
  const urls = rows.map((r) => r.channel_url);

  // M-6 fix: use getUnreadCounts (bulk) — one JOIN query instead of 2×N
  // per-channel queries. Semantics match getUnreadCount exactly (own messages
  // excluded, replies excluded, soft-deletes excluded, absent/NULL → 0).
  const [membersByChannel, lastMsgByChannel, unreadByUrl] = await Promise.all([
    getChannelMembersBulk(db, urls),
    getMessagesForChannels(db, urls, 1),
    viewerUserId
      ? getUnreadCounts(db, viewerUserId, urls)
      : Promise.resolve(new Map<string, number>()),
  ]);

  return rows.map((r) =>
    buildChannelDTO(
      r,
      membersByChannel.get(r.channel_url) ?? [],
      lastMsgByChannel.get(r.channel_url)?.[0] ?? null,
      unreadByUrl.get(r.channel_url) ?? 0,
    ),
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single channel by channel_url and assemble the full ChannelDTO.
 * Returns null if the channel does not exist.
 *
 * `viewerUserId` is optional — when supplied, `unread_message_count` is
 * computed for that user; when omitted it defaults to 0 (backward-compatible).
 */
export async function getChannel(
  db: Kysely<DB>,
  channelUrl: string,
  viewerUserId?: string,
): Promise<ChannelDTO | null> {
  const row = await db
    .selectFrom('messenger_channels')
    .selectAll()
    .where('channel_url', '=', channelUrl)
    .executeTakeFirst();

  if (!row) return null;
  return assembleChannelDTO(db, row as RawChannel, viewerUserId);
}

/**
 * Return all channels a user has joined (state = 'joined').
 * Optionally filtered by custom_type. Limit defaults to 100.
 *
 * The requesting user's unread count is computed per-channel using `userId`
 * as the viewer — no separate `viewerUserId` param needed here.
 */
export async function getMyChannels(
  db: Kysely<DB>,
  userId: string,
  options: {
    customTypes?: string[];
    limit?: number;
  } = {},
): Promise<ChannelDTO[]> {
  // Step 1: find channel_urls the user has joined
  const memberRows = await db
    .selectFrom('messenger_members')
    .select('channel_url')
    .where('user_id', '=', userId)
    .where('state', '=', 'joined')
    .limit(options.limit ?? 100)
    .execute();

  if (memberRows.length === 0) return [];

  const channelUrls = memberRows.map((r) => r.channel_url);

  // Step 2: fetch those channels, optionally filtering by custom_type
  let query = db
    .selectFrom('messenger_channels')
    .selectAll()
    .where('channel_url', 'in', channelUrls);

  if (options.customTypes && options.customTypes.length > 0) {
    // Kysely's type system limits the in() value type; cast through unknown
    query = query.where(
      'custom_type',
      'in',
      options.customTypes as unknown as ('DM' | 'open' | 'private' | 'public' | 'solo')[],
    );
  }

  const rows = await query.execute();

  return assembleChannels(db, rows as RawChannel[], userId);
}

/**
 * Channel custom_types that are study groups. DMs are conversations, not
 * groups — group-facing surfaces (home groups list, home feed, group
 * browsers) must never include them. Callers should reach for
 * getMyStudyGroups()/getMyDMs() rather than re-deriving this split.
 */
export const GROUP_TYPES = ['open', 'private', 'public', 'solo'] as const;

/** All study-group channels a user has joined (excludes DM channels). */
export async function getMyStudyGroups(
  db: Kysely<DB>,
  userId: string,
  options: { limit?: number } = {},
): Promise<ChannelDTO[]> {
  return getMyChannels(db, userId, { ...options, customTypes: [...GROUP_TYPES] });
}

/** All DM channels a user has joined. */
export async function getMyDMs(
  db: Kysely<DB>,
  userId: string,
  options: { limit?: number } = {},
): Promise<ChannelDTO[]> {
  return getMyChannels(db, userId, { ...options, customTypes: ['DM'] });
}

/**
 * Return discoverable channels (public/open by default).
 * Optionally filtered by lang. Limit defaults to 100.
 */
export async function getPublicChannels(
  db: Kysely<DB>,
  options: {
    lang?: string;
    customTypes?: string[];
    limit?: number;
  } = {},
): Promise<ChannelDTO[]> {
  const types = (options.customTypes ?? ['public', 'open']) as (
    | 'DM'
    | 'open'
    | 'private'
    | 'public'
    | 'solo'
  )[];

  let query = db
    .selectFrom('messenger_channels')
    .selectAll()
    .where('custom_type', 'in', types)
    .orderBy('updated_at', 'desc')
    .limit(options.limit ?? 100);

  if (options.lang) {
    query = query.where('lang', '=', options.lang);
  }

  const rows = await query.execute();
  return assembleChannels(db, rows as RawChannel[]);
}

/**
 * Find an existing channel of the given custom_type whose joined-member set is
 * EXACTLY `userIds` (same membership, no more, no less). Used to dedupe
 * "distinct" channels (e.g. a 1:1 DM): re-opening a conversation must reuse the
 * existing channel rather than mint a new orphan every time.
 *
 * Returns the assembled ChannelDTO of the match, or null if none exists.
 */
export async function findDistinctChannel(
  db: Kysely<DB>,
  customType: 'private' | 'public' | 'open' | 'solo' | 'DM',
  userIds: string[],
): Promise<ChannelDTO | null> {
  const wanted = [...new Set(userIds)];
  const anchorUser = wanted[0];
  if (!anchorUser) return null;

  // Candidate channels of this type that one of the members has joined.
  const memberRows = await db
    .selectFrom('messenger_members')
    .select('channel_url')
    .where('user_id', '=', anchorUser)
    .where('state', '=', 'joined')
    .execute();
  if (memberRows.length === 0) return null;

  const candidateUrls = [...new Set(memberRows.map((r) => r.channel_url))];

  const channelRows = await db
    .selectFrom('messenger_channels')
    .select('channel_url')
    .where('channel_url', 'in', candidateUrls)
    .where('custom_type', '=', customType)
    .execute();
  if (channelRows.length === 0) return null;

  // Compare full joined-member sets for each candidate.
  const allMembers = await db
    .selectFrom('messenger_members')
    .select(['channel_url', 'user_id'])
    .where('channel_url', 'in', channelRows.map((c) => c.channel_url))
    .where('state', '=', 'joined')
    .execute();

  const byChannel = new Map<string, Set<string>>();
  for (const m of allMembers) {
    if (!byChannel.has(m.channel_url)) byChannel.set(m.channel_url, new Set());
    byChannel.get(m.channel_url)!.add(m.user_id);
  }

  const wantedSet = new Set(wanted);
  for (const [url, members] of byChannel) {
    if (
      members.size === wantedSet.size &&
      [...wantedSet].every((id) => members.has(id))
    ) {
      return getChannel(db, url);
    }
  }
  return null;
}

/**
 * Create a new channel with initial members.
 * Returns the fully assembled ChannelDTO.
 *
 * When `isDistinct` is set, an existing channel of the same custom_type with the
 * EXACT same member set is reused instead of creating a duplicate (the
 * distinct-DM dedup contract). This is enforced server-side so it holds even
 * when a client fires several concurrent creates for the same conversation.
 *
 * Note: Kysely (mysql2) doesn't support BEGIN/COMMIT in the same way as
 * Sequelize; we use sequential inserts. The channel is created first, then
 * members are inserted in a bulk insert so partial failures surface clearly.
 */
export async function createChannel(
  db: Kysely<DB>,
  params: {
    channelUrl?: string;
    name: string;
    customType: 'private' | 'public' | 'open' | 'solo' | 'DM';
    userIds: string[];
    operatorIds: string[];
    coverUrl?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    lang?: string;
    isDistinct?: boolean;
  },
): Promise<ChannelDTO> {
  // Distinct channels (1:1 DMs etc.) must never duplicate: reuse an existing
  // channel with the same member set rather than orphaning history.
  if (params.isDistinct) {
    const existing = await findDistinctChannel(
      db,
      params.customType,
      params.userIds,
    );
    if (existing) return existing;
  }

  const channelUrl = params.channelUrl ?? nanoid(11);

  await db
    .insertInto('messenger_channels')
    .values({
      channel_url: channelUrl,
      name: params.name,
      custom_type: params.customType,
      cover_url: params.coverUrl ?? '',
      description: params.description ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      lang: params.lang ?? 'en',
    })
    .execute();

  if (params.userIds.length > 0) {
    const memberRows = params.userIds.map((userId) => ({
      channel_url: channelUrl,
      user_id: userId,
      role: (params.operatorIds.includes(userId) ? 'operator' : 'member') as
        | 'operator'
        | 'member',
      state: 'joined' as const,
    }));
    await db.insertInto('messenger_members').values(memberRows).execute();
  }

  const channel = await getChannel(db, channelUrl);
  if (!channel) {
    throw new Error(`createChannel: failed to reload channel ${channelUrl} after insert`);
  }
  return channel;
}

/**
 * Replace a channel's metadata JSON.
 * Returns true if a row was updated.
 */
export async function updateChannelMetadata(
  db: Kysely<DB>,
  channelUrl: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const result = await db
    .updateTable('messenger_channels')
    .set({ metadata: JSON.stringify(metadata) })
    .where('channel_url', '=', channelUrl)
    .executeTakeFirst();

  return Number(result.numUpdatedRows) > 0;
}

/**
 * Merge a single key into a channel's metadata JSON (read-modify-write;
 * preserves existing keys). Returns false when the channel does not exist.
 */
export async function updateChannelMetadataKey(
  db: Kysely<DB>,
  channelUrl: string,
  key: string,
  value: unknown,
): Promise<boolean> {
  const row = await db
    .selectFrom('messenger_channels')
    .select('metadata')
    .where('channel_url', '=', channelUrl)
    .executeTakeFirst();

  if (!row) return false;
  const metadata = parseMetadata(row.metadata) ?? {};
  metadata[key] = value;
  return updateChannelMetadata(db, channelUrl, metadata);
}
