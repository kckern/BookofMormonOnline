# Reader Siderail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browseable siderail to the side-by-side cross-reference reader so users can change books (→ that book × its top partner) and chapters (→ re-scope the current pair) without leaving the reader.

**Architecture:** Reuse the existing accordion `Rail` component inside `Reader.jsx`, laid out `header + (rail | main)` like the anchor view. All rail actions are ordinary `navigate()` calls to existing reader-URL shapes (the codec already round-trips them). One small backward-compatible addition to `Rail`/`ChapterStrip` scopes the chapter strip to the current partner. Spec: `docs/specs/2026-08-07-reader-siderail-design.md`.

**Tech Stack:** React 17 (function components + hooks), Jest + `@testing-library/react` (`react-scripts test`, `resetMocks: true`), `react-router-dom` v5 (`MemoryRouter` in tests), plain CSS (`crossref.css`).

**Working directory:** All paths are relative to repo root `/home/bom/BookofMormonOnline`; source lives under `frontend/webapp/`. **Run all test commands from `frontend/webapp/`:**

```bash
cd frontend/webapp
```

**Test runner (used every task):**

```bash
CI=true npx react-scripts test <path> --watchAll=false
```

`resetMocks: true` means any `jest.mock` implementation must be reinstalled inside `beforeEach`/the test body — `__tests__/reader.test.js` already mocks `src/models/BoMOnlineAPI` this way; reuse that file's setup.

**Visual verification:** screenshot `http://localhost:8200` (instant HMR), NOT `bom.kckern.net` (CDN-cached 4h). Dev server: `systemctl --user status bom-dev`.

**Commit trailer (every commit):**

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/views/Analysis/Bible/ChapterStrip.jsx` | Per-chapter density strip | 1 |
| `src/views/Analysis/Bible/Rail.jsx` | Accordion book rail | 1 |
| `src/views/Analysis/Bible/Reader.jsx` | Side-by-side reader + siderail | 2 |
| `src/views/Analysis/Bible/crossref.css` | Reader body layout | 2 |
| `src/views/Analysis/Bible/__tests__/rail.test.js` | Rail/ChapterStrip tests | 1 |
| `src/views/Analysis/Bible/__tests__/reader.test.js` | Reader tests | 2 |

**Dependency:** Task 1 adds the `partner` prop the reader relies on; do it first. Both tasks build on the current `feat/reader-siderail` branch (already checked out).

---

## Task 1: Scope the chapter strip to a partner (optional `partner` prop)

**Why:** In the reader the chapter strip must reflect *the current pair* (which chapters of the anchor book have refs with the partner) so a lit chapter always yields content. `aggregate.js`'s `chapterCounts(canonKey, bookName, partnerName)` already accepts a third partner arg; we thread an optional `partner` prop through `Rail` → `ChapterStrip` → that arg. The anchor view calls `Rail` without `partner`, so its behavior is unchanged.

**Files:**
- Modify: `src/views/Analysis/Bible/ChapterStrip.jsx`
- Modify: `src/views/Analysis/Bible/Rail.jsx`
- Test: `src/views/Analysis/Bible/__tests__/rail.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `src/views/Analysis/Bible/__tests__/rail.test.js`, inside its top-level `describe` block. It already imports `React`, `render`, `screen`, `Rail`. Add an import for `chapterCounts` at the top of the file (next to the existing imports):

```javascript
import { chapterCounts } from "../aggregate";
```

Then add the tests:

```javascript
  test("the anchored book's chapter strip is scoped to the partner when one is given", () => {
    const all = chapterCounts("bom", "2 Nephi");
    const scoped = chapterCounts("bom", "2 Nephi", "Isaiah");
    // a chapter that has Isaiah refs AND other-partner refs → scoped < unscoped
    const idx = all.findIndex((c, i) => scoped[i] > 0 && c !== scoped[i]);
    expect(idx).toBeGreaterThanOrEqual(0); // sanity: such a chapter exists in the data
    const ch = idx + 1;
    render(
      <Rail canon="bom" book="2 Nephi" chapter={undefined} partner="Isaiah" onAnchor={jest.fn()} onChapter={jest.fn()} />
    );
    expect(
      screen.getByRole("radio", { name: new RegExp(`^Chapter ${ch}, ${scoped[idx]} references$`) })
    ).toBeInTheDocument();
  });

  test("without a partner the chapter strip stays unscoped (anchor-view behavior is unchanged)", () => {
    const all = chapterCounts("bom", "2 Nephi");
    const idx = all.findIndex((c) => c > 0);
    const ch = idx + 1;
    render(
      <Rail canon="bom" book="2 Nephi" chapter={undefined} onAnchor={jest.fn()} onChapter={jest.fn()} />
    );
    expect(
      screen.getByRole("radio", { name: new RegExp(`^Chapter ${ch}, ${all[idx]} references$`) })
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify the first test fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/rail.test.js --watchAll=false
```

Expected: the "scoped to the partner" test FAILS — `ChapterStrip` ignores `partner`, so chapter `ch` still shows the unscoped count `all[idx]` (≠ `scoped[idx]`), and `getByRole` can't find the scoped-count label. (The "without a partner" test passes already.)

- [ ] **Step 3: Thread `partner` through ChapterStrip**

In `src/views/Analysis/Bible/ChapterStrip.jsx`, replace the component signature and the `chapterCounts` call. Change:

```javascript
export default function ChapterStrip({ canon, book, chapter, onChapter }) {
  const counts = chapterCounts(canon, book.name);
```

to:

```javascript
export default function ChapterStrip({ canon, book, chapter, partner, onChapter }) {
  const counts = chapterCounts(canon, book.name, partner);
```

- [ ] **Step 4: Thread `partner` through Rail**

In `src/views/Analysis/Bible/Rail.jsx`, add `partner` to the component signature. Change:

```javascript
export default function Rail({ canon, book, chapter, onAnchor, onChapter }) {
```

to:

```javascript
export default function Rail({ canon, book, chapter, partner, onAnchor, onChapter }) {
```

Then pass it to the `ChapterStrip` for the anchored book. Change:

```javascript
                  {isAnchor && (
                    <ChapterStrip canon={canon} book={b} chapter={chapter} onChapter={onChapter} />
                  )}
```

to:

```javascript
                  {isAnchor && (
                    <ChapterStrip canon={canon} book={b} chapter={chapter} partner={partner} onChapter={onChapter} />
                  )}
```

- [ ] **Step 5: Run the tests to verify they pass, then the whole Bible suite**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/rail.test.js --watchAll=false
CI=true npx react-scripts test src/views/Analysis/Bible --watchAll=false
```

Expected: both new tests PASS; all Bible suites PASS (the anchor view's existing rail tests are unaffected because they don't pass `partner`).

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/ChapterStrip.jsx frontend/webapp/src/views/Analysis/Bible/Rail.jsx frontend/webapp/src/views/Analysis/Bible/__tests__/rail.test.js
git commit -m "feat(analysis): optional partner prop scopes the rail chapter strip

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Render the siderail in the reader (layout + browse handlers)

**Why:** The reader currently has no navigation. This adds the rail (anchor-side canon), a `switchBook` handler (different book → that book × its top partner, or its anchor view if it has none), and a `rescope` handler (chapter → re-scope the current pair in place). The navigation-target logic is extracted into a pure exported `readerTargetForBook` so the top-partner/fallback rule is unit-testable.

**Files:**
- Modify: `src/views/Analysis/Bible/Reader.jsx`
- Modify: `src/views/Analysis/Bible/crossref.css`
- Test: `src/views/Analysis/Bible/__tests__/reader.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `src/views/Analysis/Bible/__tests__/reader.test.js`. First extend the existing top import and add two data imports. Change:

```javascript
import Reader from "../Reader";
```

to:

```javascript
import Reader, { readerTargetForBook } from "../Reader";
import { partnersFor } from "../aggregate";
import { canons } from "../canon";
```

Then add these tests inside the `describe("Reader", ...)` block:

```javascript
  test("readerTargetForBook: a book maps to itself × its top partner", () => {
    const top = partnersFor("bom", "Jacob")[0].book.name;
    expect(readerTargetForBook("bom", "Jacob")).toEqual({
      view: "reader",
      bomBook: "Jacob",
      bibleBook: top,
    });
    const kjvTop = partnersFor("kjv", "Isaiah")[0].book.name;
    expect(readerTargetForBook("kjv", "Isaiah")).toEqual({
      view: "reader",
      bibleBook: "Isaiah",
      bomBook: kjvTop,
      anchorCanon: "kjv",
    });
  });

  test("readerTargetForBook: a book with no partners falls back to its anchor view", () => {
    // there ARE Bible books with zero Book-of-Mormon cross-references
    const orphan = canons.kjv.books.find((b) => partnersFor("kjv", b.name).length === 0);
    expect(orphan).toBeDefined();
    expect(readerTargetForBook("kjv", orphan.name)).toEqual({
      view: "anchor",
      canon: "kjv",
      book: orphan.name,
    });
  });

  test("the reader renders an anchor-side rail with the anchor book marked current", async () => {
    setup(); // default: 2 Nephi × Isaiah, anchorCanon bom
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBeGreaterThan(0));
    const rail = screen.getByRole("navigation", { name: /Book of Mormon/i });
    expect(rail).toBeInTheDocument();
    // 2 Nephi is the anchored book
    expect(screen.getByRole("button", { name: /^2 Nephi, .*references/ })).toHaveAttribute("aria-current", "true");
  });

  test("clicking a rail chapter re-scopes the current pair in place", async () => {
    const { navigate } = setup();
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("radio", { name: /^Chapter 12,/ }));
    expect(navigate).toHaveBeenCalledWith({
      view: "reader",
      bomBook: "2 Nephi",
      bibleBook: "Isaiah",
      bomChapter: 12,
    });
  });

  test("clicking a different rail book opens that book × its top partner", async () => {
    const { navigate } = setup();
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBeGreaterThan(0));
    // Jacob is a sibling of 2 Nephi in the open "Small Plates" group
    fireEvent.click(screen.getByRole("button", { name: /^Jacob, .*references/ }));
    expect(navigate).toHaveBeenCalledWith(readerTargetForBook("bom", "Jacob"));
  });
```

(`waitFor`, `fireEvent`, `screen`, `MemoryRouter`, and the `setup`/`BoMOnlineAPI` mock already exist in this file.)

- [ ] **Step 2: Run to verify they fail**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/reader.test.js --watchAll=false
```

Expected: FAIL — `readerTargetForBook` is not exported (import error / undefined), and the reader renders no rail (`getByRole("navigation", {name:/Book of Mormon/})` not found).

- [ ] **Step 3: Add imports and the exported `readerTargetForBook` helper**

In `src/views/Analysis/Bible/Reader.jsx`:

(a) Change the aggregate import (currently `import { pairsFor } from "./aggregate";`):

```javascript
import { pairsFor, partnersFor } from "./aggregate";
```

(b) Add a Rail import next to the other component imports (after the existing `import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";` line):

```javascript
import Rail from "./Rail";
```

(c) Add the pure helper at module scope, immediately after the imports and before `const PAGE = 50;`:

```javascript
// Navigation target for a rail book-click: that book paired with its top
// cross-reference partner (choice A — always populates). A book with zero
// partners can't form a pair, so it degrades to its own anchor view.
export function readerTargetForBook(anchorCanon, bookName) {
  const top = partnersFor(anchorCanon, bookName)[0]?.book.name;
  if (!top) return { view: "anchor", canon: anchorCanon, book: bookName };
  return anchorCanon === "kjv"
    ? { view: "reader", bibleBook: bookName, bomBook: top, anchorCanon: "kjv" }
    : { view: "reader", bomBook: bookName, bibleBook: top };
}
```

- [ ] **Step 4: Add the rail element + handlers inside the component**

In `src/views/Analysis/Bible/Reader.jsx`, find the keyboard `useEffect` that ends just before the `if (!pairs.length)` early return — it looks like:

```javascript
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon]);
```

Immediately AFTER that `useEffect` (and before `if (!pairs.length)`), insert:

```javascript
  // Anchor side = the canon the reader was entered from; the rail browses it.
  const anchorBook = anchorCanon === "kjv" ? bibleBook : bomBook;
  const anchorChapter = anchorCanon === "kjv" ? bibleChapter : bomChapter;
  const partnerBook = anchorCanon === "kjv" ? bomBook : bibleBook;

  const switchBook = (name) => navigate(readerTargetForBook(anchorCanon, name));
  const rescope = (ch) => {
    const target = { view: "reader", bomBook, bibleBook };
    if (anchorCanon === "kjv") {
      target.anchorCanon = "kjv";
      if (ch) target.bibleChapter = ch;
    } else if (ch) {
      target.bomChapter = ch;
    }
    navigate(target);
  };

  const rail = (
    <Rail
      canon={anchorCanon}
      book={anchorBook}
      chapter={anchorChapter}
      partner={partnerBook}
      onAnchor={switchBook}
      onChapter={rescope}
    />
  );
```

- [ ] **Step 5: Wrap the empty-state render with the rail**

Still in `Reader.jsx`, the empty-pairs early return currently reads:

```javascript
        <ReaderHeader {...{ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
        <div className="xref-empty">
          No known correspondences between {bomBook}
          {bomChapter ? ` ${bomChapter}` : ""} and {bibleBook}.
        </div>
      </div>
```

Replace it with (rail beside an empty main, so an empty scope isn't a dead-end):

```javascript
        <ReaderHeader {...{ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
        <div className="xref-readerbody">
          {rail}
          <div className="xref-readermain">
            <div className="xref-empty">
              No known correspondences between {bomBook}
              {bomChapter ? ` ${bomChapter}` : ""} and {bibleBook}.
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 6: Wrap the main render with the rail**

Still in `Reader.jsx`, the main return begins with the header immediately followed by the table — this pairing is unique to the main return:

```javascript
      <ReaderHeader {...{ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
      <table className="verseViewerTable">
```

Replace it with (open the flex body + main column before the table):

```javascript
      <ReaderHeader {...{ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
      <div className="xref-readerbody">
        {rail}
        <div className="xref-readermain">
      <table className="verseViewerTable">
```

Then close the two new `<div>`s. The main return ends like:

```javascript
        </div>
      )}
    </div>
  );
}
```

Replace that ending with (close `.xref-readermain` and `.xref-readerbody` before the `.xref-reader` close):

```javascript
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
```

(Indentation need not be perfect — Prettier reflows. The test in Step 8 confirms the JSX parses.)

- [ ] **Step 7: Add the reader-body layout CSS**

In `src/views/Analysis/Bible/crossref.css`, add these rules immediately after the `.xref-reader .xref-header { ... }` rule (near the start of the `/* ---- reader ---- */` section):

```css
.xref-readerbody {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.xref-readermain {
  flex: 1;
  min-width: 0; /* let the fixed-layout table shrink instead of overflowing */
}
```

Then, inside the existing `@media (max-width: 700px)` block, add (so the rail stacks above the table on mobile — the existing `.xref-rail` mobile rule already sets `width: 100%` / `max-height: 240px`):

```css
  .xref-readerbody {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .xref-readermain {
    width: 100%;
  }
```

- [ ] **Step 8: Run the reader tests, then the whole Bible suite**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible/__tests__/reader.test.js --watchAll=false
CI=true npx react-scripts test src/views/Analysis/Bible --watchAll=false
```

Expected: all new reader tests PASS; all Bible suites PASS. If a pre-existing reader test breaks because the table moved under `.xref-readermain`, check the assertion — the tests query by `data-testid`/role, which are unaffected by the wrapper, so no change is expected.

- [ ] **Step 9: Visual check**

Confirm the dev server is up (`systemctl --user status bom-dev`), then screenshot `http://localhost:8200/analysis/bible/bom/mosiah~exodus?from=kjv&bch=20`. Verify: a Bible rail (Exodus anchored, its chapter strip scoped to Mosiah) sits left of the verse table; clicking Exodus 21 reloads the table for Exodus 21 × Mosiah; clicking a different Bible book loads it × its top BoM partner; at 390px the rail stacks above the table.

- [ ] **Step 10: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/Reader.jsx frontend/webapp/src/views/Analysis/Bible/crossref.css frontend/webapp/src/views/Analysis/Bible/__tests__/reader.test.js
git commit -m "feat(analysis): browseable siderail in the side-by-side reader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Full Bible suite once more:**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Analysis/Bible --watchAll=false
```

Expected: all suites PASS.

- [ ] **End-to-end walk** at `http://localhost:8200` (not `bom.kckern.net`):
  - `/analysis/bible/bom/mosiah~exodus?from=kjv&bch=20` — Bible rail present; chapter re-scope stays in the reader; different-book jumps to that book × top partner; anchor book + chapter marked current.
  - `/analysis/bible/bom/2-nephi~isaiah` (bom-anchored) — the rail is the Book of Mormon side; chapter clicks set `bomChapter`.
  - Confirm the **anchor view** (`/analysis/bible/bom/2-nephi`) rail looks and behaves exactly as before (no `partner` regression).

---

## Self-Review (against the spec)

**Spec coverage:**
- Rail updates content in place → Task 2 (`switchBook`/`rescope` both `navigate` to reader states) ✅
- Rail browses the anchor (`from=`) side → Task 2 (`anchorBook`/`anchorCanon`) ✅
- Chapter click re-scopes the pinned pair → Task 2 (`rescope`) ✅
- Different-book click → book × top partner (choice A) → Task 2 (`readerTargetForBook`) ✅
- Partnerless book → anchor view fallback → Task 2 (`readerTargetForBook` else branch + test) ✅
- Chapter strip scoped to the current partner → Task 1 (`partner` prop) ✅
- URL-driven / round-trips → Task 2 (all targets are existing reader/anchor states the codec handles) ✅
- Mobile stack → Task 2 (Step 7 media rule) ✅
- Anchor view unchanged → Task 1 (partner defaults to undefined) + Final Verification ✅

**Placeholder scan:** none — every step shows the exact edit.

**Type/name consistency:** `partner` prop name identical across `Rail`/`ChapterStrip`/`chapterCounts`. `readerTargetForBook(anchorCanon, bookName)` signature and return shapes (`{view:"reader",...}` / `{view:"anchor",...}`) match between the helper, the `switchBook` caller, and the tests. `anchorCanon`/`anchorBook`/`partnerBook` derivations match the spec.
