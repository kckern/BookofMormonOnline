# Chat, Comments & Study Groups — Blast Radius and Surface

**Repository:** BookofMormonOnline (dev tip `a0241c7`)
**Purpose:** Reference for an in-house replacement of Sendbird. Catalogs every file, operation, table, socket event, env var, and external dep in the chat / comment / study-group surface.
**Last verified:** 2026-05-08.

> **Headline finding.** Sendbird's SDK and library files have been physically removed (Aug–Dec 2025). An in-house messenger backend (Socket.io + GraphQL + 7 new MySQL tables) was added on the `chat` branch and merged into `dev`. Study-group resolvers are wired but **disabled** by a hardcoded flag (`MESSENGER_ENABLED = false`, `src/resolvers/BomCommunity.ts:12`) — comment in source: *"sendbird gutted, awaiting Redis replacement."* The migration is ~60% done; the remaining work is data migration, push notifications, search, and flipping the flag.

---

## 1. Sendbird timeline

Walked from `git log --all -S 'sendbird' -i` and `git log --all -- '**/*sendbird*'`.

| Date | Commit | Message | Effect |
|---|---|---|---|
| 2024-08-14 | `3944fe7` | Update sendbird.js | Last SDK update while still in use |
| 2025-08-24 | `cebd51b` | Migrate library and API files to TypeScript | `src/library/sendbird.js` → `.ts` |
| 2025-08-24 | `2853b57` | Remove legacy scripture and Sendbird modules | **Deleted** `src/library/sendbird.{ts,js}` and tests |
| 2025-12-21 | `614b13d` | Integrate custom Messenger backend and add socket support | **Replacement milestone**: introduced `MessengerController.js`, `src/socket.ts`, 7 messenger DB tables, `BomMessenger.ts`, `src/library/messenger.ts` |
| 2026-01-08 | `10ebf2e` | Refactor messaging system and update Docker build | Refined messaging + Docker integration |
| 2026-01-13 | `74d5491` | Merge branch 'chat' - Backend Modernization | Brought `chat` branch into `dev` |

**Branches.** `origin/chat` is the source of the in-house messenger; its tip (`74f5dbd`, 2026-01-18) does **not** contain Sendbird code. No other branch in `git branch -a` carries unmerged Sendbird logic.

**Current state of the word "sendbird" in the tree.** ~200+ matches, all of them in:
- comments explaining removal (e.g. `BomCommunity.ts:5` *"messenger import removed - sendbird gutted, awaiting Redis replacement"*),
- a no-op stub object `const sendbird: any = { … }` (`BomCommunity.ts:15-41`, `src/api/studybuddy.ts:1-7`, `src/api/virtualgroup.ts:1-7`) that returns empty arrays/nulls,
- type/identifier names (`sbuser`, `sb_id`) that survived the rename.
- `.env` template still lists `SENDBIRD_APPID` and `SENDBIRD_TOKEN` — neither is read by any current code path.

**No outbound API calls.** `grep -r 'sendbird.com\|sendbirdchat'` against `src/` and `frontend/webapp/src/` returns zero hits. The SDK npm package is **not** in either `package.json`.

---

## 2. In-house messenger code (current state on dev)

### 2.1 Service library — `src/library/messenger.ts` (819 lines)

`Messenger` class extends `EventEmitter`; emits events that `src/socket.ts` bridges to clients.

#### Users (8 methods)
| Method | DB target | Notes |
|---|---|---|
| `getUser(userId)` | `MessengerUser` | Single user by id |
| `getUsers(userIds[])` | `MessengerUser` (`WHERE user_id IN`) | Batch |
| `upsertUser(userId, data)` | `MessengerUser` upsert | nickname, profile_url, metadata, bot flag |
| `updateUserNickname(userId, nickname)` | `MessengerUser` | |
| `updateUserProfileUrl(userId, profileUrl)` | `MessengerUser` | |
| `updateUserMetadata(userId, metadata)` | `MessengerUser` | Arbitrary JSON metadata |
| `getUserMetadata(userId)` | `MessengerUser` | |
| `setUserOnline(userId, isOnline)` | `MessengerUser` | sets `is_online`, `last_seen_at` |

#### Channels (6 methods)
| Method | DB target | Notes |
|---|---|---|
| `getChannel(channelUrl)` | `MessengerChannel` + `MessengerMember` | With member list and message count |
| `getMyChannels(userId, opts)` | `MessengerChannel` (member predicate) | Filter by `customType` and `lang` |
| `getPublicChannels(opts)` | `MessengerChannel WHERE custom_type='public'` | |
| `createChannel(input)` | `MessengerChannel` + `MessengerMember` | Initial members + operators |
| `updateChannelMetadata(channelUrl, metadata)` | `MessengerChannel` | |
| `addUserToChannel(channelUrl, userId, role)` | `MessengerMember` | role = `operator` or `member` |

#### Messages (8 methods)
| Method | DB target | Notes |
|---|---|---|
| `postMessage(input)` | `MessengerMessage` + `MessengerHighlight` | Optional thread parent, links, scripture highlights |
| `getMessage(channelUrl, messageId)` | `MessengerMessage` + reactions | |
| `getMessages(channelUrl, opts)` | `MessengerMessage` paginated | `before` + `limit` |
| `getThread(parentMessageId)` | `MessengerMessage WHERE parent_message_id=` | Replies of a message |
| `updateMessage(channelUrl, messageId, data)` | `MessengerMessage` | Edit text/customType/links/highlights |
| `deleteMessage(channelUrl, messageId)` | `MessengerMessage.is_deleted=1` | Soft delete |
| `markAsRead(channelUrl, userId)` | `MessengerMember.last_read_at` | |
| `markChannelAsRead(channelUrl, userId)` | `MessengerMember.last_read_at` | Duplicate of `markAsRead` (probable consolidation candidate) |

#### Reactions (2 methods)
| Method | DB target |
|---|---|
| `addReaction(messageId, userId, reactionKey)` | `MessengerReaction` upsert |
| `removeReaction(messageId, userId, reactionKey)` | `MessengerReaction` delete |

#### Utility (4 methods)
`listBotUsers(lang)`, `removeUserFromChannel(channelUrl, userId)`, `getChannelMembers(channelUrl)`, `getUnreadCount(channelUrl, userId)`.

### 2.2 GraphQL resolver — `src/resolvers/BomMessenger.ts` (323 lines)

11 queries + 15 mutations, all thin delegations to `messenger.*`:

**Queries** — `messengerUser`, `messengerUsers`, `messengerBots`, `messengerChannel`, `messengerMyChannels`, `messengerPublicChannels`, `messengerMembers`, `messengerMessages`, `messengerMessage`, `messengerThread`, `messengerUnreadCount`.

**Mutations** — `messengerUpsertUser`, `messengerUpdateNickname`, `messengerUpdateProfileUrl`, `messengerUpdateUserMetadata`, `messengerSetOnline`, `messengerCreateChannel`, `messengerAddMember`, `messengerRemoveMember`, `messengerPostMessage`, `messengerUpdateMessage`, `messengerDeleteMessage`, `messengerAddReaction`, `messengerRemoveReaction`, `messengerMarkAsRead`.

(Per-op file:line in agent inventory at `/tmp/chat_inventory.md` companion notes; this surface is regular enough that the file is short to scan directly.)

### 2.3 Socket.io server — `src/socket.ts` (535 lines)

Auth: token verified against `BomUserToken` table on connect. User auto-joins their channel rooms on connect.

#### Client → Server events
| Event | Payload | Effect |
|---|---|---|
| `send_message` | `{channelUrl, message, customType?, link?, highlights?, parentMessageId?}` | Persist via `messenger.postMessage`, emit `message_received` to room |
| `mark_read` | `channelUrl` or `{channelUrl}` | Update `last_read_at`, emit `read_receipt` |
| `typing_start` / `typing_stop` | `{channelUrl}` | Broadcast `typing` |
| `update_state` | `{activeGroup?, activeCall?}` | Sync user UI state to other group members |
| `fire_action` | `{channelUrl, action}` | Sync custom action (page nav, scroll) across study group |
| `join_channel` / `leave_channel` | `channelUrl` | Subscribe/unsubscribe socket from room |
| `add_reaction` / `remove_reaction` | `{messageId, channelUrl, reactionKey}` | Persist + ack |
| `edit_message` | `{channelUrl, messageId, message?, customType?, data?}` | Persist + ack |
| `delete_message` | `{channelUrl, messageId}` | Persist + ack |

#### Server → Client events (bridged from `Messenger` event emitter)
`message_received`, `message_updated`, `message_deleted`, `member_joined`, `member_left`, `reaction_added`, `reaction_removed`, `user_presence`, `typing`, `read_receipt`, `user_state`, `channel_action`.

#### Adapter
Imports `@socket.io/redis-adapter` — Redis is the multi-instance fanout layer. Single-process mode falls back gracefully but won't scale horizontally without it.

### 2.4 Database tables

7 tables, created in migration `src/database/migrations/20251221000000-create-messenger-tables.js` (211 lines), shipped with commit `614b13d`.

| Table | Model file | PK | Key columns |
|---|---|---|---|
| `messenger_users` | `messenger_users.ts` | `user_id` (MD5 hash) | `bom_user_id` (FK), `is_online`, `last_seen_at`, `metadata` |
| `messenger_channels` | `messenger_channels.ts` | `channel_url` | `custom_type` ENUM(private,public,open,solo,DM), `lang`, `metadata` |
| `messenger_members` | `messenger_members.ts` | (`channel_url`, `user_id`) | `role` ENUM(operator,member), `state` ENUM(joined,invited,requested), `last_read_at`, `is_muted` |
| `messenger_messages` | `messenger_messages.ts` | `message_id` (nanoid) | `channel_url`, `user_id`, `parent_message_id` (threads), `message_type` ENUM(MESG,FILE,ADMN), `is_deleted` |
| `messenger_reactions` | `messenger_reactions.ts` | (`message_id`, `user_id`, `reaction_key`) | composite PK |
| `messenger_highlights` | `messenger_highlights.ts` | `id` (nanoid) | `message_id`, `ordinal`, `text` (scripture highlights inside a message) |
| `messenger_files` | `messenger_files.ts` | `file_id` (nanoid) | `message_id`, `file_url`, `file_type`, `file_size` (no S3 wiring observed yet) |

---

## 3. Study groups

### 3.1 Backend resolvers — `src/resolvers/BomCommunity.ts` (~926 lines)

**Critical state:** `const MESSENGER_ENABLED = false;` at line 12, with comment *"Hardcoded off - sendbird gutted, awaiting Redis replacement"*. While `false`, every resolver listed below either calls the no-op stub at `BomCommunity.ts:15-41` (returns empty arrays/nulls) or short-circuits.

#### Queries (8)
| Operation | File:line | Sendbird-stub dependency? | Effect today |
|---|---|---|---|
| `botlist` | 110-128 | Yes (`sendbird.listBotUsers`) | Empty list |
| `leaderboard` | 132-219 | Yes (`sendbird.listUsers`, `getMembersofPrivateGroups`) | Top users by progress without group enrichment |
| `loadGroupsFromHash` | 220-229 | Yes (`sendbird.loadChannel`) | Returns null |
| `studygrouphistory` | 231-277 | No (DB only) | Works |
| `homegroups` | 279-313 | Yes (`getMyGroups`, `getOthersGroups`, `getVirtualUsers`) | Empty groups |
| `postcomments` | 314-316 | No (stub returning `[]`) | Works |
| `homethread` | 320-354 | Yes (`getGroup`, `getThread`, `getMembers`) | Empty |
| `homefeed` | 355-462 | Yes; **explicitly disabled** when `MESSENGER_ENABLED=false` | Minimal placeholder response |

#### Mutations (7)
| Operation | File:line | Effect when re-enabled |
|---|---|---|
| `addBot` | 544-560 | Add bot user to channel (admin-gated) |
| `removeBot` | 561-576 | Remove bot from channel (admin-gated) |
| `joinGroup` | 577-607 | Join group via short-link hash |
| `joinOpenGroup` | 608-634 | Join open-enrollment group |
| `requestToJoinGroup` | 635-661 | Request access to private group |
| `withdrawRequest` | 662-688 | Cancel pending join request |
| `processRequest` | 690-720 | Admin approves/denies a join request |

### 3.2 API-layer modules

- **`src/api/virtualgroup.ts`** (~473 lines) — auto-generated study groups for specific scriptures; same `MESSENGER_ENABLED` stub pattern (line 1-7).
- **`src/api/studybuddy.ts`** (~851 lines) — AI study assistant that posts into group threads (`messenger.postMessage`, `getThread`, `startStopTypingIndicator`); same flag pattern.

### 3.3 Frontend study-group views — `frontend/webapp/src/views/_Common/Study/`

| Component | Role | Key wire-up |
|---|---|---|
| `Study.js` | Sidebar + feed + member list shell | Reads `appController.states.studyGroup` |
| `StudyGroupBar.js` | Group header (name, member count, settings) | `messengerChannel` query |
| `StudyGroupSelect.js` | Group switcher | `messengerMyChannels` + `membership_changed` socket |
| `StudyGroupAdmin.js` | Invite, manage members | `messengerAddMember`, `messengerRemoveMember` mutations |
| `StudyChat.js` | Message input, thread view, typing, reactions | `messengerMessages` / `messengerThread` queries; subscribes to `message_received`, `typing`, `reaction_changed` |
| `StudyGroupProgress.js` | Member reading-progress chart | Custom REST (not on socket) |
| `StudyGroupCall.js` | Voice/video (separate from messenger; Jitsi-style) | Custom call events |
| `StudyGroupNotebook.js` | Shared notepad | Custom notebook REST |
| `StudyHall.js` | Group landing page / featured groups | `homegroups`, `leaderboard` |

Routes are guarded by `process.env.REACT_APP_USE_MESSENGER === 'true'` (`Routes.js:6`). Currently disabled in default config.

### 3.4 Redux state in `frontend/webapp/src/models/appController.js` (~2000 lines)

| Slice | Shape | Touched by |
|---|---|---|
| `states.studyGroup` | `{ activeGroup, activeCall, members[], notifications, typingLocations }` | Study.js, StudyGroupBar.js, StudyChat.js |
| `states.messenger` | `{ channels, currentChannel, messages, unreadCounts, typingUsers }` | MessengerController, Study.js |
| `functions.markPopUpComments` | `(bool) => void` | Triggered when group message arrives |
| `functions.fireStudyGroupAction` | `(action) => void` | Cross-member nav/scroll sync |

---

## 4. Comments / passage notes / community feedback

There is **no separate comments thread system**. What the user thinks of as "comments" is two distinct things:

### 4.1 Server-aggregated commentary (read-only) — `src/resolvers/BomNotes.ts`

Operation `passagenotes(verse_ids)` returns a `PassageNotes` aggregate with `commentary[]`, `sources[]`, `chiasmus[]`, `people[]`, `places[]`, `images[]`, `notes[]`, `fax[]`, `mapstory[]`, `refs[]`. Pure read-only joins over:

| Table | Purpose |
|---|---|
| `bom_xtras_commentary` | Published commentary + user-contributed notes (`is_note=1`) |
| `bom_xtras_source` | Bibliography |
| `bom_xtras_chiasmus` | Chiastic structures |
| `bom_xtras_image` | Illustration metadata |
| `bom_xtras_fax` | Facsimile references |
| `bom_xtras_history` | Historical documents |
| `bom_map_story` | Journey narratives |

This area does **not** depend on the messenger or sockets. Already self-hosted; no migration work.

### 4.2 Threaded discussion on a passage

Implemented as a regular message thread inside a group channel — `messenger_messages.parent_message_id` is the thread anchor. The flow is `homethread(channel, message)` (BomCommunity) → `messengerThread(parentMessageId)` (BomMessenger). It rides on the messenger surface, not a separate "comments" surface.

---

## 5. Frontend surface

### 5.1 Messenger client — `frontend/webapp/src/models/MessengerController.js` (1228 lines)

Drop-in replacement for the deleted `SendbirdController.js` (deleted in `614b13d`). Maintains the same window `CustomEvent` interface so unmodified consumers keep working.

**Constructor:** `new MessengerController(serverUrl, userId, token, appController)`.

**State:** `socket` (Socket.io client), `channels` (Map<url, ChannelDTO>), `_currentUser`, `groupCallMap`.

**Public surface (~50 methods)** — `connect`, `loadChannels`, `loadChannel`, `postMessage`, `replyToMessage`, `updateMessage`, `deleteMessage`, `loadUnreadDMs`, `loadGroupMembers`, `addUserToGroup`, `removeUserFromGroup`, `markAsRead`, `startTyping`/`endTyping`, plus 30+ more.

**Inbound socket events handled:** `message_received`, `message_updated`, `message_deleted`, `typing`, `reaction_changed`, `channel_action`, `membership_changed`, `user_joined`, `user_left`, `unread_count_changed` — each re-dispatched as a `window` `CustomEvent` for the views.

### 5.2 Routes touching this surface

Behind `REACT_APP_USE_MESSENGER`:
- `/home`, `/home/:channelId`, `/home/:channelId/:messageId`
- `/groups`
- `/group/:channelId`, `/group/:channelId/:leaderboard`

Plus `/messages` (DM inbox) and `/invite/:hash` (invite flow) — verify in `Routes.js`.

---

## 6. External dependencies

### 6.1 npm

**Backend (`package.json`)**
```
"socket.io": "^4.8.1"
"@socket.io/redis-adapter": "^8.3.0"
"@types/socket.io": "^3.0.1"
"socket.io-client": "^4.8.1"   // for internal use
"redis": "^4.6.13"
```

**Frontend (`frontend/webapp/package.json`)**
```
"socket.io-client": "^4.8.1"
```

**Sendbird npm packages: none.** Confirmed absent in both manifests.

### 6.2 Environment variables

| Var | Read by | Status |
|---|---|---|
| `REDIS_URL` | `src/socket.ts` | Required for multi-instance fanout |
| `MESSENGER_BOT_TOKEN` | `src/socket.ts` | Special bot auth path |
| `CORS_ORIGIN` | `src/socket.ts` | Defaults to `*` |
| `MESSENGER_ENABLED` | **Not currently read** — flag is hardcoded `false` in `BomCommunity.ts:12` | **Make this an env var** as part of re-enable |
| `REACT_APP_USE_MESSENGER` | `frontend/webapp/src/models/Routes.js:6` | Frontend route guard |
| `SENDBIRD_APPID`, `SENDBIRD_TOKEN` | Nothing | Dead in `.env` template; safe to delete |

### 6.3 Outbound HTTP

No outbound calls to `sendbird.com` or `sendbirdchat.com` anywhere in `src/` or `frontend/webapp/src/`. Only outbound chat-related call is `getclicky.com` (analytics, unrelated) and the messenger backend's own Socket.io transport.

---

## 7. Database — full picture

### 7.1 Messenger tables (7) — see §2.4 above

### 7.2 Group/social adjuncts

| Table | Model | Role |
|---|---|---|
| `bom_user_social` | `BomUserSocial` | Public social profile (nickname, picture, visibility) — pre-dates messenger |
| `bom_shortlinks` | `BomShortlinks` | Short-link hash → channel URL (group invite links) |

### 7.3 Notes (already-self-hosted; not on migration path)

`bom_xtras_commentary`, `bom_xtras_source`, `bom_xtras_chiasmus`, `bom_xtras_image`, `bom_xtras_fax`, `bom_xtras_history`, `bom_map_story` (per §4.1).

---

## 8. In-house replacement — surface area summary

### Already implemented
- Channel CRUD (private/public/open/solo/DM) — `messenger_channels`
- Member CRUD with operator/member roles — `messenger_members`
- Message CRUD with soft-delete — `messenger_messages`
- Threading (parent_message_id) — `messenger_messages`
- Reactions (composite PK) — `messenger_reactions`
- Read receipts — `messenger_members.last_read_at`
- User profiles + metadata — `messenger_users`
- Typing indicators — ephemeral via socket events
- Scripture highlights inside a message — `messenger_highlights`
- Real-time fanout — Socket.io with Redis adapter
- Channel search (mine + public) — `getMyChannels`, `getPublicChannels`
- Unread counts — `getUnreadCount`

### Partially implemented
- File attachments — `messenger_files` table exists, but no S3 (or other) storage integration is wired in. Posting a file currently has no upload path.
- Presence — `setUserOnline` flips a flag but there's no heartbeat or activity-driven update; clients only learn presence on join/leave events.

### Not implemented
- **Push notifications** (Sendbird offered this; we don't yet)
- **Message search** — no FULLTEXT index on `messenger_messages.message`, no resolver
- **Admin broadcasts** — `message_type=ADMN` ENUM exists but no path to author one
- **Message history export**
- **Data migration tools** — no Sendbird-export reader, no group/message recovery script

### Already self-hosted (no work)
- Commentary / passage notes (`bom_xtras_*`)
- Leaderboard scoring (DB-only in current `leaderboard` resolver)
- Scripture content

### Risks & open questions
1. **Sendbird account access.** If the org's Sendbird account is closed, group memberships and message history are unrecoverable. Plan should assume worst case.
2. **Hardcoded flag.** `MESSENGER_ENABLED = false` in `BomCommunity.ts:12` should become `process.env.MESSENGER_ENABLED !== 'false'` so flipping it doesn't require a code change. Also, a hardcoded false at the resolver level is silent — callers see empty results, no error. Add a one-line warning log or 5xx on key paths.
3. **Redis dependency.** Single-instance dev works without it; multi-instance prod won't share state without it. Document the requirement.
4. **Stub leakage.** The `const sendbird: any = { … }` shim in `BomCommunity.ts`, `studybuddy.ts`, `virtualgroup.ts` masks real bugs by returning empty arrays. After flipping the flag, delete the stubs and let TypeScript surface the actual gaps.
5. **Push notifications strategy.** FCM? APNs? Web Push? Pick one before users notice the gap from Sendbird.
6. **Search.** A FULLTEXT index on `messenger_messages.message` is the cheapest path; otherwise an external Sphinx/Elasticsearch index (the project already has a `src/search/sphinx.ts`).

---

## 9. Coverage summary

| Bucket | Count |
|---|---|
| Sendbird-related commits identified | 6 milestones (Aug 2024 → Jan 2026) |
| Active Sendbird API calls in code | 0 |
| Sendbird stub objects masking dead calls | 3 (`BomCommunity.ts`, `studybuddy.ts`, `virtualgroup.ts`) |
| Messenger service methods | 28 |
| Messenger GraphQL queries | 11 |
| Messenger GraphQL mutations | 15 |
| Messenger socket events (client→server) | 13 |
| Messenger socket events (server→client) | 12 |
| Messenger DB tables | 7 |
| Study-group GraphQL queries | 8 (currently disabled) |
| Study-group GraphQL mutations | 7 (currently disabled) |
| Frontend study-group components | 9 major + helpers |
| Frontend chat client size | 1228 lines (`MessengerController.js`) |
| LOC removed from Sendbird path | `src/library/sendbird.{ts,js}` deleted; `frontend/webapp/src/.../SendbirdController.js` deleted |

**Migration burndown:**
- Sendbird removal: **complete**.
- In-house implementation: **~60%** (core works; study-group surface gated off).
- Data migration: **0%** (no plan, no tools).
- Feature parity: **~70%** (push, search, file upload, presence-sync still missing).

**Single-line summary for planning:** Flip `MESSENGER_ENABLED`, delete the three sendbird stubs, decide on data-migration scope, then close the four feature-gap items above.

---

## 10. Related references

- `docs/reference/backend-api-handlers.md` — full backend handler inventory (also notes BomMessenger and BomCommunity as Sendbird-adjacent).
- `docs/reference/bomonline-api-client.md` — frontend BoMOnlineAPI wrapper (the GraphQL transport for everything except sockets).
- `docs/api/queries.md`, `docs/api/mutations.md` — schema-level reference.
