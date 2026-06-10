/**
 * messaging/users.ts — Kysely port of src/library/messenger.ts (lines 89–205)
 *
 * Functions accept an explicit `db: Kysely<DB>` so tests can inject a real
 * connection and callers can pass the singleton from `getDb()`.
 *
 * is_online is NOT tracked here (presence is Task 2.x); it always returns false.
 * last_seen_at is stored as a DATETIME column; we return it as ms-epoch or null.
 * metadata is a JSON column — mysql2 may deliver it pre-parsed or as a string.
 * is_bot is a TINYINT(1); mysql2 may deliver 0/1 as a number — coerce to boolean.
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { UserDTO } from './dto.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type RawUser = {
  user_id: string;
  nickname: string;
  profile_url: string | null;
  metadata: unknown;
  is_bot: number | boolean | null;
  last_seen_at: Date | null;
};

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toUserDTO(row: RawUser): UserDTO {
  return {
    user_id: row.user_id,
    nickname: row.nickname || row.user_id,
    profile_url: row.profile_url ?? '',
    metadata: parseMetadata(row.metadata),
    is_online: false, // presence is Task 2.x
    last_seen_at: row.last_seen_at ? new Date(row.last_seen_at).getTime() : null,
    is_bot: Boolean(row.is_bot),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Get a single user by user_id (MD5 of bom_user.user). Returns null if not found. */
export async function getUser(
  db: Kysely<DB>,
  userId: string,
): Promise<UserDTO | null> {
  const row = await db
    .selectFrom('messenger_users')
    .select(['user_id', 'nickname', 'profile_url', 'metadata', 'is_bot', 'last_seen_at'])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return row ? toUserDTO(row as RawUser) : null;
}

/** Get multiple users by IDs. Returns an array (empty if userIds is empty). */
export async function getUsers(
  db: Kysely<DB>,
  userIds: string[],
): Promise<UserDTO[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .selectFrom('messenger_users')
    .select(['user_id', 'nickname', 'profile_url', 'metadata', 'is_bot', 'last_seen_at'])
    .where('user_id', 'in', userIds)
    .execute();

  return rows.map(r => toUserDTO(r as RawUser));
}

/** Insert or update a user row. Returns the resulting UserDTO. */
export async function upsertUser(
  db: Kysely<DB>,
  userId: string,
  data: {
    nickname?: string;
    profile_url?: string;
    bom_user_id?: string | null;
    metadata?: Record<string, unknown> | null;
    is_bot?: boolean;
  },
): Promise<UserDTO> {
  const metadataValue =
    data.metadata !== undefined
      ? (data.metadata === null ? null : JSON.stringify(data.metadata))
      : null;

  await db
    .insertInto('messenger_users')
    .values({
      user_id: userId,
      nickname: data.nickname ?? userId,
      profile_url: data.profile_url ?? '',
      bom_user_id: data.bom_user_id ?? null,
      metadata: metadataValue as string | null,
      is_bot: data.is_bot ? 1 : 0,
    })
    .onDuplicateKeyUpdate({
      nickname: data.nickname ?? userId,
      profile_url: data.profile_url ?? '',
      bom_user_id: data.bom_user_id ?? null,
      metadata: metadataValue as string | null,
      is_bot: data.is_bot ? 1 : 0,
    })
    .execute();

  // Re-fetch to get the canonical row (including DB-generated timestamps).
  const row = await db
    .selectFrom('messenger_users')
    .select(['user_id', 'nickname', 'profile_url', 'metadata', 'is_bot', 'last_seen_at'])
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();

  return toUserDTO(row as RawUser);
}

/** Update a user's display nickname. Returns true if a row was matched. */
export async function updateUserNickname(
  db: Kysely<DB>,
  userId: string,
  nickname: string,
): Promise<boolean> {
  const result = await db
    .updateTable('messenger_users')
    .set({ nickname })
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return Number(result.numUpdatedRows) > 0;
}

/** Update a user's profile URL. Returns true if a row was matched. */
export async function updateUserProfileUrl(
  db: Kysely<DB>,
  userId: string,
  profileUrl: string,
): Promise<boolean> {
  const result = await db
    .updateTable('messenger_users')
    .set({ profile_url: profileUrl })
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return Number(result.numUpdatedRows) > 0;
}

/** Replace a user's metadata. Returns true if a row was matched. */
export async function updateUserMetadata(
  db: Kysely<DB>,
  userId: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const result = await db
    .updateTable('messenger_users')
    .set({ metadata: JSON.stringify(metadata) as string })
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return Number(result.numUpdatedRows) > 0;
}

/** Retrieve only the metadata object for a user. Returns null if not found or unset. */
export async function getUserMetadata(
  db: Kysely<DB>,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const row = await db
    .selectFrom('messenger_users')
    .select('metadata')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!row) return null;
  return parseMetadata(row.metadata);
}

/**
 * Mark a user online or offline.
 *
 * NOTE: This writes `last_seen_at` to the DB when going offline, matching the
 * legacy behaviour. `is_online` column is updated for completeness; the
 * authoritative online flag will move to Redis in Task 2.x (presence).
 */
export async function setUserOnline(
  db: Kysely<DB>,
  userId: string,
  isOnline: boolean,
): Promise<void> {
  await db
    .updateTable('messenger_users')
    .set({
      is_online: isOnline ? 1 : 0,
      last_seen_at: isOnline ? null : new Date(),
    })
    .where('user_id', '=', userId)
    .execute();
}

/**
 * Return all users flagged as bots.
 *
 * The optional `lang` argument mirrors the legacy signature but is not yet
 * used (metadata.lang filtering deferred to Task 4.x).
 */
export async function listBotUsers(
  db: Kysely<DB>,
  _lang?: string,
): Promise<UserDTO[]> {
  const rows = await db
    .selectFrom('messenger_users')
    .select(['user_id', 'nickname', 'profile_url', 'metadata', 'is_bot', 'last_seen_at'])
    .where('is_bot', '=', 1)
    .execute();

  return rows.map(r => toUserDTO(r as RawUser));
}
