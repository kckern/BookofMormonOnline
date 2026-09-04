-- Post content model redesign (Phase 2): additive columns for the new
-- anchor + canonical-references model. Both nullable → INSTANT/INPLACE on MySQL 8
-- (no rewrite, no blocking); the running backend ignores them until dual-read
-- ships. `content_refs` (not `references` — reserved word) holds the JSON
-- Reference[]. `anchor` is the page-slug join-key (mirrors custom_type today).
-- Spec: docs/superpowers/specs/2026-09-03-post-content-model-redesign.md
ALTER TABLE messenger_messages
  ADD COLUMN anchor VARCHAR(191) NULL AFTER custom_type,
  ADD COLUMN content_refs JSON NULL AFTER anchor,
  ADD INDEX idx_anchor (anchor);
