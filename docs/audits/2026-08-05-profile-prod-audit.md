# Profile Surface — Prod-Readiness Audit
**Date:** 2026-08-05  
**Auditor:** Claude (automated, rigorous)  
**Plan reference:** `docs/plans/2026-08-05-prod-audit-execution-plan.md` §Task 3  
**Backend:** `http://localhost:5006` (bom-greenfield, live dev DB)  
**Isolation:** `STUDY_CLI_HOME=/tmp/audit-profile`; sim handles `pra`, `prb`

---

## Summary

Five profile-surface findings examined. **Two P0 blockers confirmed** (profile takeover, metadata full-replace). Two P1s confirmed (avatar existence probe on hot path, upload no size cap). One P2 partially mitigated (pass in loader memory but not SDL-exposed).

**Top blockers before prod cutover:**
1. **P-1 (P0, CONFIRMED)** — Any caller, including unauthenticated, can overwrite any user's `nickname`/`profileUrl`/`metadata` by passing a known `userId`. Zero auth check. Probe produced `nickname: "ANON-OWNED"` with no bearer token.
2. **P-2 (P0/P1, CONFIRMED)** — `messengerUpdateUserMetadata` does a full JSON replace. Any key not included in the update payload is permanently erased. A partially-update client silently destroys user data.
3. **P-4 (P1, CONFIRMED)** — `uploadProfileImage` passes the raw base64 string to `sharp` with no pre-decode size check. A multi-megabyte payload causes Node to allocate a large buffer before `sharp` even runs.

---

## Findings

### P-1 profile takeover via `userId` arg — CONFIRMED (severity: P0)

- **Claim:** `messengerUpdateUser` / `messengerUpdateUserMetadata` accept an arbitrary `userId` arg and use it as the write target without verifying it matches the authenticated caller.
- **Method:** Code review at `backend/src/graphql/resolvers/messenger.ts:454–504` + dynamic probe as `pra` (authenticated) and then as anonymous (no bearer) targeting `prb`'s `user_id`.
- **Evidence:**
  - Code: `const targetUserId = userId ?? (await resolveActingUserId(ctx));` (line 460 and 487). `resolveActingUserId` is only used as a *fallback* when no `userId` arg is supplied. When `userId` IS supplied, it is used verbatim — no ownership check against the acting user.
  - `resolveActingUserId` returns `null` when there is no bearer token, but when `userId` is passed directly the function is never called at all.
  - Dynamic probe (authenticated cross-user): `pra`'s token + `prb`'s `user_id` arg → mutation returned `{ "user_id": "b1bb6f0a735b4aa6709e723a63e8821f", "nickname": "OWNED-BY-PRA" }`.
  - `prb` read-back: `{ "messengerUser": { "nickname": "OWNED-BY-PRA" } }` — change persisted to DB.
  - Dynamic probe (unauthenticated): `--anon` flag (no bearer) + `prb`'s `user_id` → mutation returned `{ "nickname": "ANON-OWNED" }`. **No authentication is required at all.**
- **Impact:** Any user (or unauthenticated actor) who knows or can derive another user's `user_id` (an MD5 of their username, discoverable via `messengerUsers`/channel member lists) can permanently overwrite that user's nickname, profile URL, and metadata. This is a complete profile takeover. At scale this enables impersonation, harassment, and silent data corruption.
- **Fix sketch:** In `messengerUpdateUser` and `messengerUpdateUserMetadata`, after resolving `targetUserId`, assert `targetUserId === actingUserId` (or require operator privilege for admin override); reject with UNAUTHORIZED otherwise. Also require a valid bearer token before proceeding at all (guard on `actingUserId` being non-null before the `userId ?? actingUserId` coalesce).

---

### P-2 metadata full-replace wipes keys — CONFIRMED (severity: P0/P1)

- **Claim:** `messengerUpdateUserMetadata` does a full JSON column replace, so any key not present in the new payload is permanently deleted.
- **Method:** Code review at `backend/src/graphql/resolvers/messenger.ts:482–503` + `backend/src/messaging/users.ts:286–298` + dynamic probe with two-step update.
- **Evidence:**
  - Code: `updateUserMetadata` at `users.ts:291` does `.set({ metadata: JSON.stringify(metadata) })` — no merge with existing value.
  - Probe step 1 (as `prb`): `messengerUpdateUserMetadata(metadata:"{\"summary\":\"a\",\"bookmark\":\"b\"}")` → `true`.
  - Probe step 2 (as `prb`): `messengerUpdateUserMetadata(metadata:"{\"summary\":\"c\"}")` → `true`.
  - Read-back: `metadata: { "summary": "c" }` — the `"bookmark": "b"` key is gone, permanently erased by a partial update.
  - Note: this was also exploitable cross-user via P-1 (same missing auth guard on `userId`), but the data-loss vector is independent of P-1.
- **Impact:** Any client that performs a partial metadata update (e.g., updating `summary` without re-sending `bookmark`) silently destroys the omitted keys. Frontend bug or partial update = permanent data loss. Also enables targeted key-erasure if combined with P-1.
- **Fix sketch:** Replace the full-replace with a DB-level JSON merge (`JSON_MERGE_PATCH(metadata, ?)` in MySQL) or read-modify-write in the resolver before calling `updateUserMetadata`.

---

### P-3 avatar existence probe on hot path — CONFIRMED (severity: P1)

- **Claim:** Every `getUser`/`getUsers` call synchronously awaits an outbound HTTP existence probe (ranged GET to the asset CDN) for any user whose `profile_url` is derived (not explicitly stored), blocking the response for up to 2 s per uncached URL.
- **Method:** Code review at `backend/src/messaging/users.ts:67–83` (`verifyDerivedAvatars`), `users.ts:130–156` (`getUser` — `await verifyDerivedAvatars` at line 154), `users.ts:159–189` (`getUsers` — `await verifyDerivedAvatars` at line 188), and `avatarAssets.ts:22–82` (2000 ms `FETCH_TIMEOUT_MS`, fail-open-after-timeout).
- **Evidence:**
  - `getUser` (line 154): `await verifyDerivedAvatars([row], [dto])` — synchronously blocks the resolver.
  - `getUsers` (line 188): same pattern for batches — all derived URLs are checked in `Promise.all` (parallel but still awaited before return).
  - `avatarAssets.ts:24`: `const FETCH_TIMEOUT_MS = 2000` — each uncached URL can add up to 2 s of latency.
  - Hot paths confirmed to call `getUsers`: `leaderboard` (`community.ts:396`), `homefeed` member assembly (`community.ts:695`), `messengerChannelMembers` → `members.ts:104`, notification assembly (`notifications.ts:151`).
  - Cache helps (positive TTL 24 h, negative 60 s) but cold-start / first-visit for a user's profile page hits the probe on every request for 60 s after a miss.
- **Impact:** Leaderboard, homefeed, and channel-member list requests can each stall for up to 2 s per unique uncached avatar URL. Under load (many new users or cache eviction) this compounds. Not a correctness issue but a P1 latency/reliability risk in prod.
- **Fix sketch:** Move avatar existence probing out of the synchronous read path — either serve derived URLs optimistically (let the frontend's `onError` fallback handle 404s) or resolve asynchronously after the DTO is returned.

---

### P-4 upload no size cap / no throttle — CONFIRMED (severity: P1)

- **Claim:** `uploadProfileImage` passes the raw base64 string to `sharp` without validating the decoded byte length first, allowing arbitrarily large payloads to be fully buffered in memory.
- **Method:** Code review at `backend/src/graphql/resolvers/userprofile.ts:124–161` and `backend/src/media/s3.ts:35–58`.
- **Evidence:**
  - `userprofile.ts:124`: `const { token, imageData } = args;` — `imageData` is a GraphQL `String` arg with no SDL `@constraint` or length directive.
  - `s3.ts:40–41`: Only `!base64Data || base64Data.trim() === ''` is checked before `Buffer.from(base64Clean, 'base64')` (line 48) and `sharp(imageBuffer)` (line 52). No `imageBuffer.length` check.
  - `s3.ts:47–55`: A 50 MB base64 string (~37 MB decoded) would be fully buffered before `sharp` attempts to decode it — at which point sharp may reject it or succeed and produce a valid 256×256 JPEG, but the full 37 MB was already in heap.
  - There is no per-user rate limit, per-IP throttle, or request-size middleware guarding this path.
- **Impact:** An authenticated user (auth token required, limiting blast radius) can send repeated multi-megabyte GraphQL requests that spike Node heap and trigger GC pressure or OOM. Not anonymous-exploitable (token check at line 127 rejects unauthenticated callers), but any registered account can abuse it.
- **Fix sketch:** Add a pre-check `if (imageData.length > MAX_BASE64_LEN) throw new GraphQLError('Image too large', ...)` before `Buffer.from` in `s3.ts:uploadProfileImage` (e.g., `MAX_BASE64_LEN = 5 * 1024 * 1024` for ~3.7 MB decoded). Also enforce a request body size limit at the Express level.

---

### P-5 `pass` in memory — PARTIAL (severity: P2)

- **Claim:** The `pass` (password hash) column is selected into in-memory objects in `userauth.ts` and `userprofile.ts`, risking accidental GraphQL exposure.
- **Method:** Code review at `backend/src/data/loaders/userauth.ts:59` (`findUserByCredentials`), `userauth.ts:88` (`findUserByToken`), `backend/src/data/loaders/userprofile.ts:34` (`getUserByToken` select list), and `backend/schema/BomUser.graphql:52–67` (SDL `User` type).
- **Evidence:**
  - `userauth.ts:59`: selects `'pass'` in the `findUserByCredentials` result.
  - `userauth.ts:88`: selects `'bom_user.pass as pass'` in `findUserByToken`.
  - `userprofile.ts:44`: selects `'u.pass'` in `getUserByToken`.
  - SDL `BomUser.graphql:52–67`: `type User { user, email, name, bookmark, zip, complete, started, time, finished, sessions, social, progress, history, networks }` — **`pass` is NOT in the SDL `User` type**. GraphQL default resolvers will not surface it.
  - All three functions return the hash for internal use only (bcrypt verify/rehash). The `pass` field is never returned through a GraphQL resolver field that maps to the SDL `User` type.
- **Impact (as-is):** Low. The hash is never returned to the client via GraphQL. The risk is future developer error — adding `pass` to the SDL or a new resolver that spreads the row object without filtering. The in-memory objects act as a latent footgun.
- **Fix sketch:** Strip `pass` from the returned objects in all three loader functions before returning (return `{ ...row, pass: undefined }`) so callers never receive it, eliminating the accidental-exposure vector entirely.

---

## Verdict table

| ID | Title | Verdict | Severity | Launch blocker? |
|----|-------|---------|----------|----------------|
| P-1 | Profile takeover via `userId` arg | CONFIRMED | P0 | YES |
| P-2 | Metadata full-replace wipes keys | CONFIRMED | P0/P1 | YES |
| P-3 | Avatar existence probe on hot path | CONFIRMED | P1 | Risk-accept w/ owner |
| P-4 | Upload no size cap / no throttle | CONFIRMED | P1 | Risk-accept w/ owner |
| P-5 | `pass` in memory | PARTIAL | P2 | No (SDL not exposed) |
