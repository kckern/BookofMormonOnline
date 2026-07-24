# ATV Parser Rewrite (Phase 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the string-surgery parser in `frontend/webapp/src/views/_Common/ATV.js` with a pure, tested `parseApparatus()` that never throws — removing two entries that currently blank the whole page and 136 readings that render corrupted text — with no intended visual change.

**Architecture:** Split parsing from rendering. A new pure module `ATV/parseATV.js` turns an apparatus HTML block into a data structure (`segments → units → readings → states`). A new `ATV/apparatus.js` holds the sigla reference table. `ATVHeader` becomes a thin renderer over that data, emitting the same DOM it emits today. No React, no DOM, no network in the parser — it is fully unit-testable.

**Tech Stack:** React 17 (CRA), Jest via `react-scripts test`, `@testing-library/react`, `html-react-parser`, `react-tooltip` v4.

**Scope:** Phase 1 only, from `docs/specs/2026-07-24-atv-textual-variants-ux.md`. Facsimile crops, the hover peek, the modal, `CommentaryTile`, and prose-body units are Phases 2–4 and are **out of scope here**. This phase ships alone and is worth shipping alone.

---

## Background you need

Read `docs/specs/2026-07-24-atv-textual-variants-ux.md` §2.1, §6.1 and §6.1.1 before starting. The short version:

Royal Skousen's *Analysis of Textual Variants* is stored as commentary (`bom_xtras_commentary`, sources 161–166). Each entry opens with a `<div class='source'>` block holding a **variation apparatus** — a quoted verse with bracketed disagreements:

```
and I know that the record which I make [<em>to be</em> &gt; js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST] <em>true</em>
```

Grammar:

- `[` … `]` — one **variation unit**
- `|` — separates competing **readings**
- each reading ends in a **sigla run** naming its witnesses: `0` = Original Manuscript, `1` = Printer's Manuscript, `A`–`T` = the 1830…1981 printed editions
- `NULL` or empty content = that witness **omits** the text (rendered `∅`)
- `&gt;` + code = an **in-document correction**, i.e. the reading changed *within* one witness. Codes: `js` (Joseph Smith), `jg` (John Gilbert), `+` (more ink), `–` (less ink), `%` (erasure), `p` (pencil), `b` (blue ink), and combinations. A bare `&gt;` with no code is also valid and common.

**Four measured facts that drive the design.** Do not re-litigate these; they were verified against all 4,528 entries:

1. **2 entries crash the current parser** — `1080616101` (trailing space before `|`) and `1610416602` (nested `[Mosiah?]` brackets). There are **no error boundaries anywhere in the frontend**, so either one blanks the entire page.
2. **136 readings render corrupted text** because sigla are stripped with `String.replace` (first occurrence) instead of positionally.
3. **100 readings carry two or more correction codes** — a reading is a *sequence of states*, not a string plus a flag. `of >js NULL >js of` means present → omitted → present.
4. **Correction markers vary by ENTITY ENCODING, not by whitespace.** Measured across all 4,528 header blocks: `&gt;js` 635, literal `>js` 17, and `&gt; js` (spaced) exactly **1**. The en-dash code is stored as `&gt;&ndash;` (48 occurrences) and **never** as a literal `–` (0). So the parser must decode a small closed set of entities — `&gt;`, `&ndash;`, `&amp;` — before looking a code up. Bare markers with no code (~908) are the single most common form, ahead of `js`.

> **Corrected 2026-07-24.** An earlier draft of this plan claimed "907 spaced vs 1,296 tight". That was a measurement error: the regex counted a bare `&gt;` followed by a word (`&gt; headed`) as a spaced code, which is why its output contained junk codes like `>the` and `>wor`. Whitespace is a non-issue; entity encoding is the real hazard. The corrected vocabulary lives in `ATV/apparatus.js`.

---

## Task 0: Branch

The current branch `feat/matters-filter-redesign` is unrelated work, and the tree has unrelated modified SVGs. Start clean off `dev`.

**Step 1: Create the branch**

```bash
cd /Users/kckern/Documents/GitHub/BookofMormonOnline
git checkout dev && git pull
git checkout -b feat/atv-parser-rewrite
```

**Step 2: Verify the test runner works before writing anything**

```bash
cd frontend/webapp
CI=true npx react-scripts test --testPathPattern="_Common/__tests__" --watchAll=false
```

Expected: existing `_Common` tests pass. If `npx jest` is used instead, it will die on `import` — CRA's babel transform is required. Use `react-scripts test`.

---

## Task 1: The witness reference table

Move the sigla data out of `ATV.js` into its own module so both the parser and (later) the renderer can use it, and so the unused provenance text finally has a home.

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/apparatus.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/apparatus.test.js`

**Step 1: Write the failing test**

```js
// frontend/webapp/src/views/_Common/ATV/__tests__/apparatus.test.js
import { WITNESSES, SIGLA_ORDER, CHANGES, BARE_CHANGE, decodeMarker, isSiglum } from "../apparatus";

test("covers exactly the 22 sigla, in chronological order", () => {
  expect(SIGLA_ORDER.join("")).toBe("01ABCDEFGHIJKLMNOPQRST");
  expect(Object.keys(WITNESSES).sort()).toEqual([...SIGLA_ORDER].sort());
});

test("every witness has a short label and a provenance paragraph", () => {
  for (const s of SIGLA_ORDER) {
    expect(WITNESSES[s].label).toBeTruthy();
    expect(WITNESSES[s].provenance.length).toBeGreaterThan(20);
  }
});

test("isSiglum accepts known letters and rejects everything else", () => {
  expect(isSiglum("A")).toBe(true);
  expect(isSiglum("0")).toBe(true);
  expect(isSiglum("U")).toBe(false); // in [A-Z] but not a witness
  expect(isSiglum("a")).toBe(false);
  expect(isSiglum("")).toBe(false);
});

test("correction codes cover every form attested in the corpus", () => {
  expect(CHANGES["js"]).toMatch(/Joseph Smith/);
  expect(CHANGES["jg"]).toMatch(/John Gilbert/);
  expect(CHANGES["%"]).toMatch(/erasure/);
  // Attested counts, header blocks: js 635, + 335, % 125, jg 94, – 48,
  // ? 31, p 15, %? 6, %+ 4, ++ 2. All must resolve.
  for (const code of ["js", "jg", "+", "%", "p", "–", "+–", "%+", "++", "?", "%?"]) {
    expect(typeof CHANGES[code]).toBe("string");
    expect(CHANGES[code].length).toBeGreaterThan(0);
  }
  expect(CHANGES[""]).toBeUndefined();      // bare marker is BARE_CHANGE, not a key
  expect(BARE_CHANGE).toBeTruthy();
});

test("decodeMarker normalises the entity forms the corpus actually uses", () => {
  // `&gt;&ndash;` occurs 48 times; a literal `–` after a marker occurs 0 times.
  expect(decodeMarker("&gt;&ndash;")).toBe(">–");
  expect(CHANGES[decodeMarker("&ndash;")]).toBeTruthy();
});
```

**Step 2: Run it to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test --testPathPattern="ATV/__tests__/apparatus" --watchAll=false
```

Expected: FAIL — `Cannot find module '../apparatus'`.

**Step 3: Write the module**

Copy the `key` and `changes` objects verbatim out of `frontend/webapp/src/views/_Common/ATV.js:5-40` and reshape. Keep the exact wording of the labels and provenance strings — they are bibliographic citation and must not be paraphrased.

```js
// frontend/webapp/src/views/_Common/ATV/apparatus.js

/**
 * The 22 witnesses to the Book of Mormon text, in chronological order, as used
 * by Royal Skousen's apparatus. `label` is the short citation form; `provenance`
 * is the full description (unused before this refactor — see spec P7).
 */
export const WITNESSES = {
  "0": { label: "Original Manuscript (𝒪)", provenance: "The original manuscript, 1828–1829 (28 percent extant, not counting the lost 116 pages); written down by Oliver Cowdery and other scribes from dictation by Joseph Smith" },
  "1": { label: "Printer’s Manuscript (𝓟)", provenance: "The printer’s manuscript, August 1829–March 1830; a handwritten copy of the original manuscript" },
  A: { label: "1830", provenance: "The first edition, published in Palmyra, New York; printed by E. B. Grandin, with typesetting by John Gilbert; set from the printer’s manuscript except for Helaman 13– Mormon 9, which was set from the original manuscript" },
  // … B through T: copy verbatim from ATV.js:9-27 …
};

export const SIGLA_ORDER = ["0", "1", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"];

/**
 * In-document correction codes. Keyed WITHOUT the leading ">" so the parser can
 * normalise `&gt;js`, `&gt; js` and a bare `&gt;` through one lookup.
 * Bare markers (no code, ~908 — the MOST common form) are BARE_CHANGE, not a
 * key here: an empty-string key would match at every position in a
 * longest-match tokeniser.
 */
export const CHANGES = Object.freeze({
  // --- Skousen's legend, verbatim ---
  "+": "change w/ more ink",
  "–": "change w/ less ink",
  "%": "change w/ erasure of the original ink",
  p: "correction is in pencil",
  b: "correction is in blue ink", // in the published legend; 0 occurrences in our corpus
  jg: "corrected by John Gilbert",
  js: "corrected by Joseph Smith",
  "+–": "correction was heavy in ink flow but the second part was weak",
  // --- editorial: OUR wording, not Skousen's, for forms his legend omits ---
  "%+": "erasure, then a heavier correction",
  "++": "two successive heavy corrections",
  "?": "reading uncertain",
  "%?": "erasure, reading uncertain",
});

/** Bare marker (no code) — ~908 occurrences, the most common form. Editorial wording. */
export const BARE_CHANGE = "change";

/**
 * Correction markers are entity-encoded in the corpus (`&gt;`, `&ndash;`) and
 * only rarely literal. Decode this closed set before a CHANGES lookup.
 */
export const decodeMarker = (s) =>
  s.replace(/&gt;/g, ">").replace(/&ndash;/g, "–").replace(/&amp;/g, "&");

export const isSiglum = (ch) => Object.prototype.hasOwnProperty.call(WITNESSES, ch);
```

**Step 4: Run the test to verify it passes**

```bash
CI=true npx react-scripts test --testPathPattern="ATV/__tests__/apparatus" --watchAll=false
```

Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/_Common/ATV/
git commit -m "feat(atv): extract witness reference table into its own module"
```

---

## Task 2: Balanced bracket scan

The current regex `/\[([^]+?)\]/g` is non-greedy and closes on the first `]`, which is why the nested-bracket entry dies.

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/parseATV.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js`

**Step 1: Write the failing test**

```js
// frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js
import { scanBrackets } from "../parseATV";

test("returns the inner text of each top-level bracket group", () => {
  expect(scanBrackets("a [x|y A] b [p|q B] c")).toEqual(["x|y A", "p|q B"]);
});

test("nested brackets close on the OUTER bracket, not the inner one", () => {
  // entry 1610416602 — the second of the two live crashers
  const src = "did king [Benjamin 1ABCDGHK|Mosiah EFIJLMNOQRT| Benjamin [Mosiah?] P|Benjamin {Mosiah?} S] keep them";
  expect(scanBrackets(src)).toEqual([
    "Benjamin 1ABCDGHK|Mosiah EFIJLMNOQRT| Benjamin [Mosiah?] P|Benjamin {Mosiah?} S",
  ]);
});

test("unbalanced brackets are dropped rather than throwing", () => {
  expect(scanBrackets("a [x|y A")).toEqual([]);
  expect(scanBrackets("a ] b")).toEqual([]);
});

test("no brackets yields an empty list", () => {
  expect(scanBrackets("plain text")).toEqual([]);
});
```

**Step 2: Run it to verify it fails**

```bash
CI=true npx react-scripts test --testPathPattern="ATV/__tests__/parseATV" --watchAll=false
```

Expected: FAIL — `Cannot find module '../parseATV'`.

**Step 3: Write the implementation**

```js
// frontend/webapp/src/views/_Common/ATV/parseATV.js

/**
 * Top-level bracket groups, by depth counting. Unlike a non-greedy regex this
 * survives nesting: `[Benjamin [Mosiah?] P]` is ONE group, not a broken prefix.
 * Unbalanced input yields no group rather than a partial one.
 */
export function scanBrackets(html) {
  const out = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "]" && depth > 0) {
      depth--;
      if (depth === 0) out.push(html.slice(start + 1, i));
    }
  }
  return out;
}
```

**Step 4: Run the test to verify it passes**

Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/_Common/ATV/
git commit -m "feat(atv): balanced bracket scan replaces non-greedy regex"
```

---

## Task 3: The apparatus discrimination rule

Not every bracket in this corpus is a variation unit. Prose contains ordinary brackets, and `[JST]` is composed entirely of *valid* sigla — so discriminating on letters would misparse it silently as an omission attested by 1888/1953R/1981. Discriminate on **shape**.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ATV/parseATV.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js`

**Step 1: Write the failing test**

```js
import { scanBrackets, isApparatus } from "../parseATV";

test("accepts a group whose every part ends in known sigla", () => {
  expect(isApparatus("<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST")).toBe(true);
});

test("rejects a single-part group — a unit needs a disagreement", () => {
  expect(isApparatus("<em>the</em> 1ABCDEFGHIJKLMNOPRST")).toBe(false);
});

test("rejects [JST] — all valid sigla, but not apparatus shape", () => {
  // The dangerous case: J, S and T are real witnesses. Letter-based
  // discrimination would parse this as an omission attested by 3 editions.
  expect(isApparatus("JST")).toBe(false);
});

test("rejects a piped bracket that is not an apparatus", () => {
  // entry 1023516101 — a spelling note in prose, not a variation unit
  expect(isApparatus("<em>a</em>|<em>o</em>")).toBe(false);
});

test("rejects when any single part lacks trailing sigla", () => {
  expect(isApparatus("<em>in</em> 01ABCDEFGHIJKLMNOPQRST|<em>into</em> ")).toBe(false);
});

test("tolerates whitespace before the pipe", () => {
  // entry 1080616101 — the first of the two live crashers
  expect(isApparatus("thing &gt;js NULL 1 |thing A| BCDEFGHIJKLMNOPQRST")).toBe(true);
});
```

**Step 2: Run to verify it fails**

Expected: FAIL — `isApparatus is not a function`.

**Step 3: Implement**

```js
import { isSiglum } from "./apparatus";

/** Trailing run of sigla on a reading, or null. Trims first — the data has
 *  `"… 1 |"` with a trailing space, which anchored matching would miss. */
export function trailingSigla(part) {
  const t = part.trim();
  const m = t.match(/[A-Z01]+$/);
  if (!m) return null;
  return [...m[0]].every(isSiglum) ? m[0] : null;
}

/**
 * A bracket group is a variation unit iff it splits on "|" into >= 2 parts and
 * EVERY part ends in a run of known sigla. Shape, not letters — see [JST].
 */
export function isApparatus(inner) {
  const parts = inner.split("|");
  if (parts.length < 2) return false;
  return parts.every((p) => trailingSigla(p) !== null);
}
```

**Step 4: Run to verify it passes**

Expected: PASS, 6 new tests.

**Step 5: Commit**

```bash
git commit -am "feat(atv): shape-based apparatus discrimination rule"
```

---

## Task 4: Positional sigla stripping — fixes the 136 corrupted readings

`ATV.js:59` does `i.replace(indexes, "")` with a **string** argument, so it removes the *first* occurrence. When a reading's own text contains its sigla substring earlier, the wrong characters are deleted.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ATV/parseATV.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js`

**Step 1: Write the failing test**

```js
import { splitReading } from "../parseATV";

test("strips sigla from the END, not the first occurrence", () => {
  // entry 1022316101 — currently renders as "nd it came to pass that A"
  // because replace("A","") kills the capital A in "And".
  const r = splitReading(" And it came to pass that A");
  expect(r.sigla).toEqual(["A"]);
  expect(r.content).toBe("And it came to pass that");
});

test("preserves HTML entities in content", () => {
  // entry 1005916101 — the 𝒪① supralinear-insert marks
  const r = splitReading("&#120034;&#9312; <em>of the Lord</em> 0");
  expect(r.sigla).toEqual(["0"]);
  expect(r.content).toBe("&#120034;&#9312; <em>of the Lord</em>");
});

test("expands a multi-letter run into individual sigla", () => {
  const r = splitReading("<em>is</em> BCDEFGHIJKLMNOPQRST");
  expect(r.sigla).toEqual("BCDEFGHIJKLMNOPQRST".split(""));
  expect(r.content).toBe("<em>is</em>");
});

test("a part with no trailing sigla yields empty sigla and no throw", () => {
  const r = splitReading("<em>into</em> ");
  expect(r.sigla).toEqual([]);
  expect(r.content).toBe("<em>into</em>");
});
```

**Step 2: Run to verify it fails**

Expected: FAIL — `splitReading is not a function`.

**Step 3: Implement**

```js
/** Split one "|"-part into its content and its witnesses. Never throws. */
export function splitReading(part) {
  const t = part.trim();
  const sigla = trailingSigla(part);
  if (!sigla) return { content: t, sigla: [] };
  // Positional slice, NOT String.replace — replace removes the first match,
  // which corrupts readings whose own text contains the sigla substring.
  return { content: t.slice(0, t.length - sigla.length).trim(), sigla: [...sigla] };
}
```

**Step 4: Run to verify it passes**

Expected: PASS, 4 new tests.

**Step 5: Commit**

```bash
git commit -am "fix(atv): strip sigla positionally, not by first-occurrence replace"
```

---

## Task 5: Correction chains — the `states[]` model

A reading is a sequence of states. 2,001 readings have one correction, 100 have two or more.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ATV/parseATV.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js`

**Step 1: Write the failing test**

```js
import { parseStates } from "../parseATV";

test("a reading with no correction is a single state", () => {
  expect(parseStates("<em>to be</em>")).toEqual([
    { content: "<em>to be</em>", omitted: false, via: null },
  ]);
});

test("normalises both `&gt;js` and `&gt; js` to the same code", () => {
  // 635 tight vs 1 spaced; the real variance is entity vs literal (17 literal `>js`).
  const tight = parseStates("thing &gt;js NULL");
  const spaced = parseStates("<em>to be</em> &gt; js <em>is</em>");
  expect(tight[1].via.code).toBe("js");
  expect(spaced[1].via.code).toBe("js");
  expect(spaced[1].via.label).toMatch(/Joseph Smith/);
});

test("a bare `&gt;` is a valid correction with the generic label", () => {
  const s = parseStates("<em>beheld</em> &gt; <em>headed</em> &gt; NULL");
  expect(s).toHaveLength(3);
  expect(s[1].via.code).toBe("");
  expect(s[2].omitted).toBe(true);
});

test("three-state chain: absent -> read it -> read", () => {
  // entry 1001016101
  const s = parseStates("NULL &gt;+ <em>read it</em> &gt;% <em>read</em>");
  expect(s).toHaveLength(3);
  expect(s[0].omitted).toBe(true);
  expect(s[1].content).toBe("<em>read it</em>");
  expect(s[1].via.code).toBe("+");
  expect(s[2].via.code).toBe("%");
});

test("present -> omitted -> present round trip", () => {
  // entry 1022216101 — the case a single `omitted` boolean cannot express
  const s = parseStates("<em>of</em> &gt;js NULL &gt;js <em>of</em>");
  expect(s.map((x) => x.omitted)).toEqual([false, true, false]);
});

test("an unknown correction code still produces a state, with a null label", () => {
  const s = parseStates("<em>x</em> &gt;zz <em>y</em>");
  expect(s).toHaveLength(2);
  expect(s[1].via.code).toBe("zz");
  expect(s[1].via.label).toBeNull();
});
```

**Step 2: Run to verify it fails**

Expected: FAIL — `parseStates is not a function`.

**Step 3: Implement**

```js
import { CHANGES, BARE_CHANGE, decodeMarker, isSiglum } from "./apparatus";

const OMITTED = /^(NULL)?$/;

/**
 * Split a reading's content on correction markers into ordered states.
 * states[0] is the original; each later state records the code that produced it.
 *
 * Markers are `&gt;` (635 with `js`) or, rarely, a literal ">" (17), optionally
 * followed by a code. Decode entities FIRST via decodeMarker() — the en-dash
 * code is stored as `&ndash;` (48) and never as a literal `–` (0). A marker
 * with no code (~908, the most common form) yields `code: null`.
 */
export function parseStates(content) {
  const MARKER = /&gt;\s*([a-z]{1,2}|[+%–b p]{1,2})?(?=\s)|&gt;\s*/g;
  const states = [];
  let cursor = 0;
  let pendingCode = null;

  const push = (raw, via) => {
    const text = raw.trim();
    states.push({
      content: OMITTED.test(text.replace(/<[^>]*>/g, "").trim()) ? "" : text,
      omitted: OMITTED.test(text.replace(/<[^>]*>/g, "").trim()),
      via,
    });
  };

  const re = /&gt;\s*([a-z]{1,3}|\+{1,2}|%\+?|–|b|p)?/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    push(content.slice(cursor, m.index), pendingCode);
    const code = (m[1] || "").trim();
    pendingCode = {
      code,
      label: Object.prototype.hasOwnProperty.call(CHANGES, code) ? CHANGES[code] : null,
    };
    cursor = m.index + m[0].length;
  }
  push(content.slice(cursor), pendingCode);
  return states;
}
```

> **Implementer note:** the regex above is a starting point, not gospel. The
> corpus contains bare `&gt;` immediately followed by a word (`&gt; headed`),
> which must NOT swallow the word as a code. Write the tests first, then tune
> the regex until all six pass. If a cleaner tokeniser (scan for `&gt;`, then
> take a following token only if it is in `CHANGES`) is easier to make correct,
> prefer it — `CHANGES` is a closed vocabulary, so membership testing is safer
> than pattern matching.

**Step 4: Run to verify it passes**

Expected: PASS, 6 new tests. Iterate on the tokeniser until they do.

**Step 5: Commit**

```bash
git commit -am "feat(atv): parse correction chains as ordered reading states"
```

---

## Task 6: `parseApparatus` — the public entry point

Assemble the pieces into the function the renderer will call.

> **Design decision flagged by the Task 2–4 review — settle this before writing code.**
> The sketch below re-implements the bracket depth-loop inline, because
> `parseApparatus` needs bracket *positions* (to slice out the interleaved text
> segments in document order) and its own `warnings` signal for unbalanced input,
> neither of which `scanBrackets` exposes — it returns only inner strings. That is a
> **second hand-maintained copy of the same scanner**, which can drift from the one in
> `scanBrackets`. Pick one before implementing:
> - **(a)** widen `scanBrackets` to optionally return positions + a balanced flag, and
>   have `parseApparatus` consume it (one scanner, one source of truth); **or**
> - **(b)** keep the inline loop, but add a test that runs a shared fixture set through
>   both `scanBrackets` and `parseApparatus` and asserts they agree on where the units
>   are — so a future edit to one loop that doesn't touch the other fails loudly.
>
> (a) is cleaner and is preferred unless it turns out to complicate the text-interleaving
> logic; (b) is the minimum acceptable. Do not ship two silently-independent scanners.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ATV/parseATV.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js`

**Step 1: Write the failing test**

```js
import { parseApparatus } from "../parseATV";

const REAL = "and I know that the record which I make [<em>to be</em> &gt; js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST] <em>true</em>";

test("interleaves text and unit segments in document order", () => {
  const { segments, warnings } = parseApparatus(REAL);
  expect(segments.map((s) => s.kind)).toEqual(["text", "unit", "text"]);
  expect(segments[0].text).toContain("and I know that the record");
  expect(segments[2].text).toContain("<em>true</em>");
  expect(warnings).toEqual([]);
});

test("a unit carries one reading per pipe-part, each with sigla", () => {
  const { segments } = parseApparatus(REAL);
  const readings = segments[1].readings;
  expect(readings).toHaveLength(3);
  expect(readings[0].sigla).toEqual(["1"]);
  expect(readings[0].states).toHaveLength(2); // "to be" -> "is"
  expect(readings[2].sigla).toHaveLength(19);
});

test("a non-apparatus bracket stays in the text stream, not parsed as a unit", () => {
  const { segments } = parseApparatus("before [<em>a</em>|<em>o</em>] after");
  expect(segments.map((s) => s.kind)).toEqual(["text"]);
  expect(segments[0].text).toContain("[<em>a</em>|<em>o</em>]");
});

test("collapses whitespace but does not decode entities", () => {
  const { segments } = parseApparatus("a\n\n  b &amp; c");
  expect(segments[0].text).toBe("a b &amp; c");
});

test("returns empty segments for empty input, never throws", () => {
  expect(parseApparatus("").segments).toEqual([]);
  expect(parseApparatus(null).segments).toEqual([]);
  expect(parseApparatus(undefined).segments).toEqual([]);
});
```

**Step 2: Run to verify it fails**

Expected: FAIL — `parseApparatus is not a function`.

**Step 3: Implement**

```js
/**
 * Parse an apparatus HTML block into ordered segments.
 * NEVER throws. Anything it cannot understand is left as text and noted in
 * `warnings` — a malformed entry degrades to plain prose, it does not take the
 * page down with it (there are no error boundaries in this app).
 */
export function parseApparatus(html) {
  if (!html || typeof html !== "string") return { segments: [], warnings: [] };
  const src = html.replace(/\s+/g, " ");
  const segments = [];
  const warnings = [];

  let depth = 0;
  let start = -1;
  let textFrom = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "]" && depth > 0) {
      depth--;
      if (depth !== 0) continue;
      const inner = src.slice(start + 1, i);
      if (!isApparatus(inner)) continue; // ordinary prose bracket — leave in text
      if (start > textFrom) segments.push({ kind: "text", text: src.slice(textFrom, start).trim() });
      segments.push({ kind: "unit", readings: inner.split("|").map(toReading) });
      textFrom = i + 1;
    }
  }
  if (depth !== 0) warnings.push("unbalanced bracket");
  const tail = src.slice(textFrom).trim();
  if (tail) segments.push({ kind: "text", text: tail });
  return { segments, warnings };
}

function toReading(part) {
  const { content, sigla } = splitReading(part);
  return { states: parseStates(content), sigla };
}
```

**Step 4: Run to verify it passes**

Expected: PASS, 5 new tests. Full file: run all of them.

```bash
CI=true npx react-scripts test --testPathPattern="ATV/__tests__" --watchAll=false
```

**Step 5: Commit**

```bash
git commit -am "feat(atv): parseApparatus entry point returning ordered segments"
```

---

## Task 7: The two crashers must not throw

This is the whole point of Phase 1. Give them their own test so a regression is unmissable.

**Files:**
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.crashers.test.js`

**Step 1: Write the failing test**

```js
// frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.crashers.test.js
import { parseApparatus } from "../parseATV";

// Verbatim from the two entries that currently blank the entire page.
// There are no error boundaries in this app: a throw here unmounts everything.

test("entry 1080616101 — trailing space before the pipe — parses without throwing", () => {
  const src =
    "and I will make my judgment to rest for a light [thing &gt;js NULL 1 |thing A| BCDEFGHIJKLMNOPQRST] [NULL &gt; of &gt;js for 1|of A|for BCDEFGHIJKLMNOPQRST] the people";
  const { segments, warnings } = parseApparatus(src);
  const units = segments.filter((s) => s.kind === "unit");
  expect(units).toHaveLength(2);
  expect(units[0].readings[0].sigla).toEqual(["1"]);
  expect(units[0].readings[2].sigla).toHaveLength(19);
  expect(warnings).toEqual([]);
});

test("entry 1610416602 — nested brackets — parses without throwing", () => {
  const src =
    "and for this cause did king [Benjamin 1ABCDGHK|Mosiah EFIJLMNOQRT| Benjamin [Mosiah?] P|Benjamin {Mosiah?} S] keep them";
  const { segments } = parseApparatus(src);
  const units = segments.filter((s) => s.kind === "unit");
  expect(units).toHaveLength(1);
  expect(units[0].readings).toHaveLength(4);
  expect(units[0].readings[2].sigla).toEqual(["P"]);
  expect(units[0].readings[2].states[0].content).toContain("Mosiah?");
});

test("hostile input never throws", () => {
  for (const bad of ["[", "]", "[[[", "[|]", "[A|]", "[NULL]", "[&gt;js]", "[|||A]"]) {
    expect(() => parseApparatus(bad)).not.toThrow();
  }
});
```

**Step 2: Run it**

```bash
CI=true npx react-scripts test --testPathPattern="parseATV.crashers" --watchAll=false
```

Expected: PASS if Tasks 2–6 are correct. **If either of the first two fails, stop and fix the parser — do not adjust the test.** These strings are the production data.

**Step 3: Commit**

```bash
git add frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.crashers.test.js
git commit -m "test(atv): regression tests for the two page-blanking entries"
```

---

## Task 8: Corpus regression script (workspace-only)

The jest fixtures cover the shapes. A full-corpus run is what actually proves it, but it needs DB access this repo does not have, and the corpus is copyrighted third-party text that must not be committed here.

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/corpusCheck.mjs`

**Step 1: Write the script**

```js
// frontend/webapp/src/views/_Common/ATV/corpusCheck.mjs
//
// Full-corpus regression for the ATV parser. NOT part of `npm test` — it needs a
// database dump, and the corpus is third-party copyrighted text that is not
// committed to this repo.
//
// Usage, from the private workspace repo:
//   node cli/db.mjs --json "SELECT id, text FROM bom_xtras_commentary \
//     WHERE text REGEXP 'class=.?.?source'" > /tmp/atv.json
//   node frontend/webapp/src/views/_Common/ATV/corpusCheck.mjs /tmp/atv.json
//
// IMPORTANT: never truncate `text`. 929 of 4,528 entries (20.5%) exceed 4,000
// characters; the longest is 24,889. A truncated dump silently undercounts.
//
// Expected, as of 2026-07-24:
//   header units 4861 | header warnings 0 | body units 3483 | body rejections 13
import fs from "fs";
import { parseApparatus, isApparatus, scanBrackets } from "./parseATV.js";

const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let headerUnits = 0, headerWarnings = 0, bodyUnits = 0, bodyRejections = 0, threw = 0;

for (const r of rows) {
  const m = r.text.match(/<div class=['"]source['"]>[\s\S]*?<\/div>/);
  const head = m ? m[0] : "";
  const body = m ? r.text.slice(r.text.indexOf(m[0]) + m[0].length) : r.text;
  try {
    const parsed = parseApparatus(head);
    headerUnits += parsed.segments.filter((s) => s.kind === "unit").length;
    headerWarnings += parsed.warnings.length;
    for (const g of scanBrackets(body.replace(/\s+/g, " "))) {
      if (isApparatus(g)) bodyUnits++;
      else if (g.includes("|")) bodyRejections++;
    }
  } catch (e) {
    threw++;
    console.error(`THREW on ${r.id}: ${e.message}`);
  }
}

const expected = { headerUnits: 4861, headerWarnings: 0, bodyUnits: 3483, bodyRejections: 13, threw: 0 };
const actual = { headerUnits, headerWarnings, bodyUnits, bodyRejections, threw };
console.table({ expected, actual });
const ok = Object.keys(expected).every((k) => expected[k] === actual[k]);
console.log(ok ? "PASS" : "FAIL — investigate before shipping");
process.exit(ok ? 0 : 1);
```

**Step 2: Run it against the real corpus**

```bash
cd ~/Documents/GitHub/BoMOnlineWorkspace
node cli/db.mjs --json "SELECT id, text FROM bom_xtras_commentary WHERE text REGEXP 'class=.?.?source'" > /tmp/atv.json
node ~/Documents/GitHub/BookofMormonOnline/frontend/webapp/src/views/_Common/ATV/corpusCheck.mjs /tmp/atv.json
```

Expected: `PASS`, and `threw: 0` above all. If any entry throws, that is a new crasher — fix the parser, add it to `parseATV.crashers.test.js`, and re-run.

If the unit counts differ from the recorded baseline, **do not just update the baseline.** Either the corpus changed or the parser regressed; find out which first.

**Step 3: Commit**

```bash
git add frontend/webapp/src/views/_Common/ATV/corpusCheck.mjs
git commit -m "test(atv): full-corpus regression script with recorded baseline"
```

---

## Task 9: Render from the parsed data

Swap `ATVHeader`'s internals. **The DOM it emits must not change** — this is a refactor plus bug fixes, not a redesign. Phase 2 changes the visuals.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ATV.js` (becomes a thin re-export + renderer)
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/ATVHeader.test.js`

**Step 1: Write the failing test**

```js
// frontend/webapp/src/views/_Common/ATV/__tests__/ATVHeader.test.js
import React from "react";
import { render } from "@testing-library/react";
import { ATVHeader } from "../../ATV";

const REAL = "<div class='source'>and I know that the record which I make [<em>to be</em> &gt; js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST] <em>true</em></div>";

test("renders nothing when there is no apparatus", () => {
  const { container } = render(<ATVHeader atvHTML="" />);
  expect(container.firstChild).toBeNull();
});

test("emits one .atv-string pill per reading, with the tooltip attributes", () => {
  const { container } = render(<ATVHeader atvHTML={REAL} />);
  const pills = container.querySelectorAll(".atv-string");
  expect(pills).toHaveLength(3);
  expect(pills[2].getAttribute("data-indexes")).toBe("BCDEFGHIJKLMNOPQRST");
  expect(pills[2].getAttribute("data-for")).toBe("atv-tooltip");
  expect(pills[2].getAttribute("data-tip")).toContain("1837");
});

test("renders an omission as ∅", () => {
  const html = "<div class='source'>x [NULL 1|<em>y</em> A] z</div>";
  const { container } = render(<ATVHeader atvHTML={html} />);
  expect(container.querySelector(".atv-string").textContent).toContain("∅");
});

test("renders a correction marker between states", () => {
  const { container } = render(<ATVHeader atvHTML={REAL} />);
  expect(container.querySelector(".atv-change")).not.toBeNull();
});

test("the crasher entry renders instead of throwing", () => {
  const html = "<div class='source'>and for this cause did king [Benjamin 1ABCDGHK|Mosiah EFIJLMNOQRT| Benjamin [Mosiah?] P|Benjamin {Mosiah?} S] keep them</div>";
  expect(() => render(<ATVHeader atvHTML={html} />)).not.toThrow();
});
```

**Step 2: Run to verify it fails**

Expected: FAIL — the current implementation throws on the last test, and the ∅/`data-tip` assertions will not match once rewritten.

**Step 3: Rewrite `ATV.js`**

Delete the `key`, `changes`, and `ATVBrackets` string-building code. Keep the module path (`_Common/ATV.js`) so `Commentary.js:15` needs no change. Render React elements, not an HTML string.

```js
// frontend/webapp/src/views/_Common/ATV.js
import React from "react";
import Parser from "html-react-parser";
import ReactTooltip from "react-tooltip";
import { parseApparatus } from "./ATV/parseATV";
import { WITNESSES } from "./ATV/apparatus";

const tipFor = (sigla) => sigla.map((s) => WITNESSES[s]?.label).filter(Boolean).join("; ");

function Reading({ reading }) {
  return (
    <span
      className="atv-string"
      data-indexes={reading.sigla.join("")}
      data-tip={tipFor(reading.sigla)}
      data-for="atv-tooltip"
    >
      {reading.states.map((st, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="atv-change">⮕ </span>}
          {st.omitted ? <b>∅</b> : Parser(st.content)}
        </React.Fragment>
      ))}
    </span>
  );
}

function ATVHeader({ atvHTML }) {
  const { segments } = parseApparatus(atvHTML);
  if (!segments.length) return null;
  return (
    <>
      <div className="atv">
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            <React.Fragment key={i}>{Parser(seg.text)}</React.Fragment>
          ) : (
            <React.Fragment key={i}>
              {seg.readings.map((r, j) => (
                <React.Fragment key={j}>
                  {j > 0 && " / "}
                  <Reading reading={r} />
                </React.Fragment>
              ))}
            </React.Fragment>
          )
        )}
      </div>
      <ReactTooltip id="atv-tooltip" place="top" effect="solid" />
    </>
  );
}

export { ATVHeader };
```

> **Note:** `ATVBrackets` was exported from the old module but has **zero
> importers** outside it (verified). Removing it is safe. If `git grep ATVBrackets`
> shows any hit outside `ATV.js`, stop and reassess.

**Step 4: Run to verify it passes**

```bash
CI=true npx react-scripts test --testPathPattern="ATV" --watchAll=false
```

Expected: PASS, all ATV suites.

**Step 5: Verify nothing else imported the removed exports**

```bash
cd /Users/kckern/Documents/GitHub/BookofMormonOnline
git grep -n "ATVBrackets" -- frontend/ | grep -v "_Common/ATV.js"
```

Expected: no output.

**Step 6: Commit**

```bash
git commit -am "refactor(atv): render apparatus from parsed data instead of string surgery"
```

---

## Task 10: Verify in the running app

Tests prove the parser. Only the browser proves the render.

**Step 1: Start both halves**

```bash
cd backend && PORT=5006 npm run dev
# separate shell:
cd frontend/webapp && PORT=3000 BROWSER=none \
  REACT_APP_LOCAL_BACKEND=true REACT_APP_LOCAL_BACKEND_PORT=5006 npm start
```

**Step 2: Open a known-good ATV commentary**

Commentary `1000216101` covers 1 Nephi 1:3. Navigate to `http://localhost:3000/commentary/1000216101`.

Check:
- the grey apparatus box renders above the prose
- three white pills: `to be ⮕ is`, `to be`, `is`
- hovering the third pill shows a tooltip listing 1837, 1840, …
- no console errors

**Step 3: Open the two former crashers**

- `http://localhost:3000/commentary/1080616101`
- `http://localhost:3000/commentary/1610416602`

Expected: both render an apparatus box. **Before this change, both blanked the page.** Confirm the page is not blank and the console is clean.

**Step 4: Check the corrupted-reading fix**

`http://localhost:3000/commentary/1022316101` — the third pill must read **"And it came to pass that"**, not "nd it came to pass that".

**Step 5: Check dark mode**

Toggle dark mode. The `.atv` box and pills should still be legible (`darkmode/_read-page.scss:50-51` covers the existing classes, which are unchanged).

**Step 6: Commit any fixes, then open the PR**

```bash
git push -u origin feat/atv-parser-rewrite
```

---

## Definition of done

- [ ] `CI=true npx react-scripts test --testPathPattern="ATV" --watchAll=false` passes
- [ ] `corpusCheck.mjs` reports `PASS` with `threw: 0` against the live corpus
- [ ] `1080616101` and `1610416602` render in the browser instead of blanking the page
- [ ] `1022316101` renders "And it came to pass that" with its leading A intact
- [ ] `git grep ATVBrackets` finds nothing outside the module
- [ ] No visual change to any correctly-parsing entry

---

## Out of scope — do not do these here

Deferred to Phases 2–4 in `docs/specs/2026-07-24-atv-textual-variants-ux.md`:

- Facsimile crops, the hover peek, the comparison modal
- Prose-body units (3,483 of them) — the parser handles them, but nothing renders them yet
- `CommentaryTile` — it still calls `stripTags`, so ATV entries still look raw in the home feed
- Retiring react-tooltip and the `rebuild()` problem
- Rendering the provenance paragraphs or correction labels — the data model now carries both, nothing displays them yet
- Accessibility, i18n and dark-mode work for the new components (§6.7) — no new components exist yet
