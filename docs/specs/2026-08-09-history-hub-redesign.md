# History Hub Redesign — Design Spec

**Date:** 2026-08-09
**Route:** `/history` (the hub landing — `HistoryHub.jsx`)
**Scope:** Redesign the hub **and** establish a shared archival visual language the sub-pages can adopt. The four sub-pages (Reception, Witnesses, Translation, Joseph Smith) keep their current layouts; this spec does not rework them.
**Primary goal:** Discovery / wayfinding — make it obvious what each collection holds (how many documents, what era) and make the front door feel like a real historical archive, not generic app cards.

---

## Problem (current state)

The hub (`HistoryHub.jsx`) renders a symmetric 2×2 of plain white rounded cards over a gray background. Concrete failures:

1. **Generic app-card aesthetic** — white rounded rectangles; nothing signals a 19th-century archive.
2. **The Translation tile renders empty** — it has no icon and its "featured" image relies on a random archive doc thumbnail, but Translation docs (ids 4974–5128) have **no thumbnails**, so the tile is a tall white box with text floating mid-air. Because tiles vertically-center content, that one gapes while the others don't.
3. **"Featured" previews are arbitrary** — a *random* witness portrait and a *random* document thumbnail per load, captioned in 0.8rem gray. Decorative, not informative.
4. **No hierarchy, poor use of space** — four equal quadrants floating in the top third; large dead gray area below.

---

## Design

### Layout — horizontal split cards, 2×2

A centered archival masthead over a 2×2 grid of **horizontal split cards**:

```
┌───────────── Historical Sources (masthead) ─────────────┐
│  kicker · serif H1 · lede · gold rule                    │
├──────────────────────────┬──────────────────────────────┤
│  [ IMG 4:3 ] Joseph Smith │  [ TRIPTYCH ] The Witnesses  │
├──────────────────────────┼──────────────────────────────┤
│  [ IMG 4:3 ] Translation  │  [ IMG 4:3 ] Reception       │
└──────────────────────────┴──────────────────────────────┘
```

**Card order (fixed):** Joseph Smith → The Witnesses → Translation Process → Reception History.

**Card anatomy:** image occupies the **left ~46%, full card height, clamped to a wide 4:3 aspect**; text fills the right. A 3px gold rule (`#c9a24b`) divides image from text. On hover the card lifts (`bottom: 2px`) and background goes `#EEE → #FFF` — the exact house behavior from `HistorySourceCard.css`.

**Text block (right):** collection name (serif, black, bold) · a `COUNT · DATE-RANGE` signal line (Roboto, muted gray, letter-spaced caps) · a one-line blurb.

### Aspect-ratio clamping (hard requirement)

Hero images must **never** become panoramic strips that overcrop faces. The image container is a fixed `aspect-ratio: 4 / 3` box with `object-fit: cover` and `object-position: top center` (same face-safe pattern the house already uses for the source-card thumb and witness portraits). This holds regardless of card width.

**Witnesses = radial "pie" of the Three.** The Witnesses image slot is a three-wedge radial split of the `oliver-cowdery`, `david-whitmer`, `martin-harris` portraits, filling the same clamped 4:3 box. Three `clip-path` wedges converge at a single vertex placed at **50% x / 38% y** — deliberately *above* dead center. Rationale: portrait eye-lines sit in the upper third, so a 38% vertex aligns the seams with the natural eye-line and fans them out *below* the faces, keeping each face un-cut in the wide part of its wedge. Two wedges occupy the upper-left/upper-right, one the lower center:

```
wedge L (Oliver):  clip-path: polygon(50% 38%, 50% 0, 0 0, 0 67%);   object-position: 34% 24%
wedge R (David):   clip-path: polygon(50% 38%, 50% 0, 100% 0, 100% 67%); object-position: 66% 24%
wedge B (Martin):  clip-path: polygon(50% 38%, 0 67%, 0 100%, 100% 100%, 100% 67%); object-position: center 44%
```

Per-portrait `object-position` values are tuned so each face centers in its wedge; treat the values above as the starting point, verify against the actual portraits during implementation.

### Visual language (shared, archival)

- **Palette (house-native):** aged-paper page background (`#f2ede1 → #e8ddc8`), ink `#1c1a16`, gold accent `#c9a24b`, muted meta gray `#555`. Gold and the witness-blue `#345496` are already the accent colors in `HistorySourceCard.css` — we reuse, not invent.
- **Type:** Georgia/serif for the masthead H1 and collection names; Roboto (house sans) for the kicker, the `COUNT · DATE-RANGE` meta line, and small labels — mirroring the source-card type system (`dateChip`, `citation`).
- **Links follow house style exactly:** `a { color: #000; text-decoration: none }`, hover unchanged (dark mode `#AAA → #FFF`). Card titles are black serif with **no underline** — the whole card is the link.
- **Masthead:** a Roboto uppercase kicker ("The Book of Mormon in History"), the serif H1, a one-line lede, and a 64px gold rule.

### Dark mode (parity required)

Mirror `html[data-theme="dark"]` the way the source card does: card `#222`, title `#eee`, meta `#9a9a9a`, links `#AAA → #FFF`, dark paper background. Images take a slight `brightness(.82)` under dark.

### Responsive

- ≥ 700px: 2×2 grid of split cards.
- < 700px: single column of split cards (image stays left).
- < 520px: card stacks vertically — image (4:3) on top, text below — so neither column gets too narrow.

---

## Data — discovery signal

Each card shows a **hero** + a **live count and date-range**. Hero strategy is per-section (see table): Joseph = fixed portrait, Witnesses = fixed 3-portrait radial pie, Translation = icon placeholder (no thumbnails exist), Reception = random thumbnail from its own fetched list. Signal is always live and accurate. This kills the "empty Translation tile" problem outright (placeholder can't gape) while keeping Reception's imagery lively.

### Per-section config (`sections.js`)

Extend each section entry with a hero descriptor, a metadata `unit`, and drop the icon-only model:

| key | title | hero | unit | live signal (measured 2026-08-09) |
|---|---|---|---|---|
| `josephSmith` | Joseph Smith | image `joseph-smith.jpg` (profile) | statements | 26 statements · 1823–1844 |
| `witnesses` | The Witnesses | **radial pie** `[oliver-cowdery, david-whitmer, martin-harris]` (vertex @ 50%/38%) | witnesses | 22 witnesses · Three, Eight & others |
| `translation` | Translation Process | **placeholder** — section icon centered on the aged-paper field (Translation docs have no thumbnails) | documents | 155 documents · 1827–1998 |
| `reception` | Reception History | **random thumbnail** — a random doc from the fetched reception list → `history/thumbs/NNNN` | documents | 580 documents · 1829–1844 |

Hero descriptor shape (one per section):
```js
hero: { type: "image", src: "<assetUrl>/history/witnesses/people/joseph-smith.jpg" }        // Joseph Smith
hero: { type: "pie", srcs: [ ".../oliver-cowdery.jpg", ".../david-whitmer.jpg", ".../martin-harris.jpg" ] }  // Witnesses — radial 3-wedge, vertex @ 50%/38%
hero: { type: "placeholder", icon: translationIcon }                                          // Translation — icon on paper
hero: { type: "randomThumb", archive: "reception" }                                           // Reception — random thumb from fetched list
```

### Count + date-range source

- **Witnesses:** static — count and grouping come from the existing `WITNESSES` array (no fetch).
- **Reception / Translation / Joseph Smith:** derive `count = list.length` and `range = [min(year), max(year)]` from the existing archive-list call `BoMOnlineAPI({ history: { archive } })`. That call already **excludes `transcript`** (the builder only requests it when a `slug` is passed — `GraphQLQueries.js:675`), so no new/minimal query is needed and no backend change is required. Results are IndexedDB-cached. Reception is already fetched on the hub today; this pass adds the Joseph-Smith fetch and drops Translation's (Translation shows only its count + placeholder — its list is still fetched for the count).
- The **Reception random thumbnail reuses the same fetched list** — `pickRandom(list)` → `history/thumbs/${String(id).padStart(4,"0")}`.
- Signal line format: `` `${count} ${unit.toUpperCase()} · ${minYear}–${maxYear}` `` (Witnesses uses the static `22 WITNESSES · THREE, EIGHT & OTHERS`).
- Graceful fallback: if a fetch fails or is pending, render the title + hero without the signal line (never a broken/empty tile).

> **Future optimization (out of scope):** a lightweight backend `historyStats(archive)` field returning `{ count, minYear, maxYear }` would avoid pulling the list at all. Noted, not required for this pass.

---

## Component changes

All within `frontend/webapp/src/views/History/`:

- **`sections.js`** — reorder to JS → Witnesses → Translation → Reception; add `hero` + `unit` per section; keep `path`. Titles: "Translation Sources" → **"Translation Process"**.
- **`HistoryHub.jsx`** — replace the random `useFeatured()` with a `useArchiveSignals()` hook that returns `{ count, minYear, maxYear }` per fetched archive (minimal projection). Render the masthead + split cards. The whole card is a `<Link>` to `section.path`.
- **`HistoryHub.css`** — rewrite for the split card, 4:3 clamp, triptych, gold divider, house card bg/hover, masthead, dark-mode block, and the three responsive breakpoints.

No sub-page files change in this pass. The card styles are written so they can later be promoted into a shared archival stylesheet the sub-pages import (the "shared visual language" half of scope).

---

## Copy — open items (need owner input)

1. **Joseph Smith blurb** — "life and work of the translator" is **wrong** (flagged by owner). Placeholder in use: *"Statements by and about Joseph Smith."* → **need final wording.**
2. Confirm the other three blurbs read correctly:
   - Witnesses: "Those who testified they saw and handled the plates."
   - Translation Process: "How the Book of Mormon was brought forth and rendered into English."
   - Reception History: "How the book was reviewed, attacked, and defended in its own day."
3. Masthead lede wording: *"Four collections tracing the record from its coming forth to its reception in the world."*

Hero imagery is resolved: Translation = icon placeholder, Reception = random thumbnail (no curation needed).

---

## Acceptance criteria

- [ ] `/history` renders the masthead + 2×2 split cards in the order JS · Witnesses / Translation · Reception.
- [ ] Every card has a hero image; **no empty/gaping tile** in any state (including while signals load or if a fetch fails).
- [ ] Hero images are clamped to 4:3, `top center`, and never render panoramic/overcropped at any card width.
- [ ] Witnesses card shows the three-portrait radial pie, vertex @ 50%/38%, no face bisected.
- [ ] Each non-witness card shows a live `COUNT · DATE-RANGE`; Witnesses shows its static signal.
- [ ] Titles are black serif with no underline; links obey house style; hover lifts and whitens per `HistorySourceCard`.
- [ ] Dark mode reaches parity with the source-card dark treatment.
- [ ] Responsive: 2-col ≥700px, 1-col <700px, stacked image-over-text <520px.
- [ ] No regression to the four sub-pages.

---

## Out of scope

- Reworking the sub-pages (Reception year filter, Witnesses heatmap, Translation/Joseph feeds).
- The Next.js `/history` SSR surface.
- Backend schema changes (the `historyStats` field is a noted future optimization only).
