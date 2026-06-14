# Timeline — adversarial critique loop

Each round: a fresh adversarial design/UX critic loads `/timeline`, screenshots,
and delivers stern feedback; the highest-impact items are then implemented and
verified. Max 10 rounds; stops early when the critic runs out of substantive issues.

---

## Round 1

**Critic verdict (paraphrased):** Attractive but fails the core job of a timeline —
no legend (colors undecodable), time axis not to scale, battle medallions look
clickable but aren't, mobile unusable, no visible tile focus, wasted vertical space,
some label overflow/truncation, no "how to read" orientation, undersized modal,
cryptic zoom controls, black destruction band reads like a render error.

**Acted on (highest impact — the critic's own #1 pick):**
- Added a **legend / "How to read this"** overlay (collapsible, fixed, parchment-themed):
  orientation note (time top→bottom, dates approximate, columns = peoples/lands),
  a color key for all 12 lineage bands, and an icon key (📍 place, ⚔ battle).
- **Corrected the color→lineage mapping** — derived it from each event's real
  `grid_bg` because the migration design doc was wrong (e.g. maroon `#85200c` is
  **Lamanites**, not Nephites; `#1c4587` is Nephites; `#38761d` is the reign of the
  judges, etc.).
- Added `title` tooltips to the zoom controls (they already had aria-labels).

**Deferred to later rounds:** mobile responsive layout; to-scale (or explicitly
ordinal) time axis; modal sizing/art aspect; styling the black destruction band as
intentional; arrow-key grid navigation; remaining label overflow/truncation tooltips.

---

## Round 2

**Critic verdict:** R1 fixes confirmed working, but the data layer is leaking and
the legend has problems. Hard-data findings: battle medallions are aria-hidden
non-interactive decoration; legend (default-open) occludes the chart origin and is
catastrophic on mobile; legend↔band name mismatch ("The Great Destruction" vs
"Cataclysmic Destruction"); "After Christ" band 1.12:1 contrast (invisible); raw
slug suffixes ("Mosiah1", "Land of Bountiful1") + typos ("Nephties", "immiment");
~78% of labels overflow with no tooltip; grid not keyboard-reachable; two greens &
two blues in the legend are mutually indistinguishable; faint modal date.

**Acted on:**
- **Source typos fixed in prod DB:** "Nephties"→"Nephites", "immiment"→"imminent",
  "Mosiah1"→"Mosiah I".
- **Display cleanup** `cleanLabel()` strips disambiguation digits glued to names
  ("Land of Bountiful1"→"Land of Bountiful"), applied to labels + modal heading.
- **"After Christ" band now visible:** remap `#fff2cc`→`#e6cf8c` (`BG_FIX`/`fixBg`),
  applied to fills, events, and the legend swatch so the key still matches.
- **Battle medallions:** now `role="img" aria-label="Battle"` + `title` (honest,
  AT-announced marker) instead of silent `aria-hidden` decoration — there is no
  per-battle record to open, so they stay non-interactive by design.
- **Legend:** defaults collapsed on mobile (≤640px) so it no longer eats the
  viewport / occludes the origin; name now matches the band ("Cataclysmic
  Destruction").
- **Tooltips** (`title`) added to all labels (places + static, not just clickable).
- **Modal date** darkened + bolded for legibility.

**Deferred:** palette perceptual-separation for the two greens / two blues;
skip-link & arrow-key grid navigation; to-scale/ordinal axis treatment; deeper
mobile grid layout; label truncation (conflicts with the intentional overflow
"duration bar" design).
