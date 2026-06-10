# Legacy serves quotes (and places) in engine-artifact order

> Scope note: TextBlock.places has the same disease via a different mechanism —
> the MySQL optimizer's access-path choice flips the order between slug-index
> order (small IN-lists) and clustered guid order (scans), proven by moroni vs
> mormon. The green-field backend pins places to guid order; order-only
> differences on quotes/places are approved (page is next-truth).

**Symptom:** quoted-scripture blocks (TextBlock.quotes) come back from the legacy
backend out of reading order — e.g. the 14 sequential chunks of Ether 4:6–19 on the
moroni page return as 51, 56, 55, 54… instead of 43…56. Users see consecutive verses
shuffled in the quotes panel.

**Root cause:** the legacy `Section.rows` resolver loads quotes through a five-way
Sequelize include; with no ORDER BY on the quote target table, MySQL's join buffer
dictates row order. It is **selection-dependent** (a trimmed query returns clean
link order; the full frontend selection returns the scramble) and matches no column
ordering (link, guid, weight, queue_weight, index_code all probed and excluded).

**Resolution (approved contract change):** the green-field backend orders quotes by
`link` (reading order — `backend/src/data/loaders.ts`, quotesByText). The `page`
matrix type is flagged `nextTruth: true`: its baselines are captured from the
green-field backend (:5006), legacy targets skip it visibly, and `TARGET=next`
verifies exactly. The A/B sweep (`backend/scripts/ab-sweep-pages.mjs`) classifies
quote-order diffs separately as approved.

**Status:** resolved-by-design in the green-field backend 2026-06-09; legacy behavior
unchanged until cutover.
