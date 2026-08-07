# Dev → Prod Final Review Plan

**Date:** 2026-08-05
**Status:** Planning (review NOT yet executed)
**Scope:** Promote the greenfield `backend/` (+ frontend) from dev to prod. Highest-risk surfaces per KC: **user functions, messaging, profile, progress, community.**

This document is the **plan** for the final review + a **candidate-findings register** from a reconnaissance pass (4 parallel read-only surface maps). The candidate findings are *unverified leads* to confirm during the review — they are not conclusions. Nothing here has been fixed.

---

## 1. Objective & go/no-go

Ship a community/study platform to prod without a P0 authorization, data-loss, or cost-runaway defect, and with prod config verified. **Launch-blockers (P0)** must be fixed pre-cutover; **P1** fixed or explicitly risk-accepted with an owner + date; **P2** logged as fast-follow.

**Go/No-Go exit criteria:**
1. Every P0 candidate finding below is either disproven or fixed + regression-tested.
2. The prod-config checklist (§6) is verified against the actual prod environment.
3. A rollback path is documented (dev and prod branches, DB migration reversibility).
4. Each surface has a signed-off reviewer.

---

## 2. Review dimensions (applied to every surface)

Each surface is reviewed through these lenses; the per-surface sections (§5) list where each bites hardest.

- **AuthN** — is the acting user established from a credential the client can't forge?
- **AuthZ** — ownership & role checks (can user X act on resource Y?). *This is the dominant risk this cutover.*
- **Data integrity** — write-on-read, non-transactional invariants, full-replace vs merge, unbounded growth.
- **Privacy** — whose data is exposed to whom (feeds, leaderboard, user lookups).
- **Perf/scale** — N+1, hot-path synchronous I/O, unindexed joins, unthrottled endpoints.
- **Error handling / info leak** — raw errors, enumeration oracles, secrets echoed to clients.
- **Prod config** — env flags whose wrong value silently breaks or exposes (SANDBOX, CORS, keys, Redis).
- **Correctness / stubs** — hardcoded/stub resolvers that will return wrong data in prod.

---

## 3. Methodology (how to review, per finding)

- **Code review** — read the resolver/handler + its service function; confirm the guard is present *and* correct (many gaps are "check exists but is the wrong check").
- **Adversarial black-box testing** — use `scripts/study.cli.mjs` (already built) to drive the live backend as multiple synthetic users and *attempt* each authz bypass (post while banned, edit another user's message, overwrite another user's profile via `userId` arg). This tool already reproduced the ban-bypass. Extend it with a few targeted scenario files under `scripts/study/scenarios/authz/`.
- **DB/schema checks** — verify indexes exist for the hot joins (`bom_log.value`, `messenger_members`), and column sizes (`bom_user.lang`).
- **Config audit** — diff the prod env against §6; grep for `process.env` defaults that silently no-op.
- **No load test required for cutover**, but flag the perf items for a soak once live.

Each candidate finding gets: confirmed? (Y/N), severity (P0/P1/P2), fix or risk-accept decision, owner.

---

## 4. Cross-cutting themes (review these once, they recur everywhere)

1. **The "trust the `userId`/`token` arg" pattern.** Many messenger/community resolvers do `target = args.userId ?? actingUser(ctx)` — the bearer only a *fallback*. Every such site is an AuthZ hole. Enumerate them all (grep `?? resolveActingUserId`, `args.userId`, `args.user_id`) and decide the rule: **the acting user must come from the credential, and any `userId`/`token` arg must be authorized against it** (self, or operator).
2. **Socket write path has no per-event membership/ban check.** `send_message`/`edit_message`/`delete_message`/`add_reaction`/`remove_reaction` check auth (+ mute on send only). A banned or non-member user posts freely; edit/delete don't check message ownership. One shared guard (`assertCanWrite(channelUrl, userId)` + ownership on edit/delete) fixes the class.
3. **`maskedErrors:false` + no rate limiting** turns every resolver into an info-leak/enumeration/abuse surface. Decide globally: mask errors in prod, add throttle to auth + write mutations.
4. **Prod config that silently degrades** (SANDBOX, Redis, CORS, LLM key, lang path). One checklist, verified live (§6).
5. **Stubs shipping as real data** (`studygrouphistory`, `moregroups`, `postcomments`, `user(token)`). Decide: hide the UI or implement.

---

## 5. Per-surface review scope + candidate findings

Severities are the recon's *proposed* triage, to confirm during review.

### 5A. User Functions / Auth
**Components:** `resolvers/userauth.ts` (`signin`/`tokensignin`/`signup`/`signout`), `resolvers/socialsignin.ts`, `resolvers/userprofile.ts` (`changePassword`), `auth/identity.ts`, `auth/password.ts`, `data/loaders/userauth.ts`, socket `realtime/server.ts:54` (`verifyToken`). SDL `schema/BomUser.graphql`.
- **P0 — `resolveLang` lang overflow.** `POST /graphql` → `ctx.lang="graphql"` → written to `bom_user.lang` on signup; if `varchar(3)`, signup errors/truncates. Confirm the column size and that the frontend hits a path/subdomain yielding a valid lang. (`graphql/lang.ts:18`, `loaders/userauth.ts:350`)
- **P0 — no password reset** exists in the new backend. Confirm whether legacy handles it or it's genuinely missing (account-recovery gap).
- **P1 — no rate limiting** on `signin`/`signup`/`changePassword`/`socialsignin`; `changePassword` requires no current password.
- **P1 — enumeration:** signup returns `ER_DUP_ENTRY` msg; `maskedErrors:false` leaks DB errors; `users(user_ids)` returns email for any ids, unauthenticated, unbounded batch.
- **P1 — Facebook `access_token` echoed** back in `SignIn.profile_url` (`loaders/socialsignin.ts:153`).
- **P2 — `generateToken(seed)`** = `md5('bom-token-seed:N')`, deterministic/predictable; tokens are client-generated with no entropy floor and no TTL.
- **P2 — write-on-read:** `tokensignin` provisions `messenger_users` on a query path.

### 5B. Profile
**Components:** `resolvers/userprofile.ts` (`editProfile`/`changePassword`/`uploadProfileImage`), `resolvers/messenger.ts:454/482` (`messengerUpdateUser`/`messengerUpdateUserMetadata`), `messaging/users.ts`, `messaging/avatarAssets.ts`.
- **P0 — profile takeover:** `messengerUpdateUser` & `messengerUpdateUserMetadata` honor an arbitrary `userId` arg (bearer only a fallback) → any authed user overwrites any user's nickname/avatar/metadata. (`messenger.ts:460/487`)
- **P0/P1 — metadata full-replace, not merge:** partial `messengerUpdateUserMetadata` wipes sibling keys incl. `bookmark` and the notification read-watermark. (`messenger.ts:482`, `users.ts:286`)
- **P1 — avatar existence probe is synchronous HTTP per user in `getUser`/`getUsers`** → on the leaderboard/homefeed hot path (100 users), a CDN hiccup = per-user timeout. (`avatarAssets.ts`)
- **P1 — no size validation on `uploadProfileImage` base64 body**; no throttle.
- **P2 — `bom_user.pass` selected into memory** by `getUserByToken`/`findUserByToken` (not exposed by the `User` type today — confirm it never becomes selectable).

### 5C. Progress
**Components:** `resolvers/useractivity.ts` (`log`/`studylog`), `resolvers/userauth.ts:91` (`userprogress`), `resolvers/ported_user.ts` (`pageprogress`/`userdailyscores`), `resolvers/readingplan.ts`, `data/loaders/userauth.ts` (`scoreProgressForUser`/`upsertTokenAndRelinkLogs`), `data/loaders/standardizedScores.ts`, `messaging/readingplan.ts`.
- **P0/P1 — write-on-read in `loadReadingPlan`:** a `readingplan` *query* auto-completes the plan (`UPDATE status`) when progress ≥100 — non-idempotent read that can fire from a homepage widget. (`readingplan.ts:231`)
- **P1 — `loadReadingPlan` full `bom_text` (~40k) scan every call**, filtered in JS, uncached.
- **P1 — leaderboard unthrottled + join perf** (`getPublicUserIds` over 100 ids); confirm indexes.
- **P1 — `standardizedScores` join on `bom_log.value` (mediumtext)** — confirm an index exists or it's a full scan.
- **P1 — one-active-plan race:** `createPlanForUser` check-then-insert with no unique constraint → two concurrent starts = two active plans.
- **P2 — junk-token progress:** `log`/`userdailyscores` fall back to the raw token as the username key; `isValidToken` not checked in `log` itself.
- **P2 — `upsertTokenAndRelinkLogs`** mass-UPDATE unscoped over all of a user's historical tokens.

### 5D. Messaging
**Components:** socket `realtime/handlers/{message,reaction,typing,read,action}.ts` + `realtime/server.ts`; GraphQL `resolvers/messenger.ts`; `messaging/{channels,messages,reactions,members,dto}.ts`. SDL `schema/Messenger.graphql`. See the authorization matrix in the recon (attached below in §7).
- **P0 — socket write handlers check neither membership nor ban** (send/edit/delete/react). Banned/non-member posts confirmed via `study.cli` repro. `isMemberMuted` returns false for a non-member (no row). (`handlers/message.ts:79`, `handlers/reaction.ts:54`)
- **P0 — `edit_message`/`delete_message` don't check message ownership:** `updateMessage`/`deleteMessage` scope by `(channel_url, message_id)` only → any authed socket edits/deletes anyone's message. (`messaging/messages.ts:500/557`)
- **P0 — `messengerCreateChannel` requires no auth** (name is the only gate) → anonymous channel creation. (`messenger.ts:350`)
- **P1 — read authz:** `messengerMessages`/`messengerChannel`/`messengerThreadMessages` return any channel's content with no membership check (private-channel history readable by URL).
- **P1 — `messengerAcceptInvitation`/`DeclineInvitation` honor arbitrary `userId`** (act on behalf of others).
- **P1 — unread-count N+1 fan-out** (2 queries × N channels) in the bulk channel assembler. (`channels.ts:153`)
- **P1 — soft-deleted messages never purged** → unbounded `messenger_messages` growth; no retention job.
- **P1 — notification push is fire-and-forget**, no durable/offline delivery.
- **P2 — `requireOperator`** doesn't assert `state='joined'` for the actor (invited-operator edge, reachable via `operatorIds` on create).

### 5E. Community
**Components:** `resolvers/community.ts` (join/request/process/bots/homefeed/homegroups/leaderboard/botlist), `resolvers/ported_community.ts`, `resolvers/homesampler.ts`, `bots/**`, `realtime/botResponder.ts`, `bots/scheduler.ts`.
- **P0/P1 — feed privacy:** feed `HomeUser` shapes are **not** run through `maskUserPrivacy` (only leaderboard is) → a private user's nickname/avatar shows in feeds, including public channels visible without login. (`community.ts:192/514`)
- **P1 — `joinGroup` (hash) doesn't validate `custom_type`** → a private channel is joinable by anyone holding its shortlink hash. (`community.ts:754`)
- **P1 — LLM cost/abuse:** every human `send_message` in a bot channel triggers an OpenAI call (10-msg context); no app-layer budget cap/rate limit; in-flight guard is per-process only (multi-instance = N replies). (`botResponder.ts`)
- **P1 — stubs returning wrong/empty data in prod:** `studygrouphistory` hardcoded to `['tytus','kckern']`; `moregroups`/`postcomments` permanent `[]`; `user(token)` declared without a resolver. (`ported_user.ts:103`, `ported_community.ts:45/50`)
- **P1 — `botlist` has no auth** (enumerates all study bots).
- **P2 — bot config silent-fail:** no `OPENAI_API_KEY`/wrong `BOT_LLM_MODEL` → bots silently do nothing; agent cache never auto-invalidates; scheduler uses `ORDER BY RAND()`.

---

## 6. Prod-config checklist (verify against the real prod env)

- [ ] `SANDBOX=0` (default is `1` → suppresses all writes). Confirm writes actually persist in prod.
- [ ] `bom_user.lang` column size vs `resolveLang` output; confirm the prod frontend hits a URL that yields a valid ≤3-char lang (not `graphql`).
- [ ] `REDIS_URL` set + reachable (multi-instance presence + socket fan-out; without it, split-brain).
- [ ] Socket CORS `origin:'*'` (`server.ts:182`) — restrict to prod origins if the socket port is internet-facing.
- [ ] `maskedErrors` — turn on for prod (currently `false`, `index.ts:27`); disable GraphQL introspection if required.
- [ ] `OPENAI_API_KEY` (+ `BOT_LLM_MODEL` allowed by the org) — and a **budget/cost cap** decision. `BOT_SCHEDULER_ENABLED` set intentionally.
- [ ] `MESSENGER_ENABLED` (note: only gates the socket, not GraphQL messenger resolvers) and `MESSENGER_BOT_TOKEN` (strong random).
- [ ] `S3_BUCKET` / `PROFILE_IMAGE_BASE_URL` set (missing → `uploadProfileImage` crashes / wrong avatar base).
- [ ] Rate-limit policy for GraphQL auth + write mutations and `send_message` (only the fax route is limited today).
- [ ] `x-forwarded-for` handling behind the prod proxy (first-value trust → IP spoofing into `bom_log.ip`).
- [ ] Password-reset ownership (legacy vs missing).

---

## 7. Sequencing, ownership, effort

1. **Wave 1 — AuthZ (P0), ~2–3 days.** Cross-cutting themes #1 (userId-arg trust) + #2 (socket write guard + ownership) + `messengerCreateChannel` auth. Highest blast radius; do first. Verify each fix with `study.cli` adversarial scenarios (`scripts/study/scenarios/authz/`).
2. **Wave 2 — Config + info-leak (P0/P1), ~1 day.** §6 checklist, `maskedErrors`, rate limiting, lang overflow, enumeration.
3. **Wave 3 — Data integrity & privacy (P1), ~1–2 days.** metadata merge, readingplan write-on-read + one-active race, feed privacy masking, stubs.
4. **Wave 4 — Perf (P1/P2), soak after launch.** Unread N+1, avatar probe on hot path, readingplan scan, leaderboard/index audit.

**Ownership:** one reviewer signs off per surface (5A–5E); a security-lens reviewer owns the cross-cutting AuthZ pass (§4 #1–2). The `study.cli` adversarial suite is the shared verification harness.

## 8. What this plan deliberately defers
- The review itself (this is planning).
- Load/soak testing (post-cutover).
- Legacy-parity questions (password reset, any surface still served by the old box).
- The full recon per-surface maps live in this session's transcript; the confirmed authorization matrix for messaging (write path × {auth, membership, ban, operator, mute}) is reproduced in §5D and should be pasted into the messaging reviewer's worksheet.
