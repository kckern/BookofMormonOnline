# Profile image has no single source of truth — sidebar shows generated avatar despite real photo on file

**Date:** 2026-06-11
**Symptom:** Logged in as the staff account, the left sidebar shows a generated
dicebear "thumbs" avatar, while the DM panel on the same screen shows the real
uploaded profile photo for the same user.

## Verified live (dev, `http://10.0.0.10:8200`)

Same user (`user_id = fd1bfdfce58c2f8523c1bb067f705668`), two queries, two
different answers:

```
signin.social.profile_url
  → https://api.dicebear.com/7.x/thumbs/svg?seed=fd1bf&...      (generated)

messengerUser(userId:"fd1bf...").profile_url
  → https://assets.bookofmormon.online/profiles/fd1bf....jpg    (real photo, HTTP 200)
```

The sidebar (`Sidebar.js` → `UserInfo` → `setImg(states.user.social.profile_url)`)
renders whatever signin returned; the DM panel reads the messenger user record.

## Root cause

`signin` / token-signin (`src/resolvers/BomUser.ts:138,204`) do:

```ts
const userAvatar = genUserAvatar(hashed_id);              // always generates
social: await sendbird.loadUser(hashed_id, userName, userAvatar)
```

With `MESSENGER_ENABLED` falsy, `sendbird` is the shim (`BomUser.ts:36`) whose
`loadUser` just **echoes the passed-in URL back** — so `social.profile_url` is
always the freshly generated dicebear, regardless of what's on file. It never
consults `messenger_users.profile_url` nor the S3 convention
(`profiles/<md5(user)>.jpg`, which exists for this user).

Additional landmine: when `MESSENGER_ENABLED=true`, `sendbird` becomes the real
`messenger` service — **which has no `loadUser` method at all**
(`src/library/messenger.ts` has `getUser`/`upsertUser`). Signin would throw
`messenger.loadUser is not a function` the moment the flag flips on.

## The competing "sources of truth" (inventory)

1. `messenger_users.profile_url` (DB) — what the DM/messenger surfaces use. ✅ correct for staff.
2. S3-by-convention `profiles/<md5(user)>.jpg` — what `UserAvatar.getProfileImageUrl` reconstructs.
3. Per-request `genUserAvatar(hashed_id)` in signin (`BomUser.ts`) — what the sidebar ends up showing.
4. Frontend regenerators: `components/UserAvatar.generateAvatarUrl`, `models/Utils.genUserAvatar`
   (duplicated palette/logic, drifted: signin's URL has 3 eye variants + mouth/rotate, the
   frontend copy differs), plus `Utils.breakCache` onError fallback.
5. Legacy URLs persisted in data: `avatars.dicebear.com/api/...` (v1 host — now HTTP **410**).

Because `UserAvatar` prefers a *loadable* `profileUrl` over everything, a junk
generated URL that loads fine permanently shadows the real photo — fallback
order can't rescue it.

## Suggested remediation (not applied)

1. Make `messenger_users.profile_url` the SSoT. Signin should resolve the avatar
   via the messenger record (or `getProfileImageUrl` S3 check) and only generate
   a dicebear avatar as last resort **at write time** (persist it), never per-request.
2. Add `loadUser` to the messenger service (get-or-upsert returning the stored
   `profile_url`) so the `MESSENGER_ENABLED=true` path doesn't throw.
3. Collapse the four avatar-generator copies into one shared helper (backend
   exports the canonical generator; frontend uses one module).
4. Data cleanup: rewrite persisted `avatars.dicebear.com` v1 URLs (410 Gone) to
   the stored photo or the canonical generated avatar.
