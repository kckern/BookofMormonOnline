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

import { generateAvatarUrl, isDeadAvatarHost, resolveDerivedAvatars } from './avatarAssets.js';
import { md5 } from '../auth/identity.js';
import { profileImageUrl } from '../media/profileImage.js';
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
  // bom_user_id IS the bom_user.user username; user_id is its md5 (I1).
  bom_user_id?: string | null;
};

// Under invariant I1 (docs/plans/2026-09-01-identity-avatar-consolidation.md)
// every human row's user_id IS md5(bom_user.user), so the row key is the image
// key. A NULL profile_url means "derive"; the frontend UserAvatar falls back to
// a generated avatar on 404.
function deriveProfileUrl(row: Pick<RawUser, 'user_id'>): string {
  return profileImageUrl(row.user_id);
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
      derived.push({ url: dto.profile_url, seedKey: row.user_id });
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

/** Stored URLs on retired hosts (dicebear v1 → HTTP 410) are treated as
 *  absent so the derive+verify path replaces them. Must run on the RAW rows
 *  before toUserDTO/verifyDerivedAvatars — both key off `row.profile_url`.
 *  (The data cleanup itself is workspace scope.) */
function scrubDeadAvatars<T extends { profile_url: string | null }>(rows: T[]): T[] {
  for (const r of rows) {
    if (isDeadAvatarHost(r.profile_url)) r.profile_url = null;
  }
  return rows;
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

/**
 * The one messenger row for a bom_user username. Under I1 that is exactly the
 * md5-keyed row, so callers provisioning on sign-in look here and nowhere else.
 * Returns the query so callers pick execute/executeTakeFirst.
 */
export function messengerRowForUsername(db: Kysely<DB>, username: string) {
  return db
    .selectFrom('messenger_users')
    .select('user_id')
    .where('user_id', '=', md5(username));
}

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
  scrubDeadAvatars([row as RawUser]);
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
  scrubDeadAvatars(rows as RawUser[]);
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
  // I1: a linked human row is keyed by md5(username), one row per person.
  // The 2026-09-02 merge made this true for existing data; refuse to write a
  // row that would split someone's identity again.
  if (data.bom_user_id && userId !== md5(data.bom_user_id)) {
    throw new Error('messenger user_id must be md5(bom_user_id)');
  }
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

  scrubDeadAvatars([row as RawUser]);
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

/**
 * Build the write that makes an uploaded avatar the user's stored profile_url.
 *
 * toUserDTO resolves `row.profile_url || deriveProfileUrl(row)`, so a stored
 * URL always beats the derived S3 key. Users who inherited a gravatar or
 * provider avatar at migration time therefore kept seeing the old face after
 * every upload — the S3 object changed, the read path never looked at it.
 * uploadProfileImage claims the row so the upload is what gets served.
 *
 * Under I1 a person owns exactly the md5-keyed row, so that is the only row
 * to claim. Returns the query rather than executing it so callers route it
 * through runWrite and stay sandbox-safe.
 * docs/bugs/2026-09-01-profile-photo-reverts.md
 */
export function claimUploadedProfileUrl(
  db: Kysely<DB>,
  args: { userId: string; profileUrl: string },
) {
  return db
    .updateTable('messenger_users')
    .set({ profile_url: args.profileUrl })
    .where('user_id', '=', args.userId);
}

/** Merge incoming keys into the existing metadata (shallow merge). Returns true if a row was matched. */
export async function updateUserMetadata(
  db: Kysely<DB>,
  userId: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const existing = await db
    .selectFrom('messenger_users')
    .select('metadata')
    .where('user_id', '=', userId)
    .executeTakeFirst();
  let base: Record<string, unknown> = {};
  if (existing?.metadata) {
    try {
      base =
        typeof existing.metadata === 'string'
          ? JSON.parse(existing.metadata)
          : (existing.metadata as Record<string, unknown>);
    } catch {
      base = {};
    }
  }
  const merged = { ...base, ...metadata };

  const result = await db
    .updateTable('messenger_users')
    .set({ metadata: JSON.stringify(merged) as string })
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

  scrubDeadAvatars(rows as RawUser[]);
  return rows.map(r => toUserDTO(r as RawUser));
}

/**
 * English-edition site languages (plain, rlds, …) read English study bots;
 * everything else matches its own code exactly.
 */
const ENGLISH_EDITIONS = new Set(['rlds', 'covoc', 'str', 'plain', 'easy', 'concise']);

export function normalizeBotLang(lang?: string | null): string {
  const l = (lang || 'en').toLowerCase();
  return ENGLISH_EDITIONS.has(l) ? 'en' : l;
}

/**
 * Return the pluggable study bots for a site language.
 *
 * A bot is offered in the picker iff it is registered in bom_bot with
 * bot_class='study' and enabled=1, and its lang matches the (normalized)
 * site language — or is NULL, meaning the bot serves every language.
 * Community bots (scheduled persona conversations) and unregistered
 * is_bot rows never appear.
 */
export async function listStudyBots(
  db: Kysely<DB>,
  lang?: string | null,
): Promise<UserDTO[]> {
  const l = normalizeBotLang(lang);
  const rows = await db
    .selectFrom('messenger_users as u')
    .innerJoin('bom_bot as b', 'b.bot_id', 'u.user_id')
    .select(['u.user_id', 'u.nickname', 'u.profile_url', 'u.metadata', 'u.is_bot', 'u.last_seen_at'])
    .where('u.is_bot', '=', 1)
    .where('b.bot_class', '=', 'study')
    .where('b.enabled', '=', 1)
    .where((eb) => eb.or([eb('b.lang', '=', l), eb('b.lang', 'is', null)]))
    .orderBy('u.nickname')
    .execute();

  scrubDeadAvatars(rows as RawUser[]);
  return rows.map(r => toUserDTO(r as RawUser));
}
