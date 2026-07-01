-- battle placements from battleSlugs.json (gen_battle_placements.py)
-- Apply to bom_prd via BoMOnlineWorkspace. Idempotent (grid_row IS NULL guard).
-- PRECONDITIONS (plan Task 7 reconciliation, icon-event architecture):
-- 1. Task 12's label_params DDL applied first (creates grid_icon).
-- 2. Frontend with icon-event rendering (grid.icon -> marker path) deployed.
-- ROLLBACK: the paired _rollback.sql below.
-- ALSO at apply time: delete the k='battle' tiles from frontend/webapp/src/views/Timeline/gridTiles.json (see plan Task 7 reconciliation) and deploy that frontend change in the same window.
UPDATE bom_timeline SET grid_row=103, grid_col=31, grid_w=1, grid_h=1, grid_bg='#6fa8dc', grid_icon='battle', label_category='event' WHERE slug='zemnarihahs-attack' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=119, grid_col=24, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='attacks-at-desolation' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=123, grid_col=30, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='cumorah-battle' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=19, grid_col=16, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='mulekite-wars' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=33, grid_col=19, grid_w=1, grid_h=1, grid_bg='#3c78d8', grid_icon='battle', label_category='event' WHERE slug='lamanites-vs-zeniff-2' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=37, grid_col=31, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='lamanites-vs-noah' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=38, grid_col=14, grid_w=1, grid_h=1, grid_bg='#3c78d8', grid_icon='battle', label_category='event' WHERE slug='lamanites-vs-limhi' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=53, grid_col=31, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='amlicite-battle' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=58, grid_col=31, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='attack-on-ammonihah' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=59, grid_col=15, grid_w=1, grid_h=1, grid_bg='#bf9000', grid_icon='battle', label_category='event' WHERE slug='amalekite-attack' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=61, grid_col=14, grid_w=1, grid_h=1, grid_bg='#bf9000', grid_icon='battle', label_category='event' WHERE slug='zerahemnah-vs-moroni' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=72, grid_col=32, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='pahoran-vs-kingmen' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=75, grid_col=30, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='western-war' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=78, grid_col=29, grid_w=1, grid_h=1, grid_bg='#85200c', grid_icon='battle', label_category='event' WHERE slug='coriantumr-vs-nephites' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=82, grid_col=29, grid_w=1, grid_h=1, grid_bg='#38761d', grid_icon='battle', label_category='event' WHERE slug='internal-nephite-conflict' AND grid_row IS NULL LIMIT 1;
UPDATE bom_timeline SET grid_row=97, grid_col=32, grid_w=1, grid_h=1, grid_bg='#6fa8dc', grid_icon='battle', label_category='event' WHERE slug='gadianton-guerilla-attacks' AND grid_row IS NULL LIMIT 1;
