# Bible Analysis (`/analysis/bible`) UX Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the concrete UX and correctness defects the design review found in the Bible cross-reference view (`docs/audits/2026-08-07-bible-analysis-ux-rebuke.md`): a URL-encoding bug that silently drops highlights, chapter scope lost on the way to the reader, ribbon clicks landing on the wrong ribbon, an inoperable mobile overview, no verse text shown before the reader, and assorted layout/affordance sloppiness.

**Architecture:** All view state lives in the URL (`urlState.js` codec); components are pure functions of parsed state and call `navigate()`. Data is a module-scope rollup of a static pair index (`aggregate.js` over `data.js`). We keep that architecture intact — every fix is a local change to one component, its CSS, the codec, or the aggregate, each with its own test. No new state stores, no new libraries.

**Tech Stack:** React 17 (function components + hooks), Jest + `@testing-library/react` (`react-scripts test`, config sets `resetMocks: true`), plain CSS (`crossref.css`), `react-router-dom` v5 (`MemoryRouter` in tests).

**Working directory:** All paths are relative to the repo root `/home/bom/BookofMormonOnline`. All source lives under `frontend/webapp/`. **Run all test/build commands from `frontend/webapp/`** (that's where `package.json` and the `test` script live):

```bash
cd frontend/webapp
```

**How to run one test file (used in every task):**

```bash
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/<file>.test.js --watchAll=false
```

`CI=true` + `--watchAll=false` forces a single non-interactive run. `resetMocks: true` means any `jest.mock` implementation must be (re)installed inside `beforeEach` or the test body — see `reader.test.js` for the established pattern.

**How to verify visual/CSS changes:** Per `CLAUDE.md`, screenshot **`http://localhost:8200`** (instant HMR), NOT `bom.kckern.net` (Cloudflare caches the bundle for 4h). The dev server runs under systemd (`systemctl --user status bom-dev`). If it isn't up, the reviewer used headless Chromium against `http://10.0.0.10:8200` — either origin serves the live bundle.

**Commit discipline:** One commit per task (the final step of each task). Commit messages end with the trailer:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## File Structure

| File | Responsibility | Tasks that touch it |
|---|---|---|
| `src/views/Analysis/Bible/canon.js` | Canon data + `slugify` | 1 |
| `src/views/Analysis/Bible/urlState.js` | URL ⇄ state codec | 1, 2 |
| `src/views/Analysis/Bible/aggregate.js` | Pair rollups + `pairsFor` | 2 |
| `src/views/Analysis/Bible/AnchorView.jsx` | Anchored master-detail | 2, 3, 10 |
| `src/views/Analysis/Bible/Reader.jsx` | Side-by-side verse reader | 2, 9 |
| `src/views/Analysis/Bible/SampleStrip.jsx` | **NEW** — verse-text teaser beside the bars | 3 |
| `src/views/Analysis/Bible/PartnerBars.jsx` | Ranked partner bars | 4 |
| `src/views/Analysis/Bible/Overview.jsx` | Ribbon overview | 5, 6, 7 |
| `src/views/Analysis/Bible/TableTwin.jsx` | WCAG table twin | 11 |
| `src/views/Analysis/Bible/Rail.jsx` | Anchor-canon book rail | 8 |
| `src/views/Analysis/Bible/highlighter.jsx` | Phrase highlighting in verse text | 12 |
| `src/views/Analysis/Bible/crossref.css` | All styling | 3, 4, 6, 7, 8, 9 |

**Task dependency note:** Task 2 (Bible-chapter scope) extends `pairsFor`'s signature and is a prerequisite for Task 3 (SampleStrip), which calls the chapter-aware `pairsFor`. Do them in order. Tasks 1, 4–11 are independent of each other and may be reordered.

---

## Task 1: Fix the `?hl=` URL corruption that silently drops highlights

**Problem:** `slugify` (`canon.js:115`) only strips apostrophes and collapses whitespace, so the division "Gospels & Acts" slugifies to `gospels-&-acts`. `serialize` (`urlState.js:94`) then interpolates that raw into `?hl=${slug}` with no encoding. The bare `&` splits the query string, the `hl` value is truncated to `gospels-`, `divisionBySlug` finds nothing, and the highlight silently vanishes. Verified in the review: raw `&` → 0 highlighted bars; `%26` → 5.

**Fix:** (a) Harden `slugify` to emit only URL-safe `[a-z0-9-]` (root-cause: no stray `&` in any slug); (b) belt-and-suspenders, `encodeURIComponent` the `hl` value in `serialize`. Both together are consistent because `divisionBySlug`/`bookBySlug` re-`slugify` the incoming slug, so a clean slug round-trips.

**Files:**
- Modify: `src/views/Analysis/Bible/canon.js:115-116`
- Modify: `src/views/Analysis/Bible/urlState.js:94`
- Test: `src/views/Analysis/Bible/__tests__/urlState.test.js`, `src/views/Analysis/Bible/__tests__/canon.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `src/views/Analysis/Bible/__tests__/urlState.test.js`, inside the top-level `describe("urlState", ...)` block (after the existing `"query states round-trip through serialize"` test):

```javascript
  test("a division highlight with '&' in its name round-trips without corruption", () => {
    const state = {
      view: "anchor",
      canon: "bom",
      book: "3 Nephi",
      highlight: "Gospels & Acts",
    };
    const url = serialize(state);
    // no bare ampersand may reach the query string — that splits the params
    const query = url.split("?")[1] || "";
    expect(query).not.toMatch(/&/);
    const [path, search = ""] = url.split("?");
    expect(
      parseValue(path.replace(/^\/analysis\//, ""), search ? `?${search}` : "")
    ).toEqual(state);
  });
```

Add to `src/views/Analysis/Bible/__tests__/canon.test.js`, inside its top-level `describe` block:

```javascript
  test("slugify emits only url-safe characters", () => {
    expect(slugify("Gospels & Acts")).toBe("gospels-acts");
    expect(slugify("1 Corinthians")).toBe("1-corinthians");
    expect(slugify("Solomon's Song")).toBe("solomons-song");
  });
```

If `slugify` is not already imported in `canon.test.js`, add it to the existing import from `"../canon"`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/urlState.test.js src/views/Analysis/Bible/__tests__/canon.test.js --watchAll=false
```

Expected: FAIL. The urlState test fails because the query contains `&` (from `gospels-&-acts`); the canon test fails with `Expected "gospels-acts" Received "gospels-&-acts"`.

- [ ] **Step 3: Harden `slugify`**

In `src/views/Analysis/Bible/canon.js`, replace lines 115–116:

```javascript
export const slugify = (str) =>
  (str || "").toLowerCase().replace(/['’]/g, "").replace(/\s+/g, "-");
```

with:

```javascript
export const slugify = (str) =>
  (str || "")
    .toLowerCase()
    .replace(/['’]/g, "")        // drop apostrophes so "Solomon's" → "solomons"
    .replace(/[^a-z0-9]+/g, "-") // any other non-url-safe run → single dash
    .replace(/^-+|-+$/g, "");    // no leading/trailing dashes
```

- [ ] **Step 4: Encode the `hl` value in `serialize`**

In `src/views/Analysis/Bible/urlState.js`, replace line 94:

```javascript
    return state.highlight ? `${path}?hl=${slugify(state.highlight)}` : path;
```

with:

```javascript
    return state.highlight
      ? `${path}?hl=${encodeURIComponent(slugify(state.highlight))}`
      : path;
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/urlState.test.js src/views/Analysis/Bible/__tests__/canon.test.js --watchAll=false
```

Expected: PASS. Also re-run the sibling suites that depend on `slugify` to confirm no regression (book slugs are unaffected because they contain no `&`):

```bash
CI=true npx react-scripts test src/views/Analysis/Bible --watchAll=false
```

Expected: all Bible suites PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/canon.js frontend/webapp/src/views/Analysis/Bible/urlState.js frontend/webapp/src/views/Analysis/Bible/__tests__/urlState.test.js frontend/webapp/src/views/Analysis/Bible/__tests__/canon.test.js
git commit -m "fix(analysis): url-safe slugs + encoded hl param so division highlights survive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Carry Bible chapter scope into the reader

**Problem:** Anchoring on a Bible book with a chapter (`/analysis/bible/kjv/1-corinthians/15`) scopes the anchor view, but clicking a partner opens the reader **unscoped** — the chapter is discarded. `AnchorView.openReader` (`AnchorView.jsx:34`) only forwards `chapter` for the BoM branch, and the reader has no concept of a Bible-side chapter: `pairsFor` (`aggregate.js:164`) filters by `bomChapter` only, and the codec can't serialize a Bible chapter.

**Fix:** Add a first-class `bibleChapter` to reader state, threaded through the codec, `pairsFor`, `openReader`, and the `Reader` header/back-target. `chapterOfVid` already works for Bible verse ids (it uses global `generateReference`), so the aggregate change is one line.

**Files:**
- Modify: `src/views/Analysis/Bible/aggregate.js:164-174` (`pairsFor` signature + filter)
- Modify: `src/views/Analysis/Bible/urlState.js:43-53, 96-99` (parse + serialize `bch`)
- Modify: `src/views/Analysis/Bible/AnchorView.jsx:29-36` (`openReader` forwards Bible chapter)
- Modify: `src/views/Analysis/Bible/Reader.jsx` (destructure, filter, header, back-target, effect deps)
- Test: `__tests__/aggregate.test.js`, `__tests__/urlState.test.js`, `__tests__/anchorView.test.js`, `__tests__/reader.test.js`

- [ ] **Step 1: Write the failing test for the codec**

Add to `src/views/Analysis/Bible/__tests__/urlState.test.js`, inside `describe("urlState", ...)`:

```javascript
  test("a reader scoped to a Bible chapter round-trips via ?bch=", () => {
    const state = {
      view: "reader",
      bomBook: "2 Nephi",
      bibleBook: "Isaiah",
      anchorCanon: "kjv",
      bibleChapter: 2,
    };
    const url = serialize(state);
    expect(url).toContain("bch=2");
    const [path, search = ""] = url.split("?");
    expect(
      parseValue(path.replace(/^\/analysis\//, ""), search ? `?${search}` : "")
    ).toEqual(state);
  });

  test("an out-of-range Bible chapter is dropped, not trusted", () => {
    // Isaiah has 66 chapters; 999 must not survive parsing
    expect(
      parseValue("bible/bom/2-nephi~isaiah", "?bch=999&from=kjv")
    ).toEqual({ view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", anchorCanon: "kjv" });
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/urlState.test.js --watchAll=false
```

Expected: FAIL — `serialize` ignores `bibleChapter`, so the URL has no `bch=2` and the round-trip returns state without `bibleChapter`.

- [ ] **Step 3: Teach the codec `bch`**

In `src/views/Analysis/Bible/urlState.js`, replace the `finish` helper (lines 43–46):

```javascript
    const finish = (state) => {
      if (params.get("from") === "kjv") state.anchorCanon = "kjv";
      return state;
    };
```

with:

```javascript
    const finish = (state) => {
      if (params.get("from") === "kjv") state.anchorCanon = "kjv";
      const bch = params.get("bch");
      if (bch && /^\d+$/.test(bch)) {
        const n = Number(bch);
        if (n >= 1 && n <= bible.chapters) state.bibleChapter = n;
      }
      return state;
    };
```

(`bible` is already in scope — it is resolved at line 41 `const bible = bookBySlug("kjv", right);`.)

Then replace the reader serialization (lines 96–99):

```javascript
  const path = `${base}/bom/${slugify(state.bomBook)}${
    state.bomChapter ? `/${state.bomChapter}` : ""
  }~${slugify(state.bibleBook)}`;
  return state.anchorCanon === "kjv" ? `${path}?from=kjv` : path;
```

with:

```javascript
  const path = `${base}/bom/${slugify(state.bomBook)}${
    state.bomChapter ? `/${state.bomChapter}` : ""
  }~${slugify(state.bibleBook)}`;
  const q = new URLSearchParams();
  if (state.anchorCanon === "kjv") q.set("from", "kjv");
  if (state.bibleChapter) q.set("bch", String(state.bibleChapter));
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
```

- [ ] **Step 4: Run the codec test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/urlState.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 5: Write the failing test for `pairsFor` Bible-chapter filtering**

Add to `src/views/Analysis/Bible/__tests__/aggregate.test.js` (import `pairsFor` from `"../aggregate"` if not already imported):

```javascript
  test("pairsFor scopes to a Bible chapter when given one", () => {
    const all = pairsFor("2 Nephi", "Isaiah");
    const scoped = pairsFor("2 Nephi", "Isaiah", undefined, 2); // Isaiah 2
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThan(all.length);
    // every returned Bible verse must live in Isaiah 2
    const { chapterOfVid } = require("../aggregate");
    for (const [, bibleVid] of scoped) expect(chapterOfVid(bibleVid)).toBe(2);
  });
```

- [ ] **Step 6: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/aggregate.test.js --watchAll=false
```

Expected: FAIL — the 4th argument is ignored, so `scoped.length === all.length`.

- [ ] **Step 7: Add the Bible-chapter filter to `pairsFor`**

In `src/views/Analysis/Bible/aggregate.js`, replace `pairsFor` (lines 164–174):

```javascript
export const pairsFor = (bomBookName, bibleBookName, bomChapter) => {
  const bom = canons.bom.books.find((b) => b.name === bomBookName);
  const bible = canons.kjv.books.find((b) => b.name === bibleBookName);
  if (!bom || !bible) return [];
  return index.filter(([bomVid, bibleVid]) => {
    if (bomVid < bom.start || bomVid > bom.end) return false;
    if (bibleVid < bible.start || bibleVid > bible.end) return false;
    if (bomChapter && chapterOfVid(bomVid) !== bomChapter) return false;
    return true;
  });
};
```

with:

```javascript
export const pairsFor = (bomBookName, bibleBookName, bomChapter, bibleChapter) => {
  const bom = canons.bom.books.find((b) => b.name === bomBookName);
  const bible = canons.kjv.books.find((b) => b.name === bibleBookName);
  if (!bom || !bible) return [];
  return index.filter(([bomVid, bibleVid]) => {
    if (bomVid < bom.start || bomVid > bom.end) return false;
    if (bibleVid < bible.start || bibleVid > bible.end) return false;
    if (bomChapter && chapterOfVid(bomVid) !== bomChapter) return false;
    if (bibleChapter && chapterOfVid(bibleVid) !== bibleChapter) return false;
    return true;
  });
};
```

- [ ] **Step 8: Run the aggregate test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/aggregate.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 9: Write the failing test for `openReader` forwarding the Bible chapter**

Add to `src/views/Analysis/Bible/__tests__/anchorView.test.js`, inside `describe("AnchorView", ...)`:

```javascript
  test("opening a partner from a Bible chapter anchor forwards bibleChapter", () => {
    const { navigate } = setup({ view: "anchor", canon: "kjv", book: "Isaiah", chapter: 2 });
    fireEvent.click(screen.getByRole("button", { name: /^2 Nephi,/ }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        view: "reader",
        bomBook: "2 Nephi",
        bibleBook: "Isaiah",
        anchorCanon: "kjv",
        bibleChapter: 2,
      })
    );
  });
```

- [ ] **Step 10: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/anchorView.test.js --watchAll=false
```

Expected: FAIL — the navigate payload has no `bibleChapter`.

- [ ] **Step 11: Forward the Bible chapter in `openReader`**

In `src/views/Analysis/Bible/AnchorView.jsx`, replace `openReader` (lines 29–36):

```javascript
  const openReader = (partnerName) => {
    const readerState =
      canon === "bom"
        ? { view: "reader", bomBook: book, bibleBook: partnerName }
        : { view: "reader", bomBook: partnerName, bibleBook: book, anchorCanon: "kjv" };
    if (canon === "bom" && chapter) readerState.bomChapter = chapter;
    navigate(readerState);
  };
```

with:

```javascript
  const openReader = (partnerName) => {
    const readerState =
      canon === "bom"
        ? { view: "reader", bomBook: book, bibleBook: partnerName }
        : { view: "reader", bomBook: partnerName, bibleBook: book, anchorCanon: "kjv" };
    if (chapter) {
      if (canon === "bom") readerState.bomChapter = chapter;
      else readerState.bibleChapter = chapter;
    }
    navigate(readerState);
  };
```

- [ ] **Step 12: Run the anchorView test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/anchorView.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 13: Write the failing test for the reader honoring `bibleChapter`**

Add to `src/views/Analysis/Bible/__tests__/reader.test.js`, inside `describe("Reader", ...)`:

```javascript
  test("a bibleChapter-scoped reader shows the scope and fewer pairs than unscoped", async () => {
    // unscoped Jacob × Isaiah, then scoped to Isaiah 49
    const navigate = jest.fn();
    const { unmount } = render(
      <MemoryRouter>
        <Reader
          state={{ view: "reader", bomBook: "Jacob", bibleBook: "Isaiah", anchorCanon: "kjv", bibleChapter: 49 }}
          navigate={navigate}
        />
      </MemoryRouter>
    );
    // header names the scoped Bible chapter
    expect(await screen.findByText(/Isaiah 49/)).toBeInTheDocument();
    // Escape returns to the Bible chapter anchor, not the whole book
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "anchor", canon: "kjv", book: "Isaiah", chapter: 49 })
    );
    unmount();
  });
```

- [ ] **Step 14: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/reader.test.js --watchAll=false
```

Expected: FAIL — the header renders "Isaiah" without the chapter, and Escape returns `{canon:"kjv", book:"Isaiah"}` with no `chapter`.

- [ ] **Step 15: Thread `bibleChapter` through the Reader**

In `src/views/Analysis/Bible/Reader.jsx`:

(a) Replace the destructure (line 18):

```javascript
  const { bomBook, bibleBook, bomChapter } = state;
```

with:

```javascript
  const { bomBook, bibleBook, bomChapter, bibleChapter } = state;
```

(b) Replace the `pairs` memo call to `pairsFor` (line 23) and its dep array (line 31). Change:

```javascript
      pairsFor(bomBook, bibleBook, bomChapter).map(([bomVid, bibleVid, isQuote]) => ({
```

to:

```javascript
      pairsFor(bomBook, bibleBook, bomChapter, bibleChapter).map(([bomVid, bibleVid, isQuote]) => ({
```

and change the dep array on line 31 from:

```javascript
    [bomBook, bibleBook, bomChapter, lang]
```

to:

```javascript
    [bomBook, bibleBook, bomChapter, bibleChapter, lang]
```

(c) Replace the `backState` block (lines 79–88):

```javascript
  const anchorCanon = state.anchorCanon === "kjv" ? "kjv" : "bom";
  const backState =
    anchorCanon === "kjv"
      ? { view: "anchor", canon: "kjv", book: bibleBook }
      : {
          view: "anchor",
          canon: "bom",
          book: bomBook,
          ...(bomChapter ? { chapter: bomChapter } : {}),
        };
```

with:

```javascript
  const anchorCanon = state.anchorCanon === "kjv" ? "kjv" : "bom";
  const backState =
    anchorCanon === "kjv"
      ? {
          view: "anchor",
          canon: "kjv",
          book: bibleBook,
          ...(bibleChapter ? { chapter: bibleChapter } : {}),
        }
      : {
          view: "anchor",
          canon: "bom",
          book: bomBook,
          ...(bomChapter ? { chapter: bomChapter } : {}),
        };
```

(d) Update the Escape-effect dep array (line 99) from:

```javascript
  }, [bomBook, bibleBook, bomChapter, anchorCanon]);
```

to:

```javascript
  }, [bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon]);
```

(e) Pass `bibleChapter` into both `ReaderHeader` prop spreads (lines 104, 116, 141). Each currently reads:

```javascript
        <ReaderHeader {...{ bomBook, bibleBook, bomChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
```

Replace all three occurrences with:

```javascript
        <ReaderHeader {...{ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
```

(f) Update `ReaderHeader` to render the Bible chapter. Replace the signature and the title `<span>` (lines 210, 224–227):

```javascript
function ReaderHeader({ bomBook, bibleBook, bomChapter, anchorCanon, navigate, backState, total, quoteTotal }) {
  const anchorBook = anchorCanon === "kjv" ? bibleBook : bomBook;
```

with:

```javascript
function ReaderHeader({ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total, quoteTotal }) {
  const anchorBook = anchorCanon === "kjv" ? bibleBook : bomBook;
```

and the title block (lines 224–227):

```javascript
      <h3 className="xref-readertitle">
        <span className="book">{bomBook}{bomChapter ? ` ${bomChapter}` : ""}</span> references to{" "}
        <span className="book">{bibleBook}</span>
      </h3>
```

with:

```javascript
      <h3 className="xref-readertitle">
        <span className="book">{bomBook}{bomChapter ? ` ${bomChapter}` : ""}</span> references to{" "}
        <span className="book">{bibleBook}{bibleChapter ? ` ${bibleChapter}` : ""}</span>
      </h3>
```

Also surface the scope in the breadcrumb link when anchored from the Bible side. Replace the `Breadcrumb.Link` (lines 218–221):

```javascript
        <Breadcrumb.Link onClick={() => navigate(backState)}>
          {anchorBook}
          {anchorCanon === "bom" && bomChapter ? ` › ch. ${bomChapter}` : ""}
        </Breadcrumb.Link>
```

with:

```javascript
        <Breadcrumb.Link onClick={() => navigate(backState)}>
          {anchorBook}
          {anchorCanon === "bom" && bomChapter ? ` › ch. ${bomChapter}` : ""}
          {anchorCanon === "kjv" && bibleChapter ? ` › ch. ${bibleChapter}` : ""}
        </Breadcrumb.Link>
```

- [ ] **Step 16: Run the reader test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/reader.test.js --watchAll=false
```

Expected: PASS. Then run the whole Bible suite to confirm no regression:

```bash
CI=true npx react-scripts test src/views/Analysis/Bible --watchAll=false
```

Expected: all PASS.

- [ ] **Step 17: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/aggregate.js frontend/webapp/src/views/Analysis/Bible/urlState.js frontend/webapp/src/views/Analysis/Bible/AnchorView.jsx frontend/webapp/src/views/Analysis/Bible/Reader.jsx frontend/webapp/src/views/Analysis/Bible/__tests__/
git commit -m "fix(analysis): carry Bible chapter scope from anchor into the reader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Show actual verse text beside the aggregate bars (SampleStrip)

**Problem:** The anchor page is all numbers — bars and counts — with zero words of scripture until the final click. The review's highest-leverage fix: put a concrete verse-pair sample next to the chart so a user sees *what a "reference" is* before committing a click, and so the quantitative viz sits beside a data sample.

**Fix:** A new `SampleStrip` component renders the top 2 verse pairs (of the highlighted partner, or the top-ranked partner if none is highlighted) as compact side-by-side text with the shared phrases highlighted — reusing `pairsFor`, `BoMOnlineAPI`, and `highlightTextJSX`. It sits in the detail column above `PartnerBars` and links into the full reader.

**Files:**
- Create: `src/views/Analysis/Bible/SampleStrip.jsx`
- Modify: `src/views/Analysis/Bible/AnchorView.jsx` (render it, above `PartnerBars`)
- Modify: `src/views/Analysis/Bible/crossref.css` (styles)
- Test: `src/views/Analysis/Bible/__tests__/sampleStrip.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `src/views/Analysis/Bible/__tests__/sampleStrip.test.js`:

```javascript
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SampleStrip from "../SampleStrip";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// resetMocks: true — reinstall per test
const installApiMock = () =>
  BoMOnlineAPI.mockImplementation((input) => {
    const verses = {};
    for (const vid of input.verses || []) {
      verses[vid] = { verse_id: vid, text: `text of verse ${vid}`, heading: "" };
    }
    return Promise.resolve({ verses, versehighlights: {} });
  });

describe("SampleStrip", () => {
  beforeEach(installApiMock);

  test("renders sample verse text for the chosen partner and links to the reader", async () => {
    const onOpen = jest.fn();
    render(
      <SampleStrip bomBook="2 Nephi" bibleBook="Isaiah" onOpen={onOpen} />
    );
    // verse text appears once the API resolves
    await waitFor(() => expect(screen.getAllByText(/text of verse/).length).toBeGreaterThan(0));
    // the "open the full reader" affordance is present and wired
    const open = screen.getByRole("button", { name: /full reader|all \d+/i });
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalled();
  });

  test("renders nothing when the pair has no correspondences", () => {
    const { container } = render(
      <SampleStrip bomBook="Enos" bibleBook="Revelation" onOpen={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/sampleStrip.test.js --watchAll=false
```

Expected: FAIL with "Cannot find module '../SampleStrip'".

- [ ] **Step 3: Create the SampleStrip component**

Create `src/views/Analysis/Bible/SampleStrip.jsx`:

```javascript
import React, { useEffect, useState } from "react";
import { generateReference } from "scripture-guide";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { determineLanguage } from "src/models/Utils";
import { pairsFor } from "./aggregate";
import { highlightTextJSX } from "./highlighter";

const SAMPLE = 2;

// A concrete "here is what a reference actually is" teaser shown beside the
// aggregate bars: the top few verse pairs, side by side, phrases highlighted.
// Reuses the reader's data path (BoMOnlineAPI + highlighter) at a tiny page size.
export default function SampleStrip({ bomBook, bibleBook, bomChapter, bibleChapter, onOpen }) {
  const lang = determineLanguage();
  const all = pairsFor(bomBook, bibleBook, bomChapter, bibleChapter);
  const pairs = all.slice(0, SAMPLE);

  const [verses, setVerses] = useState({});
  const [highlights, setHighlights] = useState({});

  useEffect(() => {
    if (!pairs.length) return;
    let cancelled = false;
    const needed = [...new Set(pairs.flatMap(([b, k]) => [b, k]))];
    const versePairs = pairs.map(([b, k]) => [b, k]);
    BoMOnlineAPI({ verses: needed, versehighlights: versePairs }).then(
      ({ verses, versehighlights }) => {
        if (cancelled) return;
        const map = {};
        for (const v of Object.values(verses || {})) map[v.verse_id] = v;
        setVerses(map);
        setHighlights(versehighlights || {});
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomBook, bibleBook, bomChapter, bibleChapter]);

  if (!all.length) return null;

  const ready = pairs.some(([b]) => verses[b]);

  return (
    <aside className="xref-sample" aria-label={`Sample references from ${bomBook} to ${bibleBook}`}>
      <div className="xref-sample-head">
        <span className="xref-sample-title">
          {bomBook} × {bibleBook}
        </span>
        <button className="xref-sample-open" onClick={onOpen}>
          Open full reader — all {all.length} ›
        </button>
      </div>
      {!ready ? (
        <div className="xref-sample-skeleton" aria-hidden="true" />
      ) : (
        <ul className="xref-sample-list">
          {pairs.map(([bomVid, bibleVid, isQuote]) => {
            const pair = highlights[`${bomVid},${bibleVid}`] || {};
            const bom = verses[bomVid] || {};
            const bible = verses[bibleVid] || {};
            return (
              <li key={`${bomVid}-${bibleVid}`} className={isQuote ? "quote" : "phrase"}>
                <div className="xref-sample-side">
                  <span className="xref-sample-ref">{generateReference(bomVid, lang)}</span>
                  <p>{highlightTextJSX(bom.text, pair.bom_highlight, bomVid)}</p>
                </div>
                <div className="xref-sample-side">
                  <span className="xref-sample-ref">{generateReference(bibleVid, lang)}</span>
                  <p>{highlightTextJSX(bible.text, pair.bible_highlight, bibleVid)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run the SampleStrip test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/sampleStrip.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 5: Wire SampleStrip into AnchorView**

In `src/views/Analysis/Bible/AnchorView.jsx`:

(a) Add the import after line 5 (`import PartnerBars from "./PartnerBars";`):

```javascript
import SampleStrip from "./SampleStrip";
```

(b) Compute which partner to sample. Immediately after `flipTarget` is computed (after line 22, before `const flip =`), add:

```javascript
  // The partner we show a concrete text sample for: the highlighted one if it
  // is a real partner book, otherwise the top-ranked partner.
  const sampleTarget =
    (partners.some((p) => p.book.name === highlight) && highlight) ||
    partners[0]?.book.name;
```

(c) Render `SampleStrip` between the scope chip and `PartnerBars`. Replace the `<PartnerBars .../>` block (lines 90–96):

```javascript
          <PartnerBars
            canon={canon}
            book={book}
            chapter={chapter}
            highlight={highlight}
            onSelect={openReader}
          />
```

with:

```javascript
          {sampleTarget && (
            <SampleStrip
              bomBook={canon === "bom" ? book : sampleTarget}
              bibleBook={canon === "bom" ? sampleTarget : book}
              bomChapter={canon === "bom" ? chapter : undefined}
              bibleChapter={canon === "kjv" ? chapter : undefined}
              onOpen={() => openReader(sampleTarget)}
            />
          )}
          <PartnerBars
            canon={canon}
            book={book}
            chapter={chapter}
            highlight={highlight}
            onSelect={openReader}
          />
```

- [ ] **Step 6: Add SampleStrip styles**

Append to `src/views/Analysis/Bible/crossref.css`, before the `/* ---- responsive ---- */` comment (line 667):

```css
/* ---- sample strip (text beside the bars) ---- */

.xref-sample {
  max-width: 860px;
  margin: 0 0 1.25rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 0.75ex;
  background: var(--surface-1, #f8f8f8);
  padding: 0.75rem 0.9rem;
}

.xref-sample-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.xref-sample-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.xref-sample-open {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: var(--link, #345496);
  cursor: pointer;
  white-space: nowrap;
}

.xref-sample-open:hover {
  text-decoration: underline;
}

.xref-sample-skeleton {
  height: 4.5rem;
  border-radius: 0.5ex;
  background: linear-gradient(90deg, var(--surface-2, #f0f0f0), var(--surface-1, #f8f8f8), var(--surface-2, #f0f0f0));
}

.xref-sample-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.xref-sample-list li {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  border-left: 3px solid var(--xref-phrase);
  padding-left: 0.6rem;
}

.xref-sample-list li.quote {
  border-left-color: var(--xref-quote);
}

.xref-sample-ref {
  display: block;
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--text-secondary, #444);
  margin-bottom: 0.15rem;
}

.xref-sample-side p {
  margin: 0;
  font-family: "Scripture", serif;
  font-size: 0.9rem;
  line-height: 1.3rem;
  color: var(--text-primary, #212529);
}

.xref-sample-side p span.highlight {
  background-color: rgba(92, 185, 138, 0.3);
  box-shadow: inset 0 -2px 0 var(--xref-quote);
}
```

Then add one line to the existing `@media (max-width: 700px)` block (before its closing brace, after line 693) so the two-column sample stacks on mobile:

```css
  .xref-sample-list li { grid-template-columns: 1fr; }
```

- [ ] **Step 7: Verify the full Bible suite still passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible --watchAll=false
```

Expected: all PASS (AnchorView now renders SampleStrip; the existing AnchorView tests don't mock `BoMOnlineAPI`, but SampleStrip only *calls* it in an effect and renders a skeleton until it resolves, so those tests still find their bars and headings — confirm no test throws on the un-mocked call. If any AnchorView test errors on the network call, wrap the render in the same `BoMOnlineAPI` mock those tests would need; but the effect swallows results and never throws synchronously, so no change should be required.)

- [ ] **Step 8: Visual check**

Start/confirm the dev server (`systemctl --user status bom-dev`), then screenshot `http://localhost:8200/analysis/bible/kjv/1-corinthians` and confirm two verse pairs render above the bars with highlighted phrases and an "Open full reader" link.

- [ ] **Step 9: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/SampleStrip.jsx frontend/webapp/src/views/Analysis/Bible/AnchorView.jsx frontend/webapp/src/views/Analysis/Bible/crossref.css frontend/webapp/src/views/Analysis/Bible/__tests__/sampleStrip.test.js
git commit -m "feat(analysis): show sample verse text beside the partner bars

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Make the partner bars obviously clickable + hint the empty column

**Problem:** The partner bars open the reader but look like a static chart — only `cursor:pointer` and an `aria-label` signal interactivity. And the detail column is half empty on the right. The review: add a "verses ›" affordance and a hint line.

**Fix:** Add a per-bar "open" affix (a `›` chevron that appears on hover/focus) and a one-line hint under the bars telling the user the bars are clickable.

**Files:**
- Modify: `src/views/Analysis/Bible/PartnerBars.jsx`
- Modify: `src/views/Analysis/Bible/crossref.css`
- Test: `src/views/Analysis/Bible/__tests__/partnerBars.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/views/Analysis/Bible/__tests__/partnerBars.test.js` (match the existing render/setup pattern in that file — it renders `PartnerBars` with `canon`/`book`/`onSelect` props):

```javascript
  test("each bar advertises that it opens the verse reader", () => {
    const onSelect = jest.fn();
    render(<PartnerBars canon="bom" book="2 Nephi" onSelect={onSelect} />);
    // an explicit affordance label, not just cursor:pointer
    expect(screen.getAllByText("›").length).toBeGreaterThan(0);
    // a hint line tells the user the bars are interactive
    expect(screen.getByText(/select a book to read the verses/i)).toBeInTheDocument();
  });
```

If `PartnerBars`, `render`, `screen` are not already imported at the top of the file, add them (`import PartnerBars from "../PartnerBars";` and the `@testing-library/react` imports) following the pattern of the other test files.

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/partnerBars.test.js --watchAll=false
```

Expected: FAIL — no `›` affix and no hint line.

- [ ] **Step 3: Add the affordance and hint**

In `src/views/Analysis/Bible/PartnerBars.jsx`, replace the bar's inner markup. Change the `<span className="xref-bar-count">{total}</span>` line (line 49) to add a chevron sibling:

```javascript
            <span className="xref-bar-count">{total}</span>
            <span className="xref-bar-go" aria-hidden="true">›</span>
```

Then update the grid to reserve a column for the chevron — this is a CSS change (Step 4). Finally, add the hint line. Replace the closing of the bars container (lines 53–58):

```javascript
      {partners.length > FOLD && !showAll && (
        <button className="xref-showall" onClick={() => setShowAll(true)}>
          Show all {partners.length}
        </button>
      )}
    </div>
  );
```

with:

```javascript
      {partners.length > FOLD && !showAll && (
        <button className="xref-showall" onClick={() => setShowAll(true)}>
          Show all {partners.length}
        </button>
      )}
      <p className="xref-bars-hint">Select a book to read the verses side by side.</p>
    </div>
  );
```

- [ ] **Step 4: Style the chevron column and hint**

In `src/views/Analysis/Bible/crossref.css`, update the `.xref-bar` grid (line 459) from:

```css
  grid-template-columns: 140px 1fr 3.5em;
```

to:

```css
  grid-template-columns: 140px 1fr 3.5em 1em;
```

Add the two responsive overrides. Update the `@media (max-width: 1100px)` rule (line 671) from:

```css
  .xref-bar { grid-template-columns: 110px 1fr 3.5em; }
```

to:

```css
  .xref-bar { grid-template-columns: 110px 1fr 3.5em 1em; }
```

Then add, right after the `.xref-bar-count` rule (after line 513):

```css
.xref-bar-go {
  color: var(--link, #345496);
  font-weight: 700;
  opacity: 0;
  transition: opacity 120ms;
  text-align: center;
}

.xref-bar:hover .xref-bar-go,
.xref-bar:focus-visible .xref-bar-go {
  opacity: 1;
}

.xref-bars-hint {
  margin: 0.6rem 0 0;
  font-size: 0.8rem;
  color: var(--text-muted, #777);
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/partnerBars.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/PartnerBars.jsx frontend/webapp/src/views/Analysis/Bible/crossref.css frontend/webapp/src/views/Analysis/Bible/__tests__/partnerBars.test.js
git commit -m "fix(analysis): make partner bars read as clickable + add reader hint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Fix ribbon click hit-priority and neutralize hairline ribbons

**Problem:** 104 ribbons overlap; SVG paints in `links` order, so a 2-reference hairline can sit on top of a 400-reference cable and steal the click. The review measured a center-of-chart probe landing on a ≤5-ref ribbon.

**Fix:** Paint ribbons in ascending value order so the biggest ribbons render last (on top, and win pointer events). Additionally, when nothing is active, set `pointer-events: none` on ribbons carrying ≤ `HAIRLINE` references so they can't intercept clicks meant for a cable. `data-ribbon` selectors are attribute-based, so reordering the array does not break existing tests.

**Files:**
- Modify: `src/views/Analysis/Bible/Overview.jsx`
- Test: `src/views/Analysis/Bible/__tests__/overview.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/views/Analysis/Bible/__tests__/overview.test.js`, inside `describe("Overview", ...)`:

```javascript
  test("ribbons paint largest-last so big cables win the click", () => {
    const { container } = setup();
    const ribbons = [...container.querySelectorAll("[data-ribbon]")];
    // map each rendered ribbon to its reference count via the title text
    const values = ribbons.map((g) => {
      const t = g.querySelector("title").textContent;
      return Number(t.match(/· (\d+) refs/)[1]);
    });
    // ascending: later (on-top) ribbons have >= value of earlier ones
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/overview.test.js --watchAll=false
```

Expected: FAIL — ribbons are in `links` order, not value-sorted.

- [ ] **Step 3: Sort the render order and gate hairline pointer events**

In `src/views/Analysis/Bible/Overview.jsx`, add a `HAIRLINE` constant next to the existing constants (after line 8, `const FALLBACK_H = 420;`):

```javascript
const HAIRLINE = 5; // ribbons with <= this many refs never intercept clicks when idle
```

Then change the ribbon map to iterate a value-sorted copy. Replace line 292:

```javascript
              {ribbons.map((r, i) => {
```

with:

```javascript
              {[...ribbons].sort((a, b) => a.value - b.value).map((r, i) => {
```

Finally, gate pointer events on idle hairlines. In the ribbon `<g>` element, replace the `style` prop (line 313):

```javascript
                    style={{ "--i": i, "--emphasis": emphasis }}
```

with:

```javascript
                    style={{
                      "--i": i,
                      "--emphasis": emphasis,
                      pointerEvents: !active && r.value <= HAIRLINE ? "none" : undefined,
                    }}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/overview.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 5: Visual check**

Screenshot `http://localhost:8200/analysis/bible` and click near the center of the widest cable; confirm the readout names a high-reference pair, not a 2-reference hairline.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/Overview.jsx frontend/webapp/src/views/Analysis/Bible/__tests__/overview.test.js
git commit -m "fix(analysis): paint ribbons largest-last and mute hairline hit targets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Cursor-anchored ribbon tooltip

**Problem:** Hover feedback lives in the `xref-readout` status line above the chart — up to ~600px from the cursor. Users don't connect the ribbon they're touching with the far-away text.

**Fix:** A lightweight tooltip element positioned at the cursor inside the ribbon wrap, populated on ribbon hover/move and cleared on leave. The existing `xref-readout` line stays (it is the `aria-live` a11y channel); the tooltip is a `aria-hidden` visual echo.

**Files:**
- Modify: `src/views/Analysis/Bible/Overview.jsx`
- Modify: `src/views/Analysis/Bible/crossref.css`
- Test: `src/views/Analysis/Bible/__tests__/overview.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/views/Analysis/Bible/__tests__/overview.test.js`, inside `describe("Overview", ...)`:

```javascript
  test("hovering a ribbon shows a cursor-anchored tooltip with the pair detail", () => {
    const { container } = setup();
    const ribbon = container.querySelector('[data-ribbon="2 Nephi|Major Prophets"]');
    fireEvent.mouseMove(ribbon, { clientX: 400, clientY: 300 });
    const tip = container.querySelector(".xref-tip");
    expect(tip).toBeInTheDocument();
    expect(tip).toHaveTextContent(/Major Prophets ↔ 2 Nephi/);
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/overview.test.js --watchAll=false
```

Expected: FAIL — no `.xref-tip` element exists.

- [ ] **Step 3: Add tooltip state and rendering**

In `src/views/Analysis/Bible/Overview.jsx`:

(a) Add tooltip state next to the existing `active` state (after line 22, `const [active, setActive] = useState(null);`):

```javascript
  const [tip, setTip] = useState(null); // { x, y, text } in wrap-relative px
```

(b) Add a handler that positions the tooltip relative to the ribbon wrap. Insert it right before the `return (` of the component (after line 226, after `rightSegments`):

```javascript
  const moveTip = (r, e) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      text: `${r.left} ↔ ${r.right} · ${r.value} refs · ${r.quotes} quotes`,
    });
  };
```

(c) Wire the ribbon `<g>` to it. In the ribbon element, add `onMouseMove` alongside the existing `onMouseEnter`/`onMouseLeave` (lines 315–316). Replace:

```javascript
                    onMouseEnter={() => setActive({ type: "ribbon", key })}
                    onMouseLeave={() => setActive(null)}
```

with:

```javascript
                    onMouseEnter={() => setActive({ type: "ribbon", key })}
                    onMouseMove={(e) => moveTip(r, e)}
                    onMouseLeave={() => {
                      setActive(null);
                      setTip(null);
                    }}
```

(d) Render the tooltip inside `.xref-svgbox`. Replace the opening of the svg box (line 267):

```javascript
          <div className="xref-svgbox" ref={wrapRef}>
```

with:

```javascript
          <div className="xref-svgbox" ref={wrapRef}>
          {tip && (
            <div
              className="xref-tip"
              aria-hidden="true"
              style={{ left: tip.x, top: tip.y }}
            >
              {tip.text}
            </div>
          )}
```

(The stray-indent is fine; Prettier will reflow. The `<div>` closes at the existing `</div>` on line 346.)

- [ ] **Step 4: Style the tooltip**

Add to `src/views/Analysis/Bible/crossref.css`, right after the `.xref-svgbox` rule (after line 153):

```css
.xref-svgbox {
  position: relative; /* positioning context for .xref-tip */
}

.xref-tip {
  position: absolute;
  transform: translate(0.75rem, 0.75rem); /* offset off the cursor */
  pointer-events: none;
  z-index: 2;
  max-width: 20rem;
  padding: 0.3rem 0.55rem;
  border-radius: 0.5ex;
  background: var(--surface-0, #fff);
  border: 1px solid var(--border, #ddd);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary, #212529);
  white-space: nowrap;
}
```

Note: `.xref-svgbox` already has a `flex: 1; min-height: 0;` rule at line 150–153 — add `position: relative;` to that existing block instead of duplicating the selector if you prefer; either works because CSS merges them, but consolidating is cleaner.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/overview.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/Overview.jsx frontend/webapp/src/views/Analysis/Bible/crossref.css frontend/webapp/src/views/Analysis/Bible/__tests__/overview.test.js
git commit -m "feat(analysis): cursor-anchored tooltip on ribbon hover

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Make the overview operable on mobile

**Problem:** Below 700px the ribbon labels are `display:none` (`crossref.css:689`) — the chart becomes anonymous gray boxes with a "click a division" hint and no way to tell which is which. The table twin is the WCAG-clean, fully labeled, navigable equivalent and already exists.

**Fix:** On narrow viewports, render the `TableTwin` in place of the ribbon chart and hide the chart/table toggle (which would be meaningless). Detect width with a `matchMedia` hook so it's reactive and testable.

**Files:**
- Modify: `src/views/Analysis/Bible/Overview.jsx`
- Test: `src/views/Analysis/Bible/__tests__/overview.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/views/Analysis/Bible/__tests__/overview.test.js`, inside `describe("Overview", ...)`. This test stubs `matchMedia` to report a narrow viewport:

```javascript
  test("on a narrow viewport the overview renders the table twin, not the ribbon svg", () => {
    const original = window.matchMedia;
    window.matchMedia = (q) => ({
      matches: true, // pretend we are below the breakpoint
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    });
    try {
      const { container } = setup();
      expect(container.querySelector(".xref-ribbonsvg")).toBeNull();
      expect(screen.getAllByTestId("xref-pairrow").length).toBeGreaterThan(0);
    } finally {
      window.matchMedia = original;
    }
  });
```

Note: jsdom does not implement `matchMedia`, so the hook must guard for its absence (see Step 3) — the existing desktop tests run with `matchMedia === undefined` and must keep rendering the chart.

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/overview.test.js --watchAll=false
```

Expected: FAIL — the chart renders regardless of viewport, so `.xref-ribbonsvg` is present and there are no table rows.

- [ ] **Step 3: Add a `useIsNarrow` hook and branch the render**

In `src/views/Analysis/Bible/Overview.jsx`:

(a) Add the hook below the imports, before the `Overview` component (after line 8):

```javascript
// True when the viewport is too narrow for the labeled ribbon chart. Guards for
// environments without matchMedia (jsdom) by reporting false (desktop chart).
function useIsNarrow(maxWidth = 700) {
  const query = `(max-width: ${maxWidth}px)`;
  const get = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [narrow, setNarrow] = React.useState(get);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const on = () => setNarrow(mql.matches);
    on();
    mql.addEventListener ? mql.addEventListener("change", on) : mql.addListener(on);
    return () =>
      mql.removeEventListener ? mql.removeEventListener("change", on) : mql.removeListener(on);
  }, [query]);
  return narrow;
}
```

Ensure `React` is imported as default (it is — line 1 is `import React, { ... } from "react";`).

(b) Call the hook at the top of the component, right after `const mode = ...` (after line 16):

```javascript
  const isNarrow = useIsNarrow();
```

(c) Branch the render. Replace the mode branch (line 254):

```javascript
      {mode === "table" ? (
        <TableTwin navigate={navigate} />
      ) : (
```

with:

```javascript
      {mode === "table" || isNarrow ? (
        <TableTwin navigate={navigate} />
      ) : (
```

(d) Hide the chart/table toggle on narrow (the table is forced, so the toggle is meaningless). Replace the mode toggle button (lines 239–245):

```javascript
          <button
            className="xref-modetoggle"
            aria-pressed={mode === "table"}
            onClick={() => setMode(mode === "chart" ? "table" : "chart")}
          >
            {mode === "chart" ? "View as table" : "View as chart"}
          </button>
```

with:

```javascript
          {!isNarrow && (
            <button
              className="xref-modetoggle"
              aria-pressed={mode === "table"}
              onClick={() => setMode(mode === "chart" ? "table" : "chart")}
            >
              {mode === "chart" ? "View as table" : "View as chart"}
            </button>
          )}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/overview.test.js --watchAll=false
```

Expected: PASS (the new narrow test renders the table; every existing desktop test still renders the chart because jsdom has no `matchMedia`).

- [ ] **Step 5: Visual check**

Screenshot `http://localhost:8200/analysis/bible` at a 390px viewport width; confirm a filterable, labeled table renders (not anonymous gray boxes) and rows open the reader.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/Overview.jsx frontend/webapp/src/views/Analysis/Bible/__tests__/overview.test.js
git commit -m "fix(analysis): render the labeled table twin on mobile overview

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Collapse the rail into an accordion (kill the nested-scroll tunnel)

**Problem:** The 240px rail is a nested-scroll tunnel showing ~24% of a 2870px list, while the detail column has empty vertical space. The rail's *content* (density bars, auto-centering) is good — the review says demote to an accordion, don't delete.

**Fix:** Render only the anchored book's group expanded; other groups collapse to a clickable group header that re-anchors to that group's first book on click. This shrinks the list from ~65 rows to ~9 headers + one expanded group, so the rail fits without an inner scrollbar on desktop, and the auto-scroll `useLayoutEffect` becomes a no-op (nothing to scroll).

**Files:**
- Modify: `src/views/Analysis/Bible/Rail.jsx`
- Modify: `src/views/Analysis/Bible/crossref.css`
- Test: `src/views/Analysis/Bible/__tests__/rail.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/views/Analysis/Bible/__tests__/rail.test.js` (follow the file's existing render pattern — `Rail` takes `canon`, `book`, `onAnchor`, `onChapter`):

```javascript
  test("only the anchored book's group is expanded; other groups collapse to headers", () => {
    const onAnchor = jest.fn();
    render(
      <Rail canon="bom" book="Alma" chapter={undefined} onAnchor={onAnchor} onChapter={jest.fn()} />
    );
    // Alma lives in "Plates of Mormon" — its sibling Mosiah is visible
    expect(screen.getByRole("button", { name: /^Mosiah,/ })).toBeInTheDocument();
    // a book in a different, collapsed group is NOT rendered as a book button
    expect(screen.queryByRole("button", { name: /^Enos,/ })).toBeNull();
    // its group header is a button that re-anchors when clicked
    fireEvent.click(screen.getByRole("button", { name: /Small Plates/i }));
    expect(onAnchor).toHaveBeenCalledWith("1 Nephi"); // first book of Small Plates
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/rail.test.js --watchAll=false
```

Expected: FAIL — every group is fully expanded, so `Enos` is present and the group name is a `<div>`, not a button.

- [ ] **Step 3: Rewrite Rail as an accordion**

Replace the body of `src/views/Analysis/Bible/Rail.jsx` (lines 8–59, the whole `export default function Rail`) with:

```javascript
export default function Rail({ canon, book, chapter, onAnchor, onChapter }) {
  const { groups, books } = canons[canon];
  const max = Math.max(...books.map((b) => bookTotal(canon, b.name)), 1);

  const railRef = useRef(null);
  const anchorRef = useRef(null);
  useLayoutEffect(() => {
    const rail = railRef.current;
    const el = anchorRef.current;
    if (!rail || !el) return;
    rail.scrollTop = Math.max(
      0,
      el.offsetTop - rail.clientHeight / 2 + el.clientHeight / 2
    );
  }, [book]);

  // Which group holds the anchored book — that group stays open; the rest
  // collapse to a header that re-anchors to the group's first book on click.
  const openGroup = groups.find((g) => g.books.some((b) => b.name === book))?.name;

  return (
    <nav ref={railRef} className="xref-rail" aria-label={canons[canon].label}>
      {groups.map((group) => {
        const isOpen = group.name === openGroup;
        if (!isOpen) {
          const groupTotal = group.books.reduce((a, b) => a + bookTotal(canon, b.name), 0);
          return (
            <button
              key={group.name}
              className="xref-rail-groupbtn"
              aria-label={`${group.name}, ${groupTotal} references, open`}
              onClick={() => onAnchor(group.books[0].name)}
            >
              <span className="xref-rail-groupname">{group.name}</span>
              <span className="xref-rail-groupcount" aria-hidden="true">{groupTotal}</span>
            </button>
          );
        }
        return (
          <div key={group.name} className="xref-rail-group">
            <div className="xref-rail-groupname open">{group.name}</div>
            {group.books.map((b) => {
              const total = bookTotal(canon, b.name);
              const isAnchor = b.name === book;
              return (
                <div key={b.name} className="xref-rail-item">
                  <button
                    ref={isAnchor ? anchorRef : undefined}
                    className={`xref-rail-book ${isAnchor ? "anchored" : ""}`}
                    aria-current={isAnchor ? "true" : undefined}
                    aria-label={`${b.name}, ${total} references`}
                    onClick={() => onAnchor(b.name)}
                  >
                    <span className="xref-rail-bookname">{b.name}</span>
                    <span className="xref-rail-density" aria-hidden="true">
                      <span
                        className="xref-rail-densityfill"
                        style={{ width: `${Math.sqrt(total / max) * 100}%` }}
                      />
                    </span>
                  </button>
                  {isAnchor && (
                    <ChapterStrip canon={canon} book={b} chapter={chapter} onChapter={onChapter} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Style the collapsed group header and relax the rail's max-height**

In `src/views/Analysis/Bible/crossref.css`:

(a) The rail no longer needs to be a fixed-height scroll tunnel on desktop — the accordion fits. Replace the `.xref-rail` rule (lines 317–323):

```css
.xref-rail {
  flex: 0 0 240px;
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  padding-right: 0.5rem;
  position: relative; /* offsetParent for the anchored-book auto-scroll (Rail.jsx) */
}
```

with:

```css
.xref-rail {
  flex: 0 0 240px;
  /* accordion keeps the list short; cap only as a safety net, not a tunnel */
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  padding-right: 0.5rem;
  position: relative; /* offsetParent for the anchored-book auto-scroll (Rail.jsx) */
}
```

(b) Add the collapsed-group button styles right after the `.xref-rail-groupname` rule (after line 332):

```css
.xref-rail-groupbtn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  border-radius: 0.5ex;
  padding: 0.25rem 0.5rem;
  margin-top: 0.4rem;
  font: inherit;
  color: var(--text-primary, #212529);
  cursor: pointer;
  text-align: left;
}

.xref-rail-groupbtn:hover {
  background: var(--surface-2, #f0f0f0);
}

.xref-rail-groupbtn .xref-rail-groupname {
  margin: 0;
}

.xref-rail-groupcount {
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted, #777);
}
```

- [ ] **Step 5: Run the rail test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/rail.test.js --watchAll=false
```

Expected: PASS. Then run the anchorView suite too (it renders Rail):

```bash
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/anchorView.test.js --watchAll=false
```

Expected: PASS. If any anchorView test relied on a book from a now-collapsed group being present, update that assertion to click the group header first — but the existing tests anchor on "2 Nephi"/"Isaiah" and assert on the detail column and partner bars, not on other-group rail rows, so no change is expected.

- [ ] **Step 6: Visual check**

Screenshot `http://localhost:8200/analysis/bible/bom/alma`; confirm the rail shows the Plates-of-Mormon group expanded, other groups as single-line headers, no inner scrollbar on a normal desktop height.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/Rail.jsx frontend/webapp/src/views/Analysis/Bible/crossref.css frontend/webapp/src/views/Analysis/Bible/__tests__/rail.test.js
git commit -m "fix(analysis): collapse the anchor rail into an accordion, kill nested scroll

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Reader layout cleanup — link Bible refs, de-mirror, dedupe headings, drop justify

**Problem (four sub-items from the review):**
1. Bible refs are dead `<span>`s while BoM refs link to `/read` (`Reader.jsx:163` vs `:173`).
2. Mirrored layout flings the Bible ref ~500px from its verse card (right cell is right-aligned).
3. The chapter heading (e.g. "The Sacrament: Blessing the Bread") repeats on every row in a run.
4. Justified text in ~530px columns produces rivers (`crossref.css:653`).

**Fix:** Link Bible refs to `/read`; left-align the right column so the ref sits beside its card; render each cell's heading only when it changes from the previous visible row; drop `text-align: justify` globally (the mobile override already did this — promote it).

**Files:**
- Modify: `src/views/Analysis/Bible/Reader.jsx`
- Modify: `src/views/Analysis/Bible/crossref.css`
- Test: `src/views/Analysis/Bible/__tests__/reader.test.js`

- [ ] **Step 1: Write the failing tests**

The existing reader test `"BoM refs link to /read/, Bible refs are plain text"` asserts the OLD behavior (Bible refs are NOT links) — that assertion is now wrong and must be updated. Replace that test (reader.test.js lines 52–58) with:

```javascript
  test("both BoM and Bible refs link to /read/", async () => {
    setup({ bomBook: "Jacob" });
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(9));
    const bomLinks = screen.getAllByRole("link", { name: /Jacob/ });
    expect(bomLinks[0]).toHaveAttribute("href", expect.stringMatching(/^\/read\//));
    const bibleLinks = screen.getAllByRole("link", { name: /Isaiah \d/ });
    expect(bibleLinks[0]).toHaveAttribute("href", expect.stringMatching(/^\/read\//));
  });

  test("a repeated chapter heading renders once per run, not on every row", async () => {
    // reinstall the mock with a constant heading so consecutive rows share it
    BoMOnlineAPI.mockImplementation((input) => {
      const verses = {};
      for (const vid of input.verses || []) {
        verses[vid] = { verse_id: vid, text: `text of verse ${vid}`, heading: "Shared Heading" };
      }
      return Promise.resolve({ verses, versehighlights: {} });
    });
    setup({ bomBook: "Jacob" });
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(9));
    // 9 pairs, one shared heading string — must appear far fewer than 9 times
    expect(screen.getAllByText("Shared Heading").length).toBeLessThan(9);
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/reader.test.js --watchAll=false
```

Expected: FAIL — Bible refs are `<span>` not `<a>`, and the heading renders on every row.

- [ ] **Step 3: Link Bible refs and dedupe headings**

In `src/views/Analysis/Bible/Reader.jsx`:

(a) Track the last-seen heading per column while mapping rows, so a heading only prints when it changes. Replace the `visible.map(...)` opening (lines 154–158):

```javascript
          {visible.map(({ bomVid, bibleVid, isQuote, bomRef, bibleRef }) => {
            const pairHighlights = highlights[`${bomVid},${bibleVid}`] || {};
            const bomData = verseData[bomVid] || {};
            const bibleData = verseData[bibleVid] || {};
            return (
```

with:

```javascript
          {(() => {
            let lastBomHeading = null;
            let lastBibleHeading = null;
            return visible.map(({ bomVid, bibleVid, isQuote, bomRef, bibleRef }) => {
              const pairHighlights = highlights[`${bomVid},${bibleVid}`] || {};
              const bomData = verseData[bomVid] || {};
              const bibleData = verseData[bibleVid] || {};
              const bomHeading = bomData.heading && bomData.heading !== lastBomHeading ? bomData.heading : "";
              const bibleHeading = bibleData.heading && bibleData.heading !== lastBibleHeading ? bibleData.heading : "";
              if (bomData.heading) lastBomHeading = bomData.heading;
              if (bibleData.heading) lastBibleHeading = bibleData.heading;
              return (
```

(b) Replace the two ref/heading cells (lines 161–175). Change:

```javascript
                  <td className="scriptureRef left">
                    <div className="header_container">
                      <Link className="ref" to={`/read/${verseIdToSlug([bomVid])}`}>
                        {bomRef}
                      </Link>
                      {isQuote && <span className="xref-quote-badge">QUOTE</span>}
                      <div className="heading noselect">{bomData.heading}</div>
                    </div>
                  </td>
                  <td className="scriptureRef right">
                    <div className="header_container">
                      <div className="heading noselect">{bibleData.heading}</div>
                      <span className="ref">{bibleRef}</span>
                    </div>
                  </td>
```

with:

```javascript
                  <td className="scriptureRef left">
                    <div className="header_container">
                      <Link className="ref" to={`/read/${verseIdToSlug([bomVid])}`}>
                        {bomRef}
                      </Link>
                      {isQuote && <span className="xref-quote-badge">QUOTE</span>}
                      <div className="heading noselect">{bomHeading}</div>
                    </div>
                  </td>
                  <td className="scriptureRef right">
                    <div className="header_container">
                      <Link className="ref" to={`/read/${verseIdToSlug([bibleVid])}`}>
                        {bibleRef}
                      </Link>
                      <div className="heading noselect">{bibleHeading}</div>
                    </div>
                  </td>
```

(c) Close the IIFE. Replace the map's closing (lines 187–189):

```javascript
              </React.Fragment>
            );
          })}
```

with:

```javascript
              </React.Fragment>
            );
            });
          })()}
```

- [ ] **Step 4: De-mirror and de-justify in CSS**

In `src/views/Analysis/Bible/crossref.css`:

(a) The right column is now ref-then-heading like the left. Remove the right-align mirroring. Replace the two `.right` ref/heading rules (lines 617–620 and 637–639):

```css
.verseViewerTable td.scriptureRef.right .heading {
  text-align: right;
  padding-right: 1rem;
}
```

and

```css
.verseViewerTable td.scriptureRef.right .ref {
  text-align: right;
}
```

Delete both rules entirely (the right column now inherits the left-aligned `.heading`/`.ref` layout, so the ref sits beside its card).

(b) Drop global justify. Replace the `.verseViewerTable .scriptureCell p` rule's `text-align` (line 653):

```css
  text-align: justify;
```

with:

```css
  text-align: left;
```

Then the now-redundant mobile override `.verseViewerTable .scriptureCell p { text-align: left; }` (line 693) can be removed from the `@media (max-width: 700px)` block, along with its comment on line 692 (`/* justified text in ~150px columns is all rivers */`).

- [ ] **Step 5: Run the reader test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/reader.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 6: Visual check**

Screenshot `http://localhost:8200/analysis/bible/bom/3-nephi~matthew`; confirm both refs are links sitting beside their verse cards, the shared heading appears once per run, and body text is left-aligned (no rivers).

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/Reader.jsx frontend/webapp/src/views/Analysis/Bible/crossref.css frontend/webapp/src/views/Analysis/Bible/__tests__/reader.test.js
git commit -m "fix(analysis): link Bible refs, de-mirror the reader, dedupe headings, drop justify

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Rename the cryptic flip button

**Problem:** "⇄ view from Moroni" is insider jargon for a control that swaps the anchored canon *and* book.

**Fix:** Clearer copy: "Swap sides: anchor on {book} →". Keep the `⇄` glyph as an icon.

**Files:**
- Modify: `src/views/Analysis/Bible/AnchorView.jsx:47-51`
- Test: `src/views/Analysis/Bible/__tests__/anchorView.test.js`

- [ ] **Step 1: Update the tests that assert the old label**

Several existing tests match `/view from Isaiah/i`. Update them to the new copy. In `src/views/Analysis/Bible/__tests__/anchorView.test.js`, replace every occurrence of the regex `/view from Isaiah/i` and `/view from isaiah/i` with `/anchor on Isaiah/i`, and the mixed matcher `/view from|anchor on/i` stays as-is (it already tolerates the new text). Specifically update the assertions in the tests: "heading, total, breadcrumb, and flip control render", "flip with no highlight re-anchors on the top partner", and "flip button names its destination book".

Add one explicit test of the new copy inside `describe("AnchorView", ...)`:

```javascript
  test("the swap control uses plain language naming its destination", () => {
    setup();
    expect(screen.getByRole("button", { name: /swap sides: anchor on Isaiah/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/anchorView.test.js --watchAll=false
```

Expected: FAIL — the new-copy test can't find the button; the button still says "view from Isaiah".

- [ ] **Step 3: Update the button label**

In `src/views/Analysis/Bible/AnchorView.jsx`, replace the flip button (lines 47–51):

```javascript
        {flipTarget && (
          <button className="xref-flip" onClick={flip}>
            ⇄ view from {flipTarget}
          </button>
        )}
```

with:

```javascript
        {flipTarget && (
          <button className="xref-flip" onClick={flip}>
            <span aria-hidden="true">⇄ </span>Swap sides: anchor on {flipTarget} →
          </button>
        )}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/anchorView.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/AnchorView.jsx frontend/webapp/src/views/Analysis/Bible/__tests__/anchorView.test.js
git commit -m "fix(analysis): plain-language label for the anchor swap control

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Make the table twin's Bible column clickable

**Problem:** In `TableTwin`, the BoM cell is a `xref-rowlink` button but the Bible cell is plain text (`TableTwin.jsx:95`). Since Task 7 makes the table the mobile default, the Bible column should be an equal navigation affordance.

**Fix:** Wrap the Bible book name in the same `xref-rowlink` button that opens the reader.

**Files:**
- Modify: `src/views/Analysis/Bible/TableTwin.jsx:95`
- Test: `src/views/Analysis/Bible/__tests__/tableTwin.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/views/Analysis/Bible/__tests__/tableTwin.test.js` (follow its existing render pattern — `TableTwin` takes a `navigate` prop):

```javascript
  test("the Bible column is a link that opens the reader", () => {
    const navigate = jest.fn();
    render(<TableTwin navigate={navigate} />);
    // pick any Bible book link; clicking opens the reader for that pair
    const bibleLink = screen.getAllByRole("button", { name: /Open .* × .* reader/ })[0];
    fireEvent.click(bibleLink);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "reader" })
    );
  });
```

Note: the BoM cell already renders a button with `aria-label="Open {bom} × {bible} reader"`. After the fix, the Bible cell renders a second button with the same aria-label per row — so `getAllByRole(...).length` will be twice the row count. This test only needs one, so `[0]` is fine.

- [ ] **Step 2: Run to verify it fails**

This assertion may already pass by matching the *BoM* button. To make the test meaningfully target the Bible cell, assert the count doubles. Replace the test body's final lines with a count check that fails pre-fix:

```javascript
  test("the Bible column is a link that opens the reader", () => {
    const navigate = jest.fn();
    const { container } = render(<TableTwin navigate={navigate} />);
    const rows = container.querySelectorAll("[data-testid='xref-pairrow']").length;
    // one rowlink per cell that navigates: BoM + Bible = 2 per row
    expect(container.querySelectorAll(".xref-rowlink").length).toBe(rows * 2);
  });
```

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/tableTwin.test.js --watchAll=false
```

Expected: FAIL — currently one `.xref-rowlink` per row (BoM only), so the count is `rows`, not `rows * 2`.

- [ ] **Step 3: Make the Bible cell a link**

In `src/views/Analysis/Bible/TableTwin.jsx`, replace the Bible cell (line 95):

```javascript
                <td>{p.bibleBookName}</td>
```

with:

```javascript
                <td>
                  <button
                    className="xref-rowlink"
                    aria-label={`Open ${p.bomBookName} × ${p.bibleBookName} reader`}
                    onClick={(e) => {
                      e.stopPropagation();
                      open(p);
                    }}
                  >
                    {p.bibleBookName}
                  </button>
                </td>
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/tableTwin.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/TableTwin.jsx frontend/webapp/src/views/Analysis/Bible/__tests__/tableTwin.test.js
git commit -m "fix(analysis): make the table twin's Bible column open the reader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Harden the phrase highlighter so highlights stop vanishing

**Problem (separately reported by the user):** Highlight arrays from the API frequently don't render on the page. The matcher in `highlighter.jsx` is too brittle in three ways:
1. `prepareText` (line 7) strips `-` and `'` from the **verse text**, but the incoming **highlight string is never normalized the same way** — so a highlight like `"Lord's"` or `"well-beloved"` can never match text whose punctuation was stripped. Mismatch → silently dropped (the file's own comment admits "an unmatched string degrades to unhighlighted text").
2. The pattern only converts **spaces** to a flexible separator (`replace(/ /g, "[^a-z]+")`, line 15). Punctuation *inside or beside* a word (apostrophes, hyphens, commas) isn't tolerated.
3. Regex metacharacters in the highlight string aren't escaped — a stray `(` or `+` either throws (caught, dropped) or mis-matches.

**Fix:** Match token-by-token. Reduce each highlight string to its letter tokens (`/[a-z]+/gi`), join them with a tolerant `[^a-z]*` gap, and match case-insensitively against the **original** verse text (no destructive pre-stripping) so punctuation drift on either side can't break the match — and the rendered text keeps its apostrophes/hyphens. Strings genuinely absent from the text still degrade to plain text; that residual is acceptable and expected.

**Files:**
- Modify: `src/views/Analysis/Bible/highlighter.jsx`
- Test: `src/views/Analysis/Bible/__tests__/highlighter.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `src/views/Analysis/Bible/__tests__/highlighter.test.js` (it already imports `generateHighlightedText` from `"../highlighter"`; if not, add the import). These capture the three drift cases:

```javascript
  const plain = (result) =>
    result.jsx.map((n) => n.props.children).join("");
  const highlighted = (result) =>
    result.jsx
      .filter((n) => n.props.className === "highlight")
      .map((n) => n.props.children)
      .join("");

  test("matches across an apostrophe the text spells without one", () => {
    // API string has the apostrophe; local text does not (or vice-versa)
    const res = generateHighlightedText("and the Lords anointed came", ["Lord's anointed"]);
    expect(highlighted(res).toLowerCase()).toContain("lords anointed");
  });

  test("matches across a hyphen and surrounding punctuation", () => {
    const res = generateHighlightedText("his well beloved Son, whom", ["well-beloved"]);
    expect(highlighted(res).toLowerCase().replace(/[^a-z ]/g, "")).toContain("well beloved");
  });

  test("a regex-metacharacter highlight string does not throw and can match", () => {
    const res = generateHighlightedText("fear God (the Lord) alway", ["God the Lord"]);
    expect(highlighted(res).toLowerCase()).toContain("god");
    // and the full text is still present (nothing dropped)
    expect(plain(res).length).toBeGreaterThan(0);
  });

  test("a string genuinely absent from the text degrades to plain, unhighlighted text", () => {
    const res = generateHighlightedText("wherefore it came to pass", ["not present here"]);
    expect(highlighted(res)).toBe("");
    expect(plain(res)).toBe("wherefore it came to pass");
  });
```

If the file has existing tests that assert the OLD stripped-output behavior (e.g. expecting apostrophes removed from the rendered text), update those assertions to expect the original punctuation preserved — the new matcher renders the source text verbatim.

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/highlighter.test.js --watchAll=false
```

Expected: FAIL — the apostrophe and hyphen cases don't match under the current space-only, punctuation-stripping matcher.

- [ ] **Step 3: Rewrite the matcher**

In `src/views/Analysis/Bible/highlighter.jsx`, replace the top of the file through `generateHighlightedText` (lines 7–46):

```javascript
const prepareText = (text) => (text || "").replace(/[-']/g, "");

export const generateHighlightedText = (text, arrayOfStrings) => {
  text = prepareText(text);

  const ranges = [];
  for (const str of arrayOfStrings || []) {
    const pattern = String(str).replace(/ /g, "[^a-z]+");
    let match = null;
    try {
      match = new RegExp(pattern, "gi").exec(text);
    } catch (e) {
      // un-regexable highlight string: skip it
    }
    if (match) ranges.push([match.index, match.index + match[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
```

with:

```javascript
// Reduce a highlight string to its letter tokens; join with a tolerant gap so
// punctuation drift (apostrophes, hyphens, commas) on EITHER side can't break
// the match. Matching runs against the original text — no destructive stripping
// — so the rendered verse keeps its punctuation.
const tokenize = (s) => String(s || "").match(/[a-z]+/gi) || [];

export const generateHighlightedText = (text, arrayOfStrings) => {
  text = text || "";

  const ranges = [];
  for (const str of arrayOfStrings || []) {
    const tokens = tokenize(str);
    if (!tokens.length) continue;
    // tokens separated by any run of non-letters, including none — "[^a-z]*"
    // under the /i flag excludes A–Z too, so it only spans separators.
    const pattern = tokens.join("[^a-z]*");
    let match = null;
    try {
      match = new RegExp(pattern, "i").exec(text);
    } catch (e) {
      // pattern still unbuildable somehow: skip it
    }
    if (match) ranges.push([match.index, match.index + match[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
```

The rest of the function (the `merged`/`jsx` builder from the old line 25 onward) is unchanged — it already slices `text`, which is now the original, punctuation-preserving string. Leave `highlightTextJSX` (old lines 48–51) as-is. Delete the now-unused `prepareText` only if no other export references it (it does not — grep to confirm: `grep -n prepareText src/views/Analysis/Bible/highlighter.jsx`).

- [ ] **Step 4: Run the highlighter test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/highlighter.test.js --watchAll=false
```

Expected: PASS. Then run the reader suite (it renders highlighted text) to confirm no regression:

```bash
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/reader.test.js --watchAll=false
```

Expected: PASS.

- [ ] **Step 5: Visual check**

Screenshot `http://localhost:8200/analysis/bible/bom/2-nephi~isaiah` and confirm shared phrases are highlighted on far more pairs than before (spot-check a pair whose highlight contains an apostrophe or hyphen).

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/highlighter.jsx frontend/webapp/src/views/Analysis/Bible/__tests__/highlighter.test.js
git commit -m "fix(analysis): token-based phrase matching so highlights stop vanishing on punctuation drift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Investigate the quote-count discrepancy (data integrity)

**Problem (investigation, not a mechanical fix):** The reviewer found the reader header claims "48 quotes" for a pair while the famous sacrament-prayer parallels (Moroni 4–5 ↔ Matthew 26 / Luke 22) render with **no** QUOTE badge and no highlight — i.e. the `isQuote` flag (3rd column of the `index` in `data.js`) appears wrong for known quotations, and badge count vs. highlight count disagree. This is a data problem in the pair index, possibly compounded by highlight strings that don't match the local verse text (`highlighter.jsx` silently drops unmatched strings). Fixing it means regenerating or correcting `data.js`, which is outside a pure front-end change and needs the data owner.

**Fix (this task):** Use the systematic-debugging skill to characterize the defect precisely and write it up — do **not** hand-edit `data.js` blindly.

**Files:**
- Read: `src/views/Analysis/Bible/data.js`, `src/views/Analysis/Bible/highlighter.jsx`, `src/views/Analysis/Bible/aggregate.js`
- Create: `docs/bugs/2026-08-07-bible-analysis-quote-flag-integrity.md`

- [ ] **Step 1: Reproduce and quantify**

REQUIRED SUB-SKILL: Use superpowers:systematic-debugging.

Write a throwaway Node script (or a temporary Jest test) that loads `index` from `data.js` and, for a known quotation pair (e.g. the verse-id range for Moroni 4 and its Matthew/Luke partners — resolve ranges via `canon.js`), prints how many rows are flagged `isQuote` vs. total, and lists the specific vids that a human can spot-check against the printed scripture. Capture the numbers.

- [ ] **Step 2: Separate the two failure modes**

Determine which is happening (they need different fixes):
- (a) The `isQuote` flag is genuinely absent/incorrect in `data.js` for rows a human calls a quote → **data regeneration** needed.
- (b) The flag is correct but the highlight *strings* returned by the API don't match the local verse text, so `generateHighlightedText` drops them → highlighting is lossy but the badge should still show. **Task 12 already hardens this matcher**, so re-check after Task 12 lands: quantify how many previously-dropped highlights now render, and whether any residual misses are genuine absences (acceptable) vs. still-fixable drift. Confirm the QUOTE badge (driven purely by `isQuote`, `Reader.jsx:166`) shows even when the highlight doesn't.

- [ ] **Step 3: Write the findings doc**

Create `docs/bugs/2026-08-07-bible-analysis-quote-flag-integrity.md` with: symptom, the exact vids checked, the counts from Step 1, which failure mode(s) confirmed, root cause hypothesis, and a concrete recommended fix owner/path (e.g. "regenerate `data.js` from source X" or "reconcile header quote count with rendered badges"). Link back to `docs/audits/2026-08-07-bible-analysis-ux-rebuke.md`.

- [ ] **Step 4: Delete the throwaway script; commit the doc only**

```bash
git add docs/bugs/2026-08-07-bible-analysis-quote-flag-integrity.md
git commit -m "docs(analysis): investigate quote-flag integrity in the cross-ref index

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Run the entire Bible suite once more:**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible --watchAll=false
```

Expected: all suites PASS.

- [ ] **Walk the whole flow in the browser** at `http://localhost:8200` (not `bom.kckern.net`):
  - `/analysis/bible` — ribbons paint largest-last, hover shows a cursor tooltip, center-click hits a cable; at 390px the labeled table renders instead of gray boxes.
  - `/analysis/bible/kjv/1-corinthians` — sample verse text shows above the bars; bars read as clickable; picking a chapter then a partner lands in a reader scoped to that Bible chapter.
  - reader — both refs are links beside their cards, headings appear once per run, text left-aligned.

- [ ] **Update the audit doc** `docs/audits/2026-08-07-bible-analysis-ux-rebuke.md` with a short "Remediation" footer linking this plan and listing which P0/P1/P2 items are now addressed (Task 13 flags the one that needs a data owner).

---

## Deferred / Out of Scope

- **`?view=table` vs. state key `mode` naming drift** — cosmetic; renaming the query param breaks existing shared links, so left as-is intentionally.
- **Chapter-cell counts inside the 12px cells** — counts remain in `title`/`aria-label`; surfacing them visually needs a hover popover with real design, not a mechanical tweak.
- **Quote-flag data correction** — Task 13 characterizes it; the actual data regeneration is owned outside this front-end plan.

---

## Self-Review (completed against the audit)

**Spec coverage vs. the review's fix list:**
- P0 encode `hl` → Task 1 ✅
- P0 inline verse samples → Task 3 ✅
- P0 forward chapter scope → Task 2 ✅
- P0 ribbon paint order + pointer-events + cursor tooltip → Tasks 5 + 6 ✅
- P0 mobile overview → Task 7 ✅
- P1 bars affordance + empty-column hint → Task 4 ✅
- P1 rail accordion / kill nested scroll → Task 8 ✅
- P1 reader cleanup (left-align, refs beside cards, dedupe headings, link Bible refs) → Task 9 ✅
- P1 reconcile quote counts → Task 13 (investigation, data-owned) ✅ flagged
- P1 unify view/mode → Deferred (URL-contract risk) ✅ noted
- P2 rename flip button → Task 10 ✅
- P2 chapter-cell tooltips → Deferred ✅ noted
- P2 table Bible column clickable → Task 11 ✅
- **User report: highlights frequently don't appear (too fragile)** → Task 12 ✅ (token-based matcher, punctuation-drift tolerant)

**Type/name consistency:** `pairsFor(bom, bible, bomChapter, bibleChapter)` used identically in aggregate, Reader, and SampleStrip. `bibleChapter` state key used identically in codec, AnchorView, Reader. `xref-rowlink`, `xref-tip`, `xref-sample-*`, `xref-bar-go` class names match between JSX and CSS.

**Placeholder scan:** none — every code step shows the full old→new edit or complete new file.
