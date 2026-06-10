# Green-Field Messaging Platform Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Native real-time messaging + community platform in the green-field backend (`/backend`, :5006) replacing Sendbird, so the React client works unchanged.

**Architecture:** DDD `messaging/` domain (Kysely) consumed by two transports — socket.io (live writes, attached to Fastify) and GraphQL (reads + membership). One `RealtimeBus` fan-out seam (socket.io + Redis adapter). OpenAI bot responder behind a provider-agnostic `LlmGateway` port.

**Tech Stack:** Fastify, graphql-yoga, Kysely, socket.io + @socket.io/redis-adapter, redis, nanoid, openai.

**Spec:** `docs/specs/2026-06-09-greenfield-messaging-platform.md`

**Reference implementations to PORT (read these first):**
- `src/library/messenger.ts` — the ~820-line Sequelize lib: DTO surface + every channel/message/reaction/read operation. THE behavioral spec for the data layer.
- `src/socket.ts` — existing socket.io+Redis wiring, handler→service→broadcast pattern, handshake auth (`verifyToken`).
- `src/resolvers/BomCommunity.ts` — parked GraphQL resolver bodies (homefeed/homegroups/homethread/join*/bot*).
- `src/api/studybuddy.ts`, `src/api/virtualgroup.ts` — bot persona + AI generation reference.
- Client contract: `frontend/webapp/src/models/MessengerController.js` (socket events, exact payloads).

**Test infra:** new `backend/test/messaging/` (vitest) for unit/service tests; `tests/messaging/` (root, jest) for socket+GraphQL integration with a real `socket.io-client`.

**Concurrency rule for executors:** each task owns the files it Creates. Shared wiring files (`context.ts`, `index.ts`, `resolvers.ts`, `realtime/server.ts`) are touched only by the task that owns that integration step; never two agents in one shared file at once.

---

## DTO contract (port verbatim from `src/library/messenger.ts:20-78`)

`UserDTO{user_id,nickname,profile_url,metadata,is_online,last_seen_at,is_bot}`,
`MemberDTO extends UserDTO {role,state,is_muted}`,
`ChannelDTO{channel_url,name,cover_url,custom_type,data,metadata,members,member_count,unread_message_count,last_message,created_at,lang}`,
`MessageDTO{message_id,channel_url,user,message_type,message,custom_type,data,parent_message_id,thread_info,reactions,created_at,updated_at}`,
`HighlightDTO{id,message_id,ordinal,text}`. These live in `backend/src/messaging/dto.ts` and are the cross-layer contract.

## File map

| File | Responsibility |
|---|---|
| `backend/src/messaging/dto.ts` | The DTOs above (port). |
| `backend/src/messaging/users.ts` | user repo/service: get/upsert/metadata/online, bot listing. |
| `backend/src/messaging/channels.ts` | channel CRUD, my/public lists, DTO assembly. |
| `backend/src/messaging/members.ts` | membership: add/remove, role/state, requests. |
| `backend/src/messaging/messages.ts` | post/get/edit/delete, history, threads, highlights, `data` JSON. |
| `backend/src/messaging/reactions.ts` | add/remove, reaction aggregation. |
| `backend/src/messaging/readstate.ts` | mark_read, unread counts. |
| `backend/src/messaging/presence.ts` | Redis online-set + heartbeat; DB last_seen_at fallback. |
| `backend/src/messaging/bots/registry.ts` | bot users, addBot/removeBot/botlist. |
| `backend/src/messaging/bots/personas.ts` | persona lookup from BomVirtualgroupPrompts. |
| `backend/src/messaging/ai/LlmGateway.ts` | PORT interface `generate()`. |
| `backend/src/messaging/ai/OpenAiAdapter.ts` | default adapter (openai chat). |
| `backend/src/realtime/server.ts` | socket.io attach + Redis adapter + handshake auth. |
| `backend/src/realtime/RealtimeBus.ts` | `emit(event, room, payload)` fan-out seam. |
| `backend/src/realtime/handlers/*.ts` | one per client→server event. |
| `backend/src/realtime/botResponder.ts` | bus subscriber → LlmGateway → post. |
| `backend/src/graphql/resolvers/community.ts` | parked reads + membership mutations. |
| `backend/src/config/redis.ts` | shared redis client factory. |
| `tests/messaging/*.test.js` | integration (socket-client + GraphQL). |

---

## PHASE 1 — Data layer (Kysely Messenger port)

### Task 1.1: Introspect messenger_* + DTOs
**Files:** Modify `backend/codegen/db.d.ts` (regen); Create `backend/src/messaging/dto.ts`.
- [ ] Run `cd backend && npm run codegen:db`; confirm `MessengerUsers/Channels/Members/Messages/Highlights/Reactions/Files` interfaces appear in `codegen/db.d.ts`.
- [ ] Create `dto.ts` with the five interfaces from the DTO contract above (copy from `src/library/messenger.ts:20-78`).
- [ ] `npx tsc --noEmit` clean. Commit `feat(messaging): introspect messenger tables + DTO contract`.

### Task 1.2: users service
**Files:** Create `backend/src/messaging/users.ts`, `backend/test/messaging/users.test.ts`.
Port `Messenger.getUser/getUsers/upsertUser/updateUser*/getUserMetadata/setUserOnline/listBotUsers` (`messenger.ts:89-205`) to Kysely functions taking `(db, ...)`. `is_online` comes from presence (Task 2.x) — for now default false; `last_seen_at` from the column (ms epoch).
- [ ] TDD: vitest test inserts a `messenger_users` row in the test DB, asserts `getUser` returns the `UserDTO` shape. (Test DB = the same bom_prd via backend/.env; use a unique throwaway user_id like `test_<nanoid>` and clean up.)
- [ ] Implement; `npm test` (vitest) green; `tsc` clean. Commit.

### Task 1.3: channels + members + DTO assembly
**Files:** Create `backend/src/messaging/channels.ts`, `members.ts`, tests.
Port `getChannel/getMyChannels/getPublicChannels/createChannel/updateChannelMetadata` and `addUserToChannel/removeUserFromChannel/getChannelMembers` (`messenger.ts:207-400`). ChannelDTO assembly joins members + member_count + last_message + unread (unread stubbed 0 until Task 1.5). `custom_type` ENUM preserved; `data` is the JSON-string back-compat field.
- [ ] TDD: create a channel + add two members, assert ChannelDTO members/member_count.
- [ ] Implement; tests green; commit.

### Task 1.4: messages + reactions + threads
**Files:** Create `backend/src/messaging/messages.ts`, `reactions.ts`, tests.
Port `postMessage/getMessage/getMessages/getThread/updateMessage/deleteMessage` (`messenger.ts:401-648`) and `addReaction/removeReaction` (`:650-683`). message_id = `nanoid(11)`; highlights persisted to `messenger_highlights`; `data` JSON carries links/highlights; reactions aggregated as `{key,user_ids[]}`; thread_info via reply_count + most_replies.
- [ ] TDD: post a message with highlights, assert MessageDTO incl. reactions empty + data JSON round-trips; add reaction → appears aggregated.
- [ ] Implement; tests green; commit.

### Task 1.5: read-state + unread
**Files:** Create `backend/src/messaging/readstate.ts`, test; Modify `channels.ts` unread wiring.
Port `markAsRead/markChannelAsRead/getUnreadCount` (`messenger.ts:684-720`); wire `unread_message_count` into ChannelDTO.
- [ ] TDD: post 2 messages, mark read, assert unread 0; post 1 more, assert unread 1.
- [ ] Implement; tests green; commit.

---

## PHASE 2 — Real-time core

### Task 2.1: redis client + presence
**Files:** Create `backend/src/config/redis.ts`, `backend/src/messaging/presence.ts`, test.
`redis.ts`: factory returning a connected client from `REDIS_URL`, or null (single-instance). `presence.ts`: `setOnline(userId)/setOffline(userId)/isOnline(userId)/onlineUserIds()` using a Redis set + per-user TTL key (heartbeat); on offline also write `messenger_users.last_seen_at`. No redis → isOnline=false, last_seen from DB. Wire `is_online` into `users.ts` DTO.
- [ ] TDD: with a fake/in-memory redis (or skip-if-no-redis guard), assert setOnline→isOnline true, setOffline→false + last_seen written.
- [ ] Implement; tests green; commit.

### Task 2.2: socket server + handshake auth + RealtimeBus
**Files:** Create `backend/src/realtime/server.ts`, `backend/src/realtime/RealtimeBus.ts`; Modify `backend/src/index.ts` (attach to Fastify httpServer).
Port `src/socket.ts:89-167` (initialize, Redis adapter, handshake `io.use` verifying `{userId,token}` → green-field `userByToken`+md5 match → `socket.data.user`; join member channel rooms on connect; presence setOnline; on disconnect setOffline). `RealtimeBus.emit(event, room, payload)` = `io.to(room).emit(...)`. Expose a module `getBus()` so GraphQL can fan out.
- [ ] Manual smoke: boot backend, connect a socket.io-client with a valid token → connected; bad token → rejected. (No unit gate; integration test in P5.)
- [ ] `tsc` clean; commit.

### Task 2.3: live-write handlers
**Files:** Create `backend/src/realtime/handlers/{message,reaction,typing,read}.ts`; Modify `server.ts` to register them.
Port `src/socket.ts` handlers: `send_message`→messages.post→`message_received`; `edit_message`→`message_updated`; `delete_message`→`message_deleted`; `add/remove_reaction`→`reaction_changed`; `typing_start/stop`→`typing`; `mark_read`→readstate+`unread_count_changed`. Each: authenticate via `socket.data.user`, call messaging service, `bus.emit` to the channel room, ack the emitter. Match payload shapes the client expects (`MessengerController.js`).
- [ ] Manual smoke per event (two socket clients, send→other receives). `tsc` clean; commit.

---

## PHASE 3 — Community GraphQL

### Task 3.1: read resolvers
**Files:** Create `backend/src/graphql/resolvers/community.ts`; Modify `resolvers.ts` + `context.ts` (merge + loaders) — owner task.
Port `homefeed/homegroups/homethread/requestedUsers/loadGroupsFromHash` from `src/resolvers/BomCommunity.ts` onto the messaging services. Match the parked response shapes (HomeGroup/HomeUser/feed). `leaderboard` already exists — do not touch.
- [ ] Manual: query each against the running backend; shape-compare to `BomCommunity.ts` return structures.
- [ ] `tsc` clean; commit.

### Task 3.2: membership mutations + bus fan-out
**Files:** Modify `community.ts`.
Port `joinGroup/joinOpenGroup/requestToJoinGroup/withdrawRequest/processRequest` → members service; each returns `JoinedGroup{isSuccess,msg,channel,user}` and calls `getBus().emit('membership_changed'/'user_joined'/'channel_action', channelUrl, payload)`.
- [ ] Manual: joinGroup → response shape + a connected socket client in that room receives `user_joined`.
- [ ] `tsc` clean; commit.

---

## PHASE 4 — Bots + AI responder

### Task 4.1: bot registry + botlist/addBot/removeBot
**Files:** Create `backend/src/messaging/bots/registry.ts`; Modify `community.ts` (botlist/addBot/removeBot).
Port from `BomCommunity.ts`: `botlist` (is_bot users), `addBot`/`removeBot` (membership). Bot messages already post via the message path.
- [ ] Manual: addBot → bot appears in channel members; botlist returns bots.
- [ ] commit.

### Task 4.2: LlmGateway port + OpenAiAdapter + personas
**Files:** Create `backend/src/messaging/ai/LlmGateway.ts`, `OpenAiAdapter.ts`, `backend/src/messaging/bots/personas.ts`, vitest test for the adapter (mocked openai).
`LlmGateway` interface: `generate(opts:{system:string, messages:{role,content}[]}):Promise<string|null>`. `OpenAiAdapter` implements via `openai` chat (model from env, default `gpt-3.5-turbo` per legacy), returns null on error/timeout. `personas.ts` loads bot persona/prompt from `BomVirtualgroupPrompts` (migrate the hardcoded `virtualgroup.ts` personas into the table or a seed).
- [ ] TDD: adapter test with a mocked openai client returns the text; on thrown error returns null.
- [ ] Implement; tests green; commit.

### Task 4.3: botResponder (bus subscriber)
**Files:** Create `backend/src/realtime/botResponder.ts`; Modify `server.ts` (subscribe).
On a new human `message_received` in a channel with a bot member: load persona, build system+recent-history, `LlmGateway.generate`, post the reply via messages.post (broadcasts normally). Guard: ignore bot-authored messages (no loops), token budget, silent on null.
- [ ] Manual: post in a bot channel (stub the gateway to fixed text via env in dev) → bot reply broadcasts.
- [ ] `tsc` clean; commit.

---

## PHASE 5 — Integration tests + cutover

### Task 5.1: integration suite
**Files:** Create `tests/messaging/realtime.test.js`, `tests/messaging/community.test.js`, `tests/messaging/helpers.js`.
Boot a test backend (or target a running one via env), connect a real `socket.io-client` with a test token. Assert round-trips: send→`message_received`; join (GraphQL)→`user_joined`; react→`reaction_changed`; typing; `mark_read`→`unread_count_changed`; thread fetch; bot reply with a stubbed `LlmGateway` (env-injected fixed text → deterministic). GraphQL read/mutation shape assertions vs the parked contracts.
- [ ] Tests green against a backend with a disposable test channel (create + teardown in helpers).
- [ ] Commit.

### Task 5.2: cutover wiring
**Files:** Modify `backend/src/index.ts` (ensure socket attached when messaging enabled), `backend/.env.example` (MESSENGER_ENABLED, REDIS_URL, OPENAI_API_KEY, OPENAI_MODEL); doc.
- [ ] Set `MESSENGER_ENABLED=true` path; manual two-browser smoke (live message + presence) against :5006.
- [ ] Update `docs/reference/backend-graphql-surface.md` (move community fns from "not built" to built) + a `docs/reference/messaging-platform.md` ops note.
- [ ] Commit.

---

## Acceptance criteria
1. `tsc` clean across `/backend`; vitest unit tests (P1/P2/P4) green.
2. `tests/messaging/` integration suite green (deterministic via stubbed `LlmGateway`).
3. Two-browser manual smoke: live message delivery, presence, join, reaction, bot reply.
4. Client unchanged — same socket events + GraphQL shapes the parked code targeted.
5. Redis-down → single-instance still works; LLM-down → silent bot, channel unaffected.

## Notes
- No regression-suite baselines exist (parked code) — the integration suite is the gate.
- File upload (`messenger_files`) wiring deferred (reuses the profile-image S3 work when it lands).
