# Fax Verse Inspector — Spec

**Date:** 2026-07-24
**Status:** Approved (design), pending implementation plan
**Area:** `frontend/webapp/src/views/Facsimiles/`
**Revision:** 2 — data layer rewritten against the real `/fax/boxes` contract
after a backend audit (see "Backend contract" below). Phased delivery.

## Summary

Upgrade the facsimile viewer's passive verse-highlight overlay into an
interactive **verse inspector**. When an edition has box geometry, every verse
on the visible spread becomes a hotspot:

- **Hover** a verse → the rest of the page dims and the verse is "cut out"
  (spotlight), with a tooltip above it showing the actual verse text.
- **Click a verse** → inspector modal (enlarged cutout, speaker/voice avatar +
  label, verse text, and cross-edition comparison). **Click off-verse** (margin,
  gutter) → turn the page, exactly as today. Turning stays discoverable.
- **Deep-link** to a verse → that verse loads already "pinned" in the same
  cutout+tooltip state (no hover). The pin is deliberately sticky so an
  inadvertent gesture can't wipe the deep-link intent: it releases only after
  the user first engages that verse (hover on → off), then normal hover resumes.

This replaces the current `useFaxHighlight` / `FaxHighlightOverlay` pair, which
draws non-interactive boxes for the active reference only.

## Backend contract (verified 2026-07-24)

`GET {renderBaseUrl}/fax/boxes/{version}/{selector}` (`backend/src/media/fax/route.ts:139-164`):

- Response: `{ pageScale, clamped, boxes: [{ verseId, imagePage, x, y, w, h }] }`.
- **`imagePage` is authoritative** — the server maps stored `page` to the scan
  file (`imagePage = b.page + meta.offset`, `route.ts:158`). Join hotspots to
  the viewer on this, **not** on index tuples.
- **Multiple boxes per verse.** `verseIdsToBoxes` returns one row per box and a
  verse spans several (multi-line / multi-column; `resolve.ts:19-34`,
  `geometry.ts`). A verse straddling a page break has boxes on two `imagePage`s.
- **Hard 40-id cap.** `clamped = verseIds.length > 40; ids = slice(0, 40)`
  (`route.ts:152-153`, `MAX_VERSE_IDS`). Requests **must** chunk to ≤40 ids and
  merge client-side. A dense spread (50–70 verses) exceeds this.
- Cacheable: `cache-control: public, max-age=86400`.
- **Renderability ≠ `indexRef`.** A version is renderable iff it has rows in
  `bom_xtras_fax_index` (`versions.ts`). `earliest`/`poetic`/`rebom` have
  geometry with an **empty** `indexRef`. Use the renderable edition list
  (`renderableEditions` in `Facsimiles.js`) as the hotspot/compare gate, never
  `ed.indexRef`.

Verse text + speaker come from GraphQL `read(ref)`:
`sections[].blocks[]{ person_slug, voice, lines[]{ verse_id, text } }`. `read`
is cached in localForage by ref string (`GraphQLQueries.js:358-361`) — so we
fetch by **chapter** (a spread touches 1–3), not by an ad-hoc spread range, to
keep cache keys reusable and avoid re-fetching chapters under unique keys.
Speaker avatar: `${assetUrl}/people/{person_slug}`; voice label via `label(voice)`.

## Goals

1. Every verse with geometry on the visible spread is hoverable/tappable.
2. Hover/pin renders a dimming scrim with the verse (all its boxes) cut out + a
   text tooltip.
3. Clicking a verse opens an inspector modal; clicking off-verse still turns.
4. Deep-linked verse loads pre-pinned; the pin survives stray gestures.
5. Works on desktop (`FacsimilePageViewer`) and mobile (`FacsimilePageViewerMobile`).

## Non-goals

- No backend changes. Chunking + cross-edition coverage are client-side.
- No magnifier loupe this pass (pan-zoom only).
- No editing of the index/boxes.

## Backend audit corrections folded in

The first draft assumed one `/fax/boxes` call per spread, one box per verse, and
derived verse_ids from index tuples. All three were wrong (above). Corrected:
chunked ≤40-id fetches, per-verse **box arrays** keyed off the response's own
`verseId`/`imagePage`, and no tuple derivation.

## Phased delivery

- **Phase 1 (this plan): desktop core.** Hotspots + scrim/cutout (static, no
  spotlight-travel tween) + tooltip + click→modal with a statically-cropped
  cutout, verse text, and speaker/voice avatar. Off-verse click still turns.
- **Phase 2: deep-link pin + mobile.** The sticky enter→exit pin; mount the
  layer + modal in the virtualized mobile scroller with tap semantics.
- **Phase 3: pan-zoom + cross-edition compare.** `FaxPanZoom` in the modal and
  `faxCompare` side-by-side editions.

Each phase gets its own implementation plan. The architecture below is whole;
section tags note the phase.

## Architecture

### 1. Data layer — `useFaxVerses(version, leftLeaf, rightLeaf)` (Phase 1)

Replaces `useFaxHighlight`. For the visible spread:

- **verse_ids**: `lookupReference(leaf.pageReference).verse_ids` for each leaf,
  unioned — the same derivation the viewer already uses
  (`FacsimilePageViewer.js:106-110`). No tuple math.
- **boxes**: chunk the id union into groups of ≤40, fetch
  `/fax/boxes/{version}/ids/{chunk}` per chunk, merge all `boxes`. Group by
  `(imagePage, verseId)` → a **box array** per verse per page. Cache by
  `version + sorted-id-chunk` (responses are day-cacheable).
- **text + speaker**: resolve the spread's chapter ref(s) (1–3), fetch
  `read(chapterRef)` per chapter (cache by chapter), flatten
  `sections[].blocks[].lines[]` into `Map<verse_id, {text, person_slug, voice, ref}>`.
- **Fetch hygiene**: debounce hydration until the spread settles (~150ms after a
  turn) and abort superseded fetches (AbortController; the current `cancelled`
  guard only drops results, it doesn't cancel). Riffling must not queue N
  in-flight requests.

Output:

```
{
  versesByPage: Map<imagePage, Array<{
    verse_id, ref,
    boxes: [{x, y, w, h}],        // 1+ boxes, all on this imagePage
    text, person_slug, voice      // may be undefined → tooltip shows ref only
  }>>,
  pageScale: number,
}
```

A verse straddling two pages appears under both `imagePage` keys (each with its
boxes on that page); the modal aggregates by `verse_id`.

### 2. Cutout + tooltip layer — `FaxVerseCutout` (Phase 1; supersedes `FaxHighlightOverlay`)

Rendered per page image, scaled `k = displayedWidth / pageScale` (ported from
`FaxHighlightOverlay`).

- **Hotspots**: one transparent `pointer-events:auto` hit-target **per box**
  (a verse's boxes all carry the same verse object). `cursor: pointer`. These
  are the only interactive layer above the image. Off-hotspot clicks fall
  through to the existing page-turn `onClick` (`FacsimilePageViewer.js:674`), so
  **margins still turn the page**.
- **Scrim + cutout**: one SVG overlay per page. A dark `<rect>` covers the page;
  an SVG `<mask>` punches out **every box of the active verse** (rounded rects),
  so a multi-box verse is fully lit. A soft ring strokes each cutout box.
  `pointer-events:none` — never blocks the hotspots beneath. Renders only when a
  verse is active. **Phase 1 = fade in/out only** (no spotlight-travel tween;
  that's polish, and avoids strobing while the mouse crosses many hotspots).
- **Tooltip**: caret-pointed card anchored above the active verse's
  bounding box (union of its boxes); flips below near the top edge, x-clamped to
  viewport. Shows the reference label + verse text. `pointer-events:none`.
- **Hover intent**: ~100ms enter delay before a hotspot goes active, so a casual
  traversal across 20+ verse boxes doesn't strobe the dimmer.
- **Flip coordination**: the body-portaled flip overlay (`FaxPageFlip`, z-4000)
  does not contain this scrim. Clear active/hover state when a flip starts (hook
  the `animateTo`/`cancelFlip` path, `FacsimilePageViewer.js`) so the scrim
  doesn't strand over a turning page; re-hydrate after the spread settles.
- **Width-transition drift**: `.page` animates width 0.28s (`FacsimilePageViewer.scss`).
  Suppress the scrim during the width transition (or key `k` off the live DOM
  width via the existing overlay ResizeObserver measure) so the spotlight can't
  sit over the wrong line for 280ms.

`FaxHighlightOverlay`'s scaling math is ported here; see Testing for its test.

### 3. Interaction state machine — `faxVerseState.js` (Phase 1 core; pin = Phase 2)

Pure reducer (DOM-independent, unit-tested). State:
`{ activeVerseId, source: 'hover' | 'pinned' | null, pinnedEngaged, openVerseId }`.

- **idle** → no scrim.
- **hover** (Phase 1): entering a hotspot (after intent delay) →
  `{active, source:'hover'}`; leaving clears.
- **click** (Phase 1): clicking a hotspot sets `openVerseId` → modal. Off-hotspot
  clicks are not the reducer's concern (they hit the page-turn handler).
- **pinned** (Phase 2, deep-link): seeded **not on mount** but when
  `(refParam present ∧ data hydrated ∧ the ref's verse is on this spread)` — the
  viewer async `history.replace`s the deep-link URL and `versesByPage` arrives
  later (`Facsimiles.js:349-371`), so mount is too early. A **multi-verse**
  deep-link (`alma.5.12-18`) spotlights the **union of the range's boxes** and
  pins the range (not just the first verse — dimming 13–18 would regress today's
  behavior). Release rules (the sticky intent):
  - entering the pinned verse → `pinnedEngaged:true`; the next leave releases,
  - hovering a *different* verse releases immediately,
  - clicking opens the modal (and releases).
- **spread-change** (Phase 2): any page turn / edition switch clears pin+hover
  (`refParam` is dropped from the URL on the first turn,
  `FacsimilePageViewer.js:354`, so the pin must die with it).

### 4. Inspector modal — `FaxVerseModal` (Phase 1 shell; pan-zoom/compare Phase 3)

- Portaled to `document.body`, dark backdrop. Closes on X, backdrop, and Esc.
  Esc uses a **capture-phase `stopPropagation`/`stopImmediatePropagation`**
  handler (mirrors `ScripturePopup.js:61-73`) so it neither turns a page nor
  exits to the grid. Closing also clears any pin/hover scrim underneath (so a
  deep-linked user pressing Esc isn't yanked to the grid with the spotlight up).
  Note: two window-capture Esc handlers (ScripturePopup + this) tiebreak on
  registration order; acceptable because co-open is unlikely — documented.
- **Header**: `<img src={assetUrl}/people/{person_slug}>` (hidden on error) +
  `label(voice)` + reference.
- **Body (Phase 1)**: a statically-cropped cutout of the page around the verse's
  bounding box + verse text. **Phase 3** upgrades this to `FaxPanZoom` (wheel/
  pinch zoom, drag pan, fit-to-box start, clamped) — a small self-contained
  component, no new dependency (`simple-react-lightbox` is a gallery lightbox,
  wrong shape).
- **Compare (Phase 3)**: `faxCompare.js` — for the verse_id, call
  `/fax/boxes/{ed}/ids/{verse_id}` for each **renderable** edition (the
  `renderableEditions` allowlist, not `indexRef`); the response's own `boxes`/
  `imagePage` tell coverage (empty `boxes` = not covered) — **no index scan
  needed**. Render covered editions as labeled cutout thumbnails; selecting one
  loads it into the main viewport / side-by-side. Coordinates line up because
  each edition's boxes are authored against its own scans. Memoize per verse_id.

### 5. Pan-zoom — `FaxPanZoom` (Phase 3)

Positioned `<img>` in an `overflow:hidden` frame, transformed by translate/scale
state; wheel/pinch about the pointer, pointer-drag pans, clamped in view.

### 6. Viewer wiring

- **Desktop** `FacsimilePageViewer.js` (Phase 1): swap
  `useFaxHighlight`/`FaxHighlightOverlay` for `useFaxVerses` + `FaxVerseCutout`
  per page; add `openVerseId` → `FaxVerseModal`; keep the existing off-verse
  page-turn `onClick`. Wire pin seeding + flip-clear in Phase 2.
- **Mobile** `FacsimilePageViewerMobile.js` (Phase 2): the fetch unit is a
  **page**, not a spread (the viewer is a windowed vertical scroll, rows
  recycled). `useFaxVerses` must expose a **per-page** fetch + **per-page** cache
  so a fling doesn't hammer `/fax/boxes`. Active/pin/open state lives **above**
  the row components (rows unmount off-window; a pinned verse must not evaporate
  when its row recycles). Browser click-after-scroll suppression handles
  scroll-vs-tap; documented.

## Data flow

```
left/right leaf.pageReference
      │ lookupReference → verse_id union
      ├─ chunk ≤40 → GET /fax/boxes ×N ─► merge → boxes by (imagePage, verseId)
      │                                                    │
      └─ chapter ref(s) → read(chapter) ×1–3 ─► text/speaker by verse_id
                                                           │
                                    useFaxVerses → versesByPage (box arrays + text)
                                                           │
                          hover(+intent) / pin / tap  ──►  FaxVerseCutout (scrim+tooltip)
                                                           │ click verse
                                                           ▼
                                                    FaxVerseModal
                                                      ├─ cutout (static → FaxPanZoom)
                                                      ├─ avatar + voice + ref + text
                                                      └─ faxCompare (Phase 3)
```

## Error / edge handling

- Edition not renderable → no hotspots, no scrim (current behavior preserved).
- Verse has boxes but no text → hotspot + cutout still work; tooltip shows ref.
- `/fax/boxes` chunk or `read` fails → that data is absent; the page image is
  unaffected, no thrown error.
- Deep-link ref not on the loaded spread → no pin.
- Multi-verse deep-link → spotlight the union; pin the range.
- Compare finds zero covering editions → empty state, not an error.
- Rapid page turns → debounced + aborted; stale responses never apply; active
  state clears on flip start.
- `prefers-reduced-motion` → cutout/tooltip transitions collapse to instant.

## Testing

- **Unit**: `useFaxVerses` — chunk-and-merge of >40 ids, `(imagePage,verseId)`
  grouping into box arrays, chapter text indexing. `faxVerseState` reducer —
  idle/hover/click/pin/unlock/spread-change transitions (incl. multi-verse pin).
  `faxCompare` — coverage from empty vs non-empty `boxes`.
- **`FaxHighlightOverlay.test.js`**: it is **rewritten**, not "kept" — it asserts
  `.faxHighlightBox` divs with inline px (test lines 12–17, 41), which the SVG
  rewrite won't produce. Port the scaling assertions to the new DOM and port the
  ResizeObserver-measure case (lines 27–43) that protects the mobile width path.
- **Playwright** (localhost:8200): hover → scrim+cutout+tooltip with correct
  text; off-verse click still turns; verse click → modal with avatar + text;
  (P2) deep-link pinned state without hover, released on enter→exit; (P3) compare
  loads other editions.

## Rollout

- Inert for non-renderable editions → ships without gating.
- No backend/deploy dependency (chunking + coverage are client-side).
