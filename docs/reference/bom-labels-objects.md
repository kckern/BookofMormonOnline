# `bom_label` strings for the Objects feature

Inventory of every i18n key the Objects view, filter, popup, and Reader integration depend on. **48 of 62 keys are new** and need to be inserted into `bom_label`; the other 14 already exist and are reused as-is.

Ready-to-apply English seed: `scripts/sql/2026-05-12-bom_label_objects.sql` (one `INSERT` of 48 rows). Translations come later through the existing `bom_translation` pipeline (keyed on `guid`).

## Existing keys (14) — reused, no action

| key | type bucket | English |
|---|---|---|
| `clear` | general | Clear |
| `guest` | user | Guest |
| `history_date_format_full` | user | D MMM YYYY |
| `history_date_format_year` | user | YYYY |
| `home_title` | menu | Book of Mormon Online |
| `location_profile` | supplement | Location Profile |
| `off` | general | Off |
| `on` | general | On |
| `person_profile` | supplement | People Profile |
| `references` | supplement | References |
| `relationships` | supplement | Relationships |
| `select_all` | people_filter | Select All |
| `selectors` | general | Selectors |
| `view_on_map` | supplement | View on Map |

## New keys (48) — added by the seed SQL

Bucketed by the same `type` convention the existing labels use (`people_filter`, `geo_filter`, `menu`, `title`, `supplement`, `general`, plus the new `object_filter`).

### Bucket: `menu` (1)
| key | English |
|---|---|
| `menu_objects` | Objects |

### Bucket: `title` (1)
| key | English |
|---|---|
| `title_objects` | Objects in the Book of Mormon |

### Bucket: `supplement` (1) — popup chrome (matches `person_profile`/`location_profile`)
| key | English |
|---|---|
| `object_profile` | Object Profile |

### Bucket: `general` (3)
| key | English |
|---|---|
| `clear_filters` | Clear filters |
| `no_objects_match` | No objects match these filters. |
| `no_relationships` | No relationships. |

### Bucket: `""` (empty/global, 1) — matches existing `search_for_a_place` convention
| key | English |
|---|---|
| `search_for_an_object` | Search for an object |

### Bucket: `object_filter` (new — 41, paralleling `people_filter` / `geo_filter`)

**Axis titles (5)**

| key | English |
|---|---|
| `object_axis_category` | Category |
| `object_axis_era` | Era |
| `object_axis_provenance` | Provenance |
| `object_axis_specificity` | Specificity |
| `object_axis_usage` | Usage |

**Categories (16)** — match the `bom_objects.category` enum

| key | English | tag value in DB |
|---|---|---|
| `object_cat_animal` | Animal | `animal` |
| `object_cat_apparel` | Apparel | `apparel` |
| `object_cat_armor` | Armor | `armor` |
| `object_cat_building` | Building | `building` |
| `object_cat_food` | Food | `food` |
| `object_cat_landscape` | Landscape | `landscape` |
| `object_cat_metal` | Metal | `metal` |
| `object_cat_money` | Money | `money` |
| `object_cat_plant` | Plant | `plant` |
| `object_cat_record` | Record | `record` |
| `object_cat_sacred_object` | Sacred Object | `sacred-object` |
| `object_cat_structure` | Structure | `structure` |
| `object_cat_tool` | Tool | `tool` |
| `object_cat_treasure` | Treasure | `treasure` |
| `object_cat_vehicle` | Vehicle | `vehicle` |
| `object_cat_weapon` | Weapon | `weapon` |

**Eras (7)** — match the `bom_objects.era` enum

| key | English | tag value in DB |
|---|---|---|
| `era_christ_era` | Christ Era | `christ-era` |
| `era_jaredite` | Jaredite | `jaredite` |
| `era_lehite_departure` | Lehite Departure | `lehite-departure` |
| `era_nephite` | Nephite | `nephite` |
| `era_old_world` | Old World | `old-world` |
| `era_post_christ` | Post-Christ | `post-christ` |
| `era_timeless` | Timeless | `timeless` |

**Provenance (8)** — match the `bom_objects.provenance` enum

| key | English | tag value in DB |
|---|---|---|
| `prov_divine` | Divine | `divine` |
| `prov_generic` | Generic | `generic` |
| `prov_israelite` | Israelite | `israelite` |
| `prov_jaredite` | Jaredite | `jaredite` |
| `prov_lamanite` | Lamanite | `lamanite` |
| `prov_lehite` | Lehite | `lehite` |
| `prov_mulekite` | Mulekite | `mulekite` |
| `prov_nephite` | Nephite | `nephite` |

**Specificity (2)** — match the `bom_objects.specificity` enum

| key | English | tag value in DB |
|---|---|---|
| `spec_general` | Generic | `general` |
| `spec_specific` | Named | `specific` |

**Usage (3)** — match the `bom_objects.usage` enum

| key | English | tag value in DB |
|---|---|---|
| `usage_literal` | Literal | `literal` |
| `usage_metaphorical` | Symbolic | `metaphorical` |
| `usage_mixed` | Mixed | `mixed` |

## GUID generation

```js
guid = md5("label:" + type + ":" + label_id).slice(0, 13)
```

13 hex characters, matching the dominant length in `bom_label` (608 of ~1000 rows use 13-char guids). Collision-checked against existing rows at generation time — zero collisions.

The algorithm is deterministic, so re-running the seed produces the same guids — safe to use `INSERT IGNORE` if part of a rerun.

## Applying the seed

```bash
mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DB < scripts/sql/2026-05-12-bom_label_objects.sql
```

(Env vars come from Infisical / `bom-load-env` on the dev host.)

Verify with:

```sql
SELECT type, COUNT(*) AS n
FROM bom_label
WHERE label_id IN (
  'menu_objects','title_objects','object_profile','clear_filters','no_objects_match',
  'no_relationships','search_for_an_object',
  'object_axis_category','object_axis_era','object_axis_provenance','object_axis_specificity','object_axis_usage',
  'object_cat_animal','object_cat_apparel','object_cat_armor','object_cat_building','object_cat_food',
  'object_cat_landscape','object_cat_metal','object_cat_money','object_cat_plant','object_cat_record',
  'object_cat_sacred_object','object_cat_structure','object_cat_tool','object_cat_treasure',
  'object_cat_vehicle','object_cat_weapon',
  'era_christ_era','era_jaredite','era_lehite_departure','era_nephite','era_old_world','era_post_christ','era_timeless',
  'prov_divine','prov_generic','prov_israelite','prov_jaredite','prov_lamanite','prov_lehite','prov_mulekite','prov_nephite',
  'spec_general','spec_specific',
  'usage_literal','usage_metaphorical','usage_mixed'
)
GROUP BY type ORDER BY n DESC;
```

Expected output: 41 in `object_filter`, 3 in `general`, 1 in `menu`, 1 in `title`, 1 in `supplement`, 1 in `""` — total 48.

## Translation pipeline note

This file lists English only. Translations (ko, es, fr, etc.) are added through the existing `bom_translation` workflow that joins on `bom_label.guid`. The guids generated above are stable across reruns of the seed, so translations referencing them will not break if the seed needs to be re-applied.
