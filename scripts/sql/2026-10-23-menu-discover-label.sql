-- "Discover" nav/tab/bottom-nav name (front door, 2026-10-23). English row + Korean. Idempotent (NOT EXISTS), one transaction.
START TRANSACTION;
INSERT INTO bom_label (guid, label_id, label_text, type) SELECT 'hm2feb8168', 'menu_discover', 'Discover', 'home' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM bom_label WHERE label_id = 'menu_discover');
INSERT INTO bom_translation (guid, lang, refkey, value, contributor) SELECT l.guid, 'ko', 'label_text', '둘러보기', 'kcsql' FROM bom_label l WHERE l.label_id = 'menu_discover' AND NOT EXISTS (SELECT 1 FROM bom_translation t WHERE t.guid = l.guid AND t.lang = 'ko' AND t.refkey = 'label_text');
COMMIT;
