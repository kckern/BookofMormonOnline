# User Identity + Avatar Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** One person = one messenger row; one function answers "what picture does this user have"; one place derives the messenger id; the client never invents or persists an avatar.

**Architecture:** Three layers, each with a single owner. *Identity* (`backend/src/auth/identity.ts`): `md5(username)` is the messenger id, and after the Phase 1 merge every human `messenger_users` row satisfies `user_id === md5(bom_user_id)`, so nothing downstream has to tolerate multiple rows per person. *Avatar policy* (`backend/src/messaging/avatarAssets.ts`): `messenger_users.profile_url` holds only a picture the user chose or brought with them (an upload, version-busted; a social-provider picture; a Gravatar resolved once at sign-in) or `NULL` — never a generated face; a single `resolveAvatar()` turns `{stored, userId}` into a renderable URL — stored → S3-by-convention → generated — with the existing cached, non-blocking probe. Gravatar is a **write-time** concern (sign-in/sign-up/email change), never probed on a read path. *Storage* (`backend/src/media/`): key construction lives in one pure module used by upload, policy, and the migration. The frontend renders whatever the backend resolved and falls back through `UserAvatar` only; it never generates a face from the session token and never writes `profile_url`.

**Tech Stack:** TypeScript backend (Kysely 0.27, mysql2, vitest, zod env), CRA React 17 frontend (`npx react-scripts test`), `.mjs` data migrations with dry-run/`--apply` (pattern: `backend/migrations/2026-09-01-claim-shadowed-avatars.mjs`). Prod deploys on push to `prod` (GitHub Actions → `:prod` tag → 5-min health-gated blue-green timer).

---

## Context

Cory's "profile photo reverts" bug (`docs/bugs/2026-09-01-profile-photo-reverts.md`) was fixed on 2026-09-01, but the investigation exposed that the fix papered over structural problems rather than removing them:

**Identity is not single.** 81 people own 2–3 `messenger_users` rows: the md5 row the current backend writes to, plus legacy Sendbird handle rows (`caspianrex`, `caspianrex_d540bc18`) that the migration imported. Those legacy rows are not decorative — they own 2,072 messages (37% of all) and 430 reactions (88% of all). Every read path keys on `user_id` alone (`users.ts:147,180,264,279,327,359,384`; `socialsignin.ts:111-124`; `userauth.ts:88-101`), so only `homesampler.ts:753` (bookmark) and the new `claimUploadedProfileUrl` cope with the multi-row reality, each in its own way. The backend also hashes usernames in two ways (`auth/identity.ts:7` vs an inline `createHash` at `users.ts:51-55`), re-exports `md5` through a second barrel (`loaders/userauth.ts:13`), and the frontend has three hash helpers — `Utils.md5hash`, `MessengerController.md5` (hex-passthrough), and `Utils.md5` which is misnamed (it ignores its argument and returns random bytes; `Feed.js:48,586` calls it believing it hashes `item.id`).

**Avatar policy is decided sixteen different ways.** The dicebear generator exists three times (`avatarAssets.ts:182`, `identity.ts:43`, `UserAvatar.js:15`) with "keep in sync" comments that name only two of them. `{base}/profiles/{md5}.jpg` is assembled in six places. Precedence between stored / derived / generated is re-decided in `toUserDTO` (P1), `resolveDerivedAvatars` (P2), `resolveSigninAvatar` (P3), `assembleHomeUser` (P4, no S3 derive, own dead-host regex), `maskUserPrivacy` (P5), `botlist` (P6, unreachable imgur literal), signup `resolveAvatarUrl` (P7), social sign-in ×3 (P8), `UserAvatar` (P10), `breakCache` (P11, reseeds off whatever hex it finds in the failed URL), `appController.setUserSocial` (P12, seeds from the **localStorage token**), and `MessengerController` (P13). The backend reads the asset base from `PROFILE_IMAGE_BASE_URL` in one file and `S3_PUBLIC_URL` in another; only the second is declared in `config/env.ts` or any `.env.example`, so an override moves the upload URL and not the read URL.

**Generated avatars get persisted, which is what caused the bug.** `userauth.ts:136-148` stores a Gravatar-or-dicebear URL at signup; `MessengerController.js:424-427` writes a token-seeded dicebear URL into the DB whenever `profileUrl` is empty. That is where the 21 gravatar + 57 `api.dicebear.com` rows came from — and a stored URL beats an upload in `toUserDTO`, so those users could never change their picture. `userauth.ts:86` documents that generated avatars are never persisted; two live code paths contradict it.

**Decisions (confirmed with KC 2026-09-01):** include the row merge as Phase 1; include the frontend; Gravatar is **resolved once at sign-in and persisted** like a social-provider picture (a read-time probe was stress-tested and rejected: it oscillates on the 60 s negative TTL, multiplies outbound traffic, fails open during a Gravatar outage, and gets frozen into other users' notification payloads); anonymous readers of public channels get the generated face instead of any third-party avatar URL (`md5(email)` must not be served unauthenticated). `messenger_users` stays a thin participant registry per `docs/specs/2026-06-10-messaging-user-data-consolidation.md`, amended so `profile_url` may hold a user-chosen picture (that spec said humans are always NULL; the 2026-09-01 fix showed a stable derived key needs a stored version to bust caches).

**Prior art to reuse, not rewrite:** `avatarAssets.ts` probe cache (`urlExists`, positive 24h / negative 60s, non-blocking bulk path — the P-3 hot-path fix from `docs/audits/2026-08-05-profile-prod-audit.md`), `shouldRefreshStoredAvatar`, `isDeadAvatarHost`, `runWrite` sandbox gate, the driverless-Kysely test pattern in `backend/test/messaging/profileUrlClaim.test.ts`, and the dry-run/`--apply`/probe migration shape in `backend/migrations/2026-09-01-claim-shadowed-avatars.mjs`.

**Out of scope (deliberately):** group cover images (`StudyGroupSelect.groupCoverUrl`), bot avatar sourcing (`scripts/configure-study-group.ts`), the `_deprecated/` backend, `frontend/next/` (has no avatar code), the P-1 profile-takeover finding (already guarded by `requireSelf`).

---

## Invariants this plan establishes (write them into the code as tests)

| # | Invariant | Enforced by |
|---|---|---|
| I1 | Every human `messenger_users` row has `user_id = MD5(bom_user_id)`; one row per username | Phase 1 migration + `upsertUser` guard + integration test |
| I2 | `profile_url` is NULL or a real picture of the person (assets host with `?v=`, a social-provider host, or `gravatar.com/avatar/<hash>?…&d=404`). Never dicebear | `isPersistableAvatarUrl()` guard on every write path + Phase 4 migration |
| I7 | Unauthenticated responses never carry a third-party avatar URL | `maskAvatarForAnonymous()` in every anonymous-readable resolver + test |
| I3 | Exactly one function decides precedence: `resolveAvatar()` | All P1–P8 call sites delegate; grep test that `genUserAvatar`/`generateAvatarUrl` is called from ≤ 2 files |
| I4 | Exactly one function builds `profiles/<id>.jpg` | `media/profileImage.ts`; grep test |
| I5 | The frontend generator and the backend generator produce identical URLs for the same seed | Shared golden fixture asserted by both test suites |
| I6 | The frontend never writes `profile_url` and never seeds a face from the token | `tokenImage` deleted; `messengerUpdateUser` no longer accepts `profileUrl` from the client |

---

## Phase 0 — Preflight (no code)

### Task 0.1: Snapshot before any data change

**Files:** none (ops)

- On the prod host, `mysqldump` the five tables the merge touches into the private workspace's backup location: `messenger_users messenger_messages messenger_reactions messenger_members messenger_files`. (Private-workspace step; record the file name in the migration's `--apply` output.)
- Copy this plan to `docs/plans/2026-09-01-identity-avatar-consolidation.md`; commit.

```bash
git add docs/plans/2026-09-01-identity-avatar-consolidation.md
git commit -m "docs(plan): identity + avatar consolidation"
```

---

## Phase 1 — One row per person

### Task 1.1: Merge migration — dry run

**Files:**
- Create: `backend/migrations/2026-09-02-merge-legacy-messenger-users.mjs`
- Test: `backend/test/migrations/mergeLegacyUsers.test.ts` (pure planning logic only)

Structure the script as a pure `planMerge(rows)` (exported for the test) plus an `apply(db, plan)`.

**Step 1: Write the failing test** for the planner:

```ts
import { describe, expect, it } from 'vitest';
import { planMerge } from '../../migrations/2026-09-02-merge-legacy-messenger-users.mjs';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

describe('planMerge', () => {
  it('maps every legacy human row onto its md5 sibling and never onto itself', () => {
    const rows = [
      { user_id: md5('caspianrex'), bom_user_id: 'caspianrex', is_bot: 0 },
      { user_id: 'caspianrex', bom_user_id: 'caspianrex', is_bot: 0 },
      { user_id: 'caspianrex_d540bc18', bom_user_id: 'caspianrex', is_bot: 0 },
    ];
    const plan = planMerge(rows);
    expect(plan.moves).toEqual([
      { from: 'caspianrex', to: md5('caspianrex') },
      { from: 'caspianrex_d540bc18', to: md5('caspianrex') },
    ]);
  });
  it('refuses a legacy row whose md5 sibling is missing (never invents a target)', () => {
    const rows = [{ user_id: 'orphan', bom_user_id: 'ghost', is_bot: 0 }];
    expect(() => planMerge(rows)).toThrow(/no md5 sibling for ghost/);
  });
  it('leaves bots and unlinked rows alone, and lists test_ fixtures for deletion', () => {
    const rows = [
      { user_id: 'welcome_bot', bom_user_id: null, is_bot: 1 },
      { user_id: 'test_u_abc', bom_user_id: null, is_bot: 0 },
    ];
    const plan = planMerge(rows);
    expect(plan.moves).toEqual([]);
    expect(plan.deleteOrphans).toEqual(['test_u_abc']);
  });
});
```

**Step 2:** Run `cd backend && npx vitest run test/migrations/mergeLegacyUsers.test.ts` — FAIL (module not found).

**Step 3: Implement.** Header comment must cite `docs/plans/2026-09-01-identity-avatar-consolidation.md` and the counts (121 legacy human rows / 2,072 messages / 430 reactions / 1 reaction collision). Core:

```js
export function planMerge(rows) {
  const isMd5 = (id) => /^[a-f0-9]{32}$/i.test(id);
  const byId = new Set(rows.map((r) => r.user_id));
  const moves = [];
  const deleteOrphans = [];
  for (const r of rows) {
    if (isMd5(r.user_id) || r.is_bot) continue;
    if (!r.bom_user_id) {
      if (/^test_/.test(r.user_id)) deleteOrphans.push(r.user_id);
      continue; // unlinked, non-test, non-bot: leave for a human to look at
    }
    const to = md5(r.bom_user_id);
    if (!byId.has(to)) throw new Error(`no md5 sibling for ${r.bom_user_id}`);
    moves.push({ from: r.user_id, to });
  }
  return { moves, deleteOrphans };
}
```

**Every child FK on prod is `ON DELETE CASCADE`** (verified via `information_schema.REFERENTIAL_CONSTRAINTS` 2026-09-01: `fk_messenger_{messages,reactions,members,files}_user`, `fk_bom_bot_user`; and `messenger_messages` cascades on into `messenger_highlights`/`messenger_reactions` and `SET NULL`s `parent_message_id`). So the final DELETE will not *refuse* a missed repoint — it will silently destroy it. The script must therefore prove the legacy id is unreferenced before deleting, and never trust the FK.

`apply` runs **one transaction per legacy row** (a single 121-user transaction would hold FK shared locks on `messenger_users` rows that `presence.setOffline` and `updateUserMetadata` write on every socket disconnect / notification read — deadlock risk), retrying once on `ER_LOCK_DEADLOCK`. Before the loop, dump all 189 legacy rows (`SELECT *`) to `backend/migrations/out/2026-09-02-legacy-messenger-users.json` so nothing is unrecoverable. Per row, in order:

```sql
-- messages: pin updated_at (ON UPDATE CURRENT_TIMESTAMP would bump all 2,072 and it is on the wire)
UPDATE messenger_messages SET user_id=?, updated_at=updated_at WHERE user_id=?;
-- reactions: PK is (message_id,user_id,reaction_key). Name every column — an
-- unnamed INSERT…SELECT resets created_at to NOW() and would resurface every
-- repointed reaction in the 30-day notification lookback. Absorbs the 1 known collision.
INSERT IGNORE INTO messenger_reactions (message_id, user_id, reaction_key, created_at)
  SELECT message_id, ?, reaction_key, created_at FROM messenger_reactions WHERE user_id=?;
DELETE FROM messenger_reactions WHERE user_id=?;
-- 70 channels carry the legacy id in a JSON key nothing reads (Sendbird import artifact)
UPDATE messenger_channels SET metadata = JSON_SET(metadata,'$.created_by',?), updated_at=updated_at
 WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.created_by')) = ?;
-- picture carry-over: verified 0 rows affected today (2 legacy rows have a picture, both
-- siblings already do) — keep the guard so a future re-run cannot downgrade anyone
UPDATE messenger_users md JOIN messenger_users lg ON lg.user_id=?
   SET md.profile_url = COALESCE(NULLIF(md.profile_url,''), NULLIF(lg.profile_url,'')), md.updated_at=md.updated_at
 WHERE md.user_id=?;
-- PROVE unreferenced, then delete. Abort the row's transaction if any count is non-zero.
SELECT (SELECT COUNT(*) FROM messenger_messages  WHERE user_id=?)
     + (SELECT COUNT(*) FROM messenger_reactions WHERE user_id=?)
     + (SELECT COUNT(*) FROM messenger_members   WHERE user_id=?)
     + (SELECT COUNT(*) FROM messenger_files     WHERE user_id=?)
     + (SELECT COUNT(*) FROM bom_bot             WHERE bot_id=?) AS refs;   -- must be 0
DELETE FROM messenger_users WHERE user_id=?;
```

Nickname policy: keep the md5 row's (`bom_user.name` via the coalesce in `toUserDTO`); the legacy row's is a stale Sendbird handle. Notification-id churn (`notifications.ts:201` embeds the actor id in `reaction:<msg>:<user>:<key>`) is moot on this data — the newest legacy-owned reaction is from 2023-09-22 and `bom_notification` has zero rows whose `dedupe_key`/`payload` mention a legacy id — but the dry run must print those two numbers so a re-run on fresher data can't miss them.

The 3 `test_*` orphans (`bom_user_id IS NULL`, which is the *bot* auth path in `realtime/server.ts:76-86` — deleting them is a small security win) own one top-level, un-replied, un-deleted message (`17842203191`); delete it explicitly before the row rather than letting the cascade take it.

Verified 2026-09-01 that these are the **only** places a legacy id appears: not in `messenger_members`/`messenger_files`, not in any non-FK `*_user_id` column (`bom_notification`, `messenger_channel_policy`, `messenger_content_report`, `bom_email_notification_*`), not in `messenger_messages.metadata`, not inside the stringified `metadata.data.requests` arrays, and not embedded in any `channel_url`. The planner test should include a `created_by` case.
Use one `db.query()` per statement (`multipleStatements` stays off, matching the 2026-09-01 migration).

Dry run prints the plan and these **before/after checks**; `--apply` fails (exit 1) if any check is off:

```sql
-- I1
SELECT COUNT(*) FROM messenger_users WHERE (is_bot=0 OR is_bot IS NULL) AND bom_user_id<>'' AND user_id<>MD5(bom_user_id);   -- must be 0 after
-- content conservation
SELECT COUNT(*) FROM messenger_messages;                  -- unchanged minus orphan messages
SELECT COUNT(*) FROM messenger_reactions;                 -- before − 1 (the absorbed collision)
SELECT COUNT(*) FROM messenger_messages m LEFT JOIN messenger_users u ON u.user_id=m.user_id WHERE u.user_id IS NULL; -- 0 (FK would refuse anyway)
```

**Step 4:** Tests pass. Dry-run against prod from the laptop (root `.env` has the writable `bom_app` user; the script only reads without `--apply`): `node backend/migrations/2026-09-02-merge-legacy-messenger-users.mjs` → expect `moves: 121`, `deleteOrphans: 3`, `reactionCollisions: 1`.

**Step 5: Commit** `feat(migrations): plan legacy messenger-user merge (dry run)`.

### Task 1.2: Apply the merge

After Task 0.1's snapshot exists: `node backend/migrations/2026-09-02-merge-legacy-messenger-users.mjs --apply`. Paste the verification output into `docs/plans/...` under a "Phase 1 applied" note. Spot-check Cory: `SELECT COUNT(*) FROM messenger_messages WHERE user_id='9b4291984af9d3c3baaae5af3ece9962'` → 567 (52+494+21).

Commit the doc note.

### Phase 1 applied — 2026-09-01

Backup: `BoMOnlineWorkspace/infra/backups/2026-09-02-messenger-pre-merge.sql.gz` (row counts verified equal to live: 3009 / 5536 / 486 / 755 / 0). `--apply` output, all post-checks green:

```
plan   moves 121 → 81 targets · orphans 3 (test_*) · leftAlone 0
before i1Violations 121 · legacyRows 124 · messages 5536 · reactions 486 · members 755
       legacyMessages 1910 · legacyReactions 264 · reactionCollisions 1 · createdByChannels 70
       recentLegacyReactions 0 · notificationRowsWithLegacy 0
after  i1Violations 0 · legacyRows 0 · messages 5535 · reactions 485 · members 755
       createdByChannels 0 · orphanedMessages 0 · failures []
```

Spot-check: the reporter's account is now one row — 567 messages (52 + 494 + 21) and 91 reactions (9 + 82) under the md5 id. 65 non-md5 rows remain; all are bots. Legacy rows were dumped to `backend/migrations/out/` (gitignored) before deletion.

### Task 1.3: Guard the invariant on the write side

**Files:**
- Modify: `backend/src/messaging/users.ts` (`upsertUser`, ~line 208)
- Modify: `backend/src/graphql/resolvers/userauth.ts:88-101` (`tokensignin` provision)
- Test: `backend/test/messaging/userIdentity.test.ts` (new, driverless Kysely)

**Step 1: Failing tests.** `upsertUser` throws if `bom_user_id` is set and `userId !== md5(bom_user_id)`; the tokensignin provision query is `WHERE user_id = ? OR bom_user_id = ?` (never creates a second row for a username). Use the `DummyDriver` pattern from `profileUrlClaim.test.ts` and assert the compiled SQL.

**Step 2–4:** Implement (`if (data.bom_user_id && userId !== md5(data.bom_user_id)) throw new Error('messenger user_id must be md5(bom_user_id)')`), run, pass.

**Step 5: Commit** `fix(messaging): enforce user_id = md5(username) on write`.

### Task 1.4: Collapse the multi-row tolerant code

Now that I1 holds:

- `backend/src/messaging/users.ts:51-59` — delete `deriveProfileKey`; `deriveProfileUrl(row)` uses `row.user_id` directly (import the helper from Task 2.1).
- `backend/src/messaging/users.ts:302-316` — `claimUploadedProfileUrl` matches `user_id` only; drop the OR clause and the empty-string guard; update `backend/test/messaging/profileUrlClaim.test.ts` (the "legacy rows" case becomes "exactly the md5 row").
- `backend/src/graphql/resolvers/homesampler.ts:753-755` — `myBookmark` reads one row by `user_id = md5(user.user)` instead of scanning all rows by `bom_user_id`.
- `backend/src/data/loaders/socialsignin.ts:111-124` — unchanged in shape (already keys on md5), but remove the comment implying handle rows exist.

Run `npx tsc --noEmit && npx vitest run test/messaging test/graphql` — green. **Commit** `refactor(messaging): one row per user — drop multi-row tolerance`.

---

## Phase 2 — One avatar policy (backend)

### Task 2.1: One place builds the S3 key

**Files:**
- Create: `backend/src/media/profileImage.ts`
- Modify: `backend/src/config/env.ts:22` (rename nothing; *delete* the undeclared `PROFILE_IMAGE_BASE_URL` usage in favour of `S3_PUBLIC_URL`)
- Modify: `backend/src/media/s3.ts:40-45,99,150`, `backend/src/messaging/users.ts:46-59`, `backend/src/data/loaders/socialsignin.ts:116`, `backend/src/graphql/resolvers/userprofile.ts:163`
- Test: `backend/test/media/profileImage.test.ts`

```ts
// media/profileImage.ts — pure; the ONLY place that knows the key layout.
import { env } from '../config/env.js';
export const PROFILE_IMAGE_BASE = env.S3_PUBLIC_URL.replace(/\/+$/, '');
export const profileImageKey = (userId: string) => `profiles/${userId}.jpg`;
export const profileImageUrl = (userId: string, version?: number) =>
  `${PROFILE_IMAGE_BASE}/${profileImageKey(userId)}${version ? `?v=${version}` : ''}`;
```

Test: key/URL shape, version suffix, trailing-slash tolerance. Replace the six constructions; delete `s3.ts getProfileImageUrl` and `users.ts PROFILE_IMAGE_BASE` (re-export from the new module for one release if anything external imports it — nothing does; grep). Delete `PROFILE_IMAGE_BASE_URL` from `backend/src/messaging/users.ts:47`; document `S3_PUBLIC_URL` as the one knob in `backend/.env.example` and note the frontend's `REACT_APP_PROFILE_IMAGE_BASE_URL` must match it.

**Commit** `refactor(media): single profile-image key builder; one env var`.

### Task 2.2: One generator on the backend

**Files:**
- Modify: `backend/src/auth/identity.ts:37-68` — delete `genUserAvatar` and the palette constants
- Modify: `backend/src/graphql/resolvers/community.ts:18,76-81`, `backend/src/data/loaders/socialsignin.ts:14,161,170,184`, `backend/src/data/loaders/userauth.ts:5,13,137` — import `generateAvatarUrl` from `messaging/avatarAssets.js` (temporarily; Task 2.4 removes most of these calls entirely)
- Test: `backend/test/messaging/avatarAssets.test.ts` — keep the byte-parity case (`identity.ts` said "baselines pin the full URL"; move that assertion here with the literal expected URL for one seed)

**Commit** `refactor(avatars): one dicebear generator on the backend`.

### Task 2.3: `resolveAvatar()` — the one precedence function

**Files:**
- Modify: `backend/src/messaging/avatarAssets.ts` (add `resolveAvatar`, `resolveAvatars`, `isPersistableAvatarUrl`, `maskAvatarForAnonymous`; rewrite the two stale P-3 tests)
- Test: `backend/test/messaging/avatarAssets.test.ts`

**Step 1: Failing tests** (inject `fetcher` like the existing tests do):

```ts
describe('resolveAvatar', () => {
  const ID = 'feedfacefeedfacefeedfacefeedface';
  const STORED = `https://assets.bookofmormon.online/profiles/${ID}.jpg?v=1`;
  it('stored persistable URL wins without probing', async () => {
    expect(await resolveAvatar({ userId: ID, storedUrl: STORED }, neverFetch)).toBe(STORED);
  });
  it('dead-host stored URL is treated as absent', ...);                     // avatars.dicebear.com
  it('stored generated URL is treated as absent (legacy data)', ...);       // api.dicebear.com
  it('NULL → derived S3 when the object exists (warm cache)', ...);
  it('NULL → generated when the object is missing', ...);
  it('bulk path: cold cache returns generated AND fires exactly one probe; warm call returns S3', ...); // P-3 contract, replaces the 2 failing tests
});
describe('isPersistableAvatarUrl', () => {
  it.each([
    ['https://assets.bookofmormon.online/profiles/x.jpg?v=1', true],
    ['https://lh3.googleusercontent.com/a/x', true],
    ['https://www.gravatar.com/avatar/abc?s=256&d=404', true],   // resolved at sign-in, 404-safe
    ['https://www.gravatar.com/avatar/abc', false],              // no d=404 → would serve the mystery-man default
    ['https://api.dicebear.com/7.x/thumbs/svg?seed=x', false],
    ['https://avatars.dicebear.com/api/x', false],
    ['', false], [null, false],
  ])('%s → %s', (url, ok) => expect(isPersistableAvatarUrl(url)).toBe(ok));
});
describe('maskAvatarForAnonymous', () => {
  it('keeps assets-host uploads, replaces everything else with the generated face', () => {
    expect(maskAvatarForAnonymous(ID, STORED)).toBe(STORED);
    expect(maskAvatarForAnonymous(ID, 'https://www.gravatar.com/avatar/abc?d=404')).toBe(generateAvatarUrl(ID));
    expect(maskAvatarForAnonymous(ID, 'https://lh3.googleusercontent.com/a/x')).toBe(generateAvatarUrl(ID));
  });
});
```

**Step 3: Implement** on top of the existing `urlExists` cache:

```ts
const GENERATED_HOSTS = new Set(['api.dicebear.com', 'avatars.dicebear.com']);
/** A URL we are willing to store: a real picture of the person, and one that 404s (never a placeholder) when gone. */
export function isPersistableAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (GENERATED_HOSTS.has(u.host)) return false;
    if (/(^|\.)gravatar\.com$/.test(u.host)) return u.searchParams.get('d') === '404';
    return true;
  } catch { return false; }
}

/** stored (persistable) → S3 by convention (cached probe) → generated. No email, no third-party probe. */
export async function resolveAvatar(input: { userId: string; storedUrl: string | null }, fetcher = defaultFetcher): Promise<string> { ... }
export async function resolveAvatars(inputs: ...[], fetcher = defaultFetcher): Promise<Map<string, string>> { /* non-blocking bulk path, same cache */ }

/** I7: unauthenticated responses never carry a third-party URL (a Gravatar URL is md5(email)). */
export function maskAvatarForAnonymous(userId: string, url: string): string {
  try { return new URL(url).host === new URL(PROFILE_IMAGE_BASE).host ? url : generateAvatarUrl(userId); }
  catch { return generateAvatarUrl(userId); }
}
```

Probe volume on the bulk path is **unchanged** from today: one cached S3 probe per NULL row, nothing else. **Commit** `feat(avatars): resolveAvatar — one precedence rule (stored → S3 → generated)`.

### Task 2.4: Route every backend decision through it

**Files & the line each replaces:**
- `backend/src/messaging/users.ts:113` `toUserDTO` + `:67-83` `verifyDerivedAvatars` → `resolveAvatars`; `scrubDeadAvatars` folds into `isPersistableAvatarUrl` (a stored generated URL now reads as absent, which is what Phase 4 makes literal). No `email` on the read path.
- `backend/src/messaging/users.ts:200-206` `resolveSigninAvatar` → `getUser(...)?.profile_url` (already resolved) with `resolveAvatar({ userId, storedUrl: null })` for a user with no row.
- `backend/src/graphql/resolvers/community.ts:76-98` — delete `defaultAvatar` and the dead-host regex; `picture = userDto?.profile_url ?? (await resolveAvatar({ userId, storedUrl: null }))`.
- `backend/src/graphql/resolvers/community.ts:184-190` `maskUserPrivacy` → `generateAvatarUrl(seed)` stays (privacy mask is intentionally *not* the real picture) but import from avatarAssets.
- `backend/src/graphql/resolvers/community.ts:777` — delete the imgur literal.
- **Gravatar moves to the write side, generalised from the half-built `resolveAvatarUrl`** (`backend/src/data/loaders/userauth.ts:136-148`, today called only at signup, its result never persisted, and stored *without* `?d=404`). Replace it with `refreshAvatarFromEmail(ctx, username, email)` in `backend/src/data/loaders/socialsignin.ts` next to `refreshMessengerAvatar` (same file, same `shouldRefreshStoredAvatar` policy): build `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?s=256&d=404`, probe it with the **existing** ranged-GET `avatarAssetExists` (not a full `axios.get` download — delete `import axios` at `userauth.ts:11`, its only use), and persist only when `shouldRefreshStoredAvatar({ fresh, stored, s3Exists })` says so — i.e. never over an upload or a provider picture. Call it from `doSignin`, `doSignup`, `tokensignin` (after the provision insert) and `editProfile` when the email changes. Add to `avatarAssets.test.ts`: `shouldRefreshStoredAvatar` treats a stored gravatar URL as replaceable by a provider picture and a stored provider picture as *not* replaceable by gravatar (provider > gravatar > nothing).
- `backend/src/data/loaders/socialsignin.ts:161,170,184` — `profile_url || await resolveAvatar(...)`; `refreshMessengerAvatar` (`:117`) additionally refuses to persist when `!isPersistableAvatarUrl(freshUrl)`.
- `backend/src/graphql/resolvers/messenger.ts:531-532` `messengerUpdateUser` — drop the `profileUrl` argument's write (schema keeps the arg for one release, ignored with a deprecation log), so the client can no longer store a URL (I6). `updateUserProfileUrl` and `upsertUser` in `users.ts` gain an `isPersistableAvatarUrl` guard for the remaining internal callers (`scripts/configure-study-group.ts:213-219` writes bot pictures through neither — leave it, it is out of scope, but note it).
- **I7 — anonymous mask.** `backend/src/graphql/resolvers/messenger.ts:319-323` `pagecomments` returns author DTOs to unauthenticated readers of public/unlisted channels (`policy.ts:57-59`). When `actingUserId` is null, map every returned user's `profile_url` through `maskAvatarForAnonymous`. Audit the other resolvers that call `getChannelAccess(...).canRead` with a nullable acting user (`messenger.ts` message/thread reads for public channels) and apply the same mask; `leaderboard`/`homefeed` already mask via `maskUserPrivacy`, `messengerUsers` is gated by `visibleMessengerUserIds`. Test: `backend/test/messaging/community-graphql.test.ts` — a public-channel `pagecomments` query with no bearer never returns a `gravatar.com` or provider host.
- **Notification payloads** (`backend/src/notifications/store.ts:35` persists the full actor DTO, including `profile_url`, into `bom_notification.payload` — for a *different* user's row, outside any channel gate, forever). Strip `profile_url` from the persisted actor and re-resolve it at read time in `rowToDTO` (`store.ts:52`) via `getUser`. This also fixes an existing bug where a cold-cache `getUser` froze the generated face into notifications permanently.

Add the grep-style invariant tests (I3/I4) to `backend/test/messaging/avatarInvariants.test.ts`: read the source tree and assert `generateAvatarUrl(` appears only in `avatarAssets.ts` and `community.ts` (mask), and `profiles/${` only in `media/profileImage.ts`.

Run `npx tsc --noEmit && npx vitest run test/messaging test/graphql test/media`. **Commit** `refactor(avatars): all backend surfaces resolve through resolveAvatar`.

### Task 2.5: `uploadProfileImage` returns the URL it persisted

**Not a bare `String`.** `frontend/webapp/src/models/BoMOnlineAPI.js:150-155` keys every result by `results[j][query.key]`, and this mutation's `key` is `0` (`GraphQLQueries.js:1397`); on a string that is its first character, so a URL would surface as `{ h: "https://…" }`. `Boolean` only works today because `true[0]` is `undefined`, which falls through to the "assign the whole result" branch (`:154`). An **object** result takes that same branch (`editProfile` proves it), so:

**Files:**
- Modify: `backend/schema/BomUser.graphql:24` → `uploadProfileImage(token: String!, imageData: String!): ProfileImageUpload` with `type ProfileImageUpload { url: String! }`. This is a deliberate break of the "frozen contract" (`backend/codegen.ts:3`); say so in the commit.
- Run: `cd backend && npm run codegen:graphql` and commit the `backend/codegen/graphql.ts` diff (it is tracked).
- Modify: `backend/src/graphql/resolvers/userprofile.ts:150-190` — `return { url: uploadedUrl }`; the **sandbox branch** (`:150-155`) must return `{ url: profileImageUrl(userHash) }` — never `''`, because `compat/responseFilter.ts:26-28` strips empty-string fields and the client would read `undefined`.
- Modify: `backend/test/graphql/mutations.test.ts:103-111` (bad-token → `null`; still valid) and add a sandbox-shape case asserting `url` is a non-empty assets URL.
- Delete or re-capture `_deprecated/tests/baselines/en/uploadProfileImage/tiny.json` (pins `"boolean"`; not in CI, but the next parity run would flag it).
- Frontend: `frontend/webapp/src/models/GraphQLQueries.js:1393-1400` selects `{ url }`; `frontend/webapp/src/views/User/Profile.js:278-287` checks `result?.uploadProfileImage?.url` and uses it as `profileImage` instead of rebuilding `getProfileImageUrl(userId)?v=Date.now()` (P14 — this is the whole point of the change).

Deploy order: backend first (an object is truthy, so the old client's `if (!result?.uploadProfileImage)` keeps passing during the window). **Commit** `feat(profile)!: uploadProfileImage returns the persisted avatar URL`.

---

## Phase 3 — Frontend stops inventing avatars

### Task 3.1: One hash helper, honestly named

**Files:**
- Modify: `frontend/webapp/src/models/Utils.js:153-158` — rename `md5` → `randomHex` (it never hashed its input); update `Feed.js:48,586` to `useState(() => randomHex())` with a comment that the id is per-mount, which is what it always was.
- Modify: `frontend/webapp/src/models/MessengerController.js:16-23,74` — delete the hex-aware `md5`; `this.userId = userId` with a dev-only assertion `MD5_RE.test(userId)` (the value from `MessengerContext.js:66` is already the backend id). `Community.js:46,62` colour seed → `md5hash`.
- Keep `Utils.md5hash` as the one hash; `UserAvatar.js:58` keeps its passthrough (inputs there legitimately vary).

Test: `frontend/webapp/src/models/__tests__/utils.test.js` — `randomHex()` differs across calls; `md5hash('caspianrex') === '9b4291984af9d3c3baaae5af3ece9962'`.

**Commit** `refactor(webapp): one md5 helper; rename the random-id generator`.

### Task 3.2: Delete `tokenImage` and the client-side `profile_url` write

**Files:**
- Delete: `frontend/webapp/src/models/Utils.js:81-84` `tokenImage`
- Modify call sites: `appController.js:421-423` (drop the synthesis — leave `profile_url` as the server sent it), `MessengerController.js:424-427` (delete the write — P13), `Header.js:72`, `Sidebar.js:436`, `Feed.js:849-851` (render `<UserAvatar userId={states.user.user} profileUrl={states.user.social?.profile_url} />` — `UserAvatar` already handles the empty case).
- Modify: `frontend/webapp/src/models/MessengerController.js:1167-1190` `updateCurrentUserInfo(nickname, profileUrl)` — the `messengerUpdateUser` call is inline here (there is no `GraphQLQueries.js` wrapper); drop the `profileUrl` parameter and variable. After 3.2 its only remaining caller is the nickname edit.

Test: `frontend/webapp/src/models/__tests__/appController.test.js` — `setUserSocial({profile_url: null})` leaves it null (no dicebear synthesized). **Commit** `fix(webapp): never seed or persist an avatar from the session token`.

### Task 3.3: Pin the two generators together

**Files:**
- Create: `frontend/webapp/src/components/__fixtures__/avatar-golden.json` — `{ "<seed>": "<url>" }` for 8 seeds (include `'user'`, a 32-hex id, a 5-char id, an empty string)
- Test: `frontend/webapp/src/components/__tests__/UserAvatar.test.js` — `generateAvatarUrl(seed) === golden[seed]` for all
- Test: `backend/test/messaging/avatarGolden.test.ts` — reads `../../../frontend/webapp/src/components/__fixtures__/avatar-golden.json` and asserts the same for `generateAvatarUrl`

The fixture is generated once by the frontend test with a `UPDATE_GOLDEN=1` escape hatch; the backend test never writes it. Update the "keep in sync" comments in both files to point at the fixture. **Commit** `test(avatars): golden fixture pins frontend and backend generators`.

### Task 3.4: Every face goes through `UserAvatar`; delete `breakCache`

Pattern: replace `<img src={x.picture} onError={breakCache} …/>` with `<UserAvatar userId={x.user_id ?? x.userId} profileUrl={x.picture ?? x.profileUrl} size={…} className={…} />`. `UserAvatar` accepts `className`/`style`, so layout survives. Representative sites (full list in the 2026-09-01 inventory in this plan's appendix): `Home/Community.js:318,382,458,478,708`, `Home/Feed.js:424,818,866,931`, `Home/tiles/CommunityTile.js`, `_Common/Study/StudyChat.js:615,757,966,1009,1024,1045,1061`, `StudyGroupAdmin.js`, `StudyGroupSelect.js`, `StudyGroupBar.js:69,470`.

The three CSS `background-image` sites (`Page/Floaters.js:37`, `StudyGroupBar.js:581`, `StudyGroupProgress.js:58`) become an absolutely-positioned `<UserAvatar>` inside the same container; the two raw-HTML tooltip strings (`Feed.js:557`, `Community.js:670,681`) keep `<img>` but take the already-resolved URL (no fallback possible in a string — acceptable, the backend now never emits a 404 URL for a user with a row).

Delete `Utils.breakCache` (`:639-645`) once no caller remains. Verify with `npx react-scripts test --watchAll=false` and a screenshot pass of `/home` (Community + Feed) on `localhost:3000` per CLAUDE.local.md. **Commit** `refactor(webapp): route every user avatar through UserAvatar`.

---

## Phase 4 — Data cleanup (after Phase 2 is deployed)

### Task 4.1: NULL the persisted generated URLs; normalise the Gravatar ones

**Files:** Create `backend/migrations/2026-09-XX-null-generated-avatars.mjs` (same dry-run/`--apply` shape).

1. `UPDATE messenger_users SET profile_url=NULL WHERE host(profile_url) IN ('api.dicebear.com','avatars.dicebear.com')` — expected 57 + 29 = 86 rows. Safe because the read path resolves a NULL row to the identical generated URL (deterministic on `user_id`), and 86 − (rows whose user has an S3 object, which the read path will now find) is the worst case.
2. The 18 remaining `www.gravatar.com` rows (the 21 minus Cory's 3, repaired 2026-09-01) already carry `?s=256&d=404`, so they satisfy I2 as-is; assert that with the dry run (`… AND profile_url NOT LIKE '%d=404%'` → 0) rather than rewriting them. Any future sign-in re-evaluates them through `refreshAvatarFromEmail` anyway.

Verify: host breakdown of `profile_url` → only `assets.bookofmormon.online`, provider hosts, and `www.gravatar.com` with `d=404`; spot-check one formerly-dicebear row through `messengerUser(userId)`.

**Commit** the doc note.

---

## Phase 5 — Docs

- Amend `docs/specs/2026-06-10-messaging-user-data-consolidation.md` §3: "Humans: `profile_url` NULL **or a real picture of the person (upload, versioned; social provider; Gravatar with `d=404`, resolved at sign-in)**; never generated. Unauthenticated responses never carry a third-party avatar host."
- Record the rejected read-time-Gravatar design and why (oscillation on the negative TTL, outbound volume, fail-open, payload freezing) in the reference doc so it is not re-proposed.
- Close the "Remaining" items in `docs/bugs/2026-06-11-profile-image-no-ssot.md` (items 1–3 are done by Tasks 4.1, 2.4, 2.4) and the follow-ups in `docs/bugs/2026-09-01-profile-photo-reverts.md`.
- Add `docs/reference/user-identity-and-avatars.md` (evergreen): the three identifiers, I1–I6, and "where to change what".

**Commit** `docs: identity + avatar model after consolidation`.

---

## Verification (end to end)

1. **Unit:** `cd backend && npx tsc --noEmit && npx vitest run` — the two pre-existing `avatarAssets.test.ts` failures ("keeps URLs whose asset exists" at `:30` and "fails open on fetch errors" at `:49`) assert that a **cold-cache** call returns the real URL; since the P-3 change the bulk path returns the generated URL and warms the cache, so they fail by design. Task 2.3 replaces them with "cold call → generated + probe fired; warm call → real URL", matching the documented contract. `cd frontend/webapp && npx react-scripts test --watchAll=false`.
2. **Data:** after 1.2 and 4.1, from the laptop (read-only CLI in the private workspace): I1 query → 0; host breakdown of `profile_url` → only `assets.bookofmormon.online` and provider hosts.
3. **Live, local stack** (backend `:5006`, webapp `:3000` per CLAUDE.local.md): sign in as Cory's test-equivalent; `tokensignin.social.profile_url`, `messengerUser(...).profile_url`, the sidebar `<img>`, and a channel member list all show the **same** URL. Upload a new photo → the toast shows, reload → the new photo persists, and `messenger_users.profile_url` equals the mutation's return value.
4. **Gravatar at sign-in:** sign in (local stack) as a test user whose email has a Gravatar and no upload → `messenger_users.profile_url` becomes the `?d=404` Gravatar URL; upload a photo → it is replaced by the assets URL; sign in again → the assets URL survives (`shouldRefreshStoredAvatar` refuses). Then fetch `pagecomments` for a public channel with no bearer → no `gravatar.com` host in the response (I7).
5. **Prod:** push `prod`; watch `gh run watch`, then `ssh bom journalctl -u bom-deploy.service -n 30`; confirm the shipped dist contains `resolveAvatar` (`docker exec … grep -c resolveAvatar /app/backend/dist/src/messaging/avatarAssets.js`).

## Rollback

- Phase 1: restore the five tables from the Task 0.1 dump (messages/reactions/users are the only rows touched; no schema change).
- Phase 2/3: revert commits; the schema change (Boolean→String) is backward compatible for the frontend's truthiness check, so a backend rollback with the new frontend deployed still works.
- Phase 4: the NULLed URLs are all regenerable (dicebear is deterministic; Gravatar is keyed by email), so no dump needed.

## Appendix — inventory references

Line-numbered inventories of identity derivation (7 hash helpers, 30+ md5 call sites) and avatar decisions (P1–P16, 6 key builders, 3 generators, 30+ `<img>` sites) were gathered on 2026-09-01 and are summarised in Context; executors should re-grep rather than trust line numbers.
