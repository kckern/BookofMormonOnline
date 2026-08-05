# Audit: cross-reference markers swallowed by scripture-guide chaining

**Date:** 2026-08-04
**Status:** ✅ RESOLVED (2026-08-04) — fixed at the library via Option A (`chainAcrossMarkers`), shipped in `scripture-guide@1.0.95`; all frontend prose seams rewired; the interim pre-split guard was deleted. See "Resolution" at the bottom.
**Scope:** `bom_xtras_commentary` rendering via `scripture-guide` `detectReferences` (aka `detectScriptures`)
**Files touched by the finding:** `frontend/webapp/src/views/_Common/Commentary.js`, `frontend/webapp/src/views/_Common/ViewUtils.js` (`getDetectedScripturesHtml`), and every consumer of `getDetectedScripturesHtml` (Drawer person/place/commentary, Home `CommentaryTile`/`PeopleTile`/`Person`/`PlaceProfileTile`).
**Library:** `scripture-guide` — root cause present through v1.0.88; fixed in **v1.0.95**. Source: https://github.com/kckern/ScriptureGuideUtils (owned by KC).

---

## Summary

`scripture-guide`'s reference detector **greedily chains** adjacent scripture references — any run of ref-shaped substrings separated by a *joiner* is merged into a **single** link with a combined verse range. Crucially, the library's joiner list includes the cross-reference **prose markers** themselves:

```jsonc
// scripture-guide dist/scriptures.mjs  (the shared canon config)
"joiners": [ "and", ";", ",", "&", "compare", "see also", "cf", "cited at" ]
```

Because `compare` / `see also` / `cf` / `cited at` are *deliberately* joiners, a marker sitting between two references gets absorbed into the chain. For the **display** path (linkifying prose commentary) this is wrong: the connective words are either swallowed into the anchor text or dropped from the output entirely. (For the **lookup** path — parsing one citation string into `verse_ids` — absorbing them is arguably correct; see "Two functions, one config" below.)

There is even a normalization rule that explicitly deletes the marker mid-parse:

```jsonc
"pre_rules": [ /* … */ [ "\\b\\s*cf[:.]*\\s*\\b", " " ] ]   // strips "cf." to whitespace
```

---

## Frequency (`bom_xtras_commentary`, 51,581 rows, all with non-empty text)

| marker (anywhere in text) | rows | | marker | rows |
|---|---:|---|---|---:|
| `compare` | 1337 | | `i.e.` | 215 |
| `see also` | 1237 | | `e.g.` | 166 |
| `cf.` | 1177 | | `ibid` | 95 |
| `see below` | 24 | | `viz.` | 24 |
| `cp.` | 11 | | `c.f.` (dotted) | 1 |

**3,643 distinct rows (~7.1%)** carry a `see also` / `cf.` / `compare` marker (distinct count, not a sum of the overlapping per-marker LIKEs above). **3,844 rows** contain a chained citation of the shape `3:7; 4` or `3:7, 4`. Two joiners the library lists but the table also uses: `cited at` (44 rows) and bare `cf` with no dot (7 rows) — both must be in any marker list (see the prototype note).

## Three behaviors, by the delimiter in front of the marker

**Caveat:** the buckets below describe the *typical* case where each side of the marker is a **book-qualified** reference. When the trailing reference is book-less (e.g. `Alma 5:14; cf. 6:2`), a semicolon case exhibits the *swallow* behavior too (`<a>Alma 5:14; cf. 6:2</a>`) rather than the drop — the split depends on whether the following ref carries its own book, not purely on the delimiter.

The rendered anchor text is also the click payload (`scriptureLinkReplacer.js:19` takes the anchor's text child and re-runs `lookupReference` on it), so whatever the detector encloses is both shown *and* re-parsed on click.

**1. Clause-initial marker — correct.** `See also X`, `cf. X`, `Compare X` at a phrase boundary: the marker stays as plain text *outside* the link. This is the common case and needs no fix.
`See also Alma 32:21` → `See also <a>Alma 32:21</a>` ✓

**2. `comma + marker` between two refs — marker swallowed *into* the link text.** ~130 rows (`, cf.` 17 · `, see also` 65 · `, compare` 51).
`Alma 32:21, cf. 33:1` → `<a>Alma 32:21, cf. 33:1</a>` — literal "`, cf.`" now inside the anchor, and re-parsed on click.

**3. `semicolon + marker` between two refs — marker word *dropped from output*.** ⚠️ content loss — ~1,790 rows (`; see also` 699 · `; cf.` 863 · `; compare` 221 · `; cp.` 7).
`1 Nephi 2:13; see also Helaman 8:21` → `<a>1 Nephi 2:13;Helaman 8:21</a>` — the words "see also" **vanish**.

## Verified in the library

```
IN : 1 Nephi 2:13; see also Helaman 8:21.   OUT: <a>1 Nephi 2:13;Helaman 8:21</a>.   ← "see also" gone
IN : text (2 Chr 36:15; cf. Dan 1:1) more   OUT: text (<a>2 Chr 36:15;Dan 1:1</a>) more ← "cf." gone
IN : Alma 5:14; compare Mosiah 2:17 here    OUT: <a>Alma 5:14;Mosiah 2:17</a> here    ← "compare" gone
IN : Alma 32:21, cf. 33:1 end               OUT: <a>Alma 32:21, cf. 33:1</a> end      ← "cf." swallowed
```

---

## Two functions, one config — why this is a library-shaped problem

`scripture-guide` exposes both `lookupReference(str)` and `detectReferences(html, cb)` off the **same** joiner config:

- `lookupReference("see also X; Y")` → merging into one `verse_ids` set is fine/desired. Markers-as-joiners is correct here.
- `detectReferences(html, cb)` → linkifying prose. Markers-as-joiners is **wrong** — it destroys the surrounding prose.

The two use cases want different joiner sets. That's the root design issue.

---

## Fix options

### Option A — Library param (recommended; KC owns the repo)
Let `detectReferences` take a joiner override / marker-boundary flag so the display path can opt out of the marker joiners, without changing `lookupReference`:

```js
// desired frontend call
detectReferences(html, cb, lang, { joiners: ["and", ";", ",", "&"] });   // structural only
// or a semantic flag
detectReferences(html, cb, lang, { chainAcrossMarkers: false });
```

This fixes cases 2 **and** 3 at the source, is backward-compatible (default preserves today's behavior), keeps `lookupReference` merging intact, and lets us **delete the frontend pre-split guard**. Root cause is a single shared config array + the `cf` `pre_rule`; the change is small.
**Verification step before shipping:** confirm that dropping the markers from the joiner set actually stops the matcher from extending a candidate across the marker (the `cf[:.]` `pre_rule` only bites if the marker is already inside the candidate span — removing it as a joiner should keep it out, but assert this with the real cases above).

### Option B — Split the config into two joiner sets in the library
`joiners` (structural: `and ; , &`) vs `lookup_joiners` (markers: `compare / see also / cf / cited at`). `detectReferences` uses only the former; `lookupReference` uses both. No caller change, but it changes behavior for *every* `detectReferences` consumer → semver-minor/major and broader blast radius.

### Option C — Frontend pre-split guard (prototype, shipped in this branch)
`frontend/webapp/src/views/_Common/detectScripturesGuarded.js` splits the HTML on the markers and runs detection per-segment, so a chain can never span a marker. Wired into the single shared seam `getDetectedScripturesHtml` (`ViewUtils.js`); `Commentary.js` now routes through that same helper instead of its former inline copy of the callback.

Prototype result:
```
IN : 1 Nephi 2:13; see also Helaman 8:21.  →  <a>1 Nephi 2:13</a>; see also <a>Helaman 8:21</a>.   ✓ fixed
IN : text (2 Chr 36:15; cf. Dan 1:1) more  →  text (<a>2 Chr 36:15</a>; cf. <a>Dan 1:1</a>) more    ✓ fixed
IN : Alma 5:14; compare Mosiah 2:17 here   →  <a>Alma 5:14</a>; compare <a>Mosiah 2:17</a> here     ✓ fixed
IN : See also Alma 32:21 for context.      →  See also <a>Alma 32:21</a> for context.              = unchanged
IN : Alma 5:14; cited at Mosiah 2:17 here  →  <a>Alma 5:14</a>; cited at <a>Mosiah 2:17</a> here    ✓ fixed (needs "cited at" in list)
IN : Alma 32:21, cf. 33:1 end              →  <a>Alma 32:21</a>, cf. 33:1 end                       ~ regression: 33:1 book-less, unlinked
IN : Alma 5:14; cf. 6:2 here               →  <a>Alma 5:14</a>; cf. 6:2 here                        ~ regression: 6:2 book-less, unlinked
```

**Known limitations of Option C (why the library fix is preferred):**
- **Book carry-over is severed — comma *and* semicolon forms.** Any marker followed by a **book-less** reference loses that reference's link: after splitting, the trailing segment has no book context. This hits `Alma 32:21, cf. 33:1` (~130 comma-form rows) **and** `Alma 5:14; cf. 6:2` (≥96 semicolon-form rows by a bare-verse-only floor of `; <marker> N:N`; chapter-only follow-ons push it higher). So the trade is "~130 + ≥96 rows lose a link" to fix "~1,790 rows of marker content loss" — not the comma-only regression an earlier draft claimed.
- **The marker list must mirror the library's joiners exactly.** The library joiners are `compare / see also / cf / cited at` — note `cf` and `cited at` with **no dot**. An earlier prototype regex used `cf\.` (dot required) and omitted `cited at`, so `; cited at X` (44 rows) and `; cf X` (7 rows) still lost their marker. Fixed: abbreviations are dot-optional (`\bcf\b\.?`) and `cited at` is included.
- **Re-implements knowledge the library already has** (the marker list) and calls `detectScriptures` N times per commentary.
- **String split is HTML-naive but no worse than the library.** Splitting on "compare"/"see also" inside a tag/attribute changes nothing `detectScriptures` wasn't already doing — verified: guard output is byte-identical to the raw library on `title="Compare …"`, `href="…/cf.pdf"`, `class="compare-box"` inputs. (Separately, the raw library *does* inject anchors inside attribute values, e.g. `<img title="Compare <a>Alma 5:14</a>…">` — a pre-existing library defect neither the guard nor Option A/B addresses.)

**Recommendation:** ship Option A in `ScriptureGuideUtils`, then delete `detectScripturesGuarded.js` and revert the two seams to a plain (parameterized) `detectReferences`. Option C stays only as a stopgap if the library release lags.

---

## Out-of-scope detection seams (not guarded by this prototype)

These also call the raw detector and would benefit from the same fix (or the library param): `models/Utils.js:859`, `views/Map/MapPanel.js:126`, `views/Page/Narration.js:601`, `views/Page/PersonPlace.js` (`detectScripturesPreservingTokens`, used by `PopUp`), `views/Home/tiles/NotesTile.js:54`. A library-level fix (Option A/B) covers all of them at once; the frontend guard does not.

## Note

The Read-view `CategoryPanels/CommentaryPanel.js` is still a `JSON.stringify` stub — it does not yet render commentary prose through the detector. When it's built out, route its text through the guarded/parameterized seam.

## Test-tooling note

`ATV/__tests__/proseBodyRender.test.js` and `scriptureLinkReplacer` specs currently **fail to run** in Jest (ESM-transform error on `scripture-guide`) — this is pre-existing (reproduced with the audit's edits stashed) and unrelated to this change, but it means the detection path has no green unit coverage here today.

---

## Resolution (2026-08-04)

Shipped **Option A** at the library and rewired the frontend. The interim guard (Option C, `detectScripturesGuarded.js`) is **deleted**.

**Library — `scripture-guide@1.0.95`** (repo `ScriptureGuideUtils`, branch `feat/chain-across-markers-option`):
- `detectReferences`/`findReferences` gained `chainAcrossMarkers` (default `true`, backward-compatible). When `false`, the detector is handed a cloned `lang_extra` whose joiners keep only structural separators (`;`, `,`, `&`, `and`); prose markers no longer merge references. `lookupReference` is untouched and still folds whole citations. Covered by `test/detect/chain-across-markers.test.js` (12 tests). Verified the published package: `detectScriptures('1 Nephi 2:13; see also Helaman 8:21.', cb, {chainAcrossMarkers:false})` → `<a>1 Nephi 2:13</a>; see also <a>Helaman 8:21</a>.`
- **Strictly better than the guard on the regression axis:** the library keeps book carry-over — `Alma 5:14; see also 6:2` keeps `6:2` linked. The ~130 comma-form + ~96 semicolon-form bare-verse rows the guard would have de-linkified are **not** regressed.

**Frontend** (`frontend/webapp`, dep bumped `^1.0.84` → `^1.0.95`) — `chainAcrossMarkers:false` passed at every prose-linkifying seam:
- `ViewUtils.js` `getDetectedScripturesHtml` (covers Drawer person/place/commentary + Home `CommentaryTile`/`PeopleTile`/`Person`/`PlaceProfileTile`; `Commentary.js` routes through this helper).
- `views/Home/tiles/NotesTile.js` — option object carries **no** language, so abbreviation matching is preserved.
- `views/Map/MapPanel.js`, `views/Page/PersonPlace.js` (`detectScripturesPreservingTokens`, covering all three `PopUp` callers), `views/Page/Narration.js`, `models/Utils.js` (`replaceURLWithHTMLLinks`).
- **Left on default (correct):** `views/_Common/ATV/lastScriptureRef.js` — ref-*extraction* for ATV governing-verse, not prose rendering; chaining is irrelevant there.

Dev server (`bom-dev`) recompiled clean (webpack, warnings-only). The "out-of-scope seams" and Option C notes above are retained for history but are now **superseded** by this resolution.
