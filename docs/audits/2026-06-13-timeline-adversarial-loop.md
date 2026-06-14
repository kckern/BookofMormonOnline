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
