# Witness `principalNames` — source-of-truth contract

The witnesses page (`/history/witnesses/:witness`) fetches source documents from `bom_xtras_history` where `archive='witnesses'` and `principal` matches the witness. The DB stores `principal` as a free-form human-readable string ("Martin Harris", "Joseph Smith, Jr.", etc.) — not as a slug — so the frontend has to know which exact string(s) belong to which witness.

That mapping lives in `frontend/webapp/src/views/History/Witnesses.js`, in the inline `data` object's `principalNames: [String]` field per witness. **It is the only contract between the inline witness superstructure and the DB.** A witness with `principalNames: []` will silently render an empty-state ("No sources available for this witness.") regardless of whether the DB has rows.

## When to edit `principalNames`

1. **New source rows added to `bom_xtras_history` with a new principal spelling.**
   Example: someone adds rows with `principal = 'Saml. H. Smith'`. The existing Samuel Smith page lists `["Samuel H. Smith", "Eight Witnesses"]` — it won't pick up the new rows until `"Saml. H. Smith"` is added to the array.

2. **A new witness is added to the inline superstructure.**
   Look up which DB principal strings refer to that person and seed the array. If none exist, set `principalNames: []` — the empty-state will display.

3. **A principal name in the DB is renamed.**
   Update the array to match. Don't rename the DB-side principal lightly; multiple inline witnesses may reference the same string (e.g., collective rows like `"Three Witnesses"`, `"Eight Witnesses"`, `"Christian Whitmer and Peter Whitmer, Jr."`).

## How to check what's in the DB

Run the schema/principal dump script:

```bash
set -a; source "$XDG_RUNTIME_DIR/bom-dev.env"; set +a
npx ts-node --transpile-only scripts/describe-history.ts
```

It prints all distinct principal values for `archive='witnesses'` with row counts. Cross-reference against `Witnesses.js`'s `data` literal.

## Collective rows

Some source rows are tagged with collective principals rather than individuals:
- `"Three Witnesses"` — shown on all three Three-Witnesses pages
- `"Eight Witnesses"` — shown on all eight Eight-Witnesses pages
- `"Christian Whitmer and Peter Whitmer, Jr."` — shown on both Christian's and Peter's pages
- `"Four Witnesses"` — currently only 1 row; not surfaced anywhere

To include a collective entry on an individual witness page, append the collective string to that witness's `principalNames` array.

## Known reconciliations (as of 2026-05-13)

| Inline slug | DB principal(s) |
|---|---|
| `samuel-smith` | `Samuel H. Smith` *(DB has middle initial)* |
| `katherine-smith` | `Katherine` *(DB has no surname)* |
| `josiah-stoal` | `Josiah Stowell` *(DB spelling differs from inline display name)* |
| `william-smith` | `William Smith` + `William B. Smith` *(same person, two strings)* |
| `peter-whitmer-jr` | `Peter Whitmer Jr.` + `Peter Whitmer, Jr.` *(comma variant)* |
| `william-hussey-azel-vandruver` | *(no DB rows)* |

The display name shown on the page (witness's portrait card and detail page heading) is the `name` field in the inline data, not anything from the DB. Editing `principalNames` only changes which DB rows are surfaced, never how the witness is identified in the UI.

## Spec & history

Feature spec: `docs/specs/2026-05-13-witnesses-sources-archive.md`
Implementation plan: `docs/plans/2026-05-13-witnesses-sources-archive.md`
