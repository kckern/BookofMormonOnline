-- Post content model redesign (Phase 4 RETIRE) — DESTRUCTIVE, run LAST.
-- Only after: (1) backfill-content-refs.mjs --apply has populated content_refs
-- for all rows, (2) the new code is deployed, and (3) the feed is verified to
-- render from references. Drops the now-redundant legacy reference columns +
-- the highlights side-table (both folded into content_refs by the backfill).
-- IRREVERSIBLE — take a dump of these columns first if you want a safety net.
ALTER TABLE messenger_messages
  DROP COLUMN link_type,
  DROP COLUMN link_target,
  DROP COLUMN link_aux;

DROP TABLE messenger_highlights;
