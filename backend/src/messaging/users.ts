/**
 * messaging/users.ts — Kysely port of src/library/messenger.ts (lines 89–205)
 *
 * Functions accept an explicit `db: Kysely<DB>` so tests can inject a real
 * connection and callers can pass the singleton from `getDb()`.
 *
 * is_online is resolved via the presence service (Redis-backed).  When Redis
 * is unavailable, presence functions degrade to false / [] so behaviour is
 * identical to the previous hardcoded-false implementation — existing tests
 * remain green.
 * last_seen_at is stored as a DATETIME column; we return it as ms-epoch or null.
 * metadata is a JSON column — mysql2 may deliver it pre-parsed or as a string.
 * is_bot is a TINYINT(1); mysql2 may deliver 0/1 as a number — coerce to boolean.
 */

import { createHash } from 'node:crypto';
import { generateAvatarUrl, resolveDerivedAvatars } from './avatarAssets.js';
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { UserDTO } from './dto.js';
import { isOnline, onlineUserIds } from './presence.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type RawUser = {
  user_id: string;
  nickname: string | null;
  profile_url: string | null;
  metadata: unknown;
  is_bot: number | boolean | null;
  last_seen_at: Date | null;
  // joined from bom_user when the participant is a human (bom_user_id set).
  // Thin human rows store nickname/profile_url NULL — display is coalesced from here.
  bom_name?: string | null;
  // bom_user_id IS the bom_user.user username; md5(username) keys the profile image.
  bom_user_id?: string | null;
};

// Profile images live at {base}/profiles/{md5(bom_user.user)}.jpg (the
// Sendbird→S3 migration target). Modern human rows have user_id === that md5,
// but SendBird-migrated legacy rows carry handle-style ids, so for linked rows
// derive from md5(bom_user_id) — bom_user_id IS the username. Humans'
// messenger_users.profile_url is NULL, so derive it; the frontend UserAvatar
// falls back to a generated avatar on 404.
export const PROFILE_IMAGE_BASE = (
  process.env['PROFILE_IMAGE_BASE_URL'] || 'https://assets.bookofmormon.online'
).replace(/\/+$/, '');

function deriveProfileKey(row: Pick<RawUser, 'user_id' | 'bom_user_id'>): string {
  return row.bom_user_id
    ? createHash('md5').update(row.bom_user_id).digest('hex')
    : row.user_id;
}

function deriveProfileUrl(row: Pick<RawUser, 'user_id' | 'bom_user_id'>): string {
  return `${PROFILE_IMAGE_BASE}/profiles/${deriveProfileKey(row)}.jpg`;
}

/**
 * Derived URLs are a convention — the asset may not exist (many migrated
 * users never had an image). Swap unverified derived URLs for the dicebear
 * fallback so the API never emits a 404 image URL. Stored profile_url values
 * are explicit (upload/seed) and pass through untouched.
 */
async function verifyDerivedAvatars(rows: RawUser[], dtos: UserDTO[]): Promise<void> {
  const derived: Array<{ url: string; seedKey: string }> = [];
  rows.forEach((row, i) => {
    const dto = dtos[i];
    if (!row.profile_url && dto?.profile_url) {
      derived.push({ url: dto.profile_url, seedKey: deriveProfileKey(row) });
    }
  });
  if (derived.length === 0) return;
  const resolved = await resolveDerivedAvatars(derived);
  rows.forEach((row, i) => {
    const dto = dtos[i];
    if (!row.profile_url && dto?.profile_url) {
      dto.profile_url = resolved.get(dto.profile_url) ?? dto.profile_url;
    }
  });
}

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

export function toUserDTO(row: RawUser, online = false): UserDTO {
  // Coalesce display from bom_user for thin human rows; bots/orphans carry their own.
  const nickname = row.nickname || row.bom_name || row.user_id;
  const profile_url = row.profile_url || deriveProfileUrl(row);
  return {
    user_id: row.user_id,
    nickname,
    profile_url,
    metadata: parseMetadata(row.metadata),
    is_online: online,
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
    .leftJoin('bom_user', 'bom_user.user', 'messenger_users.bom_user_id')
    .select([
      'messenger_users.user_id as user_id',
      'messenger_users.nickname as nickname',
      'messenger_users.profile_url as profile_url',
      'messenger_users.metadata as metadata',
      'messenger_users.is_bot as is_bot',
      'messenger_users.last_seen_at as last_seen_at',
      'messenger_users.bom_user_id as bom_user_id',
      'bom_user.name as bom_name',
    ])
    .where('messenger_users.user_id', '=', userId)
    .executeTakeFirst();

  if (!row) return null;
  const online = await isOnline(userId);
  const dto = toUserDTO(row as RawUser, online);
  await verifyDerivedAvatars([row as RawUser], [dto]);
  return dto;
}

/** Get multiple users by IDs. Returns an array (empty if userIds is empty). */
export async function getUsers(
  db: Kysely<DB>,
  userIds: string[],
): Promise<UserDTO[]> {
  if (userIds.length === 0) return [];

  // Fetch DB rows and the full online set in parallel to avoid N+1 presence calls.
  const [rows, onlineIds] = await Promise.all([
    db
      .selectFrom('messenger_users')
      .leftJoin('bom_user', 'bom_user.user', 'messenger_users.bom_user_id')
      .select([
        'messenger_users.user_id as user_id',
        'messenger_users.nickname as nickname',
        'messenger_users.profile_url as profile_url',
        'messenger_users.metadata as metadata',
        'messenger_users.is_bot as is_bot',
        'messenger_users.last_seen_at as last_seen_at',
        'messenger_users.bom_user_id as bom_user_id',
        'bom_user.name as bom_name',
      ])
      .where('messenger_users.user_id', 'in', userIds)
      .execute(),
    onlineUserIds(),
  ]);

  const onlineSet = new Set(onlineIds);
  const dtos = rows.map(r => toUserDTO(r as RawUser, onlineSet.has(r.user_id)));
  await verifyDerivedAvatars(rows as RawUser[], dtos);
  return dtos;
}

/**
 * Avatar for a sign-in response — the ONE answer for "what picture does this
 * user have". Delegates to getUser (stored profile_url → asset-verified
 * derived URL → dicebear); a user with no messenger row yet gets the same
 * deterministic dicebear the frontend would draw.
 * Replaces ad-hoc genUserAvatar() calls in signin/tokensignin
 * (docs/bugs/2026-06-11-profile-image-no-ssot.md).
 */
export async function resolveSigninAvatar(
  db: Kysely<DB>,
  userId: string,
): Promise<string> {
  const user = await getUser(db, userId);
  return user?.profile_url || generateAvatarUrl(userId);
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
