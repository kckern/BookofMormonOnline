# Chiasmus View — UX & Code Audit

> **Status 2026-07-16 — IMPLEMENTED** (plan: `docs/plans/2026-07-16-chiasmus-view-overhaul.md`, Tasks 1–17 on `dev`).
> P0 soundness: `chiasmUtils.js` enrichment module (no `lookupReference` in render paths), `addHighlights` regex crash fixed, fetch cancellation + error state, replace-not-push URL hygiene, `t()` i18n helper with contract test, dark-mode token partial + AA contrast fix, a11y pass (real buttons, focus-visible, aria-pressed, guarded global key handler). P1 browse: URL-encoded browse state (`useBrowseState`), `applyBrowseState` filter/sort/group selector, toolbar (search / group / sort / inclusion chips with counts), sticky group headers, visible-order prev/next navigation, LRU detail cache + prefetch, first mobile layout (full-screen detail, single-column grid, closed-panel collapse). P2 visual: `ChiasmGlyph` SVG fingerprint (indent=depth, width=length tertile, pivot accent), card redesign with circular depth chip and CVD-validated book-group color rails, pivot emphasis + pinnable pair highlighting, read-in-context / copy-link actions, shared `MiniChiasm` replacing the PassageNotes raw-JSON dump (§4). P3 backend: `verse_id`, `line_lengths`, `speaker` on `Chiasmus` (batched, no N+1) and `passagenotes` returning the full scheme + full-span reference; frontend speaker avatars + speaker grouping. Verified: 100/100 chiasmus-related frontend tests, backend suite 382 passed (1 pre-existing env failure in `readingplan/mutations`), full SCSS compile clean.
> **Not done (deferred):** chiasm text in `searchAll`; Page-view margin glyphs; dictionary rows for the new `t()` keys (content-ops); the dev-URL Next.js 404 (deployment, §8).

**Date:** 2026-07-16
**Scope:** `frontend/webapp/src/views/Analysis/Chiasmus/` (`Chiasmus.js`, `Chiasm.js`, `Chiasmus.css`), plus its integration surfaces: `views/Read/PassageNotes.js` + `CategoryPanels/ChiasmusPanel.js`, `views/Home/tiles/ChiasmusTile.js`, backend `backend/src/graphql/resolvers/scriptureextras.ts` + `backend/src/data/loaders/scriptureextras.ts`.
**Method:** full code read of the view and its data path; cross-reference against the Read view's speaker-avatar pattern (`Read/components/ChapterContent.js`), the dark-mode token system (`assets/theme/scss/darkmode/`), and the GraphQL query layer (`models/GraphQLQueries.js`).

---

## 1. Verdict

The concepts are right — a browsable index of every identified chiasm, a detail panel that renders the mirrored structure with indentation, letter badges, hover-linked pairs, and keyboard navigation. The chiasm rendering itself (indent-in, indent-out, highlight the parallel phrases) is the correct core idea and worth keeping.

Everything around that core is under-built: the index is a wall of identical gray cards with no imagery, no grouping, no search, and cryptic filter controls; the detail panel is functional but flat; there is **zero mobile layout, zero dark-mode coverage, zero i18n**, and the view's only integration point with the rest of the app (the Read view's PassageNotes chiasmus tab) renders **raw `JSON.stringify` output** to users. Meanwhile the Home `ChiasmusTile` shows the team already knows how to present a chiasm attractively — the Analysis view just hasn't caught up.

---

## 2. Data inventory — what dimensions exist for filtering, sorting, and grouping

This is the foundation for any browse-experience overhaul. Three tiers:

### 2.1 Available today in the list query (`chiasmus`)
| Field | Notes |
|---|---|
| `chiasmus_id` | GUID, used in deep link `/analysis/chiasmus/<id>` |
| `reference` | Human-readable, e.g. "Alma 36:1–30" — parseable to `verse_id` via `scripture-guide` |
| `scheme` | Concatenated line keys, e.g. `ABCDDCBA`, `AaAbBb…` — rich, underused |
| `title` | Editorial title |

### 2.2 Derivable client-side (no backend change)
| Dimension | How | Good for |
|---|---|---|
| **Book / chapter** | `lookupReference(reference)` → verse_id → book | **Grouping** (canonical book order), filtering |
| **Canonical position** | first verse_id | Default **sort** |
| **Depth** (A→N levels) | max letter of `scheme` (already computed) | Filter, sort, badge |
| **Line count** | `scheme.length` | Sort ("longest / most elaborate") |
| **Compound** | `/Aa/` repeated-letter pattern (already computed) | Type filter |
| **Sub-level structure** | lowercase / Greek (`αβγδ`) letters in scheme | Type filter ("has micro-structure") |
| **Symmetry quality** | is scheme a perfect mirror (`ABCCBA`) vs irregular (`ABCBA`, unmatched letters) | Type filter, sort ("perfect chiasms") |
| **Biblical overlap** | verse_id ∈ Isaiah/Malachi/Matthew quotation blocks (currently a hardcoded ref string in the component) | Type filter |

### 2.3 Needs a small backend addition (high value)
The DB rows already carry per-line `verse_id` + `verses` (`ChiasmusLineRow` in `loaders/scriptureextras.ts`), so the resolver can expose:

| Dimension | How | Unlocks |
|---|---|---|
| `verse_id` / `verse_ids` on the list query | first line's verse_id | kills the client-side `lookupReference` storm (see §5) |
| **Speaker / writer** (`person_slug`) | **already in the DB per verse line** — `lds_scriptures_lines.person_slug`; fetch with `WHERE verse_id IN (…)`, the exact pattern `searchhist.ts:230-237` already uses | the **circular avatar** (à la Read view), group-by-speaker, filter-by-speaker |
| **Voice / source category** (`voice`) | same table, same lookup — `lds_scriptures_lines.voice`, a label key the Read view renders via `label(block.voice)` (narrative register: narrator vs quoted discourse etc.) | a second identity facet: filter "chiasms in quoted sermons" vs "in narration" — distinct from *who* is speaking |
| **Verse span** | sum of `verses` across lines | sort by length |
| **Word count** | `line_text` lengths | "epic vs compact" sort |

Grouping candidates ranked by usefulness: **Book** (canonical, the natural reading frame) → **Speaker/Writer** (Nephi, Jacob, Alma, Mormon… — most delightful, needs backend join) → **Depth** (2-level couplets vs the 7-level Alma 36 monuments) → **Type** (simple / compound / biblical-parallel).

Sorting candidates: canonical position (default), depth, length (lines or verses), title A–Z.

Filter candidates: book multi-select, depth range, type toggles, speaker, and **free-text search** over title + reference + line text (a `searchIcon` is already imported in `Chiasmus.js` but never used — the intent existed).

---

## 3. Findings — UX and layout

### 3.1 The index is unbrowsable at scale
A flat `auto-fill minmax(10rem, 1fr)` grid of ~uniform gray cards. Every card looks identical: bold title, small reference, depth number in a stretched badge. There is no visual differentiation by depth, book, speaker, or shape; no grouping headers; no search. Users can't answer "show me the big ones in Alma" or "what did Nephi write" without reading every card.

### 3.2 Filter controls are cryptic and inverted
- The depth filter buttons show a count and a number, with a vertically-rotated 0.7rem "Chiastic Levels" label. Clicking a depth **hides** it (adds to `filteredLevels`, rendered at `opacity: 0.2`). "Filtered" meaning "excluded" with the pressed state shown by fading the *button* (not the cards) is backwards from every filter idiom users know.
- The Biblical / Compound buttons render `✓`/`✗` glyphs where **✓ means "currently shown, click to hide"** — the checkmark reads as state but acts as a toggle-to-exclude. Both filters are also exclusion-only; there's no "show only biblical."
- `setOnlyFilter` (an "Only" button) exists but is dead code behind `{false && …}`, and its logic is broken anyway (it iterates the already-filtered list rather than all levels).

### 3.3 Sort is minimal and mislabeled
One button toggling `Reference` ↔ `Depth` plus an unstyled `⬇/⬆` unicode button. No grouping at all. (See §2 for the dimensions a real toolbar could offer.)

### 3.4 Detail panel: right ideas, missing payoff
- Pair-highlighting on hover (`activeScheme`) is the best interaction in the view — but it's hover-only (nothing on touch), unpinnable, and the highlight style is a faint `#FFFF0022`.
- **The center of a chiasm is its point** — the X pivot is where the meaning turns. The rendering treats the pivot line identically to every other line. This is the single biggest missed storytelling opportunity.
- No link to read the passage in context. A chiasm's `reference` is exactly what `/read` and `/search` deep links consume; the panel is a dead end.
- Prev/Next in the panel don't wrap and use raw list order; the arrow keys wrap and *also* use raw list order — both ignore the active filter/sort, so "next" jumps somewhere unrelated to the visible list.
- Closing the panel doesn't reset the URL (stays on `/analysis/chiasmus/<id>`; refresh reopens the closed chiasm). Every chiasm viewed does a history `push`, so Back walks through every card the user clicked.

### 3.5 No mobile layout at all
`Chiasmus.css` contains **no `@media` rules**. The open detail panel is hard-coded `width: 40%`; on a phone the index squeezes into ~200px columns beside a 150px panel. The two-panel master-detail needs a small-screen mode (full-screen detail or bottom sheet).

### 3.6 Zero visual identity
Gray on gray (`#DDD` cards, `#CCC` hover, `#888` badges), serif body text at `#AAA` (fails WCAG AA against `#DDD`), a depth badge whose `border-radius: 50%` + horizontal padding renders as an ellipse, unicode-arrow buttons. Compare the Home `ChiasmusTile`, which already renders a chiasm with `RefPill`, `<mark>` highlights, and indentation — the Analysis view should be *more* polished than its teaser tile, not less.

---

## 4. Findings — integration gaps

| Surface | State |
|---|---|
| **Read → PassageNotes → Chiasmus tab** | `CategoryPanels/ChiasmusPanel.js` renders `<pre>{JSON.stringify(data)}</pre>` — raw JSON shown to end users. The tab, counts, and data plumbing all work; only the render is missing. |
| **Page view** | No awareness of chiasms at all. `passagenotes` already returns chiasmus per verse range, so a margin indicator/badge on annotated passages is data-feasible today. |
| **Home tile** | `ChiasmusTile` is good and links both to the index and to a specific chiasm. The deep link works (the null-crash on cold load was already fixed in `Container`). |
| **Search** | Chiasm titles/text are not in `searchAll`. Lower priority, but a world-class version would surface "Alma 36" chiasm in search. |

Also noted while testing: `https://bom.kckern.net/analysis/chiasmus` currently returns a **Next.js 404 shell** (`__next_error__`), while `/analysis` returns 200 — whatever is deployed at the dev URL right now is not this CRA app, or its router doesn't cover this path. Out of scope here, but worth a look; deep links shared to dev will 404.

---

## 5. Findings — code quality, performance, correctness

1. **`lookupReference` storm.** `categoryCounts` calls `lookupReference` once per chiasm on *every render* (it's computed in the component body, not memoized); `bibleVerseIds` re-parses a five-book ref string every render; the reference sort comparator calls `lookupReference` **twice per comparison** inside `.sort()` — O(n log n) parses per keystroke of interaction. Fix: enrich the list once in a `useMemo` (or better, get `verse_id` from the server per §2.3) and never parse in render paths.
2. **`addHighlights` builds `new RegExp(highlight)` from raw DB strings** — a highlight containing `(`, `?`, or `*` throws and takes the panel down. The double-wrap guard (`match.includes("span")`) tests the matched text, not its surroundings, so overlapping highlights can still nest or skip. Escape the pattern; better, mark spans in one pass.
3. **`document.title` flashes "undefined | …"** — the effect in `Chiasm.js` runs with `title === undefined` before the fetch resolves; also `push()` runs inside that same `[title]` effect, so the URL updates as a side effect of a title change.
4. **React key warnings**: the depth-filter map returns a keyless `<>` fragment; the card list uses `key={i}` on a filtered+sorted array (unstable identity — use `chiasmus_id`).
5. **Dead/unused code**: `searchIcon`, `Dropdown/DropdownToggle/DropdownMenu/DropdownItem`, `Label`, `Switch` imports; the disabled `setOnlyFilter`; a 1 ms `await new Promise(setTimeout)` in `navigateChiasmus`; `sortField` and `sortFieldButton` duplicating the same state.
6. **Depth computed in three places** (list map, `depthCounts`, badge) with the `>7 → "+"` bucketing duplicated in two of them.
7. **Global `keydown` listener** on `document` for arrows/Escape with no guard for focus context — fine today (no inputs on the page), a landmine the moment a search box is added.
8. **i18n**: every string is hardcoded English ("Chiasmus in the Book of Mormon", "Sort:", "Previous/Next", "Chiastic Levels", "Biblical", "Compound") in an app that otherwise routes copy through `label()`.
9. **Dark mode**: no coverage. All colors are hardcoded light-theme hex values; nothing under `assets/theme/scss/darkmode/` mentions chiasmus or the Analysis views. The view will render as a white slab in dark mode.
10. **A11y**: cards, close ×, and prev/next are click-handler `div`s — not focusable, no `role`, no keyboard activation; filter buttons don't expose `aria-pressed`; pair-highlighting is mouse-only.

---

## 6. Redesign proposal

### 6.1 Design thesis
**The shape is the star.** A chiasm is a *visual* object — text that folds back on itself around a center. No other scripture site presents that shape well, and this dataset (scheme + lines + highlights + verse anchors) is exactly what's needed to draw it. Every design decision below serves making the shape scannable at index level and dramatic at detail level.

### 6.2 Signature element: the chiasm glyph
A small generated SVG per chiasm — one horizontal bar per line, indented by letter depth, mirrored around the pivot; pivot bar accented. It's a fingerprint: a 3-level couplet and Alma 36 look instantly different. Render ~40×40px on cards, larger as the detail-panel header ornament.

**Bar width encodes line length.** Indent = depth, width = word/char count of the line, so the glyph is a true silhouette of the passage (terse pivot between long framing lines, or the reverse). Quantize per-chiasm (tertiles within the chiasm's own lines → three widths, e.g. 40/70/100% of the run remaining after indent, with a clamped minimum so deep+short stays legible); exact/log-scaled widths only at detail size.

Data: the detail panel has `line_text` already. The **list** query only carries `scheme` — but the resolver already loads every line's text to compute `scheme` (`reduceChiasmusLines` receives `allLines`), so exposing a compact `line_lengths: [Int]` on the list query is zero extra DB cost. Fallback until then: index glyphs from `scheme` alone (uniform widths), lengths appear at detail level.

```
ABCCBA:   ▬▬▬▬▬▬        ABCDCBA:  ▬▬▬▬▬▬
            ▬▬▬▬▬                    ▬▬▬▬▬
             ▬▬▬▬                     ▬▬▬▬
             ▬▬▬▬                      ▬▬▬   ← pivot, accent color
            ▬▬▬▬▬                     ▬▬▬▬
          ▬▬▬▬▬▬                     ▬▬▬▬▬
                                   ▬▬▬▬▬▬
```

### 6.3 Card anatomy
Reuse the Read view's portrait convention (`assetUrl + /people/${person_slug}`, circular, clickable → people popup) once the speaker join lands (§2.3):

```
┌──────────────────────────────┐
│ (◯)  The Lord's Covenant     │   ◯ = circular speaker avatar (Read-style)
│ Nephi                        │   speaker name, small
│  ▬▬▬▬                        │
│   ▬▬▬     [1 Nephi 19:7–14]  │   glyph left, RefPill right
│    ▬▬                        │
│   ▬▬▬                        │
│  ▬▬▬▬          ⬡ 4 levels    │   depth chip (circle, not ellipse)
└──────────────────────────────┘
```

Until the speaker field exists, ship the card with glyph + RefPill + depth chip; the avatar slot is additive.

### 6.3b Color codes & avatars

**Give color exactly one job: identity.** The glyph shape already encodes depth and length, the RefPill carries the reference, so color should answer "whose words / which part of the record is this?" — and nothing else.

- **The categorical dimension is the book-group, not the book.** Fifteen books is past the ~8-hue ceiling for a categorical palette; the record's own structure gives a natural 6-bucket grouping that readers already know:
  1. Small plates (1 Ne–Omni) · 2. Mosiah–Alma–Helaman (Mormon's abridgment) · 3. 3–4 Nephi · 4. Mormon · 5. Ether · 6. Moroni (+ a neutral for edge cases).
  Hues are **assigned in fixed order and never reshuffled** — filtering or regrouping must not repaint surviving cards. Depth is *not* color-coded (redundant with the glyph); type (biblical/compound) stays a text chip, not a hue.
- **Where the color appears:** avatar ring, group-header underline, and a thin card rail — small, consistent touchpoints. Bars of the glyph stay neutral ink except the **pivot bar, which uses a single fixed accent token** (same accent in every glyph; it means "center," not identity).
- **Avatars:** circular portrait via the Read-view convention (`assetUrl/people/{person_slug}`, click → people popup). Fallback when no portrait exists: initial-letter disc tinted with the entity color. Spans crossing voices (narrator framing a quotation) show the dominant voice — the backend picks it when it resolves `speaker`. Lazy-load (`loading="lazy"`) with fixed dimensions so the grid doesn't shift.
- **Validate, don't eyeball:** the 6 hues must pass the dataviz palette validator (adjacent-pair CVD ΔE ≥ 8, chroma floor, contrast) against both surfaces — run `validate_palette.js --mode light` and `--mode dark`, deriving the dark-mode steps from the theme tokens in `assets/theme/scss/darkmode/_tokens.scss` rather than auto-inverting. Text (titles, refs, counts) always wears text tokens, never the entity color.

### 6.4 Browse model
```
┌─ Toolbar ────────────────────────────────────────────────┐
│ [🔍 Search chiasms…]  Group: Book ▾   Sort: Canonical ▾ ⬍ │
│ Filters:  (Depth 2–7+ range)  (Simple|Compound|Biblical)  │
└──────────────────────────────────────────────────────────┘
  ── 1 Nephi (14) ───────────────────────────  ← sticky group header + count
  [card] [card] [card] [card]
  ── 2 Nephi (22) ──────────────────────────
  [card] [card] …
```
- Filters are **inclusion** chips with visible active state (fix the inverted ✓/✗ semantics).
- Search matches title + reference; with backend help, line text too.
- All browse state (`?group=book&sort=depth&d=4-7&type=compound&q=…`) lives in the query string — shareable, restorable, and back-button-safe (`replace`, not `push`, while browsing).

### 6.5 Detail panel
- **Pivot emphasis**: center line(s) get the accent treatment — this is the payoff moment of the whole view.
- **Pinnable pairs**: click a letter badge to pin the pair (touch-friendly); hover remains for mouse.
- **"Read in context"** button → `/search/<reference>` or the Read deep link derived from verse_id; plus a copy-link for `/analysis/chiasmus/<id>`.
- Prev/next follow the **visible (filtered+sorted) order**, shared with the arrow-key handler.
- Mobile: panel becomes a full-screen overlay (or bottom sheet) below ~800px; index reflows to a single column.
- Close resets URL to `/analysis/chiasmus`.

### 6.6 Integration
1. **PassageNotes `ChiasmusPanel`** (highest leverage, smallest lift): replace the JSON dump with a mini chiasm rendering — the `ChiasmusTile` line-renderer is 90% of the needed component; extract it to `_Common` and share. Link to the full Analysis view.
2. **Page view**: a small margin glyph on passages that sit inside a chiasm (`passagenotes.chiasmus` already provides the data), opening the panel or deep-linking to Analysis.
3. **Home tile**: already good; once the shared mini-renderer exists, the tile uses it too — one implementation everywhere.

### 6.7 Backend enablers (one resolver, big payoff)
Extend the `Chiasmus` type: `verse_id`, `book`, `speaker { name, person_slug }`, `line_count`, `line_lengths`, `verse_span`. All source data is already in `ChiasmusLineRow` + the narration/voice tables the `read` query joins. This removes every client-side `lookupReference` call and unlocks avatar, speaker grouping, and length sorting.

### 6.8 Performance & memory plan

The dataset is small (one list query, a few hundred rows), so the goal is *staying* fast as cards get richer, plus fixing what's already wasteful:

1. **Enrich once, render pure.** Build the display list in a single `useMemo` keyed on `[chiasmus, lang]`: parse `reference` → verse_id once, compute depth/type buckets and sort keys once. After that, filter/sort/group are array ops over precomputed keys — no `lookupReference` in any render path (today it runs per card per render *and* twice per comparison inside `.sort()`).
2. **Memoized cards.** `React.memo` each card with stable props (`key={chiasmus_id}`, primitive fields only). The glyph SVG is a pure function of `scheme` (+ `line_lengths`) — ~10 `<rect>`s, negligible; memoization makes re-renders on filter changes touch only entering/leaving cards.
3. **Virtualize only if needed.** A few hundred memoized cards in a CSS grid is fine; if the inventory grows past ~500, add `react-window` behind the grouping layer rather than pre-optimizing now.
4. **Ship lengths, not text.** For length-scaled glyphs on index cards, expose integer `line_lengths` server-side (§6.2). Fetching full `lines { line_text }` for every chiasm just to measure them would balloon the payload and the IndexedDB cache by megabytes of scripture text that index cards never display.
5. **Detail-panel fetch hygiene.**
   - `Chiasm.js` fetches without a cancellation guard — rapid arrow-key navigation can resolve out of order and setState after unmount (React 17 warns; stale chiasm can flash). Use the `cancelled` flag pattern `ChiasmusTile` already has.
   - Keep a small in-memory LRU (last ~10 chiasms) and **prefetch prev/next** when a chiasm opens — arrow-key browsing becomes instant instead of a spinner per keypress. This also sidesteps the IndexedDB-transaction contention that forced `useCache:false` here in the first place.
6. **History and DOM.** `replace` instead of `push` while flipping through chiasms (unbounded history stack today); scroll the active card via a ref instead of `document.querySelector`.
7. **Images.** Avatars are `assetUrl` CDN images — request a sized variant if available, `loading="lazy"`, explicit width/height (no CLS, no offscreen decode cost on a 300-card grid).

---

## 7. Phased roadmap

| Phase | Contents | Effort |
|---|---|---|
| **P0 — Make it sound** | Fix `addHighlights` regex crash; memoize/enrich list once (kill lookup storm); fetch-cancellation guard in `Chiasm.js`; stable keys + memoized cards; title/URL hygiene (no `undefined`, reset on close, replace-not-push); remove dead imports/code; `label()` all strings; dark-mode partial (`_analysis.scss` with tokens); a11y pass (real buttons, focus, `aria-pressed`) | S–M |
| **P1 — Make it browsable** | Toolbar (search, group-by, sort, inclusion filters), sticky group headers, URL-encoded browse state, filtered-order prev/next + keyboard nav, prev/next prefetch + small LRU, mobile layout | M |
| **P2 — Make it sing** | Chiasm glyph SVG (length-scaled at detail level), card redesign with RefPill + depth chip, validated book-group color system, pivot emphasis + pinnable pairs in detail, "Read in context" links, shared mini-chiasm component → real PassageNotes panel | M |
| **P3 — Make it connected** | Backend fields (verse_id, speaker, `line_lengths`, spans) → circular avatars + speaker grouping + length-scaled index glyphs; Page-view margin glyphs; (stretch) chiasm titles/text in `searchAll` | M–L |

P0 and P1 are pure frontend. P2's glyph and shared component are frontend-only too. Only P3 touches the backend, and it's one loader/resolver extension.

---

## 8. Side observations (out of scope, flagged)

- `bom.kckern.net/analysis/chiasmus` serves a Next.js error shell (404) while `/analysis` is 200 — the deployed dev frontend doesn't match this CRA app's routing for this path. Deep links to chiasms on the dev URL are broken regardless of anything in this audit.
- CLAUDE.md's backend layout description (`src/resolvers/`, `src/typeDefs/`) is stale — the live backend is `backend/src/graphql/…`; the old tree is under `_deprecated/`.
