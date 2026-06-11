# Read View UI Audit — scroll whiplash, skeletons, nav lifecycle

**Date:** 2026-06-11
**Scope:** `frontend/webapp/src/views/Read/` (Read.js, Read.scss, components/, CategoryPanels/), plus the global styles and hooks it depends on.
**Trigger:** User reports of (1) horizontal "whiplash" when the vertical scrollbar appears, (2) loading skeletons not appearing, (3) suspected page-navigation lifecycle issues.

---

## Finding 1 (HIGH, root cause confirmed): Skeleton CSS was lost in a merge — skeletons render invisible

`components/SkeletonLoader.js` renders ~10 classes (`.skeleton-section`, `.skeleton-heading`, `.skeleton-text-line`, `.skeleton-avatar`, `.skeleton-voice`, `.skeleton-study-btn`, `.skeleton-paragraph`, plus the `skeleton-loading` keyframes). **None of these classes are defined anywhere in the app's CSS.** The only `skeleton` hit outside Read is `Facsimiles.scss` (`.skeleton-shimmer`, unrelated).

Git forensics:

- `190ffd15` (2025-09-07) added ~120 lines of skeleton CSS to `Read.scss` (keyframes + all classes).
- `d753acba` (2025-09-24) still had them and even tuned them ("Match real read-section margin").
- `6a63b83c` ("Merge branch 'chat' - Backend Modernization") resolved `Read.scss` in favor of parent `e521ca1d` (0 skeleton lines) over parent `decc9e38` (34 skeleton lines). The skeleton styles were silently dropped while `SkeletonLoader.js` survived.

Result: during every load, the skeleton renders as a stack of empty, unstyled `<div>`s — effectively a blank page. This is the "skeletons not loading" report.

**Fix:** recover the block from history (`git show d753acba:frontend/webapp/src/views/Read/Read.scss`, the `@keyframes skeleton-loading` section through `.skeleton-voice`) and re-add to `Read.scss`. Prune the classes the current SkeletonLoader no longer renders (`.skeleton-nav`, `.skeleton-nav-btn`, `.skeleton-title`, `.skeleton-chapter-nav` were removed from the JS in `19146b20`).

## Finding 2 (HIGH): Horizontal whiplash — scrollbar appearing/disappearing shifts the centered container

No stylesheet in the app sets `scrollbar-gutter` or forces `html { overflow-y: scroll }`. The Read view renders inside Bootstrap's centered `.container` (`Read.js:608`), so:

1. On navigation/initial load, content collapses to `null` and the skeleton is invisible (Finding 1) → page height < viewport → **scrollbar disappears** → viewport widens ~15px → container shifts right.
2. Chapter content arrives → page is tall → **scrollbar reappears** → container snaps left.

This double-shift is the reported whiplash. The invisible skeleton amplifies it: a properly styled skeleton is tall enough to keep the scrollbar present through most loads. But the structural fix is reserving the gutter.

**Fix (global stylesheet):**
```css
html {
  overflow-y: scroll;            /* always reserve the gutter (bulletproof) */
}
@supports (scrollbar-gutter: stable) {
  html { overflow-y: auto; scrollbar-gutter: stable; }  /* no dead track when short */
}
```

## Finding 3 (HIGH): Clicking a verse tears down and rebuilds the entire view

Every verse is a `<Link to={/read/...}>` (`ChapterContent.js:179`). A click changes route params → the route-monitor effect (`Read.js:243-266`) fires because `initHighlightedVerses` is a fresh array identity per route → it sets `setInitialLoad(true)` → the load effect (`Read.js:383-437`) runs `setContent(null)` + `setAllChapters([])` and refetches. The fetch is usually served from the local cache (`models/Cache.js`), but it is still async, so at least one frame renders with no content:

- page collapses → scrollbar toggles → **horizontal whiplash on every verse click** (compounds Finding 2),
- all chapters unmount/remount (loses appended infinite-scroll chapters),
- 300ms later the debounced `scrollIntoView` re-scrolls to the verse.

Highlighting a verse inside the already-loaded chapter should never reset `initialLoad`.

**Fix:** in the route effect, compare `initChapterRef` to the current `chapterRef`/`activeChapterRef`. If unchanged, update only `highlightedVerses` (and prev/next refs if needed) and skip `setInitialLoad(true)`. Only treat it as a fresh navigation when the chapter actually changed.

## Finding 4 (MEDIUM): `setTimeout(0)` "batching" does the opposite under React 17

`Read.js:243-266` wraps eight `setState` calls in `setTimeout(..., 0)` with a comment claiming it batches to prevent flicker. In React 17, updates inside timeouts are **not** batched (auto-batching outside event handlers arrived in React 18) — this produces up to eight sequential re-renders, plus a full frame where the new URL renders with the previous chapter's state. Updates made synchronously inside a `useEffect` body *are* batched in React 17.

**Fix:** delete the timeout and set state directly in the effect; better, collapse this state cluster (`chapterRef`, `activeChapterRef`, `highlightedVerses`, `nextChapterRef`, `prevChapterRef`, `chapterVerseIds`, `initialLoad`) into one `useReducer`/single-object state so a navigation is one dispatch.

## Finding 5 (MEDIUM): Scroll position is only reset for one of four navigation paths

`window.scrollTo(0, 0)` lives solely in `handleExplicitChapterNavigation` (`Read.js:237`), which is wired only to ChapterNav grid clicks. The header prev/next buttons, ArrowLeft/ArrowRight keyboard nav, and verse links navigate via `history.push` without it. Today this is masked by the page collapsing to near-zero height (browser clamps scroll), but once Finding 1 is fixed the skeleton is tall, and these paths will leave the user mid-page in the new chapter — close enough to the bottom to spuriously trigger the infinite-scroll `loadNextChapter` threshold (`Read.js:364`).

**Fix:** scroll to top whenever the *chapter* changes (not on verse-highlight changes), in one place — e.g. an effect keyed on `chapterRef` — instead of per-callsite.

## Finding 6 (MEDIUM): URL/history hygiene

- The highlight-sync effect (`Read.js:487-494`) uses `history.push`, so highlight refinements stack history entries; Back walks through stale verse states. Verse Links already push — this effect should use `history.replace`.
- `Read.js:413` calls `window.history.replaceState` directly, bypassing react-router. The router's `match.url` goes stale, so the highlight-sync effect compares against an outdated URL and can push a redundant entry.
- `Tab` is hijacked for verse navigation (`Read.js:314`): keyboard users cannot move focus through the page — an accessibility violation (WCAG 2.1.1/2.4.3). ArrowUp/Down also `preventDefault`, removing native page scrolling. Prefer `j`/`k`-style shortcuts or only intercept arrows when a verse is already highlighted; never intercept Tab.

## Finding 7 (LOW): Infinite-scroll state drifts from what the user is reading

- No scroll-spy: `activeChapterRef`, `document.title`, the ChapterNav active cell, and the header title remain pinned to the *first* chapter as the user scrolls into appended ones.
- `prevChapterRef` is never advanced when chapters are appended, while `nextChapterRef` is — the header's two buttons describe different chapters' neighbors.
- The skeleton at `Read.js:552` (loading more) and `Read.js:555` (no data) are separate component instances with `Math.random()` layouts; transitions between loading phases remount the skeleton with a different shape, causing visible reshuffle. Render a single instance with stable placement (or seed the layout).

## Finding 8 (LOW): Dead code / regressions / cleanups

- **Swipe navigation regression:** `aeac9ad8` added horizontal swipe chapter navigation; the `43e79701` refactor dropped it. Mobile users lost swipe nav.
- `scrollTimeoutRef` (`Read.js:123`) is cleared but never set; `lastLoadedChapterCount` (`Read.js:125`) is written, never read. Dead refs.
- `console.log('(1) Grid item clicked...')` ships in production (`ChapterNav.js:77`).
- `ChapterNav.js`: `chapterCounts`/`book_keys` are re-created per render and sit in `useMemo` deps, defeating the memos. Move to module scope.
- `PassageNotes_new.scss` is imported nowhere — dead file (PassageNotes imports `PassageNotes.scss` + `CategoryPanels.scss`).
- The scroll listener re-subscribes every render (`useThrottle` returns a new identity per render because `func` is inline); same for the `keydown` listener via `handleKeyDown` dep churn. Harmless but noisy; stabilize with refs if touched.
- App-wide, out of scope but noted: `public/index.html` viewport meta sets `user-scalable=no, maximum-scale=1` (WCAG 1.4.4 failure).

---

## Recommended fix order

1. **Restore skeleton CSS** from `d753acba` into `Read.scss` (Finding 1) — one-commit recovery, directly answers a user report.
2. **Reserve the scrollbar gutter** globally (Finding 2) — two lines of CSS, kills the whiplash structurally.
3. **Stop full teardown on verse clicks** (Finding 3) — biggest lifecycle win; removes the most frequent whiplash trigger.
4. Replace the `setTimeout(0)` pseudo-batching with a reducer (Finding 4), and unify scroll-to-top on chapter change (Finding 5).
5. History/a11y hygiene (Finding 6), then drift + dead-code cleanups (Findings 7–8); consider restoring swipe nav.

Findings 1–2 are independent and safe to ship immediately; 3–4 touch the same effect cluster and are best done together.
