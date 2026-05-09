# Profile Image: Code-Only Follow-Ups

**Status:** code merged to `dev` via `5a3c2c2 Merge branch 'feature/profile-image-upload'` (commit `45792f9`).

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

### A. Auth model on `uploadProfileImage`

`src/resolvers/BomUser.ts` currently does:

```ts
uploadProfileImage: async (_root, { token, imageData }, context) => {
  const user = await findUserByToken(token);
  if (!user) throw new Error('Invalid token');
  ...
}
```

Other resolvers in the same file do the same `findUserByToken` dance, but if
`GraphQLContext` already has an authenticated `context.user` populated by
middleware, `uploadProfileImage` should use that and reject the `token` arg.

Audit:
1. Read `src/index.ts` (or wherever Apollo `context:` is built) — does it
   already resolve a user from the request?
2. If yes: drop `token` from the schema arg, source the user from
   `context.user`, update the frontend mutation to omit `token`.
3. If no: leave as-is and add a TODO referencing this section.

### B. Remove the `*.sendbird.*` special case in `UserAvatar`

`UserAvatar.js` has:

```js
const isSendbirdUrl = profileUrl && (profileUrl.includes('sendbird.com') || profileUrl.includes('sendbird.io'));
if (profileUrl && !isSendbirdUrl && !failed) { ... }
```

This exists because the user table still holds dead Sendbird CDN URLs. After
historical migration + DB cleanup (tracked privately) those rows become
`NULL`, and the special case is dead weight.

When the ops team confirms migration is complete:
1. Remove the `isSendbirdUrl` branch.
2. Revert to: `if (profileUrl && !failed) finalSrc = profileUrl;`
3. Drop the `failed` flag if it becomes redundant with `triedS3`.

### C. Group avatar path in `ImageChanger`

```js
if (isGroup) {
  const imgUrl = cropper.getCroppedCanvas().toDataURL();
  cropper.getCroppedCanvas().toBlob(function (blob) {
    ...
    setProfileImage({ img: imgUrl, file });
  });
  return setOpenModal(false);
}
```

The `isGroup` branch never calls `uploadProfileImage` — it hands the cropped
blob back to the caller via `setProfileImage`. Trace where group images are
actually persisted:

1. Find every `<PictureWithOverlay isGroup>` caller.
2. Confirm each has its own save-to-storage path. If not, group avatars are
   broken.
3. Decision: either fold groups into the same mutation (add a `kind: "user" | "group"`
   discriminator and a `targetId` arg), or keep two paths and document why.

### D. Frontend cache-busting on upload

Right now `ImageChanger` does:
```js
const newProfileUrl = `https://assets.bookofmormon.online/profiles/${userId}.jpg?v=${Date.now()}`;
appController.functions.setUserSocialProfileImage(newProfileUrl);
```

The `?v=…` query string only busts the local React render — the CDN itself
still serves the previous version until cache TTL expires (or invalidation
runs). That's fine because the backend `s3.ts` issues a CDN invalidation when
configured. But:

- The cache-busted URL gets stored in `social.profile_url` and persists
  across sessions. That URL works (CDNs usually ignore unknown query strings)
  but it's noise in the DB and breaks deterministic-URL invariants assumed
  elsewhere.
- Strip the `?v=` before persisting; keep it only as a render-time prop.

### E. `S3_BUCKET` default in `src/library/s3.ts`

```ts
const S3_BUCKET = process.env.S3_BUCKET || 'bomonline-media-assets';
```

The hardcoded fallback couples the open-source code to a specific bucket. Two
options:
- Drop the fallback, throw at startup if `S3_BUCKET` is unset (fail-fast).
- Keep the fallback if it's intentional dev convenience, but log a startup
  warning.

Pick one and apply consistently with how other backend env vars are handled
(check `MYSQL_DB`, `REDIS_URL` — do they fail-fast or fall back?).

### F. Resolver error handling

Current code:
```ts
try { await uploadProfileImage(imageData, userHash); return true; }
catch (error) { console.error(...); return false; }
```

Returning `false` collapses every failure mode (invalid base64, sharp crash,
storage 5xx, permission denied) into the same client-visible result. The
frontend can only show a generic "upload failed" toast.

Improve by returning a typed error or throwing a GraphQL error with a code
the client can branch on (e.g. `BAD_IMAGE` vs `STORAGE_UNAVAILABLE`).

## Test Coverage Gaps

- No test exercises `uploadProfileImage` end-to-end.
- No test for `UserAvatar`'s three-tier fallback (would catch B regressions).
- Existing tests under `/test/` follow whatever convention is already there —
  match it.

Add tests as part of whichever code follow-up lands first; not a separate PR.

## Sequence

A → F can ship in any order; they don't conflict. Suggested order by ROI:

1. **D** (cache-busting persistence) — single-line fix, removes DB noise.
2. **F** (error handling) — improves debuggability of the next deploys.
3. **A** (auth model) — small if context.user already exists, larger if not.
4. **C** (group avatars) — possibly reveals a real bug.
5. **B** (remove Sendbird special case) — gated on ops migration completing.
6. **E** (env var fallback) — bikeshed, do alongside any other s3.ts touch.
