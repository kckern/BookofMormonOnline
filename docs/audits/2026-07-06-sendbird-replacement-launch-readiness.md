# SendBird Rip-and-Replace — Prod Launch Readiness Audit

**Date:** 2026-07-06
**Scope:** `backend/src/messaging/` end-to-end integration (greenfield stack on :5006) + `frontend/webapp` messenger consumers.
**Question:** How close are we to launching to prod with zero SendBird dependencies and feature parity?

---

## Verdict

**Zero live SendBird dependencies remain — anywhere.** No SDK packages, no script tags, no API tokens, no outbound calls to sendbird domains, in either backend or frontend. Everything still named "sendbird" is internal compat naming (the frontend bridge `appController.sendbird`, the wire-format shim `backend/src/auth/sendbirdShim.ts`, shape mappers, comments).

**Feature parity is ~90%.** All core chat features are implemented and mostly tested. Voice calls and polls were intentionally removed. The real gaps: file/image attachments (schema exists, no upload path), no push/email notifications (in-app bell only), and two known backlog bugs (#11 metadata clobber, #12 feed socket gap).

**What actually gates launch is config/infra/data, not code:** six blockers (B1–B6 below), all provisioning-and-cutover work rather than development work. One code fix (backlog #11) is strongly recommended pre-launch because it silently loses user data.

---

## 1. SendBird dependency status

### Package/network level — clean

- `backend/package.json`, `frontend/webapp/package.json`, `frontend/next/package.json`: no sendbird packages.
- No script tags in `frontend/webapp/public/index.html`; no SendBird app IDs in any env file.
- All outbound HTTP in `backend/src/` goes to social-auth providers (Google, Facebook, Naver, Kakao) and Gravatar — nothing to sendbird domains.
- DB identity is home-grown: `messenger_users.user_id = md5(bom_user.user)`; no `sendbird_id` columns.

### Remaining "sendbird" references — all compat naming, non-blocking

| Site | What it is | Classification |
|---|---|---|
| `backend/src/auth/sendbirdShim.ts` | Pure functions (`loadUser`/`createUser`) returning `{user_id, nickname, profile_url, access_token}` in SendBird wire shape for signin/signup responses. No network calls. 6 call sites in the auth flow (`socialsignin.ts`, `userauth.ts` loader + resolver). | Compat shim |
| `frontend/webapp/src/models/MessengerController.js` | The replacement controller; "sendbird" appears only in comments ("Replacement for SendbirdController", "SendBird-compat"). | Compat shim |
| `appController.sendbird` (~84 refs across ~25 view files) | Bridge property `MessengerContext` assigns the controller to; views call `.sb.currentUser`, `.loadGroupMessages()`, etc. All routed to GraphQL + socket.io. | Compat naming |
| `frontend/webapp/src/models/messengerShapes.js` | GraphQL→SendBird-shape mappers so legacy Study/* components need no rewrite. | Compat shim |
| `frontend/webapp/src/index.js:11-18` | One-time `localStorage` cleanup of stale `sb_`/`sendbird` keys. | Vestigial |
| `backend/.env.example:15` | Section header comment "Sendbird replacement". | Comment |
| Legacy profile URLs in data | Some migrated users still have `sendbird-us-1.s3.amazonaws.com` avatar URLs in DB rows. Static data; dicebear fallback covers a dead host, but mirror before SendBird's S3 disappears. | Data artifact |
| `_deprecated/` (old `src/` Apollo stack) | Contains real legacy SendBird code; not part of the live stack. | Dead |

**Renaming `appController.sendbird` → `messenger` is deliberately deferred** — it would churn 25+ files for zero behavior change. Not a launch concern.

---

## 2. Feature parity matrix

| SendBird-era feature | Status | Notes |
|---|---|---|
| Group channels (DM/open/private/public/solo) | ✅ Full | `channels.ts`; `messengerMyChannels`/`messengerChannel` |
| Direct messages + unread counts | ✅ Full | DMs are channels (`custom_type='DM'`); `messengerUnreadDMs` |
| Message send/edit/delete | ✅ Full | Socket `send_message`/`edit_message`/`delete_message` with acks |
| Threads / replies / replier faces | ✅ Full | `parent_message_id`; `thread_info.most_replied_users` everywhere (`31fbfa5e`) |
| Reactions | ✅ Full | `reactions.ts` + socket broadcast + DTO aggregation |
| Read receipts / unread counts | ✅ Works, tests flaky | Logic correct; 8 test failures are test-data-only (backlog #6: oversized test ids vs `varchar(11)`) |
| Presence / online status | ⚠️ Partial | Redis-backed with in-process fallback; per-user not per-socket, so multi-tab close broadcasts false offline (backlog #8) |
| Notifications | ✅ Full (in-app) | Derived from replies/reactions/invites; socket-pushed; bell verified end-to-end (2026-06-13 audit) |
| **Push / email notifications** | ❌ Not implemented | SendBird provided push; new stack is in-app bell only. **UX regression — decide/document before launch.** |
| Moderation: bans | ✅ Full | Real banned state blocks all re-entry paths; operator-only escape; 26 tests (`d076ae4e`, `62c9d7fa`) |
| Moderation: muting | ✅ Full | `is_muted` gated in `send_message` |
| Member roles / operator gates | ✅ Full | `role='operator'|'member'`; admin mutations gated |
| Invites | ✅ Full | Operators always; members via `membersCanInvite` flag (`82a0f74f`); accept/decline state machine |
| User profiles / avatars | ✅ Full | Nickname/profile mutations; S3 upload + dicebear fallback (`avatarAssets.ts`) |
| User metadata | ⚠️ Bug #11 | Wholesale-replace clobbers keys — see §3 |
| Page comments | ✅ Full | Comments are messages; one-round-trip `pagecomments` query (`78286c06`, `90286...`) |
| Bots + AI responder | ✅ Full | `bots/` personas + registry, `ai/LlmGateway` (OpenAI adapter, `STUB_LLM_REPLY` for tests), channel-scoped botlist |
| **File/image attachments** | ❌ Stubbed | `messenger_files` table exists; no upload endpoint, no mutation, no socket payload. Frontend warns and ignores (`MessengerController.js` coverImage). |
| Message search | ❌ Not implemented | No messenger search resolver; app search is separate. Was low-usage on SendBird — confirm out-of-scope. |
| Voice calls | ➖ Removed | Intentional (`26b51d0b`, social hardening §4) |
| Polls | ➖ Removed | Intentional; replaced by optimistic append + socket push (`094041a9`) |

### Frontend↔backend contract

No mismatches found: every socket event MessengerController listens for (`message_received/updated/deleted`, `typing`, `reaction_changed`, `channel_action`, `user_joined/left`, `unread_count_changed`, `notification_received`) is emitted by `backend/src/realtime/`, and every `messenger*` GraphQL query/mutation it issues exists in `backend/src/graphql/resolvers/messenger.ts`. Known dead code: a few unused controller helpers pending prune (backlog #9); StudyGroupBar still has a dead 60s presence poll that should become socket-driven.

---

## 3. Open backlog (docs/reference/messenger-backlog.md)

Fixed since filing: #1 (reaction avatars), #5 (call poll — removed with calls).

**Recommended pre-launch fix:**

- **#11 — metadata clobber (HIGH, silent data loss):** `updateUserMetadata` (`backend/src/messaging/users.ts:286`) wholesale-replaces `messenger_users.metadata` JSON. Socket `update_state` fires on every tab-visibility flip and persists `{activeGroup}`, routinely erasing `summary`/`bookmark` written by other paths. Likely also interacts with the notification read watermark, which lives in the same metadata blob — a visibility flip may wipe notification read state (flagged, not separately verified). Fix is merge semantics (read-modify-write or `JSON_MERGE_PATCH`) — small, contained, ~1–2h with a test.

**Acceptable to launch with, fix after:**

- **#12 — feed socket gap (MEDIUM):** other viewers see new feed replies only on a visibility-triggered refresh; poster sees own reply optimistically. Candidate for the realtime pass per the KC no-polling directive.
- #2 notebook replyCount snake/camel; #3 `loadGroupMessages` hardcoded limit 30 (Page comment counts see only latest 30); #4 edit-path can't change mentions; #6 readstate test ids (test-only); #7 profile `Intl.NumberFormat('')` crash; #8 presence single-instance/per-user; #9 dead helper prune; #10 quadruple message normalization.

---

## 4. Launch blockers (config / infra / data — not code)

| # | Blocker | Detail | Evidence |
|---|---|---|---|
| **B1** | `SANDBOX=0` in prod env | Default is `'1'` → the Kysely sandbox dialect **silently suppresses every INSERT/UPDATE/DELETE**. With the default, prod messaging looks alive but persists nothing. | `backend/src/config/env.ts:11-14`, `backend/src/data/sandboxDialect.ts` |
| **B2** | Writable MySQL user | Prod must use `bom_app` (RW), not the `reader` account dev runs on. | `docs/reference/messenger-staging-cutover-runbook.md` |
| **B3** | Provision core env | `MYSQL_HOST/PORT/USER/PASSWORD/DB`, `PORT=5006`, `MESSENGER_BOT_TOKEN`, `OPENAI_API_KEY` (or bots silently degrade). Full template: `backend/.env.example`. | `backend/.env.example` |
| **B4** | WebSocket front door | The Next.js :8200 front door **cannot proxy WS upgrades** (HTTP rewrite only). Prod proxy (nginx/NPM) must route `/graphql` + `/messenger` straight to :5006 with `Upgrade`/`Connection` headers, and Cloudflare must permit WebSockets. Dev worked around this via `REACT_APP_API_URL` → :5006 direct; without a prod equivalent, sockets fail and the study layer degrades to "Guest". | `frontend/next/middleware.ts`, `frontend/webapp/src/contexts/MessengerContext.js:48`, cutover runbook §WebSocket |
| **B5** | Frontend build env | `REACT_APP_API_URL` (socket falls back to `window.location.origin` — only correct if the proxy in B4 makes same-origin work), `REACT_APP_USE_MESSENGER`, `REACT_APP_PROFILE_IMAGE_BASE_URL` (must match backend `S3_PUBLIC_URL`). | `MessengerController.js:87-101` |
| **B6** | Run the data migration | `backend/scripts/out/sendbird-seed.sql` (4.1 MB, idempotent, generated 2026-06-10 by `gen-sendbird-dump.mjs`) seeds `messenger_*` tables + `bom_user_meta` from the SendBird export. **Not yet applied to prod.** Regenerate/refresh if SendBird stayed live after June 10 and drift matters. | `backend/scripts/gen-sendbird-dump.mjs`, `docs/specs/2026-06-10-messaging-user-data-consolidation.md` |

### Deploy-path gap (blocker-adjacent)

Dev runs the greenfield backend via a systemd user unit (`bom-greenfield.service`: `npx tsx src/index.ts`). **There is no Dockerfile and no prod unit for `backend/`** — the only Dockerfile is the deprecated old-stack one in `_deprecated/`. Prod is also **1,655 commits behind dev** (`origin/prod..dev`), so the cutover is effectively a first deployment of the greenfield stack, not an incremental merge. A prod deploy recipe (adapted systemd unit or new Dockerfile + secrets story replacing dev's Infisical `ExecStartPre`) must exist before launch.

### Data cleanup (post-launch acceptable, pre-approved plan needed)

- **~47 duplicate DM channels** in the exported data (188 DM channels, 141 distinct member pairs; one pair has 28). The frontend bug that created them is fixed; cleanup (merge-then-delete) is drafted in the 2026-06-13 study-group loop audit but **awaits owner approval**. Backup snapshot exists (`docs/audits/dm-cleanup-backup-2026-06-13.json`).
- `messenger_users.is_bot` repair already done on dev data (2026-06-11); verify the prod seed reflects it (`metadata.isBot` is source of truth).

### Infra decisions

- **Redis:** optional. Unset → single-instance in-memory presence + socket fan-out (graceful). Required only for >1 backend node; also fixes presence backlog #8.
- **S3:** required for profile-image uploads (`S3_BUCKET`, `S3_PUBLIC_URL`, AWS creds); sandbox currently skips S3.
- **Search:** `SEARCH_BACKEND=like` default is fine; Qdrant is optional and orthogonal to messaging.

---

## 5. Test coverage snapshot

Passing suites: messages, channels, users, bans, inviteAuth, bots, botResponder, community-graphql (+auth), avatarAssets, pagecomments, ai, socket integration (auth, typing, messaging, reactions, unread, action relay end-to-end).

Flaky/failing (all diagnosed as test-harness issues, not logic): `readstate.test.ts` 8 failures (test ids overflow `varchar(11)` — backlog #6), `presence.test.ts` `last_seen_at` timing, `notifications.test.ts` one `markAllNotificationsRead` failure. Untested paths worth adding: metadata merge semantics (with the #11 fix), feed realtime delivery (with #12), multi-tab presence.

---

## 6. Recommended launch sequence

1. **Code (pre-launch):** fix #11 metadata clobber (merge semantics + test). Optionally fix readstate test ids so the suite is green for the cutover.
2. **Deploy recipe:** write the prod systemd unit (or Dockerfile) for `backend/`; decide the prod secrets story.
3. **Data:** regenerate the seed from the latest SendBird export if needed; apply `sendbird-seed.sql` to prod DB; verify `is_bot` flags; get owner sign-off on the DM-dedup plan (can run post-launch).
4. **Infra:** prod proxy routes `/graphql` + `/messenger` → :5006 with WS upgrade; Cloudflare WebSocket on.
5. **Config:** prod `.env` per B1–B3; frontend build with B5 vars.
6. **Merge/deploy:** dev → prod branch (1,655 commits — treat as a fresh deployment with its own smoke pass).
7. **Smoke test:** two real users in a shared channel — post, edit, delete, react, thread, typing, invite, ban/unban, DM, page comment, bot reply, notification bell, presence — then reload and verify persistence (catches a lingering SANDBOX=1 immediately).
8. **Communicate:** no push/email notifications at launch (in-app bell only) — decide whether that's acceptable or needs a follow-up.

---

## Sources

Four parallel audit passes (backend sendbird refs, frontend sendbird refs, feature parity, prod config/deploy) over the working tree at `2bee4afb`, cross-checked against: `docs/reference/messenger-backlog.md`, `docs/reference/messenger-staging-cutover-runbook.md`, `docs/specs/2026-06-10-messaging-user-data-consolidation.md`, `docs/audits/2026-06-10-messaging-three-way-reconciliation.md`, `docs/audits/2026-06-11-messenger-transport-audit.md`, `docs/audits/2026-06-13-study-group-adversarial-loop.md`, `docs/audits/2026-06-13-notification-bell.md`. Key claims (seed file, runbook, SANDBOX default, prod lag count) verified directly.
