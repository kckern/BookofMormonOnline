# Database-Wide utf8mb4 Standardization Plan

> **For agentic workers:** this is a **production** DB migration (`bom_prd`). Every destructive
> step is gated on a verified backup + a dry-run against a clone. Do not run any `ALTER` against
> `bom_prd` until the clone rehearsal passes. The dev host connects as read-only `reader`, so the
> actual run uses writable creds the operator supplies — Claude prepares and verifies scripts; the
> operator executes the window.

**Goal:** Standardize every table/column in `bom_prd` onto a single charset + collation —
`utf8mb4` / `utf8mb4_0900_ai_ci` (the server default) — eliminating the current mb3/mb4/latin1
drift so emoji and full Unicode work everywhere and no future JOIN throws "illegal mix of
collations."

**Approach (decided 2026-06-10):** target `utf8mb4_0900_ai_ci`; execute in a **maintenance
window with scripted `ALTER … CONVERT TO`** (app stopped), preceded by a clone rehearsal.

**Why a window, not online DDL:** the DB is small (~1 GB; biggest table 212 MB) so the window is
minutes; and stopping the app guarantees no half-converted mixed-collation JOIN ever executes
(mb4-vs-mb4 across *different* collations is an error, not a coercion).

---

## Current state (audit 2026-06-10, MySQL 8.0.40, all tables ROW_FORMAT=Dynamic)

- **71 InnoDB tables.** Column charsets: **278 utf8mb3, 100 utf8mb4, 5 latin1.**
- **mb4 is itself split:** 86 `utf8mb4_unicode_ci`, 11 `utf8mb4_0900_ai_ci`, 3 `utf8mb4_bin`.
- **Server default** is already `utf8mb4_0900_ai_ci`; **DB default** is not (legacy mb3).
- **No 767-byte risk:** every table is `Dynamic` → 3072-byte index limit; a `varchar(256)` PK is
  1024 bytes under mb4.
- **FK graph is self-contained:** all 10 FKs are inside the `messenger_*` cluster (already mb4).
  Legacy mb3 tables — including `bom_user` — have **zero incoming FKs**.
- **No generated columns** (nothing to drop/re-add around CONVERT).
- **Biggest tables** (CONVERT = full rebuild; time/disk dominated by these):
  `lds_scriptures_translations` 212 MB / 553k rows · `bom_translation` 142 MB / 292k ·
  `bom_xtras_commentary` 107 MB · `bom_log` 90 MB / 332k · `lds_scriptures_verses` 41 MB.

### Special cases (must handle before/around the blanket CONVERT)

| Case | Table.column | Why | Handling |
|---|---|---|---|
| **latin1** | `bom_xtras_dictionary` (`word`,`_word`,`heading`,`content`,`string`) | latin1→mb4 mojibakes if double-encoded | Only **15 rows** non-ASCII (`_word` 0). Inspect those 15 bytes on the clone; pick true-latin1 (plain CONVERT) vs double-encoded (VARBINARY trick) per Task 4. |
| **BTREE varchar(1000)** | `bom_xtras_stats.key`, `.value` | 1000×4 = 4000 B > 3072 → CONVERT fails | Table is **empty**. Drop both indexes → CONVERT → re-add as 191-char prefix indexes (Task 5). |
| **FULLTEXT** | `bom_text.content`, `bom_translation.value`, `bom_xtras_history.transcript` | FULLTEXT has no 3072 limit | Convert normally; the index rebuilds (slow on `bom_translation`, fine in a window). |
| **`_bin`** | `bom_text.heading`, `bom_text.content`, `bom_xtras_image.title` | TEXT content columns, not tokens/hashes | Let the blanket CONVERT fold them to `0900_ai_ci`. Note: makes `bom_text.content` FULLTEXT case-insensitive (an improvement); confirm no app relies on case-sensitive matching. |

### Interaction with the in-flight Sendbird seed
`bom_user_meta.user` is currently pinned to `utf8mb3` to match `bom_user.user` (commit `5e158f3`).
**Run this migration first.** After `bom_user` becomes `0900_ai_ci`, drop that pin — regenerate the
seed dump so `bom_user_meta.user` is plain `utf8mb4_0900_ai_ci` (Task 9). The seed then loads into a
fully-standardized schema.

---

## Task 1: Rehearsal harness — clone bom_prd and dry-run

**Files:** none in-repo; produces `docs/audits/2026-06-10-utf8mb4-dryrun-results.md` (write findings here).

- [ ] **Step 1: Take a logical backup of the source schema+data**

```bash
# Writable/admin creds (operator-supplied; NOT the dev `reader`). --single-transaction = no lock.
mysqldump -h <host> -u <admin> -p --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 bom_prd > /backup/bom_prd_pre_utf8mb4_$(date +%Y%m%d).sql
```

Expected: a mult-hundred-MB dump; this file is the rollback of record.

- [ ] **Step 2: Load it into a throwaway clone DB**

```bash
mysql -h <host> -u <admin> -p -e "CREATE DATABASE bom_prd_clone CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -h <host> -u <admin> -p --default-character-set=utf8mb4 bom_prd_clone < /backup/bom_prd_pre_utf8mb4_*.sql
```

- [ ] **Step 3: Run the full conversion script (Tasks 4–7) against the CLONE, capture errors**

Run: `mysql -h <host> -u <admin> -p bom_prd_clone < convert-utf8mb4.sql 2>&1 | tee dryrun.log`
Expected: completes with **zero** errors. Any `1071` (key too long), `1062` (dup key from collation
change), or mojibake → fix the script and re-run on a fresh clone before touching prod.

- [ ] **Step 4: Verify the clone is 100% standardized** (Task 8 queries) and spot-check data
  (accented dictionary rows, an emoji round-trip, a FULLTEXT search on `bom_translation`).

- [ ] **Step 5: Record results** in `docs/audits/2026-06-10-utf8mb4-dryrun-results.md`
  (timings per big table, any duplicate-key collisions, the latin1 verdict). This sizes the window.

---

## Task 2: Generate the conversion script

**Files:** Create `backend/scripts/gen-utf8mb4-convert.sql` (the *generator* query) and its output
`backend/scripts/out/convert-utf8mb4.sql` (gitignored — it's operational, like the seed dump).

- [ ] **Step 1: Emit one CONVERT per table that has any non-target char column**

Run this against `bom_prd` (read-only OK — it only SELECTs) to produce the body:

```sql
-- Column-aware: catches every table with >=1 char column not already 0900_ai_ci.
SELECT DISTINCT CONCAT('ALTER TABLE `', TABLE_NAME,
       '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;') AS stmt
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'bom_prd'
  AND CHARACTER_SET_NAME IS NOT NULL
  AND COLLATION_NAME <> 'utf8mb4_0900_ai_ci'
  AND TABLE_NAME NOT IN ('bom_xtras_dictionary','bom_xtras_stats')  -- handled specially
ORDER BY stmt;
```

- [ ] **Step 2: Also sweep table-level defaults** for tables whose columns are all-numeric but whose
  default charset is still mb3 (cosmetic, keeps new columns correct):

```sql
SELECT CONCAT('ALTER TABLE `', TABLE_NAME, '` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA='bom_prd' AND ENGINE='InnoDB' AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci';
```

- [ ] **Step 3: Assemble `convert-utf8mb4.sql`** in this exact order (see Tasks 3–7 for the literal
  blocks): header/guards → DB default → special-case prep (stats, dictionary) → blanket CONVERTs
  (small→large so failures surface fast and the big rebuilds run last) → re-add stats indexes →
  footer. Wrap the whole thing per Task 3.

---

## Task 3: Script header / footer (safety guards)

- [ ] **Step 1: Header**

```sql
-- convert-utf8mb4.sql — standardize bom_prd to utf8mb4 / utf8mb4_0900_ai_ci
-- Run in a maintenance window, app STOPPED, WITHOUT --force (abort on first error).
-- Rollback = restore /backup/bom_prd_pre_utf8mb4_*.sql.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;   -- messenger_* FKs span tables converted in sequence
SET UNIQUE_CHECKS = 0;        -- speed; collations are AI/CI so collisions are caught on the clone
ALTER DATABASE bom_prd CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;  -- new tables match
```

- [ ] **Step 2: Footer**

```sql
SET FOREIGN_KEY_CHECKS = 1;
SET UNIQUE_CHECKS = 1;
-- END
```

Note: this script is **not** transactional — `ALTER TABLE` is DDL and auto-commits per statement.
Atomicity comes from (a) the window + app-stopped, and (b) the backup as the rollback. Running
without `--force` means it halts at the first error, leaving the remaining tables untouched and
diagnosable.

---

## Task 4: Special case — latin1 `bom_xtras_dictionary`

**Files:** add the chosen block to `convert-utf8mb4.sql`.

- [ ] **Step 1: On the CLONE, inspect the 15 non-ASCII `content` rows + any in `string`**

```sql
SELECT id, HEX(content) FROM bom_xtras_dictionary
WHERE content <> CONVERT(content USING ASCII) LIMIT 50;
```

- [ ] **Step 2: Decide encoding and pick ONE block:**

If bytes are lone high bytes (e.g. `E9` for é) → **true latin1**, plain convert:
```sql
ALTER TABLE bom_xtras_dictionary CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

If bytes are UTF-8 sequences (e.g. `C3A9` for é) → **double-encoded**, binary-safe reinterpret
(per affected column; do all five for consistency):
```sql
ALTER TABLE bom_xtras_dictionary
  MODIFY word    VARBINARY(255),
  MODIFY _word   VARBINARY(255),
  MODIFY heading VARBINARY(255),
  MODIFY content BLOB,
  MODIFY string  BLOB;
ALTER TABLE bom_xtras_dictionary
  MODIFY word    VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  MODIFY _word   VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  MODIFY heading VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  MODIFY content TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  MODIFY string  TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL;
ALTER TABLE bom_xtras_dictionary DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

- [ ] **Step 3: Verify on the clone** the 15 rows render correctly (no `Ã©`-style mojibake) after
  whichever path. Keep the chosen block in the final script.

---

## Task 5: Special case — `bom_xtras_stats` oversized BTREE indexes (empty table)

- [ ] **Step 1: Drop the two oversized indexes, convert, re-add as prefix indexes**

```sql
ALTER TABLE bom_xtras_stats DROP INDEX `key`, DROP INDEX `value`;
ALTER TABLE bom_xtras_stats CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE bom_xtras_stats ADD INDEX `key` (`key`(191)), ADD INDEX `value` (`value`(191));
```

(191 chars × 4 = 764 B, safely under 3072; the table is empty so zero data risk. If the app needs
the full 1000-char column indexed, shrink the column instead — but 191 is the standard mb4 key.)

---

## Task 6: Blanket CONVERT — all remaining tables

- [ ] **Step 1: Paste the Task-2 generated `ALTER … CONVERT TO` lines**, ordered small→large.
  `messenger_*` (tiny/being-seeded) and `bom_user` convert here too; FK checks are off so the
  intra-cluster FK collations realign as the cluster converts. Example head/tail:

```sql
-- … dozens of small tables first …
ALTER TABLE `bom_user` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `messenger_users` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `messenger_messages` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
-- … big tables LAST (longest rebuilds) …
ALTER TABLE `lds_scriptures_verses` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `bom_log` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `bom_xtras_commentary` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `bom_translation` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `lds_scriptures_translations` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

---

## Task 7: Execute the window (operator)

- [ ] **Step 1: Announce window; stop the app(s)** so no writes/JOINs hit a half-converted schema.
  Dev: `systemctl --user stop bom-dev`. Prod: its own stop path. (Messaging is already off in prod.)
- [ ] **Step 2: Final fresh backup** (Task 1 Step 1) immediately before running — the true rollback.
- [ ] **Step 3: Run** `mysql -h <host> -u <admin> -p bom_prd < convert-utf8mb4.sql 2>&1 | tee run.log`
  **without** `--force`. Watch for any error → halt, diagnose, restore if needed.
- [ ] **Step 4: Run the verification queries (Task 8).** Must be all-clear before reopening.
- [ ] **Step 5: Restart the app(s); smoke test** (Task 10).

---

## Task 8: Verification queries (must all return zero / expected)

- [ ] **Step 1: No non-mb4 char columns remain**

```sql
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='bom_prd' AND CHARACTER_SET_NAME IS NOT NULL
  AND CHARACTER_SET_NAME <> 'utf8mb4';
```
Expected: **empty.**

- [ ] **Step 2: No stray collations** (everything is 0900_ai_ci)

```sql
SELECT COLLATION_NAME, COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='bom_prd' AND CHARACTER_SET_NAME='utf8mb4'
  AND COLLATION_NAME <> 'utf8mb4_0900_ai_ci'
GROUP BY COLLATION_NAME;
```
Expected: **empty.**

- [ ] **Step 3: Table defaults + DB default standardized**

```sql
SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES
WHERE TABLE_SCHEMA='bom_prd' AND ENGINE='InnoDB' AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci';
SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='bom_prd';
```
Expected: first empty; second `utf8mb4_0900_ai_ci`.

- [ ] **Step 4: FULLTEXT indexes intact** on `bom_text`, `bom_translation`, `bom_xtras_history`
  (re-run the index-type audit; all three still `FULLTEXT`).

---

## Task 9: Drop the seed-dump mb3 pin

**Files:** Modify `backend/scripts/gen-sendbird-dump.mjs`; regenerate `…/out/sendbird-seed.sql`;
update `docs/specs/2026-06-10-messaging-user-data-consolidation.md`.

- [ ] **Step 1:** Now that `bom_user.user` is `utf8mb4_0900_ai_ci`, change `bom_user_meta.user` from
  the `CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci` pin (commit `5e158f3`) to plain
  `utf8mb4` / `utf8mb4_0900_ai_ci` (or just inherit the table default).
- [ ] **Step 2:** Regenerate the dump: `cd backend && npx tsx scripts/gen-sendbird-dump.mjs`.
- [ ] **Step 3:** Re-run the dump's `CREATE TABLE` on the clone to confirm the FK to the now-mb4
  `bom_user.user` succeeds (no error 3780). Commit the generator + spec change.

---

## Task 10: App-side verification

- [ ] **Step 1: Confirm the connection charset is utf8mb4** in both backends so 4-byte chars round-
  trip end to end. Check the legacy Sequelize config (`src/config/` / `src/database/`) for
  `dialectOptions.charset`/`collate` and the green-field mysql2 pool (`backend/src/data/db.ts`).
  Set `charset: 'utf8mb4'` if not already. (Server default is 0900 so unspecified connections are
  fine, but make it explicit.)
- [ ] **Step 2: Smoke test** — post a message containing an emoji 😀 through the messaging path on
  staging and read it back; run a FULLTEXT scripture search; load a dictionary entry with an accent.
  All must round-trip without `?`/mojibake.
- [ ] **Step 3:** Re-run the GraphQL regression suite (`test/`) against the converted DB to confirm
  no query result shifted due to the collation/sort change.

---

## Rollback

The conversion is DDL-per-table with no transaction. If anything goes wrong mid-run or verification
fails: **restore `/backup/bom_prd_pre_utf8mb4_*.sql`** (the pre-window backup) into `bom_prd`. The
latin1→mb4 step is not cleanly reversible by re-converting, so the backup — not a reverse script —
is the rollback of record. Keep it until staging has run on the converted DB for a few days.

## Out of scope / deferred
- Moving `_bin` semantics back for any column later found to need case-sensitive matching (revisit
  only if Task 10 smoke test surfaces it).
- Converting to a *newer* collation than the server default (none exists worth chasing).
- `bom_prd_clone` cleanup: `DROP DATABASE bom_prd_clone;` after the dry-run results are recorded.
