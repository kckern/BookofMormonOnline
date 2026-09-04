-- ============================================================================
-- Retire the legacy message-reference model (manual, DESTRUCTIVE, run LATER).
-- Drops messenger_messages.link_type/link_target/link_aux + the
-- messenger_highlights table, which were folded into messenger_messages.content_refs.
--
-- DO NOT RUN until the read+write path is fully migrated + verified — see the
-- companion README (2026-09-03-retire-legacy-content-refs.README.md). Running
-- this while any code still reads the legacy columns/table WILL break the feed
-- and the page-comment view for all users.
-- ============================================================================

-- 1) Safety backups (kept as tables so this is recoverable). Drop them yourself
--    once you're confident, e.g. `DROP TABLE _bak_msg_legacy_refs_20260903;`.
CREATE TABLE _bak_msg_legacy_refs_20260903 AS
  SELECT message_id, link_type, link_target, link_aux
  FROM messenger_messages
  WHERE link_type IS NOT NULL;

CREATE TABLE _bak_messenger_highlights_20260903 AS
  SELECT * FROM messenger_highlights;

-- 2) Drop the now-redundant legacy columns.
ALTER TABLE messenger_messages
  DROP COLUMN link_type,
  DROP COLUMN link_target,
  DROP COLUMN link_aux;

-- 3) Drop the highlights side-table (highlights now live in content_refs as
--    { type:'highlight', role:'highlight', span:{ text } } entries).
DROP TABLE messenger_highlights;

-- Rollback (if you drop before the code is ready and need to restore):
--   ALTER TABLE messenger_messages
--     ADD COLUMN link_type VARCHAR(191) NULL,
--     ADD COLUMN link_target VARCHAR(191) NULL,
--     ADD COLUMN link_aux VARCHAR(191) NULL;
--   UPDATE messenger_messages m JOIN _bak_msg_legacy_refs_20260903 b
--     ON b.message_id = m.message_id
--     SET m.link_type=b.link_type, m.link_target=b.link_target, m.link_aux=b.link_aux;
--   CREATE TABLE messenger_highlights AS SELECT * FROM _bak_messenger_highlights_20260903;
--   -- (re-add messenger_highlights' original indexes/PK as needed)
