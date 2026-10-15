# Home/Discover tiles — production readiness

**Date:** 2026-10-15
**Source audit:** `docs/audits/2026-10-15-home-discover-tile-audit.md` (rubric §1–4, results R1–R3)
**Goal (KC):** every tile in `frontend/webapp/src/views/Home/tiles/` audited, improved,
standardized to the rubric, production-ready, and validated by a blind Fable review,
then deployed to prod.

## Decisions (2026-10-15)

| Topic | Decision |
|---|---|
| Entity destinations | **Keep pages, fix them.** Tiles link to `/people|places|matters/:slug` pages. The route-backed modal (S5) is deferred to its own project. In scope: the dead-end P0, a top back control, the phone layout of entity pages, and the double-Back pushes. |
| Image weight (J1) | **Generate variants.** An idempotent script builds resized WebP variants under a new media prefix; tiles use `srcset` and fall back to the original. KC confirms before the upload to the prod media bucket. |
| Pass bar | **No P0/P1 on any tile, and Craft/Beauty/Belonging all ≥ 3.** P2s may remain but are listed. Fix and re-review until every tile passes. |
| Ship | **Deploy to prod after the review passes.** KC confirms at the moment of deploy. |

## Scope

**In:**
- Every tile and helper in `Home/tiles/` (incl. `_ds/`).
- `Sampler.js`, `Sampler.css`, `Sampler.m.css`.
- The shared primitives the tiles render (`RefPill`, `ScripturePopup`, `ExpandableText`, `TileCTA`/`TileDeepLink`/`Reveal`).
- Destination fixes that tile criteria D/E depend on:
  - `/matters/<group>` routing.
  - Entity page top back control and phone layout.
  - Canonicalize-by-push in Read, Study and the map pin.
  - The narration-page overflow lock.
- The image-variant script plus the tile `srcset`.

**Out:**
- The route-backed modal.
- An index page redesign beyond the D criteria.
- Logged-in or Korean redesign. Hardcoded English gets moved behind `label()`. New label keys need rows in the labels table (prod DB write, KC confirms).
- Backend sampler changes, except where a tile can never render (translation always null; map unreachable). Those get fixed or the tile is removed from rotation. The choice is recorded in the plan.

## The tile standard (what "standardized" means)

Every tile conforms to one anatomy and one set of behaviors. Each item maps to rubric criteria.

1. **Frame**
   - An eyebrow `.tileHeading` that links to the tile's index, or plain text when there is none, with the same rule everywhere.
   - Then content, then CTAs.
   - Every tile renders inside a per-tile error boundary (M2). A throw hides that tile; the grid survives.
2. **CTAs (C1–C4, H2)**
   - Layer 1 is `TileCTA variant="reveal"` and is reversible (Show less) with focus kept (C2).
   - Layer 2 is `TileCTA variant="deeplink"`.
   - One verb vocabulary:
     - "Read more" / "Show less" (L1)
     - "See in context" (into Read)
     - "Open \<entity\>" (entity page)
     - "View all" (index)
     - "Explore" (map/story)
   - Sentence case throughout. Each destination has exactly one tab stop per card (no 2–3 links to the same href).
3. **Destination Rule (C4)**
   - In-tile prose → reveal.
   - Verse or passage → ScripturePopup.
   - Entity → its page.
   - Collection or document → page.
   - (The modal row is deferred.)
4. **Scripture refs (G1)** — one `RefPill` implementation everywhere: a real `<button>`, never nested inside an `<a>`.
5. **Images (A2, J1, G3)**
   - One `TileImage`: `srcset` variants, explicit width and height (or aspect-ratio), lazy except for the first row, meaningful or empty alt, and a dark-mode dim rule.
6. **Sizing (B1)** — the skeleton for each span matches its rendered height within 10%. Self-fetching tiles get a skeleton, never `null` or "…". An empty or failed tile collapses (no shell).
7. **Responsive (F1–F3, A1)**
   - No horizontal overflow at 390, 820 or 1440.
   - No silent `max-height` clipping. A bounded tile fades and offers its reveal.
   - Tap targets ≥ 44px on touch.
   - ScripturePopup is a full-width bottom sheet on phone, with the close control visible.
8. **Focus and contrast (C5, A4, L3)**
   - One gold `:focus-visible` ring.
   - Meta/eyebrow text ≥ 4.5:1 in light and dark.
   - No blue anywhere (house style); dark mode uses neutral and gold tokens only.
9. **Motion (A6, C1)** — hover lift only on real links. `prefers-reduced-motion` disables lift, autoplay and transitions.
10. **History (E1, E3)**
    - A tile deeplink adds exactly one history entry, and one Back returns to Home with the same tiles and scroll.
    - Canonicalizing redirects use `replace`.
11. **Content (H1–H4, A7)**
    - Dud rate ≤ 1 in 5 seeds.
    - No raw i18n keys, `undefined`, or disambiguator leaks like "Alma2".
    - No entity duplicated across tiles in one sample.

## Validation

- **Automated:**
  - Unit tests per changed module.
  - The two-layer compliance test is extended: verb vocabulary, `TileImage` usage, error boundary, and no `<a>` nesting `RefPill`.
  - The Playwright page-pass and verify scripts are re-run.
- **Blind Fable review:**
  - Agents on the Fable model, one per tile family, get only:
    - a rubric-only extract (§1–2 and §4 of the audit doc, no results)
    - the capture harness
    - the running dev app
  - They don't get R1–R3, the findings, this spec, or diffs.
  - They return the same structured result as the tile pass.
  - A tile passes at no P0/P1 and gestalt ≥ 3 on all three axes.
  - Failures go back into fix rounds. Review rounds use fresh agents, so a reviewer never sees its earlier verdict.
- **Prod:** after the review passes, KC confirms, then the deploy goes through the existing CI blue-green path. A post-deploy smoke check runs on prod.

## Success criteria

1. All 26 tiles pass the blind review bar. Any tile removed from rotation is documented with its reason.
2. Zero P0/P1 left among the R1–R3 findings that fall in scope. Each in-scope finding is either fixed or explicitly accepted with a reason in the audit doc.
3. Page-level metrics:
   - warm CLS < 0.05 on desktop and phone
   - cold CLS < 0.1
   - no console errors on a Home load
4. Deployed to prod, and the post-deploy smoke check passes.
