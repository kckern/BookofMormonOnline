# Prod-Readiness Full Audit — Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **This is an AUDIT plan** — most "steps" are *verify a finding* (read cited code + run a probe + record a verdict), not code changes. The deliverable of each surface task is a signed audit report; **do not fix anything** — record confirmed/refuted + evidence.

**Goal:** Confirm-or-refute every candidate finding from the dev→prod recon (`docs/plans/2026-08-05-dev-to-prod-final-review-plan.md`) across the five surfaces, producing one evidence-backed audit report per surface plus a consolidated go/no-go.

**Architecture:** Each surface gets an independent auditor (parallel-safe: read-only + writes a distinct report file). Verification uses three methods — **code review** (read the cited `file:line`, state whether the guard is present *and correct*), **dynamic probes** (a new `scripts/study/probe.mjs` sends raw authenticated GraphQL as a provisioned sim user; `study.cli` scenarios drive the socket path), and **DB/config checks** (schema/index/env). Reports land in `docs/audits/2026-08-05-<surface>-prod-audit.md`.

**Tech Stack:** Node 24 ESM (`node --test`), the existing `scripts/study/` harness (SessionManager/gql/session), live backend at `http://localhost:5006` (POST to `/`), MySQL via `backend/node_modules/mysql2` + `$XDG_RUNTIME_DIR/bom-dev.env`.

---

## File structure

- `scripts/study/probe.mjs` — **new.** Raw authenticated GraphQL probe as a provisioned sim user (bearer token from the roster), with `--anon` (no bearer) and `--uid <handle>` (print another user's `md5` id) for authz tests. The shared dynamic-audit tool.
- `scripts/study/probe.test.mjs` — **new.** Unit test for its arg parser.
- `scripts/study/scenarios/authz/` — **new dir.** Scenario files for socket-path authz repros (ban-bypass already reproducible; add ownership-bypass).
- `docs/audits/2026-08-05-auth-prod-audit.md` … `-community-prod-audit.md` — **new**, one per surface.
- `docs/audits/2026-08-05-prod-audit-summary.md` — **new.** Consolidated go/no-go rollup.

**Verdict format** (every finding in every report):
```
### <ID> <title>  — [CONFIRMED | REFUTED | PARTIAL]  (severity: P0/P1/P2)
- **Claim:** <the candidate finding, one line>
- **Method:** <code ref read + probe run>
- **Evidence:** <exact output / the guard line that is present/absent>
- **Impact:** <what an attacker/user gets>
- **Fix sketch:** <one line — NOT implemented>
```

---

## Task 1: Shared audit harness (`probe.mjs`)

**Files:**
- Create: `scripts/study/probe.mjs`
- Create: `scripts/study/probe.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/study/probe.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProbeArgs } from "./probe.mjs";

test("parseProbeArgs splits flags from the trailing query", () => {
  const r = parseProbeArgs(["--as", "alice", "--anon", "mutation{ x }"]);
  assert.equal(r.as, "alice");
  assert.equal(r.anon, true);
  assert.equal(r.query, "mutation{ x }");
});

test("multi-token query is rejoined", () => {
  const r = parseProbeArgs(["--as", "a", "query{", "__typename", "}"]);
  assert.equal(r.query, "query{ __typename }");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/study/probe.test.mjs`
Expected: FAIL — cannot find module `./probe.mjs`.

- [ ] **Step 3: Implement `probe.mjs`**

```javascript
// scripts/study/probe.mjs
// Raw authenticated GraphQL probe as a provisioned sim user — the dynamic-audit
// tool. Sends the given query with that user's bearer token (or none with --anon),
// so an auditor can test authz (e.g. alice's token + bob's userId arg).
//
//   node scripts/study/probe.mjs --as alice --uid bob \
//     'mutation{ messengerUpdateUser(userId:"<paste bob md5>", nickname:"pwned"){ user_id nickname } }'
//   node scripts/study/probe.mjs --as alice --anon 'mutation{ messengerCreateChannel(name:"anon"){ channel_url } }'

import { SessionManager } from "./manager.mjs";
import { gql } from "./gql.mjs";
import { md5 } from "./session.mjs";

export function parseProbeArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const k = t.slice(2);
      out[k] = argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    } else out._.push(t);
  }
  out.query = out._.join(" ");
  return out;
}

// Guard so importing for tests doesn't run the CLI.
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseProbeArgs(process.argv.slice(2));
  const base = a.url || process.env.STUDY_CLI_URL || "http://localhost:5006";
  if (!a.as || !a.query) { console.error('usage: probe.mjs --as <handle> [--anon] [--uid <handle>] "<graphql>"'); process.exit(2); }
  const mgr = new SessionManager(base);
  const session = await mgr.provision(a.as);
  if (a.uid) console.error(`# uid(${a.uid}) = ${md5((await mgr.provision(a.uid)).username)}`);
  const token = a.anon ? undefined : session.token;
  try { console.log(JSON.stringify(await gql(base, a.query, { token }), null, 2)); }
  catch (e) { console.log("ERROR: " + e.message); if (e.graphql) console.log(JSON.stringify(e.graphql, null, 2)); }
  mgr.disconnectAll();
}
```

- [ ] **Step 4: Run to verify test passes + live smoke**

Run: `node --test scripts/study/probe.test.mjs`
Expected: PASS (2 tests).
Run: `node scripts/study/probe.mjs --as alice "{ __typename }"`
Expected: `{ "__typename": "Query" }`.

- [ ] **Step 5: Commit**

```bash
git add scripts/study/probe.mjs scripts/study/probe.test.mjs
git commit -m "test(study-cli): raw authenticated GraphQL probe for authz audits"
```

---

## Task 2: Auth / User-Functions audit

**Files:** Create `docs/audits/2026-08-05-auth-prod-audit.md`. Reference: review plan §5A.

Verify each finding, record with the verdict format. Exact methods:

- [ ] **A1 — lang overflow (P0).** DB: `SHOW COLUMNS FROM bom_user LIKE 'lang'` (via mysql2 + env) → record the column size. Read `backend/src/graphql/lang.ts:14-23` and `backend/src/data/loaders/userauth.ts:350`. Probe: `curl -s -X POST http://localhost:5006/graphql -H 'content-type: application/json' -d '{"query":"mutation{ signup(token:\"probelang123\", username:\"probelanguser\", password:\"x\", name:\"\", email:\"\", zip:\"\"){ isSuccess msg } }"}'` → CONFIRMED if `ER_DATA_TOO_LONG` (posting to `/graphql` sets lang=`graphql`). Contrast with POST to `/`.
- [ ] **A2 — password reset missing (P0).** `grep -rniE "resetPassword|forgotPassword|password.*reset" backend/src backend/schema` → record. Confirm whether the legacy box owns it (ask/flag).
- [ ] **A3 — no rate limiting on auth (P1).** `grep -rn "rate-limit\|rateLimit\|@fastify/rate-limit" backend/src` → confirm only fax route is limited. Read `backend/src/index.ts` route registration.
- [ ] **A4 — error/enumeration leaks (P1).** Read `backend/src/index.ts:27` (`maskedErrors`), `backend/src/data/loaders/userauth.ts` signup catch (returns `err.code`). Probe: signup a duplicate username via `probe.mjs` → record if `ER_DUP_ENTRY` returns.
- [ ] **A5 — `users(user_ids)` unauth email dump (P1).** Probe: `node scripts/study/probe.mjs --as alice --anon 'query{ users(user_ids:["kckern"]){ user email name } }'` → CONFIRMED if it returns email with no auth.
- [ ] **A6 — Facebook access_token echo (P1).** Read `backend/src/data/loaders/socialsignin.ts` around the `profile_url` build (~line 153) → record whether the raw URL with `access_token` is returned in `SignIn.profile_url`.
- [ ] **A7 — deterministic `generateToken` (P2).** Read `backend/src/graphql/resolvers/ported_user.ts:138`; record the `md5('bom-token-seed:N')` construction.
- [ ] **Step: write the report** to `docs/audits/2026-08-05-auth-prod-audit.md` (all A-findings, verdicts, a surface summary + top-3 blockers). **Commit:** `docs(audit): auth/user-functions prod audit`.

---

## Task 3: Profile audit

**Files:** Create `docs/audits/2026-08-05-profile-prod-audit.md`. Reference: review plan §5B.

- [ ] **P-1 — profile takeover via `userId` arg (P0).** Read `backend/src/graphql/resolvers/messenger.ts:454-500` (`messengerUpdateUser`/`messengerUpdateUserMetadata`); confirm `targetUserId = args.userId ?? resolveActingUserId(ctx)`. Probe (the money test): 
```bash
BOBID=$(node -e "console.log(require('crypto').createHash('md5').update('simbob').digest('hex'))")
node scripts/study/probe.mjs --as alice "mutation{ messengerUpdateUser(userId:\"$BOBID\", nickname:\"OWNED-BY-ALICE\"){ user_id nickname } }"
node scripts/study/probe.mjs --as bob "{ messengerUser(userId:\"$BOBID\"){ nickname } }"
```
→ CONFIRMED if bob's nickname becomes `OWNED-BY-ALICE` (alice edited bob's profile).
- [ ] **P-2 — metadata full-replace wipes keys (P0/P1).** Read `messenger.ts:482` + `backend/src/messaging/users.ts:286` (`updateUserMetadata`). Probe: set metadata `{"summary":"a","bookmark":"b"}` as bob, then update with only `{"summary":"c"}`, then read metadata → CONFIRMED if `bookmark` is gone.
- [ ] **P-3 — avatar existence probe on hot path (P1).** Read `backend/src/messaging/avatarAssets.ts` (`generateAvatarUrl`/existence probe) and confirm `getUser`/`getUsers` calls it synchronously per user. Record the timeout value and whether leaderboard/homefeed pass through it.
- [ ] **P-4 — upload no size cap / no throttle (P1).** Read `backend/src/graphql/resolvers/userprofile.ts:124` — record any base64 size validation before `sharp`.
- [ ] **P-5 — `pass` in memory (P2).** Read `backend/src/data/loaders/userprofile.ts:16` / `userauth.ts:72` select lists; confirm the `User` SDL type (`schema/BomUser.graphql`) does not expose `pass`.
- [ ] **Step: write report + commit** `docs(audit): profile prod audit`.

---

## Task 4: Progress audit

**Files:** Create `docs/audits/2026-08-05-progress-prod-audit.md`. Reference: review plan §5C.

- [ ] **PR-1 — write-on-read in `loadReadingPlan` (P0/P1).** Read `backend/src/messaging/readingplan.ts` around the `progress >= 100 && status === 'active'` → `UPDATE status` (~line 231). Record: a `readingplan` *query* mutates state. If a signed-in sim user has a completable plan, probe `readingplan` twice and check `bom_readingplan.status` in the DB between calls.
- [ ] **PR-2 — `loadReadingPlan` full `bom_text` scan (P1).** Read `readingplan.ts:172` (`SELECT guid, section FROM bom_text`); record it's unpaginated/uncached and JS-filtered. `SELECT COUNT(*) FROM bom_text` to size it.
- [ ] **PR-3 — one-active-plan race (P1).** Read `backend/src/graphql/resolvers/readingplan.ts:48-64` (`createPlanForUser` check-then-insert). DB: `SHOW INDEX FROM bom_readingplan` → confirm no unique constraint enforcing one active plan/user.
- [ ] **PR-4 — leaderboard/scoring join indexes (P1).** DB: `SHOW INDEX FROM bom_log` → is `value` (mediumtext) or `user` indexed for the `standardizedScores`/`scoreProgressForUser` joins (`backend/src/data/loaders/standardizedScores.ts:44`, `userauth.ts:210`)? Record.
- [ ] **PR-5 — junk-token progress (P2).** Read `backend/src/graphql/resolvers/useractivity.ts:54-61` — confirm `log` falls back to the raw token as username and doesn't call `isValidToken`.
- [ ] **Step: write report + commit** `docs(audit): progress prod audit`.

---

## Task 5: Messaging audit (the big one)

**Files:** Create `docs/audits/2026-08-05-messaging-prod-audit.md`; add `scripts/study/scenarios/authz/edit-others-message.yaml`. Reference: review plan §5D + the authorization matrix.

- [ ] **M-1 — socket write has no membership/ban check (P0).** Already reproduced (banned user posted). Re-confirm with a scenario `scripts/study/scenarios/authz/ban-bypass.yaml` (alice creates group, invites bob, bob accepts, alice bans bob, bob posts) and assert bob's post gets a `success:true` ack. Read `backend/src/realtime/handlers/message.ts:79-133` + `reaction.ts:54-100`; record which checks are present (auth, mute) vs absent (membership, ban).
- [ ] **M-2 — edit/delete no ownership check (P0).** Create `scripts/study/scenarios/authz/edit-others-message.yaml`:
```yaml
users: [alice, bob]
settle: 800
steps:
  - as: alice
    do: group.create
    name: "ownership test"
    invite: [bob]
    as_var: ch
  - as: bob
    do: accept
    group: $ch
  - as: alice
    do: post
    group: $ch
    text: "alice's message"
    as_var: m
  - as: bob
    do: edit
    group: $ch
    id: $m
    text: "bob edited alice's message"
  - as: alice
    do: msgs
    group: $ch
    limit: 5
```
Run it; CONFIRMED if the message text becomes bob's edit (bob edited alice's message). Read `backend/src/messaging/messages.ts:500/557` — confirm the UPDATE/DELETE scope by `(channel_url, message_id)` only, no `user_id`.
- [ ] **M-3 — `messengerCreateChannel` no auth (P0).** Probe: `node scripts/study/probe.mjs --as alice --anon 'mutation{ messengerCreateChannel(name:"anon-created"){ channel_url name } }'` → CONFIRMED if a channel_url returns with no bearer. Read `messenger.ts:350-410`.
- [ ] **M-4 — read authz on `messengerMessages` (P1).** Have alice create a private channel she's the only member of; then probe `messengerMessages(channelUrl:...)` as bob (non-member) → CONFIRMED if bob reads the history. Read `messenger.ts:190`.
- [ ] **M-5 — accept/decline invitation as another user (P1).** Read `messenger.ts:730/764`; probe `messengerAcceptInvitation(channelUrl, userId:<bob>)` as alice → record whether the arbitrary `userId` is honored.
- [ ] **M-6 — unread N+1 (P1).** Read `backend/src/messaging/channels.ts:141-158` — confirm `Promise.all(urls.map(getUnreadCount))` (2 queries × N). Record (static confirmation).
- [ ] **M-7 — no message retention/purge (P1).** `grep -rniE "purge|retention|cron|is_deleted" backend/src/messaging` — confirm soft-delete only, no purge job.
- [ ] **Step: write report** (include the full auth matrix confirmed/updated) **+ commit** `docs(audit): messaging prod audit + authz scenarios`. (Commit the `scenarios/authz/*.yaml`; the `.study-cli/` roster stays gitignored.)

---

## Task 6: Community audit

**Files:** Create `docs/audits/2026-08-05-community-prod-audit.md`. Reference: review plan §5E.

- [ ] **C-1 — feed privacy not masked (P0/P1).** Read `backend/src/graphql/resolvers/community.ts:514-588` (`homefeed`) + `192` (`maskUserPrivacy`) + `410` (leaderboard applies it) — confirm feed `HomeUser` shapes are NOT masked. Probe `homefeed` as a user and record whether a non-public user's real nickname appears in feed items.
- [ ] **C-2 — `joinGroup` ignores `custom_type` (P1).** Read `community.ts:754-790`; confirm no `custom_type` check (any resolvable hash joins, incl. private). Record.
- [ ] **C-3 — LLM cost/abuse (P1).** Read `backend/src/realtime/botResponder.ts` (per-`send_message` OpenAI call, per-process in-flight guard) + `backend/src/bots/scheduler.ts`. Record: no app-layer rate limit/budget cap; in-flight guard is a module-level `Set` (per-process). Confirm whether a prod `OPENAI_API_KEY` cost cap exists.
- [ ] **C-4 — prod-visible stubs (P1).** Read `backend/src/graphql/resolvers/ported_user.ts:103` (`studygrouphistory` hardcoded `['tytus','kckern']`), `ported_community.ts:45/50` (`moregroups`/`postcomments` → `[]`), and confirm `user(token)` in `schema/BomUser.graphql` has no resolver (`grep -rn "user:" backend/src/graphql/resolvers/*.ts`). Record each + whether the frontend consumes them.
- [ ] **C-5 — `botlist` no auth (P1).** Probe `node scripts/study/probe.mjs --as alice --anon '{ botlist(channel:"x"){ id name enabled } }'` → record if it enumerates bots with no auth. Read `community.ts:712`.
- [ ] **Step: write report + commit** `docs(audit): community prod audit`.

---

## Task 7: Consolidated go/no-go rollup

**Files:** Create `docs/audits/2026-08-05-prod-audit-summary.md`.

- [ ] **Step 1: Aggregate.** Read the five surface reports; build one table: `finding-id | surface | verdict | severity | launch-blocker?`. Every CONFIRMED P0 is a launch-blocker.
- [ ] **Step 2: Cross-cutting rollup.** Group the confirmed authz findings under the two themes (the `userId`-arg trust pattern; the socket-write guard) and note the single-fix leverage for each class.
- [ ] **Step 3: Go/No-Go statement.** List the P0 blockers that must be fixed before cutover, the P1s needing a risk-accept-with-owner decision, and the P2 fast-follows. Reference the config checklist (review plan §6) as a separate gate.
- [ ] **Step 4: Commit** `docs(audit): consolidated prod-readiness go/no-go`.

---

## Self-review notes

- **Coverage:** every candidate finding in the review plan §5A–5E maps to a lettered task step (A1–A7, P-1–P-5, PR-1–PR-5, M-1–M-7, C-1–C-5) + the config checklist is carried into Task 7 Step 3.
- **No fixes:** this plan verifies and records only. Any fix work is a separate plan (the review plan's Waves 1–4).
- **Harness reuse:** `probe.mjs` (Task 1) is the shared dynamic tool used by Tasks 3/5/6; `study.cli` scenarios cover the socket path (Task 5). `.study-cli/` roster stays gitignored; only `scenarios/authz/*.yaml` are committed.
- **Type consistency:** `parseProbeArgs` (Task 1) is the exact name imported by `probe.test.mjs`; probe flags `--as/--anon/--uid/--url` are used identically across Tasks 3/5/6. Verdict format is identical in every report.
- **Parallel-safe execution:** Tasks 2–6 are independent (read-only + distinct report files) and can be one subagent each; Task 1 must precede 3/5/6 (provides `probe.mjs`); Task 7 is last.
- **Data hygiene:** probes create sim users/channels/messages in the live dev DB — run `node scripts/study.cli.mjs cleanup` after the audit (noted in Task 7).
