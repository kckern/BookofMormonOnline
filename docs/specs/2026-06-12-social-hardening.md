# Social hardening: invite authorization, real bans, poll cleanup, call gutting, replier faces

**Date:** 2026-06-12
**Status:** Approved (KC, in-session — directives verbatim)
**Source:** findings recorded in `docs/reference/studygroups.md` (2026-06-11 audit)

## 1. Invite authorization (best practice)

Today `messengerInviteMembers` has **no gate** — any authenticated user can invite
anyone into any channel. New behavior:

- Default: only **operators** may invite (`requireOperator`).
- Opt-in: channel metadata key **`membersCanInvite: true`** lets any *joined member*
  invite. Stored in `messenger_channels.metadata` (JSON column, already exposed as
  `MessengerChannel.metadata`).
- `messengerUpdateChannel` (already operator-gated) gains a `membersCanInvite: Boolean`
  arg that merges the key into channel metadata.
- Admin UI (`StudyGroupAdmin.js`) gets a "Members can invite others" toggle wired to
  that mutation.
- The `/invite/:hash` short-link flow is unchanged (link possession is the credential).

## 2. Real bans

`banMember` currently aliases remove. New model:

- `messenger_members.state` gains the value **`banned`** (column is a varchar — no DDL).
  Ban = upsert membership row with `state='banned'`, `role='member'`; the user is
  excluded from member lists/rosters/counts (state filters already exclude non-`joined`
  members everywhere display happens — verify) and **cannot re-enter**:
  `addUserToChannel`, `joinGroup` (invite-link), `messengerAcceptInvitation`, and the
  open/public join paths must reject when an existing row has `state='banned'`.
- `messengerRemoveMember` keeps meaning "kick" (row deleted; may rejoin).
- New operator-gated mutations: `messengerBanMember(channelUrl, userId)` and
  `messengerUnbanMember(channelUrl, userId)` (unban deletes the banned row).
- Community-side `banMember` resolver (legacy alias) delegates to the real ban.
- Admin UI: member row action shows Ban (and Unban for banned members, listed in a
  separate "Banned" section).

## 3. Poll cleanup

- **StudyGroupCall 1s poll** — moot: voice calls are gutted entirely (§4).
- **`homethread` 5s poll after posting a feed reply** (`Feed.js:763` area): delete the
  poll. Replace with optimistic local append of the posted reply + the existing socket
  `message_received` path for other users. If the feed thread component lacks a socket
  listener, patch the posted reply into component state directly from the mutation
  response (no timer, no refetch).

## 4. Gut voice calls

Remove the stubbed voice-call feature wholesale: `StudyGroupCall.js` (and `CallCircle`),
`fetchRoomFromGroup` (controller + noop stub), `startCall` dispatch + `activeCall` /
`activeCallers` / `mutedCallers` state, call-related sounds (enteredCall/exitedCall,
caller-online/offline), the `inCall`/"blue" presence tier in `getFreshUsers` +
StudyGroupBar/Drawer call UI, and the `x_joined_a_call` toaster. `groupCallMap` compat
field goes too. Acceptance: zero references to call surfaces repo-frontend-wide
(`activeCall|CallCircle|fetchRoomFromGroup|StudyGroupCall|groupCallMap|inCall`),
suite green, webpack green. Presence colors collapse to green/yellow/grey.

## 5. Notebook

Remains a stub. No work.

## 6. Replier faces everywhere

`MessengerThreadInfo` carries only `reply_count`, so messenger-fetched messages never
show replier faces (home-feed items do, via the community SDL). New behavior:

- Backend: thread assembly (`assembleMessages`) additionally collects, per parent, up
  to 5 **distinct most-recent replier user_ids**, resolved through the same bulk
  `getUsers` pass (no extra N+1) → `thread_info.most_replied_users: [MessengerUser]`.
  SDL `MessengerThreadInfo` gains the field.
- Frontend: query selections add `thread_info { reply_count most_replied_users { user_id nickname profile_url is_bot } }`
  in `MESSAGE_FIELDS`; `shapeThreadInfo` already maps `most_replied_users` via
  `shapeUser` — verify it flows to `ThreadedMessages` faces (UserAvatar list).

## Acceptance (whole spec)

- Invite as non-operator without the flag → `false`; with `membersCanInvite` → invited.
- Banned user: invisible in rosters, all re-entry paths rejected, unban restores ability.
- Zero `setInterval`/`setTimeout` polling loops in Feed.js and the Study call surfaces.
- No call code remains; UI renders without call affordances.
- A messenger thread with replies shows replier avatars before expansion.
- Backend vitest + frontend jest suites green; live verify on dev for each.
