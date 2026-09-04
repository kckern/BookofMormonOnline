# Retiring the legacy message-reference model — manual runbook

`2026-09-03-retire-legacy-content-refs.sql` drops the legacy reference columns
(`messenger_messages.link_type` / `link_target` / `link_aux`) and the
`messenger_highlights` table. These were superseded by the canonical-reference
model in `messenger_messages.content_refs` (JSON `Reference[]`) shipped 2026-09-03.

**Status: HELD on purpose.** The reformer-post redesign is complete and live with
the legacy columns still present (dual-read + render bridge tolerate both). The
columns are harmless redundancy. This drop is optional cleanup — run it only when
the prerequisites below are done.

## ⚠️ Hard prerequisites — do NOT run the SQL until ALL are true

Running the drop while any deployed code still *reads* the legacy columns/table
breaks the feed and the page-comment view for every user. Before running:

1. **Read path migrated off the legacy columns.** `messages.ts` must build the
   back-compat `data` field from `content_refs`, not from `link_type/target/aux`
   or `messenger_highlights`. This half is already written on branch
   **`feat/content-model-phase2`, commit `80e4829f`** (`buildDataString` rewrite +
   removed the `messenger_highlights` query + dropped the legacy columns from
   `getMessagesForChannels`' SELECT). It is NOT deployed.
2. **Write path migrated.** `postMessage` (and the realtime message handler +
   reader authoring in `Study.js`) must persist `content_refs` (+ `anchor`) for
   NEW posts — deriving references from the reader's `link`/`highlights` input.
   **This half is NOT built yet.** Without it, a study comment posted after the
   read-path deploy has `content_refs = NULL` and loses its scripture link/
   highlight on read (8 unit tests in `test/messaging/messages.test.ts` +
   `pagecomments.test.ts` demonstrate this gap).
3. **Backfill applied.** `backend/scripts/backfill-content-refs.mjs --apply` has
   populated `content_refs` for existing rows (done on `bom_prd` 2026-09-03 —
   3768 rows, incl. enriched `slug`/`ordinal` on verse refs).
4. **Deployed + verified on prod:** the feed renders, the page-comment view shows
   per-verse counts, AND a freshly-posted reader comment (with a highlight and a
   verse link) round-trips correctly.

Only after 1–4: run the SQL.

## How to run

Connect to the prod DB (`bom_prd`) as a writable user and execute the file:

```sh
mysql -h <MYSQL_HOST> -P <MYSQL_PORT> -u <writable_user> -p bom_prd \
  < scripts/sql/2026-09-03-retire-legacy-content-refs.sql
```

The script first creates two backup tables (`_bak_msg_legacy_refs_20260903`,
`_bak_messenger_highlights_20260903`), then drops. Keep the backups until you're
confident, then drop them manually. A rollback recipe is at the bottom of the SQL.

## Notes
- `messenger_messages.custom_type` is NOT dropped — it remains the page-slug the
  page-comment view (`getPageComments`) SQL-filters on. The new `anchor` column
  mirrors it; unifying/retiring `custom_type` is a separate, later decision.
- There is also a stub at `backend/migrations/2026-09-03-retire-legacy-refs.sql`
  from the original plan; this `scripts/sql/` version supersedes it (adds backups
  + rollback). Prefer this one.
