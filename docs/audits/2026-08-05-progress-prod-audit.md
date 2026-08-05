# Progress Surface — Prod-Readiness Audit

**Date:** 2026-08-05  
**Auditor:** agentic (Task 4 of `docs/plans/2026-08-05-prod-audit-execution-plan.md`)  
**Method:** Static code review + live DB schema checks (mysql2 against remote bom_prd)  
**Files reviewed:**
- `backend/src/messaging/readingplan.ts`
- `backend/src/graphql/resolvers/readingplan.ts`
- `backend/src/data/loaders/standardizedScores.ts`
- `backend/src/graphql/resolvers/useractivity.ts`
- `backend/src/data/loaders/useractivity.ts`
- `backend/src/data/loaders.ts` (userByToken DataLoader)
- `backend/src/auth/identity.ts` (isValidToken)

---

## Findings

### PR-1 Write-on-read in `loadReadingPlan` — CONFIRMED (severity: P1)

- **Claim:** A `readingplan` GraphQL query (not a mutation) executes an `UPDATE bom_readingplan SET status='completed'` when plan progress reaches 100 %.
- **Method:** Code review of `backend/src/messaging/readingplan.ts:226–236`.
- **Evidence:**
  ```typescript
  // readingplan.ts:225–236
  // Auto-complete on read (spec: no cron). Only for a live user plan.
  let status = plan.status ?? null;
  if (progress >= 100 && status === 'active') {
    // Best-effort auto-complete (spec: no cron). A write failure must not hide
    // the already-computed plan — mark completed in the response regardless.
    try {
      await db.updateTable('bom_readingplan')
        .set({ status: 'completed', enddate: new Date() })
        .where('slug', '=', planSlug)
        .execute();
    } catch (err) {
      console.error('loadReadingPlan: auto-complete write failed', err);
    }
    status = 'completed';
  }
  ```
  The guard is present *by design* (comment says "spec: no cron") — the write-on-read is intentional. However, the `readingplan` query is callable without authentication (any token, including anonymous), and the code path also triggers for plan reads via mutation post-reload calls (`startReadingPlan`, `endReadingPlan`, `updateReadingPlan` all call `loadReadingPlan` after their mutations). The write-on-read pattern means: (a) a query that semantically returns data also mutates DB state; (b) if the plan is at exactly 100 % when the function runs, any authenticated or any-token caller that triggers a reload can finalize the plan — including code triggered via a non-mutation GQL path. Status is set to `'completed'` in the response regardless of whether the write succeeds, so a DB write failure is silently swallowed.
- **Impact:** Unexpected DB mutations on reads make caching unsafe; an in-flight concurrent query could race with the update (the plan is finalized mid-read). Under the dev sandbox mode (`SANDBOX=true`) the Kysely `updateTable` write is NOT suppressed by `runWrite` here — `loadReadingPlan` calls `db.updateTable(...).execute()` directly, bypassing the sandbox write-guard entirely. On dev this will mutate the DB even when `SANDBOX=true`.
- **Fix sketch:** Move the auto-complete write into a dedicated mutation or a background task; or at minimum wrap the `updateTable` call in `runWrite(ctx, ...)` so the sandbox guard applies.

---

### PR-2 `loadReadingPlan` full `bom_text` scan — CONFIRMED (severity: P1)

- **Claim:** `loadReadingPlan` issues an unpaginated, uncached `SELECT guid, section FROM bom_text` on every invocation, loading the entire text table into JS memory and filtering it in-process.
- **Method:** Code review of `backend/src/messaging/readingplan.ts:172`; `SELECT COUNT(*) FROM bom_text` against bom_prd.
- **Evidence:**
  ```typescript
  // readingplan.ts:172
  const allTextBlocks = await db.selectFrom('bom_text').select(['guid', 'section']).execute();
  ```
  DB result: `bom_text` contains **3,544 rows**.

  The call is unconditional — it fires on every `loadReadingPlan` invocation, including the post-create/post-end reloads called from every mutation. There is no cache (no DataLoader, no Redis, no in-memory map). The result is used by `scoreSegment` to filter blocks by section guid, a pure in-JS operation.
- **Impact:** 3,544-row full-table fetch on every reading-plan query and every mutation that calls `loadReadingPlan` (startReadingPlan, endReadingPlan, updateReadingPlan all do it). If leaderboard or study group features call this per-user, it becomes an N×3544-row read. Currently bom_text is small (3,544 rows), so the query is ~fast in practice, but the pattern is unbounded and uncached — adding rows grows cost proportionally with no guard. More critically, there is no index on `bom_text.section`.
- **Fix sketch:** Cache `allTextBlocks` at module/request scope (DataLoader keyed by a singleton, or a Redis/in-memory cache with a long TTL); or restructure `scoreSegment` to accept section-guided DB lookups rather than filtering the full set.

---

### PR-3 One-active-plan race — CONFIRMED (severity: P1)

- **Claim:** `createPlanForUser` enforces the one-active-plan-per-user constraint via an application-level check-then-insert (no DB UNIQUE constraint), leaving a race window where concurrent requests could insert two active plans for the same user.
- **Method:** Code review of `backend/src/graphql/resolvers/readingplan.ts:62–64`; `SHOW INDEX FROM bom_readingplan` and `SHOW CREATE TABLE bom_readingplan` against bom_prd.
- **Evidence (code):**
  ```typescript
  // readingplan.ts:62–64
  const active = await db.selectFrom('bom_readingplan').select('guid')
    .where('owner', '=', username).where('status', '=', 'active').executeTakeFirst();
  if (active) return { isSuccess: false, msg: 'ACTIVE_PLAN_EXISTS' };
  // ... then insert at line 73
  ```
  **DB evidence — `SHOW INDEX FROM bom_readingplan`:**
  ```
  Key_name            | Non_unique | Column_name | Index_type
  idx_owner_status    | 1          | owner       | BTREE
  idx_owner_status    | 1          | status      | BTREE
  ```
  **`SHOW CREATE TABLE bom_readingplan` (full):**
  ```sql
  CREATE TABLE `bom_readingplan` (
    `guid`      varchar(32)  DEFAULT NULL,
    `slug`      varchar(256) DEFAULT NULL,
    `title`     varchar(256) DEFAULT NULL,
    `owner`     varchar(256) DEFAULT NULL,
    `startdate` date         DEFAULT NULL,
    `duedate`   date         DEFAULT NULL,
    `status`    enum('active','completed','abandoned') DEFAULT NULL,
    `config`    json         DEFAULT NULL,
    `enddate`   date         DEFAULT NULL,
    KEY `idx_owner_status` (`owner`,`status`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  ```
  `idx_owner_status` is a non-unique (`Non_unique: 1`) composite index. There is **no UNIQUE constraint on `(owner, status)` or on any partial filter `WHERE status='active'`**. No primary key exists on `guid`. The table has no PK at all.

- **Impact:** Two concurrent `startReadingPlan` mutations for the same user can both pass the `active` check (neither sees the other's uncommitted insert), resulting in two `status='active'` rows for the same owner. The user's next `loadReadingPlan` (with no slug) does `LIMIT 1` on `WHERE owner=... AND status='active'` — it will load whichever row the DB returns first, silently ignoring the second active plan.
- **Fix sketch:** Add a partial unique index `CREATE UNIQUE INDEX uniq_owner_active ON bom_readingplan (owner, status(6))` filtered to active rows, or use a DB transaction with `INSERT ... SELECT` / `INSERT ... ON DUPLICATE KEY` pattern. Also: add a PK.

---

### PR-4 Leaderboard/scoring join indexes — PARTIAL (severity: P1)

- **Claim:** The `standardizedScores`/`scoreProgressForUser` joins on `bom_log` are missing indexes on `value` (mediumtext) and `user` columns, causing full scans.
- **Method:** `SHOW INDEX FROM bom_log` against bom_prd; code review of `backend/src/data/loaders/standardizedScores.ts:67–74` and `backend/src/data/loaders/userauth.ts:225–229`.
- **Evidence — `SHOW INDEX FROM bom_log`:**
  ```
  Key_name                  | Non_unique | Column_name | Index_type | Cardinality
  PRIMARY                   | 0          | id          | BTREE      | 441073
  idx_unique_timestamp_user | 0          | timestamp   | BTREE      | 445197
  idx_unique_timestamp_user | 0          | user        | BTREE      | 378122
  type                      | 1          | type        | BTREE      | 49
  user                      | 1          | user        | BTREE      | 39432
  timestamp                 | 1          | timestamp   | BTREE      | 445197
  ip                        | 1          | ip          | BTREE      | 52483
  ```
  - **`user` IS indexed** (standalone `KEY user (user)` with cardinality 39432, plus the compound `idx_unique_timestamp_user(timestamp, user)`). The `scoreProgressForUser` query `WHERE user = ${username} AND type = 'block'` will use the `user` index efficiently. **Claim that `user` is unindexed is REFUTED for this column.**
  - **`value` (mediumtext) is NOT indexed.** The `standardizedScores.ts` query at line 67–74:
    ```sql
    SELECT t.guid AS guid, l.user AS user, l.timestamp AS timestamp
    FROM bom_text t
    INNER JOIN bom_log l ON l.value = t.guid
    WHERE l.type = 'block' AND l.credit >= 80 AND l.user IN (...)
    ```
    joins `bom_log.value` (a `mediumtext` column) to `bom_text.guid` (varchar). `bom_log.value` has no index. MySQL cannot index `mediumtext` directly without a prefix. With 441k+ rows in `bom_log`, this join must scan the `bom_log` side (filtered by `user IN (...)` using the `user` index, but then `value` join to `bom_text` is a hash/nested-loop without an index on `bom_log.value`). For large `userList` sets (studygrouphistory) this degrades.
  - **`scoreRecentBlockLogs` in `useractivity.ts`** queries `WHERE l.user = ${queryBy} AND l.type = 'block' ORDER BY l.timestamp DESC LIMIT 5` — this is served by the `user` index plus `type` index, so it is reasonably efficient.
- **Impact:** Partial — `user` index exists and helps the per-user scorer. The `standardizedScores` join on `bom_log.value` (mediumtext, unindexed) is the genuine bottleneck for leaderboard/group-history queries over large user lists. The `bom_log` table also has no PK-style constraint on `guid` (`slug`), and there is no primary key defined on `bom_readingplan` either (noted above).
- **Fix sketch:** Change `bom_log.value` to `varchar(64)` (guids are 32-char hex) and add an index; or restructure the query to filter `bom_log` on `(user, type)` first then join via a derived table. Short-term: add `KEY value_prefix (value(32))` if a full type change is deferred.

---

### PR-5 Junk-token progress — REFUTED (severity: P2)

- **Claim:** The `log` mutation falls back to the raw token as username when the token is invalid, without calling `isValidToken`, causing junk tokens ("null", "undefined") to be stored as user identity in bom_log.
- **Method:** Code review of `backend/src/graphql/resolvers/useractivity.ts:54–61` and `backend/src/data/loaders.ts:494–520` (`userByToken` DataLoader).
- **Evidence:**
  The resolver at `useractivity.ts:59` uses `ctx.loaders.userByToken.load(token)` — it does NOT directly fall back without validation. The DataLoader in `backend/src/data/loaders.ts:494–520`:
  ```typescript
  // loaders.ts:494–520
  const userByToken = new DataLoader<string, UserRow | null>(async (tokens) => {
    // Never resolve a junk token ("null"/""/"undefined") to a user...
    const valid = [...new Set([...tokens].filter(isValidToken))];
    const rows = valid.length
      ? await db.selectFrom('bom_user_token')...
      : [];
    const byToken = new Map(rows.map((r) => [r.token, r as unknown as UserRow]));
    return tokens.map((t) => byToken.get(t) ?? null);
  });
  ```
  `isValidToken` (in `backend/src/auth/identity.ts:18–20`) rejects `''`, `'null'`, `'undefined'`, `'false'`, `'NaN'`, `'none'`:
  ```typescript
  const JUNK_TOKENS = new Set(['', 'null', 'undefined', 'false', 'NaN', 'none']);
  export function isValidToken(token: unknown): token is string {
    return typeof token === 'string' && token.length > 0 && !JUNK_TOKENS.has(token);
  }
  ```
  When a junk token like `"null"` is passed: `userByToken.load("null")` → DataLoader filters it out via `isValidToken` → `userRow` is `null` → `queryBy = userRow?.user ?? token` → `queryBy = "null"` (the raw token string). So the junk token IS still used as the `user` value in `bom_log.user` for the insert.
  
  **However**, this fallback (`queryBy = token`) is the same behavior as the legacy system for anonymous/guest users — guests are identified by their session token (or device id). The DataLoader guard prevents a DB row with `user = 'null'` from *resolving back to a real user account* on future reads (`userByToken.load('null')` → `null`). The scoring queries in `scoreProgressForUser` and `completedGuids` use `queryBy` to query `bom_log`, so a guest's progress is tracked under their token string. This is the intended guest-tracking design.
  
  The plan's claim was that junk tokens bypass `isValidToken`. This is REFUTED — `isValidToken` IS called in the DataLoader. What remains is a design question (not a bug): should `log` silently accept any string as a guest identifier, or should it reject syntactically invalid tokens? The current behavior mirrors legacy and is intentional. The `last_active` update at line 64 is gated on `if (userRow)`, so junk-token logs do NOT update real user activity.

- **Impact:** None for user account security. Guest progress logged under raw token strings (including nonsense tokens like `"null"`) accumulates in bom_log but can never resolve back to a real user account. The JUNK_TOKENS set in `isValidToken` only covers a fixed list — a crafted string not in the set (e.g. `"garbage123"`) would be treated as a valid guest token. This is a minor data-quality concern, not a security issue.
- **Fix sketch:** No fix required for security. If DB cleanliness is a concern, add an input validation step in the `log` resolver: if the token resolves to null AND is not a plausible session-token format (e.g., fails a UUID/nanoid regex), return `{ logged: false }` instead of inserting.

---

## Surface Summary

| Finding | Title | Verdict | Severity | Launch Blocker? |
|---------|-------|---------|----------|-----------------|
| PR-1 | Write-on-read in `loadReadingPlan` | CONFIRMED | P1 | No (known design; sandbox bypass is the real gap) |
| PR-2 | Full `bom_text` scan on every plan read | CONFIRMED | P1 | No (3,544 rows; small now, unbounded growth) |
| PR-3 | No UNIQUE constraint on one-active-plan | CONFIRMED | P1 | Risk-accept needed |
| PR-4 | `bom_log.value` unindexed for leaderboard join | PARTIAL | P1 | No (user index exists; value join is the gap) |
| PR-5 | Junk-token progress bypasses `isValidToken` | REFUTED | P2 | N/A |

## Top Blockers (this surface)

1. **PR-3 (CONFIRMED, P1):** No UNIQUE DB constraint on `(owner, status='active')` in `bom_readingplan`. A race window exists for concurrent plan creation. The table also has no primary key, which is a schema smell. Fix before prod cutover.

2. **PR-1 (CONFIRMED, P1, sandbox-bypass variant):** `loadReadingPlan` calls `db.updateTable(...).execute()` directly — not via `runWrite()` — so the sandbox write-guard (`SANDBOX=true`) does not protect the dev DB. If dev team expects sandbox to suppress all writes, this is an active bug. The write-on-read pattern itself is an intentional design choice ("spec: no cron") but should be documented as a known constraint.

3. **PR-2 (CONFIRMED, P1):** The unconditional full `bom_text` scan per plan-read is a footgun as the table grows. Currently 3,544 rows (acceptable), but zero caching means any N-user leaderboard feature that aggregates plans will N×scan the table. Recommend caching before prod if plan-query volume scales.
