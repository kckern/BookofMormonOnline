# Duplicate page weights make TOC page order engine-dependent

**Symptom:** `bom_page.weight` — the explicit TOC ordering column — has four duplicate
`(parent, weight)` groups: weight 502 (division `5becc7807b95c`) and weights 704, 707,
708 (reign-of-judges). For tied pages the legacy backend's order is an accident of its
five-way Sequelize join (no deterministic column explains all three reign-of-judges
ties — first-text guid matches 704/708 but not 707; min-section guid matches 704/707
but not 708; page guid matches 704/707 but not 708). The display order users see today
is engine-internal join order.

**Found by:** the green-field contents slice side-by-side
(`backend/scripts/ab-compare.mjs`). The regression baselines don't pin it — the matrix
sampled divisions without ties.

**Green-field behavior:** the new backend orders deterministically by
`(weight ASC, guid ASC)`, which reproduces legacy's observed order for three of the
four tie groups. Net divergence: **one pair** — at weight 708, legacy shows "Amulek's
Teachings to the Zoramites" before "Alma's Words to his Son Shiblon"; the new backend
shows Shiblon first.

**Recommended fix (data, not code):** renumber the tied weights to encode the current
legacy display order explicitly (e.g. reign-of-judges: Antionah 704→705 and shift
705-709 up; or any unique assignment preserving today's visible order). Requires the
writable `bom_app` credentials (BoMOnlineWorkspace — not available on this host).
Once weights are unique, both backends converge with zero visible change and the order
is owned by data (SSoT) instead of engine internals.

**Status:** open — data fix pending credentials/owner. The one-pair divergence is
accepted in the green-field backend until then.
