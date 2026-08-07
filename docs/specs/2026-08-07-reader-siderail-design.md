# Reader Siderail — Design Spec

**Date:** 2026-08-07
**Area:** Bible cross-reference view (`frontend/webapp/src/views/Analysis/Bible/`)
**Status:** Approved design, pending spec review → implementation plan

## Goal
Add a **browseable siderail to the side-by-side reader** (`Reader.jsx`, the `~` view, e.g. `/analysis/bible/bom/mosiah~exodus?from=kjv&bch=20`). Today the reader is a header + a full-width verse-pair table with no navigation — to change books/chapters you must go back to the anchor view. The rail lets you browse **in place**: every rail action updates the reader's main content without leaving the reader.

## Decisions (settled during brainstorming)
- **Rail updates the main content in place** — never re-anchors away from the reader (except the one graceful-degradation case below).
- **The rail browses the anchor side** — the canon named by `from=` (`from=kjv` → the Bible rail; default/`from=bom` → the Book of Mormon rail). One rail, matching how the reader was entered.
- **Chapter click → re-scope the current pair** (pinned partner).
- **Different-book click → that book × its top cross-ref partner** (choice A — always populates instead of dead-ending on an empty pair).

## Layout
Reader body changes from `header + table` to `header + (rail | main)`:

```
┌ xref-reader ──────────────────────────────┐
│ header (breadcrumb · title · count)       │
│ ┌ xref-readerbody (flex) ───────────────┐ │
│ │ ┌ Rail ─┐  ┌ xref-readermain ───────┐ │ │
│ │ │ books │  │ verse-pair table       │ │ │
│ │ │ +chap │  │ load-more row          │ │ │
│ │ └───────┘  └────────────────────────┘ │ │
│ └───────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

- Reuse the existing accordion `Rail` (`.xref-rail`, 240px) and the anchor view's flex pattern (`.xref-anchorbody` → new sibling `.xref-readerbody`).
- Below 700px: stack (rail above the table), reusing the existing responsive rail rules.

## Component behavior

### Reader.jsx
Compute the anchor side from existing state:
- `anchorCanon` = `state.anchorCanon === "kjv" ? "kjv" : "bom"` (already derived in Reader today).
- `anchorBook` = `anchorCanon === "kjv" ? bibleBook : bomBook`.
- `anchorChapter` = `anchorCanon === "kjv" ? bibleChapter : bomChapter`.
- `partnerBook` = the *other* book (`anchorCanon === "kjv" ? bomBook : bibleBook`).

Render `<Rail>` with:
- `canon={anchorCanon}`, `book={anchorBook}`, `chapter={anchorChapter}`, `partner={partnerBook}` (new optional prop — see below).
- `onAnchor={switchBook}` and `onChapter={rescope}`.

**`switchBook(bookName)`** — different-book click (choice A):
- `top = partnersFor(anchorCanon, bookName)[0]?.book.name`.
- If `top` exists → navigate to the reader for that pair, preserving the anchor side:
  - `anchorCanon === "kjv"`: `{ view:"reader", bibleBook: bookName, bomBook: top, anchorCanon:"kjv" }`
  - `anchorCanon === "bom"`: `{ view:"reader", bomBook: bookName, bibleBook: top }`
  - (No chapter — switching books resets the scope to the whole book.)
- If `top` is undefined (the book has **zero** cross-references — some do) → graceful fallback: navigate to that book's **anchor view** `{ view:"anchor", canon: anchorCanon, book: bookName }`, which shows its (empty) partner list. This is the only case that leaves the reader, and only because no pair can exist.

**`rescope(ch)`** — chapter-strip click, pinned pair (keeps both books + `anchorCanon`):
- `anchorCanon === "kjv"`: navigate `{ ...currentReaderPair, bibleChapter: ch || undefined }`.
- `anchorCanon === "bom"`: navigate `{ ...currentReaderPair, bomChapter: ch || undefined }`.
- `ch` is `undefined` when the user toggles the active chapter off (existing ChapterStrip behavior) → clears the scope back to the whole book.

The reader's `pairs`/fetch already react to `bomChapter`/`bibleChapter` and `bomBook`/`bibleBook` (from prior work), so a `navigate()` re-renders the correct content. No new data plumbing.

### Rail.jsx / ChapterStrip.jsx — one small, backward-compatible addition
Add an **optional `partner` prop** to `Rail`, threaded to `ChapterStrip`, and on to `chapterCounts(canon, book, partner)` (that third arg already exists in `aggregate.js`). Effect: in the reader, the chapter strip's density reflects **the current pair** (which chapters of the anchor book actually have refs with the partner), so a lit chapter always yields content when clicked — consistent with choice A's "always populates."

The anchor view keeps calling `Rail` without `partner` (undefined) → `chapterCounts(canon, book)` unscoped → **unchanged behavior**. This is the only change to `Rail`/`ChapterStrip`; the accordion, auto-scroll, a11y, and existing tests are untouched.

## State / URL
Every rail action is a normal `navigate(readerState)` producing an existing reader URL shape (`/analysis/bible/bom/<bom>[/<bomch>]~<bible>?from=&bch=`). The codec (`urlState.js`) already round-trips all of these, so browser back/forward, deep links, and refresh keep working. No new state store, no new URL params.

## Files
- **`Reader.jsx`** — wrap the table + load-more in `.xref-readerbody`/`.xref-readermain`, render `Rail`, add `switchBook`/`rescope` handlers.
- **`Rail.jsx`**, **`ChapterStrip.jsx`** — thread the optional `partner` prop → `chapterCounts(..., partner)`.
- **`crossref.css`** — `.xref-readerbody` (flex, reuse `.xref-anchorbody` values) + `.xref-readermain` (`flex:1; min-width:0`), and a `<700px` stack; reuse existing `.xref-rail*` styles.
- **Tests** — `__tests__/reader.test.js` (rail renders; chapter re-scopes in place; book switch → top-partner pair; partnerless book → anchor view), `__tests__/rail.test.js` (partner prop scopes the chapter strip; no-partner call unchanged).

## Out of scope (YAGNI)
- Two rails / a both-sides view (chosen against: one anchor-side rail).
- A rail toggle to flip which canon it browses (the existing "Swap sides" control already re-enters from the other side).
- Persisting scroll position across rail navigations beyond the rail's existing anchored-book auto-centering.

## Acceptance criteria
1. The reader shows a rail (anchor-side canon) with the anchor book marked current and its chapter strip visible.
2. Clicking a chapter reloads the **same** book pair scoped to that chapter, staying in the reader; toggling it off clears the scope.
3. Clicking a different book loads that book × its top partner in the reader (never an empty pair); a zero-ref book falls back to its anchor view.
4. The chapter strip's density reflects the current partner pairing.
5. All navigation is URL-driven and round-trips; back/forward work.
6. Mobile (<700px) stacks the rail above the table.
7. The anchor view's rail is visually and behaviorally unchanged.
