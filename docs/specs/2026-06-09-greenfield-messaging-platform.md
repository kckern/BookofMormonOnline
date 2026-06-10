# Green-Field Messaging / Community Platform (Sendbird Replacement) — Design Spec

**Date:** 2026-06-09
**Status:** Approved design, pre-implementation
**Context:** Sendbird is being removed entirely. The green-field backend must provide an
internal real-time messaging + community platform so the React client (which already
talks socket.io + GraphQL) works **unchanged**. Significant groundwork exists: the
`messenger_*` MySQL schema (7 tables, migrated), an ~820-line Sequelize `Messenger` lib
(`src/library/messenger.ts`), and `src/socket.ts` (socket.io + Redis adapter) — all gated
off by `MESSENGER_ENABLED=false`.

## Goal

Build out every parked Sendbird-dependent GraphQL resolver and the real-time WebSocket
surface natively in the green-field backend (`/backend`, Yoga/Fastify/Kysely on :5006),
so the client's messaging + community features work end-to-end with no client changes.

## Approved decisions

| Concern | Decision |
|---|---|
| Topology | socket.io mounts on the **same Fastify server** as Yoga (:5006); one process; Redis adapter for cross-instance fan-out, single-instance fallback when `REDIS_URL` unset |
| Data layer | **Port the Messenger lib to Kysely** in `/backend` (the Sequelize lib is the reference spec, not reused); no imports from legacy `src/` |
| Scope | **Full parity** with the parked surface (all resolvers + socket events the client uses) |
| Write path | **Socket owns live writes**; **GraphQL owns reads + membership mutations**; both fan out via one `RealtimeBus` |
| Bots | **Full**, including the AI auto-responder |
| AI provider | **OpenAI** (matches legacy GPT), behind a **provider-agnostic port/adapter** (DDD) so the gateway is swappable |
| Testing | **Integration tests** (real socket client + GraphQL) **+ manual** smoke; no regression baselines exist (parked code) |

## Client contract (the fixed target — do not change)

The client (`frontend/webapp/src/models/MessengerController.js`) connects socket.io with
`auth: {userId, token}` (userId = md5 of `bom_user.user`; token = session token) and uses:

**Socket — client → server:** `send_message`, `edit_message`, `delete_message`,
`add_reaction`, `remove_reaction`, `typing_start`, `typing_stop`, `mark_read`,
`fire_action`, `update_state`.
**Socket — server → client:** `message_received`, `message_updated`, `message_deleted`,
`typing`, `reaction_changed`, `channel_action`, `membership_changed`, `user_joined`,
`user_left`, `unread_count_changed` (+ `connect`/`disconnect`/`connect_error`).

**GraphQL (parked resolvers to build):** reads — `homefeed`, `homegroups`, `homethread`,
`requestedUsers`, `loadGroupsFromHash`; mutations — `joinGroup`, `joinOpenGroup`,
`requestToJoinGroup`, `withdrawRequest`, `processRequest`, `addBot`, `removeBot`. Plus
`botlist` and the `HomeUser`/member shapes shared with `leaderboard` (already built).

## Architecture

### Module layout (`/backend/src`)
```
messaging/                 # DDD domain — Kysely, no realtime/transport concerns
  channels/                # channel repo + service (create/get/list, my/public)
  members/                 # membership: roles, state (joined/invited/requested)
  messages/                # post/get/edit/delete, threads, history
  reactions/               # add/remove
  presence/                # Redis online-set + heartbeat; DB last_seen_at fallback
  bots/                    # bot users, registration, persona lookup
  ai/
    LlmGateway.ts          # PORT (interface): generate(prompt, history) → text
    OpenAiAdapter.ts       # default ADAPTER; provider-agnostic seam
  dto.ts                   # UserDTO/ChannelDTO/MessageDTO/HighlightDTO (port of lib types)
realtime/
  server.ts                # socket.io attach to Fastify, Redis adapter, handshake auth
  handlers/                # one file per client→server event; calls messaging services
  RealtimeBus.ts           # emit(event, room, payload) → socket.io broadcast (Redis-backed)
  botResponder.ts          # subscribes to bus; on new msg in bot channel → LlmGateway → post
graphql/resolvers/community.ts   # parked reads + membership mutations
```
The `messaging` domain knows nothing about sockets or GraphQL. Both transports (socket
handlers, GraphQL resolvers) call the same services; neither persists directly. The
`RealtimeBus` is the single fan-out seam, used by socket handlers AND membership mutations.

### Write/read flow
- **Live writes (socket):** client emits → handler authenticates (socket.data.user) →
  calls `messaging` service (persist) → `RealtimeBus.emit(...)` to the channel room →
  connected members receive the server→client event.
- **Reads (GraphQL):** `homefeed`/`homethread`/`homegroups`/`requestedUsers`/
  `loadGroupsFromHash` query `messaging` services; shapes match the parked resolvers /
  `messenger.ts` DTOs.
- **Membership (GraphQL):** `join*`/`request*`/`withdraw`/`process`/`addBot`/`removeBot`
  mutate via `members`/`bots` services, then `RealtimeBus.emit('membership_changed' /
  'user_joined' / 'channel_action', ...)` so live clients update. Mutation response shapes
  match the parked resolvers (`JoinedGroup{isSuccess,msg,channel,user}` etc.).

### Auth
Socket handshake `{userId, token}` → verify `token` resolves a `bom_user` whose md5 ==
`userId` (reuse the green-field `userByToken` logic). On failure, reject the connection.
GraphQL membership mutations authenticate by `token` arg as the parked resolvers did.

### Presence
Redis: a per-user online flag + TTL heartbeat; on connect add, on disconnect remove +
write `messenger_users.last_seen_at`. `is_online`/`last_seen_at` on member/HomeUser shapes
read Redis first, DB fallback. No Redis → online always false, `last_seen_at` from DB.

### Bots + AI
- Bot users are `messenger_users.is_bot = 1`, linked via `members`. `botlist`/`addBot`/
  `removeBot` manage membership; bot messages post through the normal message path.
- `botResponder` subscribes to the `RealtimeBus`. On a new human message in a channel that
  has a bot member, it loads the bot's persona (from `BomVirtualgroupPrompts`, migrating
  the hardcoded `virtualgroup.ts` personas to DB), builds the prompt + recent history, and
  calls `LlmGateway.generate(...)`. The reply posts via the message service (so it
  broadcasts like any message). **`LlmGateway` is a domain port**; `OpenAiAdapter`
  (gpt-style chat) is the default implementation, swappable without touching the domain.
- Failure modes: LLM error/timeout → bot stays silent (logged, never throws into the
  channel). Token budget guarded as legacy did.

## Error handling

- Socket: handler errors → `error` event to the emitting client; never crash the server.
- Redis unavailable → single-instance mode (existing `socket.ts` pattern); presence DB-only.
- GraphQL: typed errors matching parked resolver shapes (`{isSuccess:false,msg}`).
- LLM down → silent bot.

## Testing

`tests/messaging/` integration suite: boots a test green-field backend (sandbox DB or a
disposable test schema), connects a real `socket.io-client`, and asserts round-trips —
send→`message_received`, join→`user_joined`+membership, react→`reaction_changed`, typing,
`mark_read`→`unread_count_changed`, thread fetch, and a bot reply (with a stub
`LlmGateway` returning fixed text, so the test is deterministic). GraphQL reads/mutations
asserted for shape against the parked resolver contracts. Plus a manual smoke checklist
(two browser sessions, live message + presence). No regression-suite baselines (the
parked code never had captured output); these integration tests are the safety net.

## Phasing (one spec, sequential plan)

- **P1 — Data layer:** introspect `messenger_*`; port the Messenger lib to Kysely
  (`messaging/` services + DTOs); socket handshake auth. Unit-tested against the test DB.
- **P2 — Real-time core:** attach socket.io to Fastify; `RealtimeBus`; live-write handlers
  (send/edit/delete/react/typing/read) + broadcasts; presence.
- **P3 — Community GraphQL:** `homefeed`/`homegroups`/`homethread`/`requestedUsers`/
  `loadGroupsFromHash` reads; `join*`/`request*`/`withdraw`/`process`/`addBot`/`removeBot`
  mutations with bus fan-out.
- **P4 — Bots + AI:** bot membership; `botResponder`; `LlmGateway` port + `OpenAiAdapter`;
  personas to DB.
- **P5 — Integration + cutover:** `tests/messaging/` suite; manual smoke; flip
  `MESSENGER_ENABLED=true` on green-field; point the client at :5006.

## Out of scope

- The legacy REST messaging endpoints (`/webhook`, `/studybuddy`, `/coords`, `/translate`)
  — see `docs/reference/non-graphql-endpoints.md`. The studybuddy AI logic is the
  reference for the bot responder but its REST webhook entry is not rebuilt.
- File upload storage infra (the `messenger_files` table exists; wiring the actual upload
  sink reuses whatever the profile-image S3 work lands).
