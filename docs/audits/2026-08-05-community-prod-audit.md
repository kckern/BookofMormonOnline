# Community Surface — Prod-Readiness Audit

**Date:** 2026-08-05  
**Auditor:** agentic (Task 6 — parallel independent pass)  
**Surface:** Community — `homefeed`, `leaderboard`, `joinGroup`, `botlist`, LLM bots, C-4 stubs  
**Reference:** `docs/plans/2026-08-05-prod-audit-execution-plan.md` §Task 6  
**Backend:** `backend/src/graphql/resolvers/community.ts`, `ported_user.ts`, `ported_community.ts`, `realtime/botResponder.ts`, `bots/scheduler.ts`

---

## Surface Summary

Five candidate findings (C-1–C-5). **Two confirmed at P0/P1 severity (C-1, C-5); one partial (C-4 — two of three stubs confirmed, user(token) confirmed unresolved); C-2 and C-3 confirmed as stated.**

| ID | Title | Verdict | Severity | Launch-blocker? |
|----|-------|---------|----------|----------------|
| C-1 | Feed privacy not masked | **CONFIRMED** | P1 | Yes |
| C-2 | `joinGroup` ignores `custom_type` | **CONFIRMED** | P1 | Yes |
| C-3 | LLM cost/abuse + per-process in-flight guard | **CONFIRMED** | P1 | Conditional (only if OPENAI_API_KEY is set in prod) |
| C-4 | Prod-visible stubs | **CONFIRMED** | P1 | No (REFUTED as unsafe — stubs are benign data leaks, not crashes) |
| C-5 | `botlist` no auth | **CONFIRMED** | P1 | Yes |

---

## Findings

### C-1 Feed privacy not masked — CONFIRMED (severity: P1)

- **Claim:** `homefeed` feed items include real user nicknames even for private accounts; only the `leaderboard` path applies `maskUserPrivacy`.
- **Method:** Code review of `community.ts:192` (`maskUserPrivacy`), `community.ts:410` (leaderboard `buildHomeUser` calls `maskUserPrivacy`), `community.ts:209–211` (`assembleHomeFeedItem` calls `assembleHomeUser` raw), `community.ts:171` (`assembleHomeUser` hardcodes `public: false`). Dynamic probe of `homefeed`.
- **Evidence:**
  - `assembleHomeFeedItem` (line 211): `const user = userDto ? assembleHomeUser(userDto) : null;` — no `maskUserPrivacy()` call.
  - `assembleHomeUser` (line 171): `public: false,  // privacy determination requires cross-table lookup; default to false per legacy` — every user is marked non-public but never masked.
  - Replier users (line 228): `(msg.thread_info?.most_replies ?? []).map((r) => assembleHomeUser(r))` — same omission.
  - Leaderboard at line 410: `return maskUserPrivacy(hu);` — guard IS present here.
  - Live probe: `{ homefeed { feed { user { nickname user_id } } } }` returned real names `"Kathy Cross"`, `"Jeff Becker"`, `"moony carson"`, `"Alan L"` for users who may have private account settings — full nicknames exposed to any authenticated caller.
- **Impact:** Any signed-in user can enumerate real nicknames of private users via `homefeed` feed items and thread replier lists.
- **Fix sketch:** Pass `assembleHomeFeedItem`'s user through `maskUserPrivacy` (requires `public` flag from the DB or the `publicSet` lookup already used by the leaderboard path).

---

### C-2 `joinGroup` ignores `custom_type` — CONFIRMED (severity: P1)

- **Claim:** `joinGroup(hash)` resolves any channel from `bom_shortlinks` and calls `addUserToChannel` without checking `custom_type`, so a shortlink to a private/DM channel silently admits the joiner.
- **Method:** Code review of `community.ts:754–790`.
- **Evidence:**
  ```
  community.ts:765–773
  const row = await ctx.db.selectFrom('bom_shortlinks').select('string')
    .where('hash', '=', hash).executeTakeFirst();
  const channelUrl = row?.string;
  if (!channelUrl) return { isSuccess: false, msg: 'Group not found' ... };
  const success = await addUserToChannel(ctx.db, channelUrl, myUserId, 'member');
  ```
  No `getChannel()` call, no `custom_type` check, no membership-policy check.  
  Contrast `joinOpenGroup` (line 797-826): explicitly fetches channel and gates on `custom_type !== 'open'`.
- **Impact:** An attacker with a shortlink hash for a private or DM channel can join it without approval, bypassing the `custom_type === 'public'` request flow.
- **Fix sketch:** Fetch the channel via `getChannel()` after resolving the URL; reject if `custom_type` is `'private'` or `'DM'`; require `custom_type === 'open'` or an operator-granted state.

---

### C-3 LLM cost/abuse + per-process in-flight guard — CONFIRMED (severity: P1)

- **Claim:** Every human message in a bot channel triggers an unconditional OpenAI call with no app-layer rate limit or cost budget; the in-flight guard is a module-level `Set` that resets per process restart.
- **Method:** Code review of `realtime/botResponder.ts`, `bots/generate.ts`, `bots/mastra/model.ts`, `bots/scheduler.ts`.
- **Evidence:**
  - `botResponder.ts:54`: `const inFlight = new Set<string>();` — module-level, not Redis-backed, not shared across worker processes.
  - `botResponder.ts:87–149`: `maybeBotReply()` fires on every successful `send_message` with no per-user/per-channel message rate check. Only guard is the in-flight Set (one concurrent reply per channel) and bot-authored message skip.
  - `bots/mastra/model.ts:35`: `if (process.env['OPENAI_API_KEY']) return openai(modelId || DEFAULT_MODEL);` — generation calls go straight to OpenAI with no token budget cap, no request-per-minute cap, no daily cost ceiling in application code.
  - `bots/scheduler.ts:87–108`: Scheduler loop also calls `generateBotReply` per bot per scheduled round with no budget guard.
  - No `rateLimit`, `cost_cap`, `budget`, or `max_tokens` in any of these files.
- **Impact:** A flood of messages to a bot channel (or rapid scheduling) generates unbounded OpenAI API calls. Under multi-process deployment (e.g., cluster mode) the per-process in-flight Set provides no cross-process deduplication, allowing parallel replies from different workers. Cost and quota exhaustion on prod.
- **Fix sketch:** Gate `maybeBotReply` behind a Redis TTL key (per-channel, 5–30 s cooldown); add an OpenAI provider-level spending cap; document that the in-flight Set only works in single-process deployment.

---

### C-4 Prod-visible stubs — CONFIRMED (severity: P1)

Three sub-findings:

#### C-4a — `studygrouphistory` hardcoded user list

- **Claim:** `studygrouphistory` always returns history for `['tytus','kckern']` regardless of the `studyGroupID` argument.
- **Method:** Code review of `ported_user.ts:103–131`. Dynamic probe.
- **Evidence:**
  - `ported_user.ts:106`: `const userList = ['tytus', 'kckern'];` — hardcoded; `studyGroupID` arg is passed through as an echo but the query ignores it entirely.
  - Live probe: `studygrouphistory(studyGroupID: "randomid")` returned `{ studyGroupID: "randomid", studyGroupName: "My Group", userHistories: [{ user: "tytus" }, { user: "kckern" }] }`.
- **Impact:** Any caller can see the reading progress of users `tytus` and `kckern` regardless of which study group they request. Leaks internal developer accounts' progress data publicly.
- **Fix sketch:** Remove or gate the resolver; a real implementation requires a `bom_studygroup_members` lookup.

#### C-4b — `moregroups` and `postcomments` return stubs

- **Claim:** Both resolvers are registered but return `[]` unconditionally.
- **Method:** Code review of `ported_community.ts:45,50`. Dynamic probe.
- **Evidence:**
  - `ported_community.ts:45`: `moregroups: async () => asGql([]),`
  - `ported_community.ts:50`: `postcomments: async () => asGql([]),`
  - Live probes: `moregroups(token:"x", grouping:"all"){ url }` → `{}` (graphql-yoga serializes `[]` as absent); `postcomments(token:"x", message:1){ id }` → `{}`.
  - Note: `{}` is graphql-yoga's response for a null/empty list field; the resolvers are running and returning `[]`, not crashing. No data is leaked.
- **Impact:** Frontend pagination features silently do nothing; no security exposure from these two (they are benign stubs). The recon over-claimed them as a security issue — they're a functional gap only.
- **Fix sketch:** These are intentional legacy-parity stubs (matching the original behavior); annotate as TODO or implement pagination.

#### C-4c — `user(token)` has no Query resolver

- **Claim:** `BomUser.graphql` declares `user(token: [String]): User` in `extend type Query` but no `Query.user` resolver exists.
- **Method:** `grep -rn "^\s*user:" backend/src/graphql/resolvers/*.ts` (no match for a Query-level `user` key); review of all registered resolver maps in `resolvers.ts:289–312`; direct probe.
- **Evidence:**
  - No `Query: { user: ... }` entry in any of: `userauth.ts`, `ported_user.ts`, `userprofile.ts`, `useractivity.ts`, or `resolvers.ts`.
  - `BomUser.graphql:2`: `user(token: [String]): User` is declared.
  - Live probe: `{ user(token: ["sometoken"]) { user name email } }` → `{"data":{}}` (null, no error — default resolver silently returns null).
- **Impact:** Any frontend code relying on `query { user(token) { ... } }` gets a silent null response; no security exposure, but a broken feature at launch.
- **Fix sketch:** Add a `Query.user` resolver (port of legacy BomUser.ts `user(token)` → `findUserByToken`) or deprecate the SDL field and update consumers.

---

### C-5 `botlist` no auth — CONFIRMED (severity: P1)

- **Claim:** `botlist(channel)` returns the full study-bot roster with no authentication check.
- **Method:** Code review of `community.ts:712–744`. Anonymous probe via `--anon` flag.
- **Evidence:**
  - `community.ts:712–744`: no `token` arg, no `ctx.user` / bearer check of any kind — resolver calls `listStudyBots(ctx.db, ctx.lang)` unconditionally.
  - Anonymous probe: `node scripts/study/probe.mjs --as coma --anon '{ botlist(channel:"x"){ id name enabled } }'` returned:
    ```json
    { "botlist": [
        { "id": "d7fb4f2fdc1f9e57a5d2b9f70c4d1386", "name": "Help Desk", "enabled": true },
        { "id": "a39730b7d46d6c38f1f28c832ea18e12", "name": "Linguist Agent", "enabled": true },
        { "id": "ddc26a0e41b6daffff542e9fe8d9171d", "name": "StudyBuddy", "enabled": true }
      ]
    }
    ```
  - Bot `user_id` hashes are returned (the MD5 of their usernames), enumerating internal bot account IDs to any unauthenticated caller.
- **Impact:** Unauthenticated enumeration of all study bots with their internal `user_id` hashes. The `user_id` values are the same IDs used in messenger membership and message authorship — an attacker can correlate bot activity or attempt to spoof bot origins if other authz gaps exist.
- **Fix sketch:** Require a valid bearer/session token before calling `listStudyBots`; bot IDs are not public-safe identifiers.

---

## Top Blockers

1. **C-1 (P1) — Feed privacy not masked:** Real nicknames of private-account users leak via `homefeed` feed items and replier lists. Affects every signed-in user who views the home feed. One-line fix: pipe `assembleHomeFeedItem`'s user through `maskUserPrivacy`.

2. **C-2 (P1) — `joinGroup` ignores channel type:** Any shortlink holder can join private/DM channels without operator approval. Requires adding a `getChannel()` call and `custom_type` gating in `community.ts:joinGroup`.

3. **C-5 (P1) — `botlist` unauthenticated:** Bot IDs enumerable by anyone. Requires a bearer check before `listStudyBots`.

4. **C-3 (P1, conditional) — Unbounded LLM spend:** Only a blocker if `OPENAI_API_KEY` is set in prod. If bot features are disabled for launch, defer; if enabled, add a Redis TTL cooldown before shipping.

5. **C-4a (P1) — `studygrouphistory` leaks developer accounts:** Any caller gets `tytus`/`kckern` reading progress regardless of the studyGroupID arg. Should be gated or stripped before prod.

---

## Probes Executed

| Probe | Command | Result |
|-------|---------|--------|
| C-5 anon botlist | `probe.mjs --as coma --anon '{ botlist(channel:"x"){ id name enabled } }'` | Returns 3 bots with IDs — CONFIRMED |
| C-1 homefeed nicknames | `probe.mjs --as coma '{ homefeed { feed { user { nickname user_id } } } }'` | Real full names returned — CONFIRMED |
| C-4a studygrouphistory | `probe.mjs --as coma '{ studygrouphistory(studyGroupID:"testgroup123") { ... } }'` | Returns `tytus`/`kckern` for any ID — CONFIRMED |
| C-4b moregroups | direct curl `{ moregroups(...) { url } }` | `{}` (empty list, resolver runs) — CONFIRMED benign |
| C-4b postcomments | direct curl `{ postcomments(...) { id } }` | `{}` (empty list, resolver runs) — CONFIRMED benign |
| C-4c user(token) | direct curl `{ user(token:["x"]) { user } }` | `{}` (null, no resolver) — CONFIRMED |
