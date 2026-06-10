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
import { getChannelMembers } from './members.js';
import { getMessages } from './messages.js';

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
): Promise<ChannelDTO> {
  const metadata = parseMetadata(row.metadata);

  const [members, messages] = await Promise.all([
    getChannelMembers(db, row.channel_url),
    getMessages(db, row.channel_url, { limit: 1 }),
  ]);

  return {
    channel_url: row.channel_url,
    name: row.name,
    cover_url: row.cover_url ?? '',
    custom_type: row.custom_type,
    data: JSON.stringify(metadata ?? {}), // back-compat: mirrors legacy toChannelDTO
    metadata,
    members,
    member_count: members.length,
    unread_message_count: 0, // stubbed — Task 1.5 (readstate)
    last_message: messages[0] ?? null,
    created_at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    lang: row.lang ?? 'en',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single channel by channel_url and assemble the full ChannelDTO.
 * Returns null if the channel does not exist.
 */
export async function getChannel(
  db: Kysely<DB>,
  channelUrl: string,
): Promise<ChannelDTO | null> {
  const row = await db
    .selectFrom('messenger_channels')
    .selectAll()
    .where('channel_url', '=', channelUrl)
    .executeTakeFirst();

  if (!row) return null;
  return assembleChannelDTO(db, row as RawChannel);
}

/**
 * Return all channels a user has joined (state = 'joined').
 * Optionally filtered by custom_type. Limit defaults to 100.
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

  return Promise.all(rows.map((r) => assembleChannelDTO(db, r as RawChannel)));
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
  return Promise.all(rows.map((r) => assembleChannelDTO(db, r as RawChannel)));
}

/**
 * Create a new channel with initial members.
 * Returns the fully assembled ChannelDTO.
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
  },
): Promise<ChannelDTO> {
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
