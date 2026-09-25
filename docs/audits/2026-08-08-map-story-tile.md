# Audit: `tile-mapstory` (Home MapStory journey player)

**Date:** 2026-08-08
**Scope:** The animated journey tile on Home. User-reported symptoms: moves transition too fast, the map is cluttered/clustered, labels jump and jitter, the narrative block has no place images, the camera never right-sizes the active movement, and every past/future leg is drawn at all times instead of a trailing, relevant subset.

## Files

| File | Role |
|---|---|
| `frontend/webapp/src/views/Home/tiles/MapStoryTile.js` | Orchestrator: playback state, timing budget, controls, narrative card host |
| `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js` | OpenLayers map, path layers, animation loop, camera (`fitStory`), overlay render |
| `frontend/webapp/src/views/Home/tiles/mapStoryLayout.js` | Screen-space collision solver: markers, clusters, labels, traveler placement |
| `frontend/webapp/src/views/Home/tiles/mapStoryPath.js` | Pure geometry: `legsOf`, `stopsOf` (per-move legs, distinct stops) |
| `frontend/webapp/src/views/Home/tiles/MapStoryCard.js` | Narrative beat card (`MapStoryMoveCard`, `MapStoryCompleteCard`) |
| `frontend/webapp/src/views/Home/Sampler.css` (1743–2182) | All styling |

The geometry layer (`mapStoryPath.js`) is well-designed — it deliberately avoids the old "chain every stop into one LineString" bug (see its header comment; 47 invented legs across 21 stories). The problems below are all in **presentation and pacing**, not geometry.

---

## Finding 1 — Transitions are too fast, and get faster the longer the story

**Severity: High. Root cause of "moves transition too fast."**

`MapStoryTile.js:10-18`:

```js
export const PLAYBACK_BUDGET_MS = 22000;
export const playbackTiming = (moveCount) => {
  const stepMs = Math.min(2800, Math.max(750, Math.floor(PLAYBACK_BUDGET_MS / Math.max(1, moveCount))));
  return { stepMs, travelMs: Math.min(1650, Math.max(520, Math.round(stepMs * 0.68))) };
};
```

The pacing model is a **fixed 22-second total budget** split across all moves. This is backwards for readability:

- A 30-move story → `stepMs = 750ms` (floored), `travelMs ≈ 510ms`. Each leg draws in half a second and advances almost immediately.
- The single `setTimeout(…, stepMs)` at `MapStoryTile.js:151-160` covers **both** the line-draw animation *and* the dwell. With `travelMs = 0.68 × stepMs`, only ~32% of each step remains after the line finishes — ~240ms of dwell on a 750ms step. That is far too short to read the beat card, the scripture ref, or the "8 years" duration.
- The more content a story has, the *less* time each beat gets — the opposite of what a reader needs.

**Recommended fix:** Pace **per move**, not per story. Give each move a fixed, readable dwell that is independent of `travelMs`, e.g. `dwellMs = clamp(1800..3500)` measured *after* the line-draw completes, and drive advancement off the animation's completion callback rather than one flat `setTimeout` that races the RAF loop. Optionally scale dwell up when the beat card has a `description`/`ref` to read. Drop the global budget entirely (or raise it well past 22s and treat it only as an upper cap).

---

## Finding 2 — Camera never re-frames the active move ("never zooms to right-size")

**Severity: High. Root cause of "map never zooms to right-size the movement."**

The view is set once and only ever fits the **entire** story extent:

- Initial view centers on move 0 at `MIN_ZOOM` (`MapStoryTileInner.js:265-270`).
- `fitStory()` (`MapStoryTileInner.js:276-290`) fits `baseLayer.getSource().getExtent()` — the bounding box of **all** legs — with 52px padding, capped at `MAX_ZOOM = 10`.
- `fitStory` runs on mount (`:317`), on resize (`:311`), and on Recenter (`:399-403`). **Nothing else moves the camera.**

There is no `view.animate(...)` tied to `step`. So during playback the camera is frozen on the whole-journey overview; each individual move is a small line segment on a static, zoomed-out map. For a story that spans a large extent, a short hop between two nearby places is nearly invisible.

**Recommended fix:** On each step change, animate the view to frame the **active leg** (plus a little context — e.g. the trailing 1–2 legs), padded, clamped to `MAX_ZOOM`. Use `map.getView().animate({ center, zoom, duration })` and set `programmaticMoveRef.current = true` around it so the existing `markManipulated`/`moveend` guards don't treat it as a user drag (that machinery already exists at `:293-306`). Keep whole-story fit as the "Recenter story" action and the completion frame.

---

## Finding 3 — Every leg is always drawn; nothing decays to a trailing window

**Severity: High. Root cause of "irrelevant past/future paths shown always instead of the trailing most relevant ones."**

Two overlapping layers both show too much:

1. **Base layer** (`MapStoryTileInner.js:223-244`) builds a faint full-opacity-`0.35` line for **every** leg once and never touches it again. The complete route skeleton — including the ending — is visible from frame one. This spoils the reveal and is the primary source of "ghost lines everywhere."
2. **Progress layer** (`:336-356`): visited legs (`index < step`) are painted full-color and **accumulate forever** — they never fade. By the end, every visited leg is drawn at full `VISITED` weight simultaneously.

So the screen always carries: all future legs (faint) + all past legs (bold) + active leg. There is no notion of "recent vs. old." The user's mental model — a trailing comet that emphasizes the last few moves and lets older ones recede — is not implemented.

**Recommended fix:** Introduce distance-from-playhead styling. Keep the active leg bold; fade visited legs by recency (e.g. last 2–3 at `VISITED`, older ones stepping down toward the faint `ROUTE` tone or hidden); keep future legs hidden or barely-there until reached. This pairs naturally with Finding 2's per-move camera so the "trailing window" is both drawn *and* framed.

---

## Finding 4 — Labels jump and jitter between beats

**Severity: Medium-High. Root cause of "labels jump and jitter."**

Two compounding causes:

**(a) Placement is recomputed discretely and is order/obstacle-dependent.**
`buildStoryOverlay` → `layoutSymbols`/`layoutLabels` (`mapStoryLayout.js:84-184`) run on every `updateLayout` (step change at `MapStoryTileInner.js:357`, every `moveend` at `:305`/`:297`, and every resize at `:308-315`). The solver picks the **first** candidate ring/grid slot that fits given the *current* obstacle set:

- The active marker changes size per role (26px active vs 20 anchor vs 18 visited — `mapStoryLayout.js:286-288`; CSS `is-active` is 21px at `Sampler.css:1832`). As the active stop changes each step, obstacle rectangles shift, and labels around them get re-solved into different slots.
- The traveler party is added as an obstacle (`MapStoryTileInner.js:172-204`) and moves every frame, further changing what fits.
- Because placement is a first-fit search with no memory of the previous frame's position, a place's label **teleports** between candidate positions from one beat to the next.

**(b) There is no CSS transition to absorb the discrete jumps.**
`.mapStoryPlaceLabel` and `.mapStoryStopMarker` are positioned with absolute `left`/`top` and have **no `transition`** (`Sampler.css:1822-1873`). `.mapStoryTravelerParty` sets `will-change: left, top` (`:1907`) but likewise has no `transition` (one is only *removed* under reduced-motion at `:2173-2177`, implying an intent that was never added). Every recompute is an instant snap.

**Recommended fix:**
1. Add position **stability**: cache each label's prior slot and prefer keeping it if it still fits (hysteresis), only re-solving when it genuinely collides.
2. Add `transition: left/top ~180ms ease` (and `transform`) to `.mapStoryPlaceLabel`, `.mapStoryStopMarker`, and `.mapStoryTravelerParty`, gated off under `prefers-reduced-motion`.
3. Avoid re-running the full layout on every `moveend` during a programmatic camera move — debounce/skip while `programmaticMoveRef.current` is true, recomputing once on settle.

---

## Finding 5 — The map is visually cluttered/clustered

**Severity: Medium. Root cause of "the map is clustered."**

Clutter is a direct consequence of Findings 2 and 3 plus a few local factors:

- The whole story is crammed into one ~292px-tall frame (`Sampler.css:1774`) at a low zoom, so **all** stops, markers, faint legs, labels, clusters, and leader lines share very little pixel space at once.
- Future stops *are* clustered (`clusterFutureStops`, `mapStoryLayout.js:190-214`, 46px / 52px-on-mobile radius), but named stops (active + both anchors + all visited) are **never** clustered and all render simultaneously (`buildStoryOverlay:270`, `roleForStop:216-229`). On a long story the accumulation of visited markers/labels is the bulk of the clutter.
- The **terminus anchor** is `required` and shown from move 1 (`roleForStop:222`) — its label/marker sits on the map for the entire playback, both a spoiler and permanent clutter.
- Leader lines (symbol + label + traveler) add more strokes into the same small area (`MapStoryTileInner.js:426-463`).

**Recommended fix:** Right-sizing the camera per move (Finding 2) and fading old legs/markers (Finding 3) will remove most of the clutter for free, because far-away and old elements leave the frame or recede. Additionally consider: don't surface the terminus label until it's the active/last beat; cap the number of simultaneously-labeled visited stops (label only the last N); and cluster visited stops the same way future ones are clustered once they leave the trailing window.

---

## Finding 6 — Narrative block has no place images

**Severity: Medium. Root cause of "narrative block has no place images."**

`MapStoryCard.js` (`MapStoryMoveCard`, lines 16-53) renders text only: index badge, "Start → End" leg, scripture ref button, duration, description, and traveler text. There is **no image** anywhere in the card.

The only images in the whole tile are **people** avatars on the map (`MapStoryTileInner.js:514-519`, `${assetUrl}/people/${slug}`), not places, and they live on the map layer — not in the narrative block.

Each move already carries everything needed to fetch place art: `start`/`end` slugs and `startName`/`endName` (see `stopsOf`/`legsOf` in `mapStoryPath.js` and the move shape). If an `${assetUrl}/places/${slug}` (or equivalent) endpoint exists — the people endpoint pattern suggests it may — the card can show start/end place thumbnails.

**Recommended fix:** Add start/end place thumbnails (or a single destination image) to `MapStoryMoveCard`, mirroring the people-avatar `onError` hide pattern at `MapStoryTileInner.js:518` so a missing asset degrades gracefully. Confirm the correct place-image asset route before building (verify against `assetUrl` usage elsewhere and the map/full-story page). Add matching card styling near `Sampler.css:2054-2117`.

---

## Priority summary

| # | Symptom | Severity | Where | Nature of fix |
|---|---|---|---|---|
| 1 | Transitions too fast | High | `MapStoryTile.js:10-18,151-160` | Per-move dwell, decouple from travelMs |
| 2 | No per-move zoom | High | `MapStoryTileInner.js:265-290` | `view.animate` to active leg per step |
| 3 | All legs always drawn | High | `MapStoryTileInner.js:223-244,336-356` | Recency-based fade / trailing window |
| 4 | Labels jump & jitter | Med-High | `mapStoryLayout.js:84-184`, `Sampler.css:1822-1873` | Placement hysteresis + CSS transitions |
| 5 | Map cluttered | Med | `buildStoryOverlay`, `roleForStop` | Falls out of #2/#3 + defer terminus, cap labels |
| 6 | No place images in card | Med | `MapStoryCard.js:16-53` | Add place thumbnails w/ graceful fallback |

**Recommended sequencing:** 2 and 3 together (camera + trailing render) resolve the core "cluttered, can't see the movement" experience and knock down 5 as a side effect. 1 makes it readable. 4 removes the remaining visual noise. 6 is an independent content enhancement that can land anytime.

Findings 2 and 3 are the highest-leverage: they change the tile from "static overview with animated scribbles" to "a camera that follows the journey." Everything else is polish on top of that.
