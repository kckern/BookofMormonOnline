# Chat, study groups, home feed, and page comments inventory

**Status:** production schema and flagship configuration applied; unlisted route reachable; implementation validated in the working tree; **AI posting remains deliberately off until this code is deployed and a new provider credential is provisioned**
**Last validated:** 2026-08-29
**Repository state:** `prod` at `20ea55ee`
**Companion audit:** [2026-08-29 chat/study-group reactivation readiness](../audits/2026-08-29-chat-studygroup-reactivation-readiness.md)

This is the evergreen source-of-truth inventory for the social/messaging surface. It replaces the May 2026 inventory, which described the retired Apollo/Sequelize stack under `_deprecated/src/` as if it were live.

## 1. Current truth

- `_deprecated/src/library/messenger.ts` is an 819-line historical implementation. Nothing in the active application imports it.
- Its capabilities were ported into the active Kysely services under `backend/src/messaging/`.
- The live transport is GraphQL for reads and administrative mutations plus Socket.IO at `/messenger` for message writes and realtime fan-out.
- The frontend replacement is `frontend/webapp/src/models/MessengerController.js`. It deliberately preserves Sendbird-shaped objects and legacy `window` events so the study-group views did not need a wholesale rewrite.
- No Sendbird SDK, package, API endpoint, or live Sendbird credential is used by the active application. Remaining `sendbird` names are compatibility names, comments, a signin response shim, and stale root env documentation.
- The production browser bundle evaluates global messaging **off** on `bookofmormon.online`. The exact `/home/feed` path is an explicit exception; the backend GraphQL surface is not behind the frontend flag, and the production Socket.IO endpoint is already listening.
- The feature is therefore hidden, not server-disabled. Authorization must be correct independently of the UI flag.
- The exact `/home/feed` path is an unlisted beta entrance on every host. It enables the messenger controller only for that path, adds `noindex,nofollow,noarchive`, renders no Home tabs, and queries only enabled `visibility='unlisted' AND listed=0` policy rows. It is not present in navigation or discovery data. On 2026-08-29 a browser-classified production request returned the CRA shell with HTTP 200; deliberately non-browser/crawler-like requests returned the front door's 404 response.
- The beta also suppresses the ordinary group browser/leaderboard. Typed beta deep links are server-checked against the same unlisted policy set, so `/home/feed/<some-other-channel>` cannot use the beta shell to expose a normal group.
- Channel capability decisions are centralized in `backend/src/messaging/policy.ts`. An explicit `messenger_channel_policy` row opts a channel into the new model; channels without one retain legacy behavior.

Current release decision and security evidence belong in the dated companion audit. Keep this file focused on what exists and how it is wired.

## 2. System map

```text
CRA routes and views
  Routes / Home / Study / Page
          |
          +-- BoMOnlineAPI ----------------------> POST /graphql
          |      community + messenger queries       Fastify + GraphQL Yoga
          |                                           |
          +-- MessengerContext                        +-- resolvers/community.ts
                  |                                   +-- resolvers/messenger.ts
                  +-- MessengerController             +-- messaging/* (Kysely)
                          |                            +-- RealtimeBus
                          +-- Socket.IO /messenger ---------+
                                                           |
                                                           +-- messenger_* MySQL tables
                                                           +-- Redis adapter (optional,
                                                               required for >1 app instance)

Public ingress
  Nginx Proxy Manager
      /graphql, /api, /messenger -> stable gateway :5005 -> active app slot :5005
      all other paths            -> stable gateway :8200 -> active app slot :8200
```

The production image runs the backend, Next front door, and built CRA app together via PM2. The stable blue/green gateway preserves ports `5005` and `8200` while changing the active slot.

## 3. Gates and enablement

### 3.1 Frontend messaging gate

Source: `frontend/webapp/src/models/featureFlags.js`.

`isMessengerEnabled()` returns true when any of these is true:

1. `REACT_APP_USE_MESSENGER === "true"` was baked into the CRA build.
2. The first hostname segment matches `REACT_APP_MESSENGER_HOSTS`, including `host-lang` variants. The default list is `staging,bom,localhost`.
3. The host is loopback, link-local, or an RFC1918 private address.
4. The current path is exactly `/home/feed` or one of its deep links.

Consequences:

- `staging.bookofmormon.online`, `staging-ko.bookofmormon.online`, `bom.kckern.net`, localhost, and LAN development hosts are on by default.
- `bookofmormon.online` is off by default because its first segment is `bookofmormon`.
- These `REACT_APP_*` values are build-time values. Changing a container runtime env does not change a built CRA bundle.
- The current `Dockerfile` does not declare or forward either messenger build argument. The production workflow also does not pass them. Enabling the apex therefore currently requires a source/build wiring change, not merely an environment edit.
- `isMessengerNavigationEnabled()` deliberately remains false on the path-only beta. The messenger controller can run there without turning on global messenger routes, header controls, sidebar/bottom-nav entrances, group selectors, or messaging preferences.

The following consumers use the gate:

| Consumer | Off behavior |
|---|---|
| `models/Routes.js` | `/groups`, `/group/*`, and `/invite/:hash` use `DisabledRedirect`; the path-only beta does not unlock them. |
| `views/Home/Home.js` | `/home/community*` redirects to `/home`. |
| `views/Home/HomeTabs.js` | Omits the Community tab. |
| `contexts/MessengerContext.js` | Does not instantiate `MessengerController`; exposes a no-op context. |
| `models/AppController.js` | Initializes and resets study mode off. |
| `views/_Common/Header.js` | Omits `StudyGroupBar`, including on the path-only beta. |
| `Sidebar.js`, `BottomNav.js`, `StudyGroupSelect.js` | Hide or disable study-group entrances. |

Known incomplete gate coverage: `views/Home/Sampler.js` still fetches `homegroups` and `leaderboard` and can render `CommunityTile` on a direct `/home` visit even when messaging is off. Its links then redirect away. The sampler footer also contains a Community link. Treat this as a UI consistency issue and do not describe the server or every social read as feature-gated.

### 3.2 Production navigation flags

Source: `frontend/webapp/config/features.yml`, generated into `src/config/features.generated.json`.

| Flag | Current production value | Meaning |
|---|---:|---|
| `homeNav.hidden` | `true` | Hides the Home navigation entrance in production. Direct `/home` still exists. |
| `passageNotes.hidden` | `true` | Hides the separate read-only Passage Notes panel. It is not the study-group page-comment transport. |

Reactivating community/messaging and reactivating Passage Notes are separate decisions.

### 3.3 Backend realtime gate

Source: `backend/src/index.ts`.

- Realtime starts unless `MESSENGER_ENABLED` is exactly `false`.
- `MESSENGER_ENABLED=false` prevents Socket.IO initialization only.
- Messenger and community GraphQL resolvers remain registered and callable.
- The default in `backend/.env.example` is blank/on. The root `.env.example` says `false`; it is stale and also still lists unused Sendbird credentials.

This is not a complete server-side kill switch. A safe rollback needs a frontend-off action and, if reads must be disabled, a unified backend gate or authorization-safe degraded mode.

## 4. Deprecated library to active service map

Historical source: `_deprecated/src/library/messenger.ts`. Active code uses functional Kysely modules rather than the old `Messenger extends EventEmitter` class.

| Deprecated method | Active equivalent | Notes |
|---|---|---|
| `getUser` | `messaging/users.ts:getUser` | Active DTO joins `bom_user` and derives/falls back avatars. |
| `getUsers` | `users.ts:getUsers` | Batch lookup with presence. |
| `upsertUser` | `users.ts:upsertUser` | Also used during signin provisioning. |
| `updateUserNickname` | `users.ts:updateUserNickname` | Self-gated through GraphQL. |
| `updateUserProfileUrl` | `users.ts:updateUserProfileUrl` | Self-gated; upload path is separate. |
| `updateUserMetadata` | `users.ts:updateUserMetadata` | Uses merge semantics in the active implementation. |
| `getUserMetadata` | `users.ts:getUserMetadata` | Internal service read. |
| `setUserOnline` | `users.ts:setUserOnline`; `presence.ts:setOnline/setOffline` | Realtime presence prefers Redis with DB last-seen fallback. |
| `listBotUsers` | `users.ts:listBotUsers/listStudyBots`; `bots/registry.ts` | Pluggable study bots are also filtered by `bom_bot`. |
| `getChannel` | `messaging/channels.ts:getChannel` | Builds members, last message, counts, and viewer unread state. |
| `getMyChannels` | `channels.ts:getMyChannels/getMyStudyGroups/getMyDMs` | Split helpers for study groups and DMs. |
| `getPublicChannels` | `channels.ts:getPublicChannels` | Public/open discovery. |
| `createChannel` | `channels.ts:createChannel` | Creates initial memberships transactionally. |
| `updateChannelMetadata` | `channels.ts:updateChannelMetadata/updateChannelMetadataKey` | Key-level helper avoids metadata clobber. |
| `addUserToChannel` | `messaging/members.ts:addUserToChannel` | Supports joined/invited/requested state. |
| `removeUserFromChannel` | `members.ts:removeUserFromChannel` and state-specific variants | Ban and invitation state machines are separate helpers. |
| `getChannelMembers` | `members.ts:getChannelMembers/getChannelMembersBulk` | Banned rows excluded unless explicitly requested. |
| `postMessage` | `messaging/messages.ts:postMessage` | Socket-only public write path; max body length 2,000. |
| `getMessage` | `messages.ts:getMessage` | Requires channel and message IDs at service level. |
| `getMessages` | `messages.ts:getMessages/getMessagesForChannels` | Cursor paging and multi-channel home-feed window. |
| `getThread` | `messages.ts:getThread` | Replies by `parent_message_id`. |
| `updateMessage` | `messages.ts:updateMessage` | Socket handler checks joined membership and authorship. |
| `deleteMessage` | `messages.ts:deleteMessage` | Soft-delete; socket handler permits author or operator. |
| `addReaction` | `messaging/reactions.ts:addReaction` | Unique message/user/key tuple. |
| `removeReaction` | `reactions.ts:removeReaction` | Same tuple. |
| `markAsRead` | `messaging/readstate.ts:markAsRead` | Updates member `last_read_at`. |
| `markChannelAsRead` | `readstate.ts:markChannelAsRead` | Alias of `markAsRead`. |
| `getUnreadCount` | `readstate.ts:getUnreadCount/getUnreadCounts` | Single and batched forms. |

Active capabilities added after the deprecated class:

- `pagecomments.ts` — page-scoped comment query and count aggregation.
- `notifications.ts` — durable/derived notifications and personal-room pushes.
- `retention.ts` — optional purge of old soft-deleted messages.
- `readingplan.ts` — study-plan data used by community surfaces.
- `avatarAssets.ts` — profile-image storage integration.
- `bots/` and `ai/` — bot registry, personas, provider abstraction, and OpenAI adapter.

## 5. Active backend inventory

### 5.1 Domain services

| File | Responsibility |
|---|---|
| `backend/src/messaging/dto.ts` | Stable user/member/channel/message DTO contracts. |
| `users.ts` | User identity, profile, metadata, bot, and avatar fallback operations. |
| `channels.ts` | Channel reads, discovery, distinct DMs, creation, metadata. |
| `members.ts` | Membership, invite/request/ban/mute/role state and policy helpers. |
| `messages.ts` | Message/thread CRUD, pagination, highlights, soft-delete purge. |
| `reactions.ts` | Reaction persistence and snapshots. |
| `readstate.ts` | Read timestamps and unread counts. |
| `presence.ts` | Online/offline state, Redis set, last-seen persistence. |
| `pagecomments.ts` | Page-slug filtering plus commentary/image counts. |
| `notifications.ts` | Reply/reaction/invite/mention/DM notifications and read state. |
| `retention.ts` | Optional scheduled hard purge of old deleted rows. |
| `readingplan.ts` | Reading-plan expansion for community views. |
| `avatarAssets.ts` | Avatar asset validation/storage helpers. |
| `bots/registry.ts`, `bots/personas.ts` | Bot eligibility, channel bots, personas. |
| `ai/LlmGateway.ts`, `ai/OpenAiAdapter.ts` | Bot generation seam and provider. |

### 5.2 Messenger GraphQL surface

Schema: `backend/schema/Messenger.graphql`. Resolver: `backend/src/graphql/resolvers/messenger.ts`.

Queries:

| Operation | Purpose | Intended access boundary | Audit status |
|---|---|---|---|
| `messengerUser` | One messenger profile | Authenticated; self, bot, or user sharing a joined channel | Enforced. |
| `messengerUsers` | Batch profiles/presence | Authenticated; self, bots, or users sharing a joined channel | Enforced. |
| `messengerMyChannels` | Joined channels | Self | Enforced with `requireSelf`. |
| `messengerChannel` | Channel, members, last message | Policy-readable; outsiders receive a bot-only roster with presence removed | Enforced through central policy. |
| `messengerChannelOperators` | Operator roster | Joined channel member | Enforced. |
| `messengerChannelBannedMembers` | Banned roster | Operator | Enforced. |
| `messengerMessages` | Channel history | Public/open, or joined private/DM member | Enforced. |
| `messengerMessage` | One message by ID | Same channel policy as history | Enforced after resolving the owning channel. |
| `messengerThreadMessages` | Replies to a parent | Same channel policy as parent | Enforced after resolving the parent channel. |
| `messengerUnreadDMs` | Unread DMs | Self | Enforced. |
| `pagecomments` | Page comments/counts in a group | Same channel policy as history | Enforced. |
| `notifications` | Acting user's notifications | Authenticated self | Returns empty anonymously. |
| `notificationUnreadCount` | Acting user's badge count | Authenticated self | Returns zero anonymously. |

Mutations:

| Operation group | Operations | Boundary |
|---|---|---|
| Channel | `messengerCreateChannel`, `messengerUpdateChannel` | Auth required; update requires operator. |
| User | `messengerUpdateUser`, `messengerUpdateUserMetadata` | Self. |
| Moderation | `messengerUpdateMemberRole`, `messengerSetMute`, `messengerRemoveMember`, `messengerBanMember`, `messengerUnbanMember` | Operator, with self-removal exception where defined. |
| Invitation | `messengerInviteMembers`, `messengerAcceptInvitation`, `messengerDeclineInvitation` | Invite policy/operator; acceptance/decline are self-only. |
| Notification | `markNotificationRead`, `markAllNotificationsRead` | Acting user. |

Message send/edit/delete, reactions, typing, read receipts, and study actions are not GraphQL mutations; they use Socket.IO.

### 5.3 Community GraphQL surface

Schema: `backend/schema/BomCommunity.graphql`. Primary resolver: `backend/src/graphql/resolvers/community.ts`; carryover resolvers: `ported_community.ts` and `ported_user.ts`.

| Operation | Role | Status |
|---|---|---|
| `homefeed` | Featured plus member-channel feed, or one-channel deep link | Implemented; private single-channel requests are membership-gated. Anonymous featured feed is deliberate public content. |
| `homethread` | Feed replies | Implemented; private channels are membership-gated. |
| `homegroups` | My and/or featured group cards | Implemented. Featured groups are anonymous/public. |
| `loadGroupsFromHash` | Resolve invite hashes | Implemented. |
| `requestedUsers` | Pending requests | Implemented and operator-gated. |
| `leaderboard` | Reading progress/community leaderboard | Implemented. |
| `botlist` | Available study bots | Requires verified `ctx.auth`. |
| `moregroups` | Pagination placeholder | Intentional legacy stub returning `[]`. |
| `postcomments` | Legacy feed-comment placeholder | Intentional legacy stub returning `[]`. |
| `studygrouphistory` | Per-group historical progress | Safe empty placeholder; no real implementation. |
| `joinGroup` | Join by invite hash | Implemented. |
| `joinOpenGroup` | Join an open group | Implemented. |
| `requestToJoinGroup`, `withdrawRequest`, `processRequest` | Private-group request flow | Implemented with identity/operator checks. |
| `addBot`, `removeBot` | Channel bot membership | Implemented with operator checks. |

The community schema retains legacy Sendbird-named GraphQL types for frontend compatibility. They are ordinary local DTOs, not SDK objects.

## 6. Realtime inventory

### 6.1 Connection and rooms

Source: `backend/src/realtime/server.ts`.

- Path: `/messenger`.
- Transports: WebSocket and polling.
- Human handshake requires `userId` plus a valid current session token matching that messenger identity.
- Bot handshake requires a bot user with no `bom_user_id` plus `MESSENGER_BOT_TOKEN`.
- A socket joins every `state='joined'` channel at connect and its `user:<id>` personal room.
- GraphQL membership mutations call `RealtimeBus.joinRoom/leaveRoom` so a live socket changes rooms without reconnecting.
- Redis adapter is used when `REDIS_URL` is present and reachable. Otherwise the server explicitly degrades to one-process mode.
- Presence is marked online/offline at connection boundaries and broadcast to joined channel rooms.

### 6.2 Client-to-server events

| Event | Payload | Persistence/policy |
|---|---|---|
| `send_message` | `channelUrl`, body, custom type, links/highlights/data, optional parent | Central policy; roots remain member-only; authenticated outsiders may reply only where explicitly allowed; parent must be an undeleted root in the same channel; locked threads reject replies. |
| `edit_message` | `channelUrl`, `messageId`, body/custom type | Original author with current member or outsider-reply capability; lookup binds message to channel. |
| `delete_message` | `channelUrl`, `messageId` | Author under the applicable member/reply policy, or operator; lookup binds message to channel. |
| `add_reaction`, `remove_reaction` | `channelUrl`, `messageId`, key | Central reaction policy plus message/channel binding. |
| `mark_read` | `channelUrl` | Writes only the authenticated user's membership row. |
| `typing_start`, `typing_stop` | `channelUrl` | Joined membership is rechecked; rate limited. |
| `fire_action` | `channelUrl`, action | Joined membership is rechecked. |
| `subscribe_public_channel`, `unsubscribe_public_channel` | `channelUrl` | Authenticated socket may join only the separate `public:<channel>` room after a policy read check. |
| `update_state` | metadata patch | Authenticated socket; persists acting user's light UI state. |

There are no client `join_channel`/`leave_channel` commands in the active server. Room changes are server-owned through membership state and `RealtimeBus`.

### 6.3 Server-to-client events

| Event | Consumer/effect |
|---|---|
| `message_received` | Adds chat/thread/page message; updates channel/unread state. |
| `message_updated` | Updates chat/thread/page message. |
| `message_deleted` | Dispatches `messengerMessageDeleted`; feed roots and replies are removed live. |
| `reaction_changed` | Dispatches per-message reaction event. |
| `typing` | Updates typing indicator. |
| `channel_action` | Study-group navigation, scroll, and page-presence action. |
| `membership_changed` | Reloads channel/member state. |
| `user_joined`, `user_left` | Member roster changes. |
| `unread_count_changed` | Reloads unread state. |
| `notification_received` | Updates notification bell/feed. |
| `user_presence` | Updates member presence. |
| `read_receipt` | Acknowledges/read-state fan-out. |

Socket message, reaction, and typing events use a Redis-backed fixed-window limiter with a bounded single-process fallback.

## 7. Frontend inventory

### 7.1 Controller and context

| File | Role |
|---|---|
| `frontend/webapp/src/contexts/MessengerContext.js` | Auth/flag gate, controller lifecycle, no-op fallback, `appController.sendbird` compatibility bridge. |
| `frontend/webapp/src/models/MessengerController.js` | 1,714-line GraphQL/Socket.IO client and compatibility facade. |
| `frontend/webapp/src/models/messengerShapes.js` | Converts GraphQL/local DTOs into legacy Sendbird-shaped objects used by views. |
| `frontend/webapp/src/models/featureFlags.js` | Runtime hostname/build gate and production navigation flags. |
| `frontend/webapp/src/models/AppController.js` | Shared study-group state and study-mode lifecycle. |

The `appController.sendbird` property name is compatibility naming. It points at `MessengerController`, never a Sendbird client.

### 7.2 Routes and views

| Surface | Primary files | Route/entry |
|---|---|---|
| Study-group list/room | `views/_Common/Group.js`, `views/_Common/Study/*` | `/groups`, `/group/:channelId`, message/leaderboard variants |
| Invitation | `views/_Common/Invitation*` and modal invite helpers | `/invite/:hash` |
| Community home/feed | `views/Home/Home.js`, `HomeTabs.js`, `Community.js`, `Feed.js` | `/home/community`, channel/message variants; old Community paths redirect here |
| Explore community tile | `views/Home/Sampler.js`, `tiles/CommunityTile.js` | Direct `/home`; not completely messaging-gated |
| Header/selection | `Header.js`, `StudyGroupBar.js`, `StudyGroupSelect.js`, `StudyHall.js` | Global signed-in shell when enabled |
| Navigation | `Sidebar.js`, `BottomNav.js`, `menuConfig.js` | Conditional entrances and counters |
| In-page comments | `views/Page/usePageComments.js`, `commentIndex.js`, `pageCommentCounts.js`, Page components | Current scripture/facsimile page while study mode and active group are set |
| Preferences/admin | Study-group settings/admin components and user preferences | Member/operator actions and study-mode control |

The former voice/video group-call feature is intentionally removed. Do not treat `StudyGroupCall` references in old documents as active scope.

### 7.3 Compatibility event bridge

`MessengerController` converts socket events into `window.CustomEvent` names consumed by existing components. Important families include:

- Chat: `addMessage`, `updateMessage`, `deleteChatMessage`, thread-specific add/update/delete names.
- Page comments: `addMessageToPage-<pageSlug>`, `updateMessageToPage-<pageSlug>`.
- Group state: `fireStudyGroupAction`, `memberPresenceChanged`, `membership_changed`-driven reloads.
- Counters: `unreadMessageCountChanged`, notification events.

The controller dispatches a generic live-deletion event. Feed roots and replies consume it; specialized page-comment views should consume the same event when that hidden surface is separately re-enabled.

## 8. In-page comments: exact flow

Study-group page comments are regular messenger messages:

1. A joined user selects an active study group and enables study mode.
2. `usePageComments` derives `channelUrl` from the active group and `pageSlug` from the viewed page.
3. `MessengerController.loadPageComments` calls GraphQL `pagecomments(channelUrl,pageSlug)`.
4. `backend/src/messaging/pagecomments.ts` returns matching messages and server-computed `com`/`img` counts. Facsimile counts are merged client-side.
5. The hook indexes messages by page location via `commentIndex.js`.
6. New and updated socket messages are re-dispatched as page-specific browser events and update the index live.
7. Deletes are persisted, broadcast to member and public rooms, and removed live from the community feed/thread UI.

Load gates are an authenticated app user, `studyModeOn`, an active group, and page data. When the feature flag is off, `MessengerContext` supplies no live controller and study mode initializes off.

The `pagecomments` resolver resolves the owning channel and applies the same central read policy as ordinary messages before returning content.

## 9. Home feed and group discovery: exact flow

1. `Home/Community.js` requests `homegroups`, `homefeed`, `homethread`, and membership actions through `BoMOnlineAPI`.
2. `community.ts` resolves the acting messenger user from the verified session when available.
3. Normal `homegroups` merges joined study groups with featured public/open groups; explicit disabled or `listed=0` policy rows are removed from featured discovery.
4. Normal `homefeed` merges messages from featured groups and the user's study groups, or serves a policy-checked channel/message deep link. `homefeed(unlisted:true)` is separate: it returns only enabled, unlisted, unlisted-from-discovery channels for `/home/feed`.
5. Private/DM single-channel feed and thread reads are membership-gated.
6. `Feed.js` renders roots and lazy-loads replies via `homethread`.

Anonymous public discovery/feed is an intentional product surface. Outsider channel projection contains bot identities only and clears presence/unread state; human roster and presence data are not returned.

Live reply and deletion delivery is wired through the separate policy-checked public room and consumed by the feed. It still requires the two-browser staging proof before release.

## 10. Persistence inventory

The active database types in `backend/codegen/db.d.ts` describe seven core messenger tables:

| Table | Primary key | Purpose |
|---|---|---|
| `messenger_users` | `user_id` | Messaging identity (`md5(bom_user.user)`), profile, metadata, bot flag, last seen. |
| `messenger_channels` | `channel_url` | DM/open/private/public/solo channel, language, cover, metadata, last message. |
| `messenger_members` | channel + user | Role, joined/invited/requested/banned state, mute, read timestamp. |
| `messenger_messages` | `message_id` | Body/type/custom type, links, metadata, parent, soft-delete timestamps. |
| `messenger_reactions` | message + user + key | Emoji reaction tuples. |
| `messenger_highlights` | generated ID | Ordered scripture highlights attached to messages. |
| `messenger_files` | `file_id` | Attachment metadata; no active upload/send path. |

Related tables:

- `bom_shortlinks` — invitation hash to channel URL.
- `bom_bot` — pluggable bot class/language registration.
- `bom_notification` — durable notification store; migration at `backend/migrations/2026-08-06-notification-table.sql`.
- `bom_user`, `bom_user_token`, `bom_user_social`, and reading-log tables — identity, sessions, public-profile source data, and community progress.
- `messenger_channel_policy` — owner plus independent visibility, membership, root, reply, reaction, listing, and enablement policy.
- `messenger_thread_state` — active/bot-complete/locked lifecycle and bot-message counter.
- `messenger_content_report` — deduplicated user moderation reports.
- `bom_ai_discussion_config`, `bom_ai_topic`, `bom_ai_discussion_turn` — DB-owned pacing, 80/20 topic pool, audience-response probability, and durable staggered turn queue.
- `bom_ai_audience_bot` — channel-scoped allowlist of non-member bot respondents, response weights, and topic triggers. It is orchestration configuration, not authorization or membership.
- `bom_bot_schedule` — durable next-run state and a database lease that prevents duplicate roots during blue/green overlap.
- `bom_ai_corpus`, `bom_ai_bot_corpus`, `bom_ai_evidence` — rights-classified source registry, bot grants, and viewer-safe evidence locators.

### Schema reproducibility

The only checked-in creation migration for the seven original core tables remains under `_deprecated/src/database/migrations/20251221000000-create-messenger-tables.js`; an active baseline remains desirable. The additive release migration is `backend/migrations/2026-08-29-study-group-public-beta.sql`. `npm run study-group:migrate` applies and verifies this migration, defaults to dry-run, and requires both `SANDBOX=0` and `--apply` before writing.

`backend/scripts/gen-sendbird-dump.mjs` can generate legacy seed SQL, but `backend/scripts/out/` is gitignored and the generated seed is not a deployable repository artifact. Before reactivation, operations must have a reviewed, reproducible baseline/upgrade procedure and must verify actual production constraints, indexes, collations, and enum values rather than trusting generated TypeScript types.

Message IDs are numeric strings generated from centisecond timestamps. This intentionally preserves compatibility with legacy GraphQL fields and numeric route matching while fitting the current `varchar(11)` schema.

## 11. Configuration and dependencies

### 11.1 Required/important environment

| Variable | Scope | Behavior |
|---|---|---|
| `SANDBOX` | Backend | Must be `0` on a writable prod-like validation environment; `1` suppresses writes. |
| `MYSQL_*` / `DATABASE_URL` | Backend | Messenger data source and codegen connection. Runtime user must be writable for launch. |
| `MESSENGER_ENABLED` | Backend | Socket.IO-only kill switch; exact `false` disables realtime. |
| `REDIS_URL` | Backend | Cross-process Socket.IO fan-out/presence. Optional only while exactly one app process/instance serves sockets. |
| `MESSENGER_BOT_TOKEN` | Backend | Shared bot handshake secret. Required only for socket-connected bot identities. |
| `OPENAI_API_KEY`, `BOT_LLM_MODEL` | Backend | Bot LLM provider and optional fallback model. The flagship stores its explicit model per bot in `bom_bot`. Missing provider/model/persona makes a managed bot turn fail closed. |
| `BOT_SCHEDULER_ENABLED` | Backend | Opt-in scheduled bot posting; default off. |
| `MESSAGE_RETENTION_DAYS` | Backend | Opt-in purge timer; unset is inert. |
| `S3_BUCKET`, `S3_PUBLIC_URL`, AWS provider credentials | Backend | Profile-image upload, not message attachments. |
| `REACT_APP_API_URL` | CRA build | GraphQL/socket origin; same-origin is correct with production proxy routing. |
| `REACT_APP_USE_MESSENGER` | CRA build | Global force-on. |
| `REACT_APP_MESSENGER_HOSTS` | CRA build | Runtime hostname allowlist baked into bundle. |
| `REACT_APP_PROFILE_IMAGE_BASE_URL` | CRA build | Must agree with backend public asset URL. |

The managed queue hard-caps each autonomous thread at 12 bot messages and 72 hours. Provider-side daily spend alerting remains an operations gate before broad discovery.

### 11.2 Packages

Backend: `socket.io`, `@socket.io/redis-adapter`, `redis`, Kysely/mysql2, `scripture-guide@^1.0.97`, and AI provider packages.
Frontend: `socket.io-client`, `scripture-guide@^1.0.97`, plus the existing GraphQL wrapper.
Sendbird packages: none.

## 12. Deployment and ingress wiring

| Layer | Repository evidence | Validation state |
|---|---|---|
| Build | Root `Dockerfile` builds backend, CRA, and Next; PM2 runs all three. | Confirmed statically and both backend/frontend production builds pass. Global messenger CRA build args are not needed for the path-only exception. |
| App ports | Backend `5005`, Next `8200`, CRA static `8201`. | Confirmed in image/process config. |
| Stable gateway | `ops/production/gateway/default.conf.template` forwards `8200` and `5005`, including Upgrade/Connection headers. | Confirmed statically. |
| Nginx Proxy Manager | Expected split: `/graphql`, `/api`, `/messenger` to `5005`; everything else to `8200`. | Config is external/not versioned. Public GraphQL and Socket.IO polling probes confirm the important paths currently reach the backend. |
| Blue/green | `ops/production/*` maintains one active slot at steady state and drains the old slot after health checks. | Confirmed statically. Redis is still needed if overlapping instances can both accept socket traffic or future scale-out occurs. |
| Cloud edge | Must allow long-lived/polling/WebSocket traffic and preserve same-origin auth. | Polling handshake confirmed publicly; a complete WebSocket upgrade and two-client exchange still need staging validation. |

The Nginx Proxy Manager advanced configuration and production environment are external state. They must be exported or captured as sanitized release evidence before approval.

## 13. Authentication and authorization model

### Identity

- GraphQL context verifies `Authorization: Bearer <session>` into `ctx.auth` once per request.
- The messenger user ID is `md5(ctx.auth.userId)`.
- Authorization decisions must use `ctx.auth`/the derived acting user, never mere presence of `ctx.bearerToken`.
- Socket.IO independently validates the handshake token and claimed messenger user ID.

### Channel policy to apply everywhere

| Channel type | Anonymous read | Authenticated non-member read | Joined member read/write |
|---|---:|---:|---:|
| `public`, `open` | Public projection only | Public projection only | Full allowed channel projection; writes subject to role/mute rules. |
| `private`, `DM`, `solo` | None | None | Full channel projection and normal member writes. |

Public projection must be explicit. It must not accidentally include user metadata, private reading state, raw presence/last-seen, moderation state, invite/request rows, or message bodies from a non-public channel.

`messaging/policy.ts` applies this policy to channel, history, single-message, thread, page-comment, socket write, reaction, typing, action, join, and request paths. Legacy channels receive their old defaults unless an explicit policy row opts them in.

## 14. Implemented, partial, and intentionally absent capability

### Implemented

- Group channels and DMs; discovery and distinct-DM support.
- Membership roles, invitation/request states, bans, mute, removal.
- Message send/edit/delete, threads, reactions, highlights.
- Read/unread state, presence, typing, group navigation/action relay.
- In-app notifications and personal-room push.
- Page-scoped study comments and counts.
- Home group discovery, feed, feed threads, leaderboard.
- Bots, personas, bot membership, audience respondents, and provider-based generated replies; identity/persona/model/prompt data is DB-owned and missing configuration fails closed.
- Mid-session socket room synchronization after membership changes.
- Public fixed-membership channels: anonymous read, signed-in outsider replies/reactions, no outsider root posts or join requests.
- Unlisted `/home/feed` beta route and public-safe live rooms.
- Durable AI discussion turns, 80/20 topic weighting, in-character generated openers, completion state, optional corpus-scoped retrieval, and Bible↔Book of Mormon scripture bridging.

### Partial or launch-relevant gaps

- File/image message attachments: table only; no upload/message path.
- Message search: absent.
- Specialized page-comment deletion consumers still need validation when that separately hidden UI is re-enabled.
- Home-feed reply/delete fan-out is wired and still needs the staged two-browser proof.
- The working-tree application code is not yet deployed. Production has the new schema/configuration, but autonomous posting remains inert because the deployed environment has no explicitly provisioned `OPENAI_API_KEY` and `BOT_SCHEDULER_ENABLED` is not enabled.
- Presence is per user connection transition rather than robust multi-tab/device cardinality without Redis discipline.
- Email notification infrastructure now exists elsewhere in the backend, but user-facing messaging email/push policy and end-to-end delivery need explicit validation; it is not a substitute for in-app realtime.
- Retention is inert unless configured.

### Intentionally absent/deferred

- Voice/video group calls.
- Polls.
- Sendbird administration, moderation console, and network dependencies.
- `moregroups`, `postcomments`, and real `studygrouphistory` behavior beyond their documented safe placeholders.
- Corpus ingestion for the initial beta. An empty corpus grant set is valid; generation proceeds from persona and scripture/topic context without claiming corpus grounding. Corpus ingestion can be added later without changing the scheduler contract.

## 15. Validation commands

Run from repository root unless noted.

```sh
cd backend && npm run typecheck
```

Focused frontend contract/regression set:

```sh
cd frontend/webapp
npm test -- --watchAll=false --runInBand \
  src/models/__tests__/featureFlags.test.js \
  src/contexts/__tests__/MessengerContext.test.js \
  src/models/__tests__/messengerShapes.test.js \
  src/views/Page/__tests__/usePageComments.test.js \
  src/views/Page/__tests__/commentIndex.test.js \
  src/views/Page/__tests__/pageCommentCounts.test.js \
  src/views/Home/__tests__/Home.test.js \
  src/views/Home/__tests__/HomeTabs.test.js \
  src/views/Home/__tests__/communityPath.test.js
```

Database/realtime integration requires a writable disposable database and permission to bind a local test listener. A green unit run that skips write tests is not launch evidence.

Observed on 2026-08-29:

- Production migration/configuration apply and independent readback succeeded: ten member bots, four non-member audience bots, 38 topics (32 discursive, six narrative), zero corpora/grants, one joined human owner/operator, and zero audience-bot memberships. Explicit-policy non-member bots are also denied client-socket writes, so their replies can originate only in managed orchestration.
- The legacy channel is private/read-only and its schedule is disabled. The fresh channel is enabled, unlisted, fixed-membership, member-root/authenticated-reply/authenticated-reaction.
- GraphQL code generation, backend typecheck/build, focused backend tests (five files, 31 passing tests), focused frontend tests (four suites, 42 passing tests), and the optimized frontend build passed.
- A browser-classified production request to `/home/feed` returned HTTP 200. This proves ingress and the existing beta shell, not deployment of the working-tree scheduler/application changes.
- The AI scheduler is intentionally inert until the working-tree image is deployed, a new `OPENAI_API_KEY` is provisioned, and `BOT_SCHEDULER_ENABLED=true` is set after smoke testing.

Minimum staged two-browser proof:

1. Sign in as two non-operator users and one operator using separate sessions.
2. Public/open/private/DM read matrix, including direct object-ID queries.
3. Create/join/request/invite/accept/decline/remove/ban/unban and verify live room changes.
4. Send/reload persistence; edit/delete; thread; reaction; typing; read/unread.
5. Page comment add/edit/delete/count on scripture and facsimile pages.
6. Home group/feed deep links and live replies.
7. Notification receipt/read; avatar/profile handling; bot add/remove/reply with cost guard.
8. Revoke a session and verify HTTP plus a reconnected socket reject it.
9. Restart/deploy during an active session and confirm reconnect, room restoration, and no lost persisted message.

## 16. Maintenance rule

Update this inventory whenever any of these change:

- GraphQL messenger/community schema or resolver registration.
- Socket event names, payloads, auth, or room membership.
- Messenger tables/migrations, feature flags, build arguments, proxy routes, or environment variables.
- Frontend routes, study-group/page-comment/home-feed consumers, or compatibility events.
- A capability moves between implemented, partial, intentionally absent, or removed.

For each planned launch, create a dated audit rather than overwriting historical release evidence. The latest audit must name the commit, test results, safe live checks, unresolved blockers, and signed acceptance criteria.
