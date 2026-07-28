# ATV prose-body crops — design

**Date:** 2026-07-28
**Status:** design approved, not yet implemented
**Area:** `frontend/webapp/src/views/_Common/ATV/` + `Commentary.js`

## Problem

Textual-variant apparatus units appear in two places inside a commentary popup:

1. **The header box** — the commentary's own verse, rendered by `ATVHeader`.
   It resolves a `verseId` from the commentary's reference, so its pills get a
   facsimile crop on hover (`WitnessPeek`) and a full scan grid on click
   (`VariantCompare`).
2. **The prose body** — apparatus units cited *inside* the analysis text,
   lifted to `<atv-unit>` placeholders by `extractApparatusUnits` and rendered
   by `ATVApparatus` with `variant="inline"`.

Prose-body units are rendered today with `verseId={null}` (`Commentary.js:345`).
The code comment calls this the "§6.4 trap": a body unit cites *other* verses
than the commentary's own, so cropping against the commentary's reference would
show the wrong verse's scan. The cautious choice was to show no crop at all —
peek and compare fall back to label-only.

## Key finding

The suppression is not because the right verse is unavailable — it is because
the *wrong* reference (the commentary's own) was the only one wired in. In the
production corpus, prose-body units are consistently structured as a nested list
whose parent `<li>` leads with the governing scripture reference:

```html
<li>1 Nephi 2:11
  <ul><li>...because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was...</li></ul>
</li>
```

(Real examples: entry `1001316103` → `1 Nephi 2:11`; entry `1000816101` →
`3 Nephi 11:8`.) The governing verse is the nearest scripture reference
preceding the bracket, which `scripture-guide`'s `lookupReference` already
parses. So each unit's correct `verseId` is recoverable.

## Approach

**Resolution strategy:** nearest preceding citation (chosen over a DOM-ancestry
walk, which `html-react-parser` can't reliably support, and over a
confidence-gated crop, whose extra matching logic isn't warranted given the
consistent structure).

**Keep the parser pure.** `parseATV.js` depends only on `./apparatus` and must
stay free of `scripture-guide`. Reference *detection and resolution* live in
`Commentary.js`, which already imports `detectScriptures` and follows the
`lookupReference(ref).verse_ids?.[0]` pattern used by `ATVHeader`.

### Parser change — `extractApparatusUnits`

Return one additional parallel array, leaving existing outputs untouched:

```
{ html, units, contexts }
//        ^ units[i] = readings   (UNCHANGED — no shape break)
//                     contexts[i] = HTML slice preceding unit i since the
//                                   previous apparatus boundary (or start)
```

`contexts[i]` is pure string slicing — no new dependency, no throw. Existing
callers that destructure `{ html, units }` keep working.

### Commentary.js change — governing-reference walk

Walk units in document order maintaining a **current governing reference**:

```
let current = null;                    // most recent citation seen
for each unit i in order:
  const ref = lastScriptureRef(contexts[i]);   // via existing detection
  if (ref) current = ref;              // a new heading takes over
  governingRef[i] = current;           // unit inherits the current heading
```

This mirrors how the nested list reads: a citation heading persists over the
unit(s) beneath it, so multiple units under one heading all inherit it, and a
unit with no citation before it inherits the last one seen (or `null` at the
top). In the `atv-unit` replace callback:

```jsx
const ref = governingRef[i];
const verseId = ref ? (lookupReference(ref).verse_ids?.[0] ?? null) : null;
return <ATVApparatus readings={units[i]} variant="inline"
                     verseId={verseId} reference={ref ?? commentaryData.reference} />;
```

Everything downstream (`WitnessPeek`, `VariantCompare`, `FaxCrop`) lights up
unchanged once `verseId` is non-null — full parity with the header box.

## Fallback (preserves the §6.4 safety)

If no reference resolves for a unit, `verseId` stays `null` and rendering is
exactly today's label-only behavior. We never show a crop we cannot tie to a
real verse, so a mis-parse degrades to the current state rather than showing the
wrong verse's scan. This keeps the original author's safety property while
removing the blanket suppression.

## Scope boundaries (YAGNI)

- Header-box behavior is unchanged; this touches prose-body units only.
- No confidence gate on reading-text-in-verse matching — the citation is
  trusted, matching the chosen resolution strategy.
- No parser dependency on `scripture-guide`.
- Verse *ranges* resolve to their first verse id (`verse_ids?.[0]`), same as
  `ATVHeader`.

## Testing

- **Parser (`parseATV.test.js`):** `contexts[i]` slices asserted directly as
  strings — one unit, multiple units, and a unit whose context carries a
  citation vs one that does not.
- **Render (`proseBodyRender.test.js`):** a unit under a `1 Nephi 2:11` heading
  resolves to that verse's crop (assert `FaxCrop` selector / `verseId` reaches
  `ATVApparatus`); a unit with no citation stays label-only (no crop). Add the
  governing-reference-persists case: two units under one heading both inherit it.
- **Corpus regression:** unchanged counts — this is additive metadata, not a
  parse-shape change. Re-run the gated `corpusRegression` suite against a fresh
  dump to confirm no drift (see that file's header for the command).

## Files touched

- `frontend/webapp/src/views/_Common/ATV/parseATV.js` — add `contexts` to
  `extractApparatusUnits`.
- `frontend/webapp/src/views/_Common/Commentary.js` — governing-reference walk
  + `verseId` resolution in the `atv-unit` replace callback.
- `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js` — context
  slices.
- `frontend/webapp/src/views/_Common/ATV/__tests__/proseBodyRender.test.js` —
  crop resolution + fallback + heading persistence.
