# Frontend Messaging Integration Audit — Sendbird → green-field backend

**Date:** 2026-06-10
**Question:** What must change in the frontend (which previously used the Sendbird JS SDK)
to integrate fully with the green-field messaging backend, keeping interfaces stable to
minimize code churn?

## Headline

**The Sendbird SDK is already gone from the frontend** — `@sendbird/*` is imported
nowhere; `package.json` has no Sendbird/WebRTC/Calls dependency. A prior migration
replaced it with `src/models/MessengerController.js` (socket.io-client + GraphQL),
assigned to `appController.sendbird` (the variable name was kept to avoid touching
consumers). It exposes a **`.sb` compatibility shim** mimicking the Sendbird SDK shape
(`.sb.currentUser`, `.sb.groupChannel.getChannel`, `message._sender`, `metaData`) so the
~12 Study/* components compile unchanged.

**So the integration work is overwhelmingly BACKEND, not frontend.** The one real blocker:
the controller and the green-field backend speak **non-overlapping GraphQL surfaces**.

## The core mismatch

| Layer | Frontend `MessengerController` expects | Green-field backend serves | Status |
|---|---|---|---|
| **Socket.io** | path `/messenger`, auth `{userId: md5, token}`, events `message_received/updated/deleted`, `typing`, `reaction_changed`, `membership_changed`, `user_joined/left`, `unread_count_changed`, `channel_action`, `user_state`; emits `send_message`/`edit`/`delete`/`add_reaction`/`remove_reaction`/`typing_start|stop`/`mark_read`/`fire_action`/`update_state` | **Exactly these** (built P2/P5 to this contract) | ✅ **MATCH** |
| **GraphQL data** | a `messenger*` namespace (16 ops, below) at `POST /graphql`, `Authorization: Bearer <token>` | the legacy Sendbird-shaped `homefeed`/`homegroups`/`homethread`/`join*`/`bot*` (built P3) | ❌ **NO OVERLAP** |
| **Auth into GraphQL** | `Authorization: Bearer <token>` **header** | community resolvers read a **`token` arg** (legacy style); context extracts only `lang`+`ip`, not the Authorization header | ❌ **MISMATCH** |

The green-field P3 community resolvers (`homefeed`/`homegroups`/`homethread`/
`loadGroupsFromHash`/`requestedUsers`) were built against the **legacy** parked surface —
which is correct for a different, still-live consumer set (see below) — but the **active
real-time chat controller wants a `messenger*` surface that exists on no backend.**

## Two distinct frontend consumers (both legitimate)

1. **Social "home feed" views** — `views/Home/Home.js` (`homegroups`), `Home/Feed.js`
   (`homefeed`, `homethread`), `User/Invitation.js` (`loadGroupsFromHash`) — call the
   **legacy surface via `BoMOnlineAPI`** (`GraphQLQueries.js`). ✅ Already matched by the
   green-field P3 resolvers. **No change needed.**
2. **Real-time study-group chat** — the `Study/*` components + `appController` (20 refs) →
   `appController.sendbird` = `MessengerController` → the **`messenger*` GraphQL API +
   socket.io + `.sb` shim**. ❌ The `messenger*` data surface is unbuilt.

DMs are `custom_type:'DM'` channels via the shim — covered by the existing messaging
services. **`StudyGroupCall` is deprecated and not returning — out of scope; ignore it**
(any `startCall`/`activeCall` call-coordination paths can be left to rot or stripped
later, they don't gate messaging). The real-time **study-group chat itself must work.**

## The `messenger*` GraphQL contract to build (the gap = the build spec)

`MessengerController` issues these (POST `/graphql`, Bearer auth). All map directly onto
the green-field Kysely services already built in `backend/src/messaging/`
(channels/messages/members/users/reactions/readstate) — which already return the right
snake_case DTOs the controller's `_normalize*` functions consume. This is a thin GraphQL
wrapper, not new logic.

| Operation | Kind | Backs onto (existing service) |
|---|---|---|
| `messengerUser(... )` | query | `users.getUser` |
| `messengerMyChannels(userId)` | query | `channels.getMyChannels` |
| `messengerChannel(channelUrl)` | query | `channels.getChannel` |
| `messengerChannelOperators(channelUrl)` | query | `members.getChannelMembers` (role=operator) |
| `messengerMessages(channelUrl, limit, before?)` | query | `messages.getMessages` |
| `messengerMessage(messageId)` | query | `messages.getMessage` |
| `messengerThreadMessages(parentMessageId)` | query | `messages.getThread` |
| `messengerUnreadDMs(userId)` | query | `readstate.getUnreadCount` over DM channels |
| `messengerCreateChannel(...)` | mutation | `channels.createChannel` |
| `messengerUpdateChannel(...)` | mutation | `channels.updateChannelMetadata` + name/desc |
| `messengerUpdateMemberRole(...)` | mutation | `members` role update |
| `messengerRemoveMember(...)` | mutation | `members.removeUserFromChannel` |
| `messengerInviteMembers(...)` | mutation | `members.addUserToChannel` (state=invited) |
| `messengerAcceptInvitation(...)` / `messengerDeclineInvitation(...)` | mutation | `members` state transition |
| `messengerUpdateUser(...)` / `messengerUpdateUserMetadata(...)` | mutation | `users.updateUser*`/`updateUserMetadata` |

Exact field selections per op are in `MessengerController.js` (each `gqlRequest` query
string) — they are the authoritative SDL spec. Note message ops use **numeric**
`messageId` in some queries (`messengerMessage(messageId: ${id})`) while the DB uses
nanoid strings — verify/normalize the ID type when defining the SDL.

## Recommendation — keep the frontend interface; build the surface on the backend

**Option A (recommended): build the `messenger*` GraphQL surface on the green-field
backend.** Keeps `MessengerController` and all Study/* consumers **100% unchanged** (its
public methods + `.sb` shim are the app's stable interface). Work:
- New `backend/schema/Messenger.graphql` (the `messenger*` SDL, reverse-engineered from
  the controller's query strings) + `backend/src/graphql/resolvers/messenger.ts` wrapping
  the existing messaging services. Mechanical — the services + DTOs already exist.
- **Auth fix:** extend the green-field GraphQL context to read `Authorization: Bearer
  <token>` (today it derives only `lang`/`ip`); the `messenger*` resolvers resolve the
  acting user from that token (same `userByToken` path the socket handshake uses).
- This *also* gives the green-field backend a cleaner messaging API than the legacy
  `homefeed` soup — worth having regardless.

Option B (rewrite the controller to call `homefeed`/`homegroups`/…) is worse: it churns
the frontend, and the legacy surface is a poorer fit for real-time chat.

## Minimal frontend changes (Option A)

1. **Endpoint/origin:** `MessengerController` already uses `window.location.origin` for the
   socket and a relative `POST /graphql` — so when the app is served by / proxied to the
   green-field backend (:5006), it connects with no code change. Confirm the deploy/proxy
   points the messaging origin at the green-field server (and that `setupProxy.js`/CDN
   route `/messenger` WebSocket upgrades + `/graphql` to :5006).
2. **Response-shape verification:** confirm each `messenger*` response matches what
   `_normalizeChannel/_normalizeMessage/_normalizeUser` expect (snake_case fields,
   `thread_info{reply_count}`, `members{user_id,nickname,profile_url,role}`). Build the SDL
   to those shapes and there is **zero** controller change.
3. That's it for the happy path — no component edits, no `.sb`-shim changes.

## Risks / open items

- **Auth header vs arg** (above) — must be handled or `messenger*` resolvers can't identify
  the user. Highest-priority backend change.
- **`/graphql` language path:** the green-field resolves lang from the URL's last segment;
  `POST /graphql` yields lang `"graphql"` → en fallback. Fine for messaging (English UI
  strings), but confirm no ko chat-label expectation.
- **Message ID type** (numeric in some controller queries vs nanoid strings) — pin in SDL.
- **`messengerCreateChannel`/invitations/roles** are writes — exercised only against a
  writable DB (the dev `reader` user suppresses them), same constraint as the rest of the
  messaging build.
- **Group calls — deprecated, out of scope.** `StudyGroupCall` is not returning; no work,
  no media subsystem. Study-group **chat** (channels/messages/presence/threads/reactions/
  invitations/roles) is the in-scope target and must work end to end.
- The legacy `homefeed`/`homegroups` surface stays needed for Home/Feed — keep both the P3
  community resolvers AND the new `messenger*` resolvers.

## Bottom line

Rip-and-replace is **already 80% done** (no SDK; socket layer matches; shim + normalize
layer in place). The remaining work is one **backend** slice — the `messenger*` GraphQL
surface (16 thin resolvers over existing services) plus a Bearer-token context fix — after
which the frontend integrates with **near-zero code changes**. Next step: spec + plan that
`messenger*` slice (it parallels the P3 community work, reusing the same services).
