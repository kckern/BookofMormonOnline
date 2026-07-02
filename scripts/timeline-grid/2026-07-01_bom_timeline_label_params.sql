-- SUPERSEDED 2026-07-01 (Round 2): timeline data baked into frontend timelineData.json; apply only if/when the view is re-API-ified.
-- 2026-07-01_bom_timeline_label_params.sql
-- Label/LOD params for the tile-grid timeline (audit §5). All nullable —
-- frontend defaults apply when NULL (anchor=center, tier by kind, no dir).
ALTER TABLE bom_timeline
  ADD COLUMN label_anchor ENUM('center','start','end','above','below') NULL DEFAULT NULL AFTER label_category,
  ADD COLUMN grid_tier TINYINT NULL DEFAULT NULL AFTER label_anchor,
  ADD COLUMN grid_dir ENUM('l','r') NULL DEFAULT NULL AFTER grid_tier,
  -- KC directive: battles are events with an ICON, not a primitive tile kind.
  -- VARCHAR (not ENUM): the artwork also has ship crossings and a "?" marker —
  -- future icons must not need DDL.
  ADD COLUMN grid_icon VARCHAR(24) NULL DEFAULT NULL AFTER grid_dir;

-- Seed tier 1 (always-visible band names) for the main lineage-name rows.
-- Band-name rows are the people-category placements spanning wide/tall tiles;
-- seed the obvious set and refine editorially:
UPDATE bom_timeline SET grid_tier = 1 WHERE slug IN
  ('jaredites','lehite-family','nephites','lamanites','mulekites') AND grid_row IS NOT NULL;

-- Seed anchors: place rows (p=0) read as floating captions above their anchor
-- row, matching the source artwork's quiet-caption convention:
UPDATE bom_timeline SET label_anchor = 'above' WHERE p = 0 AND grid_row IS NOT NULL;

-- Seed movement direction for the known expedition/migration bars (starter set;
-- extend editorially — without ANY dir rows, the chevron mechanism ships dark):
UPDATE bom_timeline SET grid_dir = 'l' WHERE slug IN
  ('colonial-expedition','sons-of-mosiah') AND grid_row IS NOT NULL;
UPDATE bom_timeline SET grid_dir = 'r' WHERE slug IN
  ('ill-fated-expedition','limhis-explorers') AND grid_row IS NOT NULL;
-- (verify each slug exists first: SELECT slug FROM bom_timeline WHERE slug IN (…);
--  directions follow the source artwork's travel geometry — adjust on review)
