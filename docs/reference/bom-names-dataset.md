# Book of Mormon Names dataset (Analysis → Names view)

Source of truth: `frontend/webapp/src/views/Analysis/Names/data.js`.
This doc records where the data came from and the list-cleanup decisions, so the
dataset can be audited or extended without re-deriving them.

## Schema

Each entry:

| Field | Meaning |
|---|---|
| `name` | Canonical current-edition spelling |
| `types` | `person`, `place`, `object`, `animal`, `plant`, `measure`, `material`, `title`, `word` — a name can carry several (e.g. Amnor is a spy *and* a silver measure) |
| `cultures` | People-affiliations (Nephite, Lamanite, Jaredite, Mulekite, Israelite) and/or proposed language origins (Hebrew, Egyptian, Greek, Akkadian) |
| `prefix` / `stems` / `affix` / `suffix` | Heuristic surface segmentation chosen so related names share elements (Mormon/Moroni/Morianton → stem `Mor`). **Not** established etymology |
| `note` | Textual glosses (e.g. Irreantum = "many waters", 1 Ne 17:5) and published etymology proposals; `prop.`/`cf.` mark speculation |

`facets` (named export) derives the filter-UI inventories (prefixes, stems,
affixes, suffixes, cultures, types) from the entries, replacing the hardcoded
lists in `Names.js`.

## Provenance

- **Person/place types and affiliations**: validated against the platform's own
  `bom_people` / `bom_places` data (GraphQL `person` / `place` queries with no
  slug return the full lists; `People.identification` letter codes decode via
  `affiliationBadges` in `frontend/webapp/src/views/People/People.js` —
  N=Nephite, L=Lamanite, J=Jaredite, M=Mulekite, B=Biblical, G=Gadianton,
  I=Israelite). Places are stored with descriptive prefixes ("Hill Cumorah",
  "Plains of Agosh"), matched on the final word.
- **Objects/measures/animals/plants/materials**: validated against `bom_objects`
  (category `money` → `measure`, etc.). All 19 distinctive-name objects in that
  table are covered: amnor, antion, cumom, cureloms, ezrom, leah, liahona,
  limnah, neas, onti, rameumptom, senine, senum, seon, sheum, shiblon, shiblum,
  shum, ziff.
- **Etymology notes**: follow the published Book of Mormon onomastics
  literature (BYU Book of Mormon Onomasticon project and related work); all
  speculative items are flagged `prop.` or `cf.` in the note itself.

## Cleanup of the original hand-typed list

The pre-existing `data.js` was a flat array of ~207 strings with duplicates and
typos. Changes made:

- **Duplicates removed**: Antion, Antionum, Ethem, Moriantum, Neas, Senum, Shiblon (each appeared twice).
- **Typos fixed**: `Migon` → Migron, `Gilno` → Gilgal, `Shimnilon` → Shimnilom.
- **Dropped as non-canonical variants/typos**: Amnnihu (dup of Amnihu), Cor/ihor
  (dup of Corihor), Amalickihah, Amuleki, Amuloki, Ezrum, Jashom, Limherhi,
  Minron, Ontihah, Himnor, Shibron, Zerom; Shilum (1830-edition variant of
  shiblum — noted on the Shiblum entry instead).
- **Added** (canonical names the list was missing): Lehi, Sidon, Gideon, Ramah,
  Omer, Heth, Kish, Tubaloth, Zenos, Zenock, Ammah, Aminadab, Helam, Helem,
  Gilgal, Zoram, Lemuel, Laban, Enos, Liahona.
- **Deliberately out of scope**: straight biblical reuse names with no
  distinctive BoM form (Aaron, Benjamin, Jacob, Joseph, Noah, Samuel, Isaiah
  quotation onomastics beyond Migron, etc.). Add them later if the view should
  cover the full onomasticon; the schema needs no change.

## Known data oddities (upstream, not in this dataset)

- `bom_objects` lists **Seantum** as `money`; Alma 11 defines no such measure —
  Seantum is the murderer of Helaman 9. Looks like a row-entry error in that table.
- `bom_places` spells the Ether 14:28 hill **"Comron"**; the current edition
  reads "Comnor". The dataset keeps Comnor.

## Next steps for the view

1. Wire `NamesForm` selects to the `facets` export and filter the grid on
   selected prefix/stems/affix/suffix/cultures (the current selects are inert —
   state is mutated in place and `value` is hardcoded to `[]`).
2. Tile click → detail popup (segmentation, note, scripture occurrences), and
   link `person`/`place` names to their existing entity pages.
