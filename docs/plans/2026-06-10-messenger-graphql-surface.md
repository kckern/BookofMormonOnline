# messenger* GraphQL Surface + Messaging Cutover — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Make study-group messaging work end-to-end on the green-field backend by building the `messenger*` GraphQL surface the frontend `MessengerController` already calls, plus Bearer-token auth and in-process presence, with near-zero frontend change.

**Architecture:** Thin `messenger*` GraphQL resolvers wrapping the existing `backend/src/messaging/` Kysely services (channels/messages/members/users/reactions/readstate). The SDL is reverse-engineered to match the controller's query selections verbatim. Auth comes from the `Authorization: Bearer <token>` header (the socket already uses the handshake token). Presence works single-instance via an in-memory online set (Redis deferred to multi-instance).

**Tech Stack:** graphql-yoga, Kysely, socket.io (already built), Fastify. No Redis required for launch.

**Source audit:** `docs/audits/2026-06-10-frontend-messaging-integration.md`. Branch: `feature/backend-skeleton`.

**Decisions:** Redis deferred (single instance + in-process presence). SDL matched to `MessengerController` (zero frontend change) EXCEPT the message-ID type alignment in Task 6 (Int-vs-nanoid conflict — the one unavoidable tweak).

## The contract (extracted from MessengerController.js — authoritative)

Queries (snake_case fields, the controller's `_normalize*` consumes these):
- `messengerUser(userId): MessengerUser{user_id,nickname,profile_url,metadata,is_online}`
- `messengerMyChannels(userId): [MessengerChannel]` — full channel incl. `unread_message_count`, `last_message{message_id,message,created_at}`, `members{user_id,nickname,profile_url,role}`
- `messengerChannel(channelUrl): MessengerChannel`
- `messengerChannelOperators(channelUrl): [MessengerUser]` (only `user_id` selected)
- `messengerMessages(channelUrl, limit, before): [MessengerMessage]` — incl. `user{...}`, `link_type/link_target`, `thread_info{reply_count}`, `reactions{reaction_key,user_ids}`
- `messengerMessage(messageId): MessengerMessage`
- `messengerThreadMessages(parentMessageId): [MessengerMessage]`
- `messengerUnreadDMs(userId): [MessengerUnreadDM]{channel_url,other_user_id,unread_count}`

Mutations:
- `messengerCreateChannel(name,customType,description,coverUrl,operatorIds): MessengerChannel`
- `messengerUpdateChannel(channelUrl,name,description): MessengerChannel`
- `messengerUpdateUser(userId,nickname,profileUrl): MessengerUser`
- `messengerUpdateUserMetadata(userId,metadata): Boolean`
- `messengerUpdateMemberRole(channelUrl,userId,role): Boolean`
- `messengerRemoveMember(channelUrl,userId): Boolean`
- `messengerInviteMembers(channelUrl,userIds): Boolean`
- `messengerAcceptInvitation(channelUrl,userId): Boolean`
- `messengerDeclineInvitation(channelUrl,userId): Boolean`

## File map

| File | Responsibility |
|---|---|
| `backend/schema/Messenger.graphql` | the `messenger*` SDL (matches contract) |
| `backend/src/graphql/resolvers/messenger.ts` | the 18 resolvers over messaging services |
| `backend/src/graphql/context.ts` | + Bearer token extraction → `ctx.bearerToken` |
| `backend/src/index.ts` | pass Authorization header into the Yoga context |
| `backend/src/messaging/presence.ts` | in-memory online-set fallback when no Redis |
| `frontend/webapp/src/models/MessengerController.js` | message-ID alignment (Task 6 only) |

---

### Task 1: messenger* SDL + codegen

**Files:** Create `backend/schema/Messenger.graphql`.

- [ ] **Step 1: Write the SDL** matching the contract exactly:

```graphql
extend type Query {
  messengerUser(userId: String): MessengerUser
  messengerMyChannels(userId: String): [MessengerChannel]
  messengerChannel(channelUrl: String): MessengerChannel
  messengerChannelOperators(channelUrl: String): [MessengerUser]
  messengerMessages(channelUrl: String, limit: Int, before: String): [MessengerMessage]
  messengerMessage(messageId: String): MessengerMessage
  messengerThreadMessages(parentMessageId: String): [MessengerMessage]
  messengerUnreadDMs(userId: String): [MessengerUnreadDM]
}
extend type Mutation {
  messengerCreateChannel(name: String, customType: String, description: String, coverUrl: String, operatorIds: [String]): MessengerChannel
  messengerUpdateChannel(channelUrl: String, name: String, description: String): MessengerChannel
  messengerUpdateUser(userId: String, nickname: String, profileUrl: String): MessengerUser
  messengerUpdateUserMetadata(userId: String, metadata: String): Boolean
  messengerUpdateMemberRole(channelUrl: String, userId: String, role: String): Boolean
  messengerRemoveMember(channelUrl: String, userId: String): Boolean
  messengerInviteMembers(channelUrl: String, userIds: [String]): Boolean
  messengerAcceptInvitation(channelUrl: String, userId: String): Boolean
  messengerDeclineInvitation(channelUrl: String, userId: String): Boolean
}
type MessengerUser { user_id: String, nickname: String, profile_url: String, metadata: JSON, is_online: Boolean, is_bot: Boolean, last_seen_at: Float }
type MessengerMember { user_id: String, nickname: String, profile_url: String, role: String, state: String }
type MessengerThreadInfo { reply_count: Int }
type MessengerReaction { reaction_key: String, user_ids: [String] }
type MessengerMessage {
  message_id: String, channel_url: String, user_id: String, user: MessengerUser,
  message_type: String, message: String, custom_type: String,
  link_type: String, link_target: String, parent_message_id: String,
  thread_info: MessengerThreadInfo, reactions: [MessengerReaction],
  created_at: Float, updated_at: Float
}
type MessengerChannel {
  channel_url: String, name: String, cover_url: String, custom_type: String,
  description: String, metadata: JSON, member_count: Int, unread_message_count: Int,
  last_message: MessengerMessage, members: [MessengerMember], created_at: Float, lang: String
}
type MessengerUnreadDM { channel_url: String, other_user_id: String, unread_count: Int }
```

Note: `before` and `messageId`/`parentMessageId` are `String` (nanoid). Task 6 aligns the controller to send them quoted.

- [ ] **Step 2:** `cd backend && npx tsc --noEmit` (schema is loaded at runtime from `backend/schema/*.graphql` — confirm no syntax error by booting: `PORT=5031 npx tsx src/index.ts` then `curl -s localhost:5031/health`; kill 5031). Expected: boots clean (resolvers come next; unimplemented fields resolve null).
- [ ] **Step 3: Commit** `git add backend/schema/Messenger.graphql && git commit -m "feat(messenger): messenger* SDL matching the frontend controller contract"`

### Task 2: Bearer-token in GraphQL context

**Files:** Modify `backend/src/graphql/context.ts`, `backend/src/index.ts`.

- [ ] **Step 1:** In `index.ts`, extract the Authorization header and pass it into the Yoga context alongside `lang`/`ip`:

```ts
const auth = req.headers['authorization'];
const bearerToken = typeof auth === 'string' && auth.startsWith('Bearer ')
  ? auth.slice(7) : undefined;
// ...pass { lang, ip, bearerToken } into yoga.fetch(..., { lang, ip, bearerToken })
```
Widen the Yoga generic: `createYoga<{ lang: string; ip: string; bearerToken?: string }, AppContext>`. In the `context:` callback, pass `bearerToken` to `buildContext`.

- [ ] **Step 2:** In `context.ts`, add `bearerToken?: string` to `AppContext` and the `buildContext(db, lang, ip, bearerToken?)` signature; store it on the context. Add a helper on context or a small `resolveBearerUser(ctx)` the messenger resolvers use: token → `bom_user_token` → `bom_user` → `md5(user)` = messenger user_id (reuse `userByToken` loader + `md5` from `auth/identity.ts`).

- [ ] **Step 3:** `npx tsc --noEmit` clean; boot smoke (health ok). **Commit** `feat(messenger): bearer-token auth in GraphQL context`.

### Task 3: messenger* READ resolvers

**Files:** Create `backend/src/graphql/resolvers/messenger.ts`; Modify `backend/src/graphql/resolvers.ts` (merge) + register.

- [ ] **Step 1:** Stub `export const messengerResolvers: Resolvers = {}` and wire it into `mergeResolverMaps(...)` in `resolvers.ts` (same pattern as `communityResolvers`). `tsc` clean.
- [ ] **Step 2:** Implement the 8 queries, each mapping to a service and returning the snake_case DTO directly (the DTOs already match the SDL field names):
  - `messengerUser` → `users.getUser(db, userId)`
  - `messengerMyChannels` → `channels.getMyChannels(db, userId)` (DTO already has unread/last_message/members)
  - `messengerChannel` → `channels.getChannel(db, channelUrl, viewerUserId)` (viewer from bearer for unread)
  - `messengerChannelOperators` → `members.getChannelMembers(db, channelUrl)` filtered role==='operator', mapped to `{user_id}`
  - `messengerMessages(channelUrl, limit, before)` → `messages.getMessages(db, channelUrl, {limit, before})`
  - `messengerMessage(messageId)` → `messages.getMessage(db, messageId)` (read the export; may be `getMessage(db, channelUrl, messageId)` — adapt: add a `getMessageById(db, messageId)` to messages.ts if needed, or query inline)
  - `messengerThreadMessages(parentMessageId)` → `messages.getThread(db, parentMessageId)`
  - `messengerUnreadDMs(userId)` → channels.getMyChannels filtered `custom_type==='DM'`, map `{channel_url, other_user_id (the non-self member), unread_count}`
  Add a `MessengerMessage.user` field resolver if the DTO's `user` isn't pre-populated (it is — `MessageDTO.user`). Map `MessageDTO.reactions` `{key,user_ids}` → `{reaction_key,user_ids}` (rename `key`→`reaction_key`) via a `MessengerReaction` field resolver or in-resolver map.
- [ ] **Step 3:** Boot `PORT=5031`; curl `messengerUser`/`messengerMyChannels`/`messengerMessages` with a Bearer token (probe a real `bom_user_token`); confirm shapes match the SDL. Reads work under the read-only DB. Kill 5031.
- [ ] **Step 4: Commit** `feat(messenger): read resolvers (user/channels/messages/threads/unreadDMs)`.

### Task 4: messenger* MUTATION resolvers

**Files:** Modify `backend/src/graphql/resolvers/messenger.ts`.

- [ ] **Step 1:** Implement the 9 mutations over the services, auth'd via `resolveBearerUser(ctx)`, returning the SDL shapes; writes go through the services (suppressed under the read-only dev DB → return null/false cleanly, never throw):
  - `messengerCreateChannel` → `channels.createChannel(db, {name, customType, description, coverUrl, operatorIds})`
  - `messengerUpdateChannel` → name/description update (+`updateChannelMetadata` if needed)
  - `messengerUpdateUser` → `users.updateUserNickname`+`updateUserProfileUrl`
  - `messengerUpdateUserMetadata` → `users.updateUserMetadata(db, userId, JSON.parse(metadata))`
  - `messengerUpdateMemberRole` → members role update (inline Kysely if no service export)
  - `messengerRemoveMember` → `members.removeUserFromChannel`
  - `messengerInviteMembers` → `members.addUserToChannel(..., state:'invited')` per id
  - `messengerAcceptInvitation`/`messengerDeclineInvitation` → members state transition (joined / remove)
  Emit RealtimeBus events where the legacy did (`membership_changed`/`user_joined` on invite-accept/role/remove) via `getBus()`.
- [ ] **Step 2:** Boot smoke; mutations under read-only DB return clean false/null (no crash). `tsc` clean.
- [ ] **Step 3: Commit** `feat(messenger): mutation resolvers (channel/user/member ops) with bus fan-out`.

### Task 5: in-process presence fallback (no Redis)

**Files:** Modify `backend/src/messaging/presence.ts`.

- [ ] **Step 1: Write the failing test** in `backend/test/messaging/presence.test.ts`: with no `REDIS_URL`, `setOnline('u1')` then `isOnline('u1')` → **true** (currently false), `setOffline('u1')` → false.
- [ ] **Step 2:** Run it → fails (current no-redis returns false).
- [ ] **Step 3:** Add a module-level `Set<string>` used when `getRedis()` is null: `setOnline` adds, `setOffline` deletes (+ DB last_seen write), `isOnline` checks the set, `onlineUserIds` returns `[...set]`. Redis path unchanged.
- [ ] **Step 4:** Run the test → pass; full `npx vitest run test/messaging/` green.
- [ ] **Step 5: Commit** `feat(messaging): in-process presence fallback for single-instance (no Redis)`.

### Task 6: frontend message-ID alignment + cutover verification

**Files:** Modify `frontend/webapp/src/models/MessengerController.js` (message-ID quoting only).

- [ ] **Step 1:** The controller sends `before: ${id}` and `messengerMessage(messageId: ${id})` / `messengerThreadMessages(parentMessageId: ${id})` **unquoted** (assumes Int). Message IDs are nanoid **strings**. Quote them: `before: "${id}"`, `messageId: "${id}"`, `parentMessageId: "${id}"`. Grep the file for `messageId:`/`parentMessageId:`/`before:` and add quotes. This is the ONLY frontend code change (the Int-vs-string-id reality the audit flagged).
- [ ] **Step 2:** Verify the `_normalize*` functions consume the SDL shapes correctly — read `_normalizeChannel/_normalizeMessage/_normalizeUser`; confirm field names (`channel_url`, `user_id`, `created_at`, `thread_info.reply_count`, `reactions[].reaction_key`/`user_ids`, `last_message`). If any mismatch, fix the SDL/resolver to match the controller (backend side preferred — keep frontend minimal).
- [ ] **Step 3: Cutover wiring (doc + verify, no deploy):** confirm `MessengerController` connects to `window.location.origin` (socket `/messenger`) and `POST /graphql` (relative) — so serving/proxying the app at the green-field origin needs the proxy to route `/messenger` WS upgrades + `/graphql` to the backend. Add a note to `frontend/webapp/src/setupProxy.js` proxy list (`/messenger`, `/graphql`) if running the CRA dev server against the green-field backend. Document in `docs/reference/messaging-platform.md` under a "Frontend cutover" section.
- [ ] **Step 4: Commit** `fix(messenger): quote string message IDs; document frontend cutover wiring`.

### Task 7: end-to-end manual smoke (writable DB)

- [ ] Against a backend pointed at a **writable** DB (`MESSAGING_WRITE_TESTS` infra / `bom_app` creds) + `MESSENGER_ENABLED` on: run the green-field backend, point a browser (or the integration suite with `MESSAGING_WRITE_TESTS=1`) at it, and verify the study-group flow: load my channels (`messengerMyChannels`), open a channel (`messengerChannel`+`messengerMessages`), send a message (socket `send_message` → `message_received` to both clients), thread reply, reaction, typing, invite a member (`messengerInviteMembers` → `membership_changed`). Record results.
- [ ] If green: update `docs/reference/backend-graphql-surface.md` (add the `messenger*` surface) and `docs/reference/messaging-platform.md` (mark frontend-integrated). Commit.

---

## Acceptance criteria
1. `npx tsc --noEmit` clean; `npx vitest run test/messaging/` green (incl. the new presence test).
2. All 18 `messenger*` ops resolve with shapes matching the controller's selections; reads verified live under the read-only DB.
3. Bearer-token auth resolves the acting messenger user.
4. Single-instance presence reports real online status with no Redis.
5. Frontend change limited to message-ID quoting; `_normalize*` consume the shapes unchanged.
6. (Writable DB) the end-to-end study-group chat flow works: list/open/send/thread/react/typing/invite.

## Notes
- Redis stays the documented multi-instance scale path (set `REDIS_URL`) — no code change needed to enable.
- Writes (create channel, invite, roles) only exercise against a writable DB — same constraint as the rest of the messaging build; resolvers must fail clean under `reader`.
- Keep the legacy `homefeed`/`homegroups` community resolvers — Home/Feed still use them.
