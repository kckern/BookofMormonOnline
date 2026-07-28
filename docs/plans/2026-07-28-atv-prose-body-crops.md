# ATV Prose-Body Crops Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Light up facsimile crops for textual-variant apparatus units that appear *inside* commentary prose, by resolving each unit's governing scripture citation to a `verseId` instead of hard-coding `verseId={null}`.

**Architecture:** The parser (`parseATV.js`) stays free of `scripture-guide`; it only gains a per-unit *context slice*. A small pure helper applies the "governing reference persists over following units" walk (dependency-injected detector, so it unit-tests without `scripture-guide`). `Commentary.js` wires the real `scripture-guide` detector, resolves the reference to a `verseId` via `lookupReference`, and passes it through to the existing `ATVApparatus`. No citation resolves → `verseId` stays `null` → today's label-only behavior (safe degrade).

**Tech Stack:** React 17, CRA jest (`react-scripts test`), `@testing-library/react`, `scripture-guide` (`detectScriptures`, `lookupReference`), `html-react-parser`.

**Design doc:** `docs/plans/2026-07-28-atv-prose-body-crops-design.md`

**Where to work:** worktree `.worktrees/atv-prose-crops`, branch `feat/atv-prose-body-crops`. Run all test commands from `frontend/webapp/`.

**Baseline:** `CI=true npx react-scripts test src/views/_Common/ATV/__tests__ --watchAll=false` → 130 passing, 6 skipped.

---

## Background the implementer needs

**How prose-body units are structured** (verified against the production corpus). They sit in a nested list whose parent `<li>` leads with the governing scripture reference:

```html
<li>1 Nephi 2:11
  <ul><li>...because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was...</li></ul>
</li>
```

**The existing render pipeline** (`Commentary.js`, current lines):
- `305-306`: the `.source` header block is sliced out of the body first.
- `310`: `extractApparatusUnits(htmlObject)` replaces each apparatus bracket in the body with an `<atv-unit data-atv-i="N">` placeholder and returns `{ html, units }` where `units[i]` = that unit's readings.
- `327-330`: `detectScriptures(htmlObject, cb, determineLanguage())` linkifies scripture references (runs AFTER extraction so reading content isn't linkified).
- `335-351`: the parser `replace` callback swaps each `<atv-unit>` for `<ATVApparatus readings={bodyUnits[i]} variant="inline" verseId={null} reference={commentaryData.reference} />`. **`verseId={null}` is the line we are removing.**

**Why `verseId` is enough:** `WitnessPeek` shows its hover crop only when `verseId != null` (`WitnessPeek.jsx:46`), and `VariantCompare`'s `WitnessEvidence` builds `selector = ids/${verseId}` (`VariantCompare.jsx:55`). Supply a real `verseId` and both light up with no other change. Supply `null` and behavior is exactly today's.

**`detectScriptures` contract** (from the existing call site): it invokes the callback with the matched reference string as the first argument and substitutes the callback's return value into the text. To *collect* the last reference without altering the text, pass a callback that records the string and returns it unchanged.

---

## Task 1: Parser returns per-unit context slices

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ATV/parseATV.js` (`extractApparatusUnits`, ~lines 271-286)
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js` (add a `describe`)

**Step 1: Write the failing tests**

Add to `parseATV.test.js` (it already `import`s from `../parseATV`):

```js
describe("extractApparatusUnits — context slices", () => {
  it("returns a context slice per unit: the HTML before it since the previous unit", () => {
    const { units, contexts } = extractApparatusUnits(
      "<li>1 Nephi 2:11<ul><li>because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was</li></ul></li>"
    );
    expect(units).toHaveLength(1);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toContain("1 Nephi 2:11");
    expect(contexts[0]).not.toContain("[");        // slice ends before the bracket
  });

  it("slices each unit's context from the previous apparatus boundary", () => {
    const { contexts } = extractApparatusUnits(
      "A cites 1 Nephi 1:9 [<em>x</em> 1|<em>y</em> A] then 3 Nephi 11:8 [<em>p</em> 1|<em>q</em> A] end"
    );
    expect(contexts).toHaveLength(2);
    expect(contexts[0]).toContain("1 Nephi 1:9");
    expect(contexts[1]).toContain("3 Nephi 11:8");   // only text since the prior unit
    expect(contexts[1]).not.toContain("1 Nephi 1:9");
  });

  it("is backward-compatible: units unchanged, non-apparatus brackets ignored", () => {
    const { html, units, contexts } = extractApparatusUnits("plain [not an apparatus] text");
    expect(units).toEqual([]);
    expect(contexts).toEqual([]);
    expect(html).toBe("plain [not an apparatus] text");
  });
});
```

Ensure `extractApparatusUnits` is in the import list at the top of `parseATV.test.js` (add it if only `parseApparatus` is imported).

**Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --testPathPattern="parseATV.test" --watchAll=false`
Expected: FAIL — `contexts` is `undefined` (`toHaveLength` throws / `.toEqual([])` fails).

**Step 3: Minimal implementation**

In `extractApparatusUnits`, add a `contexts` array collected alongside `units`:

```js
export function extractApparatusUnits(html) {
  if (!html || typeof html !== "string") return { html: html || "", units: [], contexts: [] };
  const { groups } = scanBracketGroups(html);
  const units = [];
  const contexts = [];
  let out = "";
  let from = 0;
  for (const g of groups) {
    if (!isApparatus(g.inner)) continue;
    const i = units.length;
    units.push(g.inner.split("|").map(toReading));
    contexts.push(html.slice(from, g.start));
    out += html.slice(from, g.start) + `<atv-unit data-atv-i="${i}"></atv-unit>`;
    from = g.end + 1;
  }
  out += html.slice(from);
  return { html: out, units, contexts };
}
```

**Step 4: Run to verify pass**

Run: `CI=true npx react-scripts test --testPathPattern="parseATV.test" --watchAll=false`
Expected: PASS (whole `parseATV.test` suite green).

**Step 5: Commit**

```bash
git add src/views/_Common/ATV/parseATV.js src/views/_Common/ATV/__tests__/parseATV.test.js
git commit -m "feat(atv): extractApparatusUnits returns per-unit context slices

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Governing-reference walk (pure helper, DI detector)

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/governingRef.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/governingRef.test.js`

This isolates the "a citation heading persists over the unit(s) beneath it" rule from `scripture-guide`, so it is unit-testable with a fake detector.

**Step 1: Write the failing tests**

```js
import { governingRefs } from "../governingRef";

// fake detector: returns the LAST "Book c:v"-looking token in a context slice
const fakeDetect = (html) => {
  const m = (html || "").match(/\b\d?\s?[A-Z][a-z]+ \d+:\d+/g);
  return m ? m[m.length - 1] : null;
};

test("each unit inherits the nearest preceding citation", () => {
  const contexts = ["heading 1 Nephi 2:11 because", "and 3 Nephi 11:8 they saw"];
  expect(governingRefs(contexts, fakeDetect)).toEqual(["1 Nephi 2:11", "3 Nephi 11:8"]);
});

test("a citation persists over following units that have none", () => {
  const contexts = ["1 Nephi 2:11 first", "second unit, no ref here"];
  expect(governingRefs(contexts, fakeDetect)).toEqual(["1 Nephi 2:11", "1 Nephi 2:11"]);
});

test("units before any citation resolve to null (label-only fallback)", () => {
  const contexts = ["intro prose, no ref", "then 1 Nephi 1:9 here"];
  expect(governingRefs(contexts, fakeDetect)).toEqual([null, "1 Nephi 1:9"]);
});

test("empty input yields empty output", () => {
  expect(governingRefs([], fakeDetect)).toEqual([]);
});
```

**Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --testPathPattern="governingRef" --watchAll=false`
Expected: FAIL — `Cannot find module '../governingRef'`.

**Step 3: Minimal implementation**

```js
/**
 * Assign each prose-body apparatus unit its governing scripture reference.
 *
 * Prose units sit under a nested-list citation heading (e.g. "1 Nephi 2:11").
 * Walking the units in document order, a heading found in a unit's preceding
 * context becomes the "current" reference and PERSISTS over the following
 * unit(s) until a new heading appears — mirroring how the list reads. Units
 * before any heading get `null` (the caller renders those label-only).
 *
 * `detectLastRef(contextHtml) -> string | null` is injected so this stays free
 * of scripture-guide and unit-testable in isolation.
 */
export function governingRefs(contexts, detectLastRef) {
  let current = null;
  return contexts.map((ctx) => {
    const ref = detectLastRef(ctx);
    if (ref) current = ref;
    return current;
  });
}
```

**Step 4: Run to verify pass**

Run: `CI=true npx react-scripts test --testPathPattern="governingRef" --watchAll=false`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/views/_Common/ATV/governingRef.js src/views/_Common/ATV/__tests__/governingRef.test.js
git commit -m "feat(atv): governingRefs — persist a citation heading over its units

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire prose-body verseId into Commentary.js

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Commentary.js` (imports; body-render block ~lines 310-352)
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/proseBodyRender.test.js`

**Step 1: Write the failing integration tests**

Rewrite `proseBodyRender.test.js`'s `renderBody` helper to mirror the *new* pipeline (governing-ref resolution + `verseId`), mock `FaxCrop`, and add crop-resolution + fallback tests. The helper uses the REAL `scripture-guide` detector so the wiring is validated end-to-end.

```js
// FaxCrop mocked so opening the modal never hits the network; it echoes its selector.
jest.mock("../FaxCrop", () => ({
  FaxCrop: (p) => <img data-testid="crop" data-selector={p.selector} alt={p.alt} />,
}));

import "@testing-library/jest-dom";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import Parser from "html-react-parser";
import { detectScriptures, lookupReference } from "scripture-guide";
import { extractApparatusUnits } from "../parseATV";
import { governingRefs } from "../governingRef";
import { ATVApparatus } from "../ATVApparatus";

const lastRef = (html) => {
  let last = null;
  detectScriptures(html || "", (s) => { if (s) last = s; return s; }, "en");
  return last;
};

function renderBody(html) {
  const { html: tokenized, units, contexts } = extractApparatusUnits(html);
  const refs = governingRefs(contexts, lastRef);
  const options = {
    replace: (node) => {
      if (node && node.name === "atv-unit") {
        const i = Number(node.attribs && node.attribs["data-atv-i"]);
        const ref = refs[i];
        const verseId = ref ? (lookupReference(ref)?.verse_ids?.[0] ?? null) : null;
        return (
          <ATVApparatus readings={units[i]} variant="inline" verseId={verseId} reference={ref || "fallback"} />
        );
      }
      return undefined;
    },
  };
  return render(<div>{Parser(tokenized, options)}</div>);
}
```

Keep the three existing structural tests (nesting preserved, no-apparatus unchanged, two-units-each-resolve — they still pass through the new helper). Add:

```js
test("a unit under a citation heading opens a modal cropped to that verse", () => {
  const { container } = renderBody(
    "<li>1 Nephi 2:11<ul><li>because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was</li></ul></li>"
  );
  fireEvent.click(container.querySelector(".atv-string"));   // open VariantCompare
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog.textContent).toContain("1 Nephi 2:11");       // governing ref reached the modal header
  const expectedId = lookupReference("1 Nephi 2:11").verse_ids[0];
  const crops = document.querySelectorAll('[data-testid="crop"]');
  expect(crops.length).toBeGreaterThan(0);
  crops.forEach((c) => expect(c.getAttribute("data-selector")).toBe(`ids/${expectedId}`));
});

test("a unit with no preceding citation degrades to no crop (verseId null)", () => {
  const { container } = renderBody(
    "<p>free-floating prose [<em>x</em> 1|<em>y</em> A] with no reference</p>"
  );
  fireEvent.click(container.querySelector(".atv-string"));
  const crops = document.querySelectorAll('[data-testid="crop"]');
  crops.forEach((c) => expect(c.getAttribute("data-selector")).toBe("ids/null"));
});
```

> Note: if `lookupReference("1 Nephi 2:11")` returns no `verse_ids` in this environment, switch the reference in the test to one that resolves (e.g. `"1 Nephi 1:3"`) and adjust the fixture heading to match — the point is that a resolvable heading yields `ids/<n>` and an absent heading yields `ids/null`.

**Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --testPathPattern="proseBodyRender" --watchAll=false`
Expected: FAIL — new crop test fails because the current `renderBody` (pre-edit) or Commentary wiring passes `verseId={null}` (selector `ids/null`, not `ids/<n>`).

**Step 3: Implementation — Commentary.js**

3a. Extend the `scripture-guide` import (currently `import { detectScriptures } from "scripture-guide";`):

```js
import { detectScriptures, lookupReference } from "scripture-guide";
```

3b. Add the helper import near the other ATV imports:

```js
import { governingRefs } from "./ATV/governingRef";
```

3c. Replace the destructure at ~line 310 to also take `contexts`, and compute governing references + a resolver. Right after:

```js
const { html: bodyTokenized, units: bodyUnits, contexts: bodyContexts } =
  extractApparatusUnits(htmlObject);
htmlObject = bodyTokenized;

// Each prose-body unit's governing verse is its nearest preceding citation
// (headings persist over following units). Resolve to a verseId so peek/compare
// crop the RIGHT verse; unresolved -> null -> label-only (design §Fallback).
const bodyUnitRefs = governingRefs(bodyContexts, (ctx) => {
  let last = null;
  detectScriptures(ctx || "", (s) => { if (s) last = s; return s; }, determineLanguage());
  return last;
});
```

3d. In the `atv-unit` branch of `parserOptions.replace` (~lines 336-348), replace the `verseId={null}` block:

```js
if (node && node.name === "atv-unit") {
  const i = Number(node.attribs && node.attribs["data-atv-i"]);
  const ref = bodyUnitRefs[i];
  // Body units cite OTHER verses than the commentary's own; resolve each unit's
  // governing citation to a verseId so its crops point at the right scans. No
  // citation -> null -> label-only, exactly as before (spec §6.4 safe degrade).
  const verseId = ref ? (lookupReference(ref)?.verse_ids?.[0] ?? null) : null;
  return (
    <ATVApparatus
      readings={bodyUnits[i]}
      variant="inline"
      verseId={verseId}
      reference={ref || commentaryData.reference}
    />
  );
}
```

**Step 4: Run to verify pass**

Run: `CI=true npx react-scripts test --testPathPattern="proseBodyRender" --watchAll=false`
Expected: PASS (all proseBodyRender tests).

**Step 5: Commit**

```bash
git add src/views/_Common/Commentary.js src/views/_Common/ATV/__tests__/proseBodyRender.test.js
git commit -m "feat(atv): crop prose-body units to their governing verse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Full-suite + corpus regression + manual verify

**Step 1: Full ATV suite**

Run: `CI=true npx react-scripts test src/views/_Common/ATV/__tests__ --watchAll=false`
Expected: all prior tests still pass; new suites green. (Was 130 passing / 6 skipped; now higher pass count.)

**Step 2: Corpus regression is additive — confirm no count drift**

The change adds metadata, not parse shapes, so corpus counts must be unchanged. Dump fresh and run the gated suite (see `corpusRegression.test.js` header for the exact `cli/db.mjs` command; write the dump to the scratchpad, not the repo — it is copyrighted):

```bash
ATV_CORPUS=<scratchpad>/atv.json CI=true npx react-scripts test \
  --testPathPattern="corpusRegression" --watchAll=false
```
Expected: 6/6 pass, baseline unchanged (entries 4528 / units 4862 / totalReadings 11210 / multiStateReadings 2135). Delete the dump afterward.

**Step 3: Manual smoke (optional but recommended)**

Per `CLAUDE.local.md`, run frontend against local backend, open a commentary whose analysis body cites another verse's variant (e.g. the 1 Nephi 1:14 "because that/thou" entry, `id 1001316103`, which lists `1 Nephi 2:11`), hover a prose-body pill → crop should appear for 1 Nephi 2:11; click → compare modal header shows "1 Nephi 2:11" with crops. Screenshot `localhost` (edge cache note in CLAUDE.md).

**Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch to decide merge/PR and clean up the worktree.

---

## YAGNI / non-goals

- No changes to `ATVApparatus`, `VariantCompare`, `WitnessPeek`, or `FaxCrop` — supplying `verseId` is sufficient.
- No confidence gate on reading-text-in-verse matching (trust the citation, per the chosen resolution strategy).
- No `scripture-guide` dependency added to `parseATV.js`.
- Header-box (`ATVHeader`) behavior is untouched.
