# Chiasmus View — UX Audit, Round 2

**Date:** 2026-07-17
**Scope:** `frontend/webapp/src/views/Analysis/Chiasmus/` after the 2026-07-16 overhaul (`docs/audits/2026-07-16-chiasmus-view-ux-audit.md`, Tasks 1–17). This round audits what shipped, as rendered — layout, color, spacing, use of space, intuitiveness, scroll behavior, data presentation, and navigation.
**Method:** local backend (`tsx watch`, :5006) + CRA dev server (:3000, `REACT_APP_LOCAL_BACKEND=true`), driven headless via Playwright at 1440×900, 1100×800, 900×800, and 390×844 (touch), light and dark, with interaction passes (search, group, sort, filter, open/close, pin, hover, arrow keys, deep links, bad deep link, Read-in-context). Screenshots: `docs/audits/chiasmus-ux-screenshots-2026-07-17/`. Full code read of the view, `chiasmUtils.js`, `useBrowseState.js`, `t.js`, `_Common/ChiasmGlyph.js`.

---

## 1. Verdict

The overhaul delivered its parts — toolbar, inclusion filters, sticky headers, URL state, glyphs, avatars, rails, pivot emphasis, pinning, dark mode, mobile overlay, keyboard nav in visible order. Individually most of them work. **Composed, they still don't make a designed page.** The toolbar is fourteen unlabeled controls in a wrapping row that no first-time visitor can parse; the page spends its most valuable pixels on a display-size title and hides the actual content below the fold on phones; five separate visual encodings (rail color, glyph, depth chip, letter badges, label pills) appear with zero on-screen legend; and there are two outright broken states — **the mobile detail overlay's close button is buried under the app header** and **a bad deep link spins forever**. It reads as a system assembled feature-by-feature and never once walked through as a stranger.

Severity buckets below: **[P0] broken / blocking**, **[P1] materially hurts usability**, **[P2] polish**.

---

## 2. Broken states

### 2.1 [P0] Mobile: the detail overlay cannot be closed
`.chiasmPanel.open` on ≤800px is `position: fixed; inset: 0; z-index 1050`, and `.chiasm-header` inside it is `position: sticky; top: 0`. The app's fixed top bar sits **on top of** the overlay's first ~110px, so the sticky header — which contains the title *and the only close button* — is hidden behind it. On a 390px phone you see a sliver of glyph and the reference; no title, no ×. (`16-mobile-detail.png`)

Worse, there's no fallback exit: opening a chiasm uses `history.replace`, so the phone's back gesture doesn't close the panel — it exits the whole view to whatever page came before. Escape doesn't exist on a phone. A mobile user who taps a card is trapped; their only options are Back-out-of-the-feature or Previous/Next forever. This alone justifies the "major issues" complaint.

Fix shape: overlay must start below the app bar (or carry its own opaque header bar with the ×), and on mobile the open-chiasm state should be a *pushed* history entry so Back closes the panel.

### 2.2 [P0] Bad deep link → infinite spinner
`/analysis/chiasmus/<unknown-id>` shows the loading spinner indefinitely (still spinning at 12s; the list loads fine beside it). The `chiasm_load_failed` error state exists in `Chiasm.js` but is never reached — the fetch neither resolves with a usable "not found" nor rejects. Any stale shared link, deleted chiasm, or truncated URL lands here. (`24b-bad-deeplink-12s.png`)

Also: the spinner itself renders as a detached floating pill near the top of the panel column — `.chiasm .loadBar { margin-top: -10rem }` is a positioning hack that visually strands it. Visible on every slow load, not just failures.

### 2.3 [P1] Duplicate-key React warning during browsing
An intermittent `Encountered two children with the same key` warning fired during the interaction pass (open panel at 1440, arrow-nav / 1100px pass). `chiasmus_id`s are unique server-side (verified: 367/367), so it's a render-side keying bug somewhere in the flow. Not pinned down in this audit; worth a targeted repro before it becomes a subtle reordering bug.

---

## 3. Layout, whitespace, use of space

### 3.1 [P1] The header wastes the best pixels on every screen size
- Desktop 1440×900: display-size `h3` + `.container` padding put the first card ~290px down; the title then **never leaves** — the page body doesn't scroll (the index scrolls inside `max-height: calc(100vh - 14.5rem)`), so a decorative headline permanently costs a fifth of the viewport.
- Phone 390×844: the title alone wraps to two ~60px lines, then the toolbar wraps to **four rows** of chips. The first card starts at ~800px — effectively *zero content above the fold* (`15-mobile-index.png`).

The page knows its content: 367 chiasms. The header should be one modest line (optionally with the total count, which currently appears nowhere), and the toolbar should collapse on mobile (a "Filters" disclosure or horizontal scroll row).

### 3.2 [P1] 800–1100px: the two-pane layout is unusable
The mobile overlay kicks in at ≤800px, but from 801px to ~1100px the side panel is `width: 40%` of a shared flex row — ~260–340px of column. The chiasm title wraps one word per line ("Record of / Knowledge"), scripture text runs 2–4 words per line, and the index squeezes to two cramped columns beside it (`25-1100px-panel-open.png`, `18-tablet-900-detail.png`). Half-screen laptop windows — a primary study posture — get the worst layout in the app. Either raise the overlay breakpoint to ~1100px or give the panel a `min-width` (~420px) and let the index yield.

### 3.3 [P1] Scroll architecture: a 12-screen inner scroll with no wayfinding
The index is 8,477px tall inside a 668px scroll container. Sticky book headers work (good), but:
- **The toolbar scrolls away.** After any scrolling, changing a filter/sort/search means scrolling all the way back up. The toolbar should be sticky above the group headers — that's the point of an inner scroll container.
- No jump-to-book rail, no back-to-top. Fifteen books, six screens per book in places, and the only navigation is the wheel.
- Two magic numbers, `calc(100vh - 14.5rem)` (index) vs `calc(100vh - 10.5rem)` (panel), leave the two panels with mismatched bottoms and a dead gray band under the index. Any change to the header silently breaks both.

### 3.4 [P2] Sparse-result states waste the canvas
A search that matches one chiasm renders one card and ~90% empty gray, with no "1 of 367" summary anywhere (`20-deeplink-with-query.png`). The no-results state is centered and fine, but the *some*-results state should say what it found.

---

## 4. Toolbar: fourteen controls, zero explanation

This is the biggest intuitiveness failure on the page (`01-index-default.png`).

1. **[P1] Nothing is labeled.** Two bare `<select>`s sit side by side — one is Group, one is Sort, and the only way to know is to open them. A lone `↓` button follows (is it current direction or the action to reverse?). Convention is `Group: Book ▾ · Sort: Canonical ▾` — the round-1 audit's mock (§6.4) drew exactly that, with visible labels; they were dropped.
2. **[P1] The depth chips are cryptograms.** Each renders count-then-value: `145 2`, `91 3`, `60 4` — which reads as "1452", "913", "604". Nothing on screen says these are *chiastic depth levels* (the explanation lives only in an aria-label). The `11 +` chip is opaque even if you've decoded the rest. And nothing signals they're clickable filters rather than a legend — they look like stat badges.
3. **[P1] Selected chips look disabled.** The active state is solid `--text-muted` (#777) — the universal gray of "unavailable". Filters-you-applied should read as emphasis (accent/dark), not as dimming.
4. **[P2] The chips mix two control types with identical styling.** Depth chips are multi-select, type chips are single-select-with-off, and both look the same. `Simple` has no count while its neighbors do, making it look like a different kind of thing (it is — but visually it's arbitrary).
5. **[P2] Sort "Length" ≠ glyph length.** Sort uses `lineCount` while the glyph encodes per-line *text* length; two definitions of "length" in one view.
6. **[P2] Descending + grouping half-reverses.** Group order is pinned (canonical/alpha) while items inside each group reverse, so "↑" produces 1 Nephi-first with reversed cards inside — reads as a bug.

---

## 5. Cards and data presentation

1. **[P1] Avatar wallpaper.** Grouped by book, 1 Nephi shows **59 near-identical Nephi portraits** in a grid (`01-index-default.png`). An identity cue repeated 59 times carries no information — it's texture, and it competes with the glyph (the actual fingerprint) for the card's visual budget. When grouped by *speaker* it's worse: every card in the "Alma" section shows the same face *and* the word "Alma" under the title, under an "Alma" header. Show the avatar when it *differs* from the group context (e.g. Isaiah inside 2 Nephi), or move speaker identity to the group header and let cards drop it.
2. **[P1] Glyphs degrade into gray blobs exactly where they matter most.** The showpiece chiasms — compound, 20–77 lines (1 Ne 1:15–18, Alma 36) — render at 44px as solid gray staircase-blocks with sub-2px bars (`02-search-alma36.png`). The 62 multi-key chiasms additionally fall back to uniform widths (known, accepted in 00e6f7c4), compounding the blob. And a depth-1 chiasm renders **all-amber** (every line is "the pivot"), which looks like an error state (`08-group-by-depth.png`, "North and South"). Cap rendered bars (e.g. collapse >12 lines to major letters only), and suppress pivot accent when depth < 2.
3. **[P1] The depth chip is an unexplained number in a circle.** A gray disc with "4" in the card corner reads as a notification badge. Its meaning is delivered via `title` tooltip only — nothing a phone user can ever discover. The `+` variant (depth ≥ 8) is pure noise. This is the card's second-largest element and a new user cannot decode it.
4. **[P2] Reference pill hard-clips.** Multi-range references overflow with no ellipsis: "1 Nephi 4:5–12; 4:14–15; 4:1" then a cut (`01-index-default.png`, "Nephi and Laban"). Add `text-overflow: ellipsis` + full ref in `title`.
5. **[P2] Group header reads as a scripture reference.** "1 Nephi 59" — book name + unlabeled count in the same type row. In a scripture app, that juxtaposition is actively misleading (there is no 1 Nephi 59, but the shape says "chapter"). "59 chiasms" or a parenthesized count fixes it.
6. **[P1] Titles are truncated almost everywhere, which makes them useless.** The grid's `minmax(10rem, 1fr)` columns leave ~80–100px for the title after the avatar and depth chip, and the single-line ellipsis cuts nearly every card: "Record of Kn…", "Divine Deliv…", "Condescensi…", "Manifestatio…" (`01-index-default.png` — count the intact titles; it's a minority). The title is the card's primary text and it communicates nothing at this width. Needs wider minimum columns (~15rem) *and* a two-line clamp so normal-length titles fit, plus a `title` tooltip as the fallback — there is currently no way to read the full title before opening the panel.
7. **[P2] Selection/hover states are unrelated and miscalibrated.** Hover is a near-invisible 15%-black outline; the active card is a heavy 3px `--text-primary` ring that reads as a focus-error (`20-deeplink-with-query.png`). Neither uses the rail/accent language the rest of the card system established.

---

## 6. Detail panel

1. **[P1] Prev/Next live 10 screens down.** Alma 36's panel is 7,279px of scroll; the only navigation buttons are at the very bottom (`21-alma36-panel-bottom.png`). Arrow-key navigation exists but is announced nowhere — undiscoverable. Put prev/next (and the reference) in the sticky header, or make the nav bar sticky-bottom.
2. **[P1] The pair-highlight wash is still `#FFFF0022`.** Round 1 flagged the faint hover highlight; the overhaul kept the same 13%-alpha yellow for `.active` lines (`04-detail-hover-pair.png` — you have to squint). The dimming of inactive lines does most of the work; the positive highlight does almost none. `--highlight` (#fff3b0) exists in the token sheet and is unused here.
3. **[P1] Five encodings, no legend.** Letter badges (A/B/C), Greek minor letters (α/β/γ), gray label-pills ("admonition", "prosperity conditional"), bold highlight words, amber pivot rail, pinnable badges — nothing on screen explains any of it. This view is the app's flagship teaching surface for a literary form most visitors have never heard of, and it presumes you already know. One dismissible "how to read a chiasm" line (or an ⓘ popover) would transform first-contact comprehension.
4. **[P2] Touch leaves a stuck highlight.** Tapping anywhere in a line fires `mouseenter` → `activeScheme` sticks until you tap another line (no `mouseleave` on touch). Combined with pin-on-badge (a 19px target, below the 24px WCAG minimum), touch interaction is technically possible but fiddly and stateful in ways the user never asked for.
5. **[P2] Header typography is flat.** Title and reference are both `h4`s of similar weight/size; the 64px glyph next to them is a gray smudge for large chiasms (see 5.2). The close × is small and unpadded.
6. **[P2] `document.title` never resets.** Open a chiasm, close it — the tab still bears the chiasm's title. Also the view is variously named "Chiasms" (doc title), "Chiasmus in the Book of Mormon" (h3), and "Chiastic Features" (Analysis hub card) — three names for one thing.

---

## 7. Navigation and breadcrumbs

1. **[P1] No path back to the Analysis hub.** The view renders under `/analysis/chiasmus` with siblings (Bible, Names, Caractors), but there's no breadcrumb ("Analysis › Chiasmus") and the sidebar's "Analysis" entry reads as *current location*, not as a link up. Sibling analyses are three clicks away through a hub the user may not remember exists. All four Analysis sub-views share this; one small breadcrumb component fixes the family.
2. **[P1] Back never closes the panel.** Every chiasm open is `history.replace`, so after browsing five chiasms, Back exits the entire view. That was a deliberate anti-history-spam decision (round 1 §3.4), but replace-everything overshoots: the *first* open from the index should `push` (one entry: "panel open"), with subsequent prev/next replacing. Desktop users have the ×; mobile users currently have nothing (see 2.1).

---

## 8. Color

1. **[P1] The rail system is invisible knowledge.** The 6-hue book-group rail palette was carefully validated (CVD ΔE, contrast — good work), but no user can learn what the colors *mean*: there's no legend, the group headers only pick up the hue as a 2px underline when grouped by book, and the bucket concept ("small plates" vs "abridgment") appears nowhere in the UI. Color that encodes something users can't decode is decoration with extra maintenance cost. A tiny legend row (six dots + names) under the toolbar — or rail-colored group headers with the bucket name — pays for the palette.
2. **[P2] Amber is doing two jobs after all.** The design doc says amber = "center, not identity", but the pinned-pair outline is also `--accent-amber`, so pin a non-pivot pair and amber now marks both the pivot line *and* your pinned selection. Pick a second accent for pinning (the `--link` blue already used for focus would do).
3. Dark mode: **verified working** (computed styles + pixel samples: cards #333 on #1a1a1a, re-stepped rails applied). The dark `.active` wash (`rgba(255,243,176,.14)`) shares finding 6.2's faintness.

---

## 9. Code-level slop (brief)

- `className="title lg-4 text-center"` (`Chiasmus.js:342`) — `lg-4` is not a class in Bootstrap or the app.
- `ChiasticLine` computes `minorCSS` with `charCodeAt(0)` of an empty string → `marginLeft: "NaNex"` for every major-only line; harmless only because the minor div isn't rendered. Compute it conditionally.
- Group-header strings bypass i18n: `Level ${depthBucket}`, `"Biblical" | "Compound" | "Simple"`, `"—"` are hardcoded in `chiasmUtils.js` `keyFn`s while the equivalent chips go through `t()`.
- Line keys in the detail panel are `key={i}` (fine while lines are static; fragile if reordering ever lands).
- Speaker avatar `<img>` has no `onerror` fallback — one missing portrait on the CDN renders a broken-image glyph inside the card.

---

## 10. What round 2 should ship (ranked)

| # | Item | Findings | Effort |
|---|---|---|---|
| 1 | Mobile overlay: header below app bar / own close bar; push-then-replace history so Back closes | 2.1, 7.2 | S |
| 2 | Bad-id fetch resolves to error state; fix stray spinner positioning | 2.2 | S |
| 3 | Toolbar comprehension pass: labels on selects, "depth" caption before chips, value-then-count chip format (`2 × 145`), selected = accent not gray, sticky toolbar | 4.1–4.3, 3.3 | M |
| 4 | Panel min-width ≥ ~420px (or overlay breakpoint ≈ 1100px) | 3.2 | S |
| 5 | Header diet: one-line title + total count; mobile toolbar collapse | 3.1 | S–M |
| 6 | Prev/Next + reference into sticky panel header; arrow-key hint | 6.1 | S |
| 7 | Legend: chiasm how-to line in panel; rail-color legend in index; depth-chip explanation | 6.3, 8.1, 5.3 | M |
| 8 | Glyph degradation: bar cap for long schemes, no all-pivot at depth 1 | 5.2 | S |
| 9 | Real highlight color for active pairs (use `--highlight`); distinct pin accent | 6.2, 8.2 | S |
| 10 | Card cleanup: contextual avatars, ellipsized reference pill, `title` attrs, "N shown" result line, group-count styling | 5.1, 5.4–5.6, 3.4 | M |
| 11 | Breadcrumb for Analysis sub-views | 7.1 | S |
| 12 | Slop sweep (§9) + duplicate-key repro | 2.3, 9 | S |

Items 1–2 are fix-before-anything; items 3–7 are where the "thrown together" impression actually lives.
