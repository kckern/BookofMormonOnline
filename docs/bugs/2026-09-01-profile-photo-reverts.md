# Profile photo saves, then reverts on reload

**Date:** 2026-09-01
**Status:** Fixed and deployed to production 2026-09-01; data repair applied
**Reported by:** a user, over email, after the 2026-08-29 upload fix (`307b5530`)

## Symptom

> "It looked like I had successfully changed my profile pic, but when I reloaded
> the page just now, it reverted back to the previous one."

The upload flow reported success — the toast fired and the new photo rendered
immediately — and the old photo came back on the next page load. Repeating the
upload did not help. Reproduced across three of the reporter's devices.

This is a *different* bug from the one fixed on 2026-08-29. That one was an
upload failure (yellow error box); this one is an upload that genuinely
succeeds and is then not read back.

## Evidence

Production logs showed three clean uploads for the reporter's avatar key:

```
[profile-image] upload start   { hash: <md5>, inputBytes: 96711 }
[profile-image] upload success { ... }
```

The S3 object was current — fetching the key through the CDN returned the
newly uploaded photo (`last-modified` matching the reported upload time). So
the write path was healthy end to end and the defect was on the read path.

`messenger_users` for that user held:

```
profile_url = https://www.gravatar.com/avatar/<hash>?s=256&d=404
updated_at  = 2026-06-12
```

That URL returns **HTTP 200** with a real, older photo of the reporter.

## Root cause

Two independent defects, either of which produces the same "reverts" symptom.

### 1. A stored `profile_url` shadows the upload (primary)

`uploadProfileImage` wrote S3 and nothing else, on the documented assumption
that a DB write was unnecessary because the avatar is served by convention at
`{S3_PUBLIC_URL}/profiles/<md5(username)>.jpg`.

But the read path is `messaging/users.ts` `toUserDTO`:

```ts
const profile_url = row.profile_url || deriveProfileUrl(row);
```

A stored value always wins over the derived key. `tokensignin` →
`resolveSigninAvatar` → `getUser` → `toUserDTO` runs on every page load, so the
gravatar was returned every time and the uploaded object was never consulted.

The frontend then made the failure look like a success. `Profile.js`
optimistically swaps in `…/profiles/<hash>.jpg?v=<Date.now()>` after the
mutation resolves, which fetches the real new object — so the photo visibly
updated until the next load replaced it with the server's answer.
`UserAvatar`'s `onError` fallback to the derived S3 URL never fired either,
because the gravatar URL returns 200, not 404.

Net effect: any user carrying an inherited avatar was **permanently unable to
change their profile photo**, with no error shown.

### 2. A mutable key declared immutable (secondary)

The object was written with `CacheControl: max-age=31536000` at a stable key
that every re-upload overwrites. Once a browser has loaded an avatar it will
serve those bytes for a year; the CloudFront invalidation on upload clears the
edge but cannot reach a client cache, and the Cloudflare layer in front of it
is not invalidated at all. That reproduces the same symptom for users whose
stored URL is already the assets host.

## Scope

`messenger_users` rows with a stored `profile_url` (humans, at time of fix):

| host | rows | effect |
|---|---|---|
| `assets.bookofmormon.online` | 1338 | no shadowing; exposed to defect 2 |
| `api.dicebear.com` | 57 | shadows uploads |
| `avatars.dicebear.com` | 29 | none — dead host, already scrubbed at read time |
| `www.gravatar.com` | 21 | shadows uploads |

Probing the assets host for each of the 78 shadowing rows found **4** that
shadow a real uploaded object (3 of them belonging to the reporter, whose
Sendbird-migrated account owns an md5-keyed row plus two legacy handle rows,
all with the same `bom_user_id`). The other 74 have no upload behind them, so
their stored avatar is the only picture they have and must be left alone.

## Fix

1. **`backend/src/graphql/resolvers/userprofile.ts`** — after a successful S3
   write, persist the uploaded URL to `messenger_users` via the new
   `claimUploadedProfileUrl`, routed through `runWrite` so sandbox stays
   read-only. An explicit upload now outranks anything inherited, and because
   the stored host is `bookofmormon.online`, `shouldRefreshStoredAvatar`
   refuses to overwrite it at the next social sign-in.

2. **`backend/src/messaging/users.ts`** — `claimUploadedProfileUrl` claims the
   md5-keyed row *and* every legacy row sharing the `bom_user_id`, so migrated
   accounts do not keep a stale face in channel member lists. It returns the
   query rather than executing it, which makes the row-matching testable
   without a database.

3. **`backend/src/media/s3.ts`** — the returned URL carries the upload
   timestamp (`…jpg?v=<ms>`) so every consumer requests a key it has never
   seen, and `CacheControl` drops from `max-age=31536000` to
   `public, max-age=300` so the bare URL (still used by the frontend fallback
   path) cannot go stale for a year.

## Data repair

`backend/migrations/2026-09-01-claim-shadowed-avatars.mjs` rewrites only rows
that are shadowing a live object. Existence is not knowable from SQL, so each
candidate is probed with a 1-byte ranged GET (the CDN 403s `HEAD`); a probe
failure is treated as "no upload" so a network blip can never wipe a stored
avatar. The new value uses the object's `Last-Modified` as the version, which
makes re-runs idempotent. Dry run by default, `--apply` to write.

Applied 2026-09-01: 78 candidates examined, 4 rewritten, 0 remaining. Fetching
the resulting stored URL returns the reporter's 2026-08-31 upload.

## Regression tests

- `backend/test/messaging/profileUrlClaim.test.ts` — compiles the claim query
  against a driverless Kysely and asserts it matches both the md5 row and the
  legacy `bom_user_id` rows, and that an empty `bom_user_id` cannot widen the
  match to every unlinked row.
- `backend/test/media/profile-image-s3.test.ts` — asserts the returned URL is
  version-busted and that the mutable key is no longer declared immutable.

## Follow-ups (not done here)

- The 74 rows storing a gravatar or `api.dicebear.com` URL with no upload
  behind them are a migration artifact; `userauth.ts` already documents that
  generated avatars should never be persisted. Worth a separate cleanup pass.
- `test/messaging/avatarAssets.test.ts` has 2 failures that predate this work
  (the P-3 non-blocking `resolveDerivedAvatars` change left the tests asserting
  the old synchronous behaviour).
