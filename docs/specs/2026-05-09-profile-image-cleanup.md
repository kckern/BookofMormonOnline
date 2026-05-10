# Profile Image: Code-Only Follow-Ups

**Status:** code merged to `dev` via `5a3c2c2 Merge branch 'feature/profile-image-upload'` (commit `45792f9`). Cleanup pass landed in `10e80dd refactor(profile-image): typed errors and required env config`.

| Item | Status |
|---|---|
| A. Auth model | Audited — no change (see §A) |
| B. Remove `*.sendbird.*` special case | **Done** (also fixed cascade bug — see §B) |
| C. Group avatar `isGroup` branch | Audited — intentional, no change (see §C) |
| D. Cache-buster persistence | Audited — non-issue, no change (see §D) |
| E. `S3_BUCKET` default | **Done** in `10e80dd` |
| F. Resolver error handling | **Done** in `10e80dd` |

**Note on the design:** profile image URLs are NOT stored in the database.
The frontend computes `md5(username)` and constructs the URL deterministically
(`https://assets.bookofmormon.online/profiles/{md5}.jpg`). On 404, the frontend
falls back to a DiceBear avatar derived from the same identity. There is no
`social.profile_url` column to clean up, no migration record, no per-user state
on the backend. This is what makes the system trivially restorable — a user's
identity is the only input.

This spec covers **only the in-repo code changes** still needed after the
profile-image-upload feature was merged. Operational rollout (storage
provisioning, credentials, historical migration of pre-existing images,
database cleanup of dead URLs) lives in the private ops workspace and is not
documented here.

## In-Tree Today (already on `dev`)

| Layer | File |
|---|---|
| Backend lib | `src/library/s3.ts` — resize → 256×256 JPEG → upload to `profiles/{md5(username)}.jpg`, optional CDN invalidation |
| Backend schema | `src/typeDefs/BomUser.ts` — `uploadProfileImage(token, imageData): Boolean` |
| Backend resolver | `src/resolvers/BomUser.ts` — token → user → upload |
| Frontend client | `frontend/webapp/src/models/GraphQLQueries.js` — `uploadProfileImage` wrapper |
| Frontend UI | `frontend/webapp/src/views/User/ImageChanger.js` — Cropper → base64 → mutation |
| Frontend display | `frontend/webapp/src/components/UserAvatar.js` — `profileUrl` → stored image → DiceBear fallback |
| Frontend wrapper | `frontend/webapp/src/views/User/PictureWithOverlay.js` — renders `UserAvatar` |

Public URL pattern users see: `https://assets.bookofmormon.online/profiles/{md5(username)}.jpg`.

## Code Follow-Ups

### A. Auth model on `uploadProfileImage` — audited, no change

The Apollo context function (`src/config/apollo.ts:22-42`) returns only
`{ lang, ip, db, loaders }` — `context.user` is never populated. Every
authenticated resolver in the project uses
`Models.BomUser.findOne(findUserByToken(args.token))`. `uploadProfileImage`
already follows that convention, so there is no stronger auth path to adopt
without a project-wide refactor of context plumbing. Out of scope for this
cleanup.

### B. Remove the `*.sendbird.*` special case in `UserAvatar` — done

The Sendbird URL guard was a hedge against the user object holding stale
profile_url values that still pointed at the dead Sendbird CDN. Once the
design moved to "URL is derived from `md5(username)`, no DB column", the
guard became dead weight and was removed.

While doing this, fixed a related cascade bug in `handleError`. Previously
a single error set BOTH `failed` and `triedS3` true at once, so a
`profileUrl` failure jumped straight to DiceBear without trying S3. Now
the two flags advance one stage at a time, giving the proper waterfall:
`profileUrl` → S3 → DiceBear.

### C. Group avatar path in `ImageChanger` — audited, intentional

The `isGroup` branch hands the cropped blob back to the parent component on
purpose. Group avatars have their own backend save flow:

- `StudyGroupSelect.js:689` packs `groupImage` into `inputData` for group
  creation.
- `StudyGroupAdmin.js:77` packs `groupImage.file` into `updateParams.coverImage`
  for group updates.

Folding group avatars into `uploadProfileImage` would require coupling the
profile mutation to group lifecycle (create/update) flows, which is a bigger
refactor with no current bug to motivate it.

### D. Frontend cache-busting on upload — audited, non-issue

`setUserSocialProfileImage` (`appController.js:442`) only mutates in-memory
React state — `appController.states.user.social.profile_url = input.val`.
There is no DB write, so the `?v=…` cache-buster never persists. It dies
on the next session refresh, when the user's social state is re-fetched
from the backend. Not a real problem.

### E. `S3_BUCKET` default in `src/library/s3.ts` — done

Done in commit `10e80dd`. The hardcoded fallback was removed; `S3_BUCKET` is
now read at upload time and an `AppError` with code `INTERNAL_ERROR` is
thrown if it's unset, rather than letting the SDK fail with an opaque
error. The `AWS_REGION` fallback was removed for the same reason — both are
operator configuration, not code defaults.

### F. Resolver error handling — done

Done in commit `10e80dd`. The resolver no longer catches and collapses every
failure into a `false` return. It now lets typed errors propagate:

- `AuthenticationError` for token failures (code `UNAUTHORIZED`, 401).
- `ValidationError` for invalid image data or hash (code `VALIDATION_ERROR`, 400).
- `AppError(EXTERNAL_SERVICE_ERROR)` for storage failures (502).
- `AppError(INTERNAL_ERROR)` for missing `S3_BUCKET` config (500).

The Apollo error formatter (`src/config/errorHandler.ts`) already preserves
these codes for clients via the `extensions.code` field, so the frontend can
branch on specific failure modes.

## Test Coverage Gaps

- No test exercises `uploadProfileImage` end-to-end.
- No test for `UserAvatar`'s three-tier fallback (would catch B regressions).
- Existing tests under `/test/` follow whatever convention is already there —
  match it.

Add tests as part of whichever code follow-up lands first; not a separate PR.

## Remaining

All in-tree code follow-ups for this feature are now done. Operational
follow-ups (backend redeploy with the new env, manual end-to-end UI
upload test) are tracked in the private ops workspace.
