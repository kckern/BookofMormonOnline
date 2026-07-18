# Messaging Platform (internal Sendbird replacement)

The green-field backend (`/backend`, :5006) provides real-time messaging + community
natively — Sendbird is gone. The React client works unchanged: same socket.io path
(`/messenger`) and the same GraphQL community surface. Spec:
`docs/specs/2026-06-09-greenfield-messaging-platform.md`. Plan:
`docs/plans/2026-06-09-greenfield-messaging-platform.md`.

## Shape

```
GraphQL (Yoga)  ─┐
                 ├─ one Fastify HTTP server on :5006
socket.io  ──────┘   (socket.io intercepts the WS upgrade on path /messenger;
                      Yoga handles plain HTTP — no routing conflict)

messaging/ (Kysely domain, transport-agnostic)
  users · channels · members · messages · reactions · readstate · presence
  bots/ (registry · personas) · ai/ (LlmGateway port + OpenAiAdapter)
realtime/
  server.ts   — socket.io attach, handshake auth, room joins, presence
  RealtimeBus — getBus().emit(event, room, payload)  ← the single fan-out seam
  handlers/   — message · reaction · typing · read  (live writes)
  botResponder— bus-triggered AI replies
graphql/resolvers/community.ts — homefeed/homegroups/homethread/requestedUsers/
                                  loadGroupsFromHash + join/request/process/bot mutations
```

## Write/read split (matches the client)

- **Live writes via socket** (`send_message`/`edit`/`delete`/`add_reaction`/
  `remove_reaction`/`typing_start|stop`/`mark_read`): the handler persists via the
  `messaging` service, then `bus.emit(...)` to the channel room. Each acks the emitter
  `{success}`; errors → `{success:false,error}`, never a crash.
- **Reads + membership via GraphQL**: the community resolvers read through the same
  services; membership mutations (`joinGroup` etc.) persist then `bus.emit('user_joined'/
  'membership_changed', ...)` so live clients update. This is the GraphQL↔socket bridge —
  one in-process `getBus()` call, cross-instance via the Redis adapter.

## Auth

Socket handshake `auth:{userId, token}` → `messenger_users[userId].bom_user_id` →
verify a `bom_user_token` row matches `(user=bom_user_id, token)`. Bots (`bom_user_id`
null) connect with `token === MESSENGER_BOT_TOKEN`. GraphQL community mutations
authenticate by the `token` arg.

## Presence

Redis SET `presence:online` + per-user TTL heartbeat (`presence:heartbeat:<id>`, 90s) —
crash-safe. On disconnect, `messenger_users.last_seen_at` is written as the durable
fallback. No `REDIS_URL` → single-instance, `is_online` always false, `last_seen_at` from
DB. `is_online` is batch-resolved (one `SMEMBERS`, no N+1).

## Bots + AI

Bot users are `messenger_users.is_bot=1`. `botResponder` subscribes to new human
messages; for a channel's bot it loads the persona (`BomVirtualgroupPrompts`, seeded
fallback), builds system + recent history, and calls `getLlmGateway().generate(...)`,
posting the reply through the normal message path. **Provider-agnostic:** the domain
depends only on the `LlmGateway` interface; `OpenAiAdapter` is the sole file importing
`openai`. LLM failure / no key → silent bot, channel unaffected. Loop guard (skip
bot-authored triggers) + per-channel in-flight debounce.

## Config (backend/.env)

`REDIS_URL` (fan-out; unset = single-instance) · `MESSENGER_BOT_TOKEN` · `OPENAI_API_KEY`
· `OPENAI_MODEL` (default `gpt-3.5-turbo`).

## Testing & status

- Unit: `backend/test/messaging/*` (vitest) — 118 green. Write paths skip under the
  read-only `reader` DB user; they run when a writable account is supplied.
- Integration: `tests/messaging/*` (jest) — real socket-client + GraphQL round-trips;
  live tests (connect, auth, typing, reads) run; write round-trips guard-skip until a
  writable test DB exists.
- **To exercise writes fully:** point the backend at a writable MySQL user (the dev host
  runs read-only `reader`; the writable `bom_app` lives in the private workspace repo) and set
  the messaging env above.

## Cutover

The realtime server initializes on backend boot (`MESSENGER_ENABLED=false` is the
kill-switch → GraphQL-only). To go live, the app's `/graphql` and `/messenger` must reach
the green-field backend (which serves the full read surface + community + `messenger*` +
sockets).

### Frontend wiring (done)

- `MessengerController` connects socket.io to `window.location.origin` path `/messenger`
  and POSTs `/graphql` with `Authorization: Bearer <token>` — all relative, no client URL
  change needed; it follows wherever the app is served/proxied.
- The `messenger*` GraphQL surface (`backend/schema/Messenger.graphql` +
  `resolvers/messenger.ts`) matches the controller's selections verbatim; `_normalize*`
  consume the shapes unchanged. The only controller edit was quoting string message IDs
  (`before`/`messageId`/`parentMessageId` are nanoid `String`s).
- `frontend/webapp/src/setupProxy.js` proxies `/messenger` (with `ws:true` for the
  socket.io upgrade) and `/graphql` to `BACKEND_URL`. For the dev CRA server to hit the
  green-field backend, point `BACKEND_URL`/`REACT_APP_LOCAL_BACKEND` at the green-field
  origin (the green-field serves both the legacy community surface and `messenger*`, so no
  per-operation split is needed — the whole backend flips together).

### Backend

`messenger*` resolvers identify the acting user from the `Authorization: Bearer <token>`
header (wired into the GraphQL context). Single instance + in-process presence needs no
Redis (set `REDIS_URL` only when scaling horizontally).

File uploads (`messenger_files`) are deferred (reuse the profile-image S3 work when it
lands).
