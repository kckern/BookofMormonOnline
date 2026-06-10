# Messenger Staging Cutover Runbook

Operational procedure to bring the green-field messaging platform live on a **staging**
subdomain (Sendbird replacement). Evergreen — update in place.

## What "cutover" means
Point a `staging` (or `staging-{lang}`) subdomain's frontend at the green-field backend with
messaging **on**, so real users exercise the live GraphQL + Socket.io loop end to end. Prod
stays on its current path; this is staging only.

## Boot verification (done 2026-06-10)
`npx tsx src/index.ts` boots clean: Fastify on `:5006`, `socket.io initialised on path
/messenger`, GraphQL answers `{__typename}`, socket handshake endpoint reachable. Full backend
suite: 170 green. The DB is already on utf8mb4 and `messenger_*` is seeded.

## ⚠️ The cutover-critical settings (most common mistakes)

1. **`SANDBOX=0`** on the backend. In dev it is `1`, and the sandbox driver
   (`src/data/sandboxDialect.ts`) **suppresses every INSERT/UPDATE/DELETE** — messages would
   appear to send but never persist. Real messaging requires `SANDBOX=0`.
2. **A writable MySQL user.** Dev uses read-only `reader`. With `SANDBOX=0` *and* `reader`,
   writes throw `ER_TABLEACCESS_DENIED`. Use the writable app user.
3. **Proxy must forward the WebSocket upgrade** for `/messenger`. Nginx Proxy Manager /
   Cloudflare in front must pass `Upgrade`/`Connection` headers and allow WebSockets on that
   path, and route `/graphql` + `/messenger` to the backend `:5006`.
4. **`MESSENGER_ENABLED`** is the backend kill-switch — anything but `"false"` = realtime on
   (default). Set to `false` to instantly disable realtime while leaving GraphQL up.

## Backend env (staging)
```
PORT=5006
MYSQL_HOST=…  MYSQL_PORT=3306  MYSQL_USER=<writable>  MYSQL_PASSWORD=…  MYSQL_DB=bom_prd
SANDBOX=0                      # CRITICAL — writes must persist
MESSENGER_ENABLED=             # unset/anything-but-false = on
REDIS_URL=                     # set for multi-instance fan-out + presence; unset = single node
MESSENGER_BOT_TOKEN=…          # bots open sockets with this shared token (bom_user_id null)
OPENAI_API_KEY=…  OPENAI_MODEL=gpt-3.5-turbo   # AI bot responder (or STUB_LLM_REPLY for fixed)
```
Validated zod-required vars: `MYSQL_HOST/USER/PASSWORD` (the rest default). The messaging vars
above are read via `process.env` directly.

## Frontend (staging)
- Messaging is gated at **runtime** by `isMessengerEnabled()` (`src/models/featureFlags.js`):
  on for a `staging`/`staging-{lang}` subdomain, or with `REACT_APP_USE_MESSENGER=true`.
- Point the app at the backend: `REACT_APP_API_URL=<backend origin>` (GraphQL `/graphql` +
  socket `/messenger` resolve from it).
- `REACT_APP_PROFILE_IMAGE_BASE_URL` must match the backend avatar base
  (`https://assets.bookofmormon.online`); 404s fall back to dicebear.

## Pre-flight checklist
- [ ] DB on utf8mb4 (done) and `messenger_*` seeded (done).
- [ ] Backend env set per above — **`SANDBOX=0` + writable user** double-checked.
- [ ] Backend boots clean against staging env; `/graphql` + `/messenger` reachable through the proxy.
- [ ] Proxy forwards the WebSocket upgrade on `/messenger`.
- [ ] Two real test users that share at least one channel (for the two-browser smoke).
- [ ] `MESSENGER_BOT_TOKEN` + OpenAI (or `STUB_LLM_REPLY`) set if testing bot replies.

## Smoke test (two browsers, two real users in a shared channel)
1. Study-group list loads (`homegroups` / `getStudyGroups`).
2. Open a group; history loads (`messengerMessages`, newest→oldest).
3. **Post** a message → appears live in the *other* browser (`message_received`).
4. **React** with an emoji → the reaction renders live in *both* browsers. ← verifies the P1
   reaction-sync fix (the one item still needing a real visual confirmation).
5. **Thread**: reply to a message → reply shows in the thread view both sides.
6. **Typing**: type in one → the other shows the typing indicator (`typing`).
7. **Scroll/page sync**: navigate the study page in one → the other follows (`fire_action` →
   `channel_action`).
8. **DM unread**: send a DM → unread count updates for the recipient.
9. **Bot**: post in a channel with a bot member → an AI reply arrives (`message_received`).
10. **Admin**: as an operator, rename the group / promote a member / remove a member — confirm
    non-operators are now rejected (the new operator gate).

## Rollback
- **Fastest:** set `MESSENGER_ENABLED=false` on the backend and restart — GraphQL stays up,
  realtime off; the frontend degrades. Or point the staging subdomain's flag away so
  `isMessengerEnabled()` returns false.
- Legacy Sendbird is down, so rollback is "messaging off," not "messaging via Sendbird."

## Known caveats / not-yet-done (P3)
- **Reaction visual round-trip** — logic-fixed + unit-verified, but step 4 above is its first
  real visual test. Watch it closely.
- **Profile images** — derived `…/profiles/{md5}.jpg`; confirm the Sendbird→S3 migration images
  exist or accept the dicebear fallback.
- **Ban / mute** — `messenger_members.is_muted` exists but there are no operations; client
  `muteMember`/`banMember` are stubs.
- **`uploadProfileImage`** — backend S3 write not ported (stub returns true).
- **Voice/video calls** — stubs both sides; out of scope.
- **Multi-instance** — only needed if running >1 backend node; set `REDIS_URL` for fan-out +
  presence across nodes.

See `docs/plans/2026-06-10-messenger-frontend-backend-contract-and-roadmap.md` for the full
contract matrix and P3 backlog.
