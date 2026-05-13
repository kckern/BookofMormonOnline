-- bom_objects.weight — two-pass sort
--   Pass 1: BoM-native (era != 'old-world') first; Bible-quoted (era = 'old-world') last.
--   Pass 2: within each bucket, first verse_id (MIN of bom_index where type='object' and slug=this) ASC.
--
-- Bucket gap of 1_000_000 dwarfs any real verse_id (~42k max) so BoM never interleaves with Bible
-- under the resolver's `ORDER BY weight DESC`. Orphans (zero bom_index rows) get COALESCEd to
-- 999_999 so they sink to the bottom of their bucket (currently only `gardens`).
--
-- NOTE: content/objects/_sql/build.mjs in the authoring repo deterministically recomputes weight
-- on every YAML→SQL build using a centrality formula. Until that script is updated to mirror this
-- two-pass logic, re-running the pipeline will overwrite these values — re-apply this UPDATE after.

UPDATE bom_objects o
LEFT JOIN (
  SELECT slug, MIN(CAST(verse_id AS UNSIGNED)) AS first_vid
  FROM bom_index
  WHERE type = 'object'
  GROUP BY slug
) i ON i.slug = o.slug
SET o.weight =
  (CASE WHEN o.era = 'old-world' THEN 0 ELSE 1000000 END)
  - COALESCE(i.first_vid, 999999);

-- Verify
-- SELECT (era='old-world') AS is_bible, COUNT(*) AS n, MIN(weight) AS lo, MAX(weight) AS hi
-- FROM bom_objects GROUP BY (era='old-world');
--
-- Expected:
--   is_bible=0  n=211  weight ∈ [1, ~968_000]
--   is_bible=1  n=36   weight ∈ [~-36_000, ~-31_000]
