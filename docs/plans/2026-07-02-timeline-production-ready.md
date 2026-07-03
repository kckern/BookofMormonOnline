# Timeline Grid — Production-Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Take the rebuilt `/timeline` grid view — which has passed a 4-dimension adversarial sign-off (design-system, layout, presentation, data-completion) — from "looks right in the working tree" to genuinely production-ready: regenerable data, test coverage for the new rendering logic, working tooling, verified accessibility/performance, and a clean deploy to dev.

**Architecture:** The timeline renders two baked JSON artifacts — `gridTiles.json` (canvas territory fills) and `timelineData.json` (events/labels/markers) — through a pure-logic model (`timelineModel.js`) and a React view (`Timeline.js` + `Timeline.css`). During the design pass these two JSON artifacts were **hand-edited directly**, but both are nominally *generated* (`build_tiles.py` → `gridTiles.json`; `gen_timeline_data.py` → `timelineData.json` from GraphQL + `data-overrides.json`). The single largest production risk is that a future regeneration silently reverts the design work. This plan makes the artifacts either faithfully regenerable or explicitly declares them the source of truth, then hardens tests, tooling, and deploy.

**Tech Stack:** React 17 (CRA via react-app-rewired), Jest, Python 3 (data pipeline), Playwright (screenshots), systemd `bom-dev` unit on the dev host (frontend `:8200`, backend `:5006`), Cloudflare edge cache on `bom.kckern.net`.

---

## Current State (as of 2026-07-02)

**Passing:** 55/55 `timelineModel` unit tests; all 4 adversarial sign-off dimensions (0 blockers).

**Uncommitted working-tree changes:**
- `frontend/webapp/src/views/Timeline/{Timeline.js, Timeline.css, timelineModel.js, timelineModel.test.js, icons.js, gridTiles.json, timelineData.json}`
- `scripts/timeline-grid/{battleTiles.json, data-overrides.json}`
- `docs/audits/2026-07-01-timeline-grid-design-audit.md` (untracked)

**Known tooling gaps:**
- `scripts/timeline-grid/screenshot.js` hardcodes `require('../../node_modules/playwright')`; playwright is not a dependency of either `package.json`. It was run this session via a `PLAYWRIGHT_MODULE` env hack and a standalone Python script.
- `frontend/webapp/src/views/Timeline/TimelinePopover.test.js` fails to run — the import chain pulls `src/models/Utils.js` (`crypto-browserify`, `dompurify`) which the bare Jest/CRA test resolver rejects. Pre-existing, not introduced here.

**New rendering logic added this session (needs test coverage):**
- `timelineModel.js`: `wedgeColor()` (rounded-corner reveal color via wrap detection), `markerIconSize()` (apex battle scaling), `cornerRadii()` gained a `strict` param, `barPaint()` grammar changed to solid-origin/dissolve-tail, `shapeTileStyle` bevel gained two-color `to` support (`BEVEL_DEG`), `apiMarkers()` now carries `w`/`h`.
- `Timeline.js`: wedge backing for fills/unders/bars, floating-vs-card label rule, icon-only battle routing, `MARKER_ICONS` (battle/voyage/skull/query).
- `icons.js`: `SHIP`, `SKULL`, `QUERY` glyphs.

---

## Phase 1 — Data Pipeline Integrity (CRITICAL, do first)

The design work lives in `gridTiles.json` and `timelineData.json`. If either is regenerated from its script, uncaptured hand-edits are lost. Resolve this before anything else.

### Task 1.1: Determine and document the source-of-truth policy

**Files:**
- Read: `scripts/timeline-grid/build_tiles.py`, `scripts/timeline-grid/gen_timeline_data.py`, `scripts/timeline-grid/reconcile.py`
- Create: `docs/reference/timeline-data-pipeline.md`

**Step 1:** Read `build_tiles.py` end-to-end. Determine its input source(s) for `gridTiles.json` (a spreadsheet? a source JSON? the DB?). Note whether re-running it would reproduce the current hand-edited tile set (it will NOT — hundreds of fill cells were added by hand this session: interior-hole fills, the gold-void closure, record-keeper connector band, bevels, wedge-relevant cells).

**Step 2:** Read `gen_timeline_data.py`. Confirm the override flow: GraphQL dump + `battleTiles.json` + `data-overrides.json` → `timelineData.json`. Most `timelineData.json` edits this session were mirrored into `data-overrides.json`, but verify (Task 1.2).

**Step 3:** Write `docs/reference/timeline-data-pipeline.md` documenting, for each artifact: what generates it, what the source of truth is *now*, and the exact command to regenerate safely. Decide and record the policy explicitly. Recommended policy:
  - `timelineData.json`: regenerable — `data-overrides.json` is the source of truth for all placement/label/icon edits. Direct edits are forbidden; use overrides.
  - `gridTiles.json`: **frozen artifact** — `build_tiles.py` is retained for history but `gridTiles.json` is now hand-maintained (the design polish is not expressible in the tile generator). Document this clearly at the top of the file's sibling README and in the pipeline doc so nobody re-runs `build_tiles.py` expecting it to reproduce the shipped canvas.

**Step 4: Commit**
```bash
git add docs/reference/timeline-data-pipeline.md
git commit -m "docs(timeline): pipeline source-of-truth policy (gridTiles frozen, timelineData via overrides)"
```

### Task 1.2: Verify `timelineData.json` fully regenerates from overrides

**Files:**
- Use: `scripts/timeline-grid/gen_timeline_data.py`, `scripts/timeline-grid/data-overrides.json`
- Verify: `frontend/webapp/src/views/Timeline/timelineData.json`

**Step 1:** Back up the current shipped file:
```bash
cp frontend/webapp/src/views/Timeline/timelineData.json /tmp/timelineData.shipped.json
```

**Step 2:** Regenerate (needs the backend on `:5006` for the GQL dump; if unavailable, note that the GQL fetch is the one unreproducible input and skip to Step 4 with a documented caveat):
```bash
cd scripts/timeline-grid && GQL_URL=http://localhost:5006/graphql python3 gen_timeline_data.py
```

**Step 3:** Diff regenerated vs shipped:
```bash
python3 - <<'EOF'
import json
a=json.load(open('/tmp/timelineData.shipped.json'))['events']
b=json.load(open('../../frontend/webapp/src/views/Timeline/timelineData.json'))['events']
ai={e['slug']:e for e in a}; bi={e['slug']:e for e in b}
miss=[s for s in ai if s not in bi]; extra=[s for s in bi if s not in ai]
diff=[s for s in ai if s in bi and json.dumps(ai[s],sort_keys=True)!=json.dumps(bi[s],sort_keys=True)]
print("missing after regen:",miss); print("extra:",extra); print("changed:",diff[:40])
EOF
```

**Step 4:** For every slug in `missing`/`changed`, add the delta to `data-overrides.json` (scalar fields, `grid` per-key, or `+new` for whole events) so a regen is a no-op. Re-run Steps 2–3 until the diff is empty. If the backend is unavailable, instead restore the shipped file (`cp /tmp/timelineData.shipped.json …`) and record in the pipeline doc that overrides were reconciled by inspection.

**Step 5: Commit**
```bash
git add scripts/timeline-grid/data-overrides.json frontend/webapp/src/views/Timeline/timelineData.json
git commit -m "chore(timeline): reconcile data-overrides so timelineData regenerates byte-stable"
```

### Task 1.3: Add a regen-stability guard test

**Files:**
- Create: `scripts/timeline-grid/test_regen_stable.py`

**Step 1: Write the failing test** — a script that asserts the committed `timelineData.json` equals the output of the generator given the current overrides (mocking/fixture the GQL dump so it runs in CI without the backend). If a live GQL fixture is impractical, assert instead that every `data-overrides.json` slug is present in `timelineData.json` with matching grid — a weaker but CI-runnable invariant.

**Step 2:** Run it, expect FAIL if overrides drift.

**Step 3:** With Task 1.2 done it should PASS.

**Step 4: Commit**
```bash
git add scripts/timeline-grid/test_regen_stable.py
git commit -m "test(timeline): guard that overrides keep timelineData regenerable"
```

---

## Phase 2 — Test Coverage for New Rendering Logic

All new pure functions in `timelineModel.js` must have unit tests (the view logic in `Timeline.js` is covered indirectly by the sign-off screenshots, but the model must be pinned).

### Task 2.1: Test `wedgeColor` wrap detection

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.test.js`

**Step 1: Write failing tests** covering the three cases the design depends on:
```javascript
describe('wedgeColor (rounded-corner reveal)', () => {
  const grid = (map) => (r, c) => map[`${r},${c}`] || null
  it('reveals the wrapping band when a color appears in ≥2 of a corner\'s 3 directions', () => {
    // tile at (5,5) own=blue; red above, left, and up-left → tl rounds & wraps red
    const at = grid({ '4,5': '#85200c', '5,4': '#85200c', '4,4': '#85200c' })
    expect(wedgeColor({ r: 5, c: 5, w: 1, h: 1, bg: '#1c4587' }, at)).toBe('#85200c')
  })
  it('returns null (cream) for a floating card: band on only one side', () => {
    const at = grid({ '4,5': '#85200c' }) // red only above → not wrapping
    expect(wedgeColor({ r: 5, c: 5, w: 1, h: 1, bg: '#1c4587' }, at)).toBe(null)
  })
  it('honors an explicit wedge override', () => {
    expect(wedgeColor({ r: 5, c: 5, w: 1, h: 1, bg: '#1c4587', wedge: '#bf9000' }, () => null)).toBe('#bf9000')
    expect(wedgeColor({ r: 5, c: 5, w: 1, h: 1, bg: '#1c4587', wedge: 'none' }, () => '#85200c')).toBe(null)
  })
})
```

**Step 2:** Run `CI=true npx react-app-rewired test --testPathPattern timelineModel --watchAll=false` — expect the 3 new tests to pass (the function exists). If any fails, the function has a bug the sign-off screenshots didn't catch — fix `wedgeColor` before proceeding.

**Step 3: Commit**
```bash
git add frontend/webapp/src/views/Timeline/timelineModel.test.js
git commit -m "test(timeline): cover wedgeColor wrap detection + override"
```

### Task 2.2: Test `markerIconSize`, `cornerRadii` strict mode, two-color bevel

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.test.js`

**Step 1: Write failing tests:**
```javascript
it('markerIconSize floors at 18 and scales to the spanned short side', () => {
  expect(markerIconSize(1, 1)).toBe(18)
  expect(markerIconSize(4, 3)).toBe(58) // min(4*26,3*20)-2
})
it('cornerRadii strict also requires the diagonal empty', () => {
  const at = (r, c) => (r === 4 && c === 4 ? '#111' : null) // diagonal occupied at tl
  expect(cornerRadii({ r: 5, c: 5, w: 1, h: 1 }, at).tl).toBe(true)        // loose: rounds
  expect(cornerRadii({ r: 5, c: 5, w: 1, h: 1 }, at, true).tl).toBe(false) // strict: squares
})
it('two-color bevel renders a hard-stop diagonal gradient', () => {
  const up = (c) => `var(${c})`
  const s = shapeTileStyle({ k: 'bevel', dir: 'tr', bg: '#111', to: '#222' }, up).background
  expect(s).toContain('var(#111)'); expect(s).toContain('var(#222)'); expect(s).toContain('deg')
})
```

**Step 2:** Run tests, expect PASS.

**Step 3: Commit**
```bash
git add frontend/webapp/src/views/Timeline/timelineModel.test.js
git commit -m "test(timeline): cover markerIconSize, strict corners, two-color bevel"
```

### Task 2.3: Add a data-integrity invariant test

**Files:**
- Create: `frontend/webapp/src/views/Timeline/timelineData.integrity.test.js`

**Step 1: Write failing test** asserting the invariants the sign-off proved by eye, so regressions are caught in CI (not screenshots):
```javascript
import data from './timelineData.json'
import tiles from './gridTiles.json'
const evs = data.events
it('every placed event sits within the grid bounds', () => {
  for (const e of evs) if (e.grid) {
    expect(e.grid.row).toBeGreaterThanOrEqual(1)
    expect(e.grid.row + (e.grid.rowSpan||1) - 1).toBeLessThanOrEqual(tiles.rows)
    expect(e.grid.col + (e.grid.colSpan||1) - 1).toBeLessThanOrEqual(tiles.cols)
  }
})
it('short timeline labels stay short (≤ 28 chars)', () => {
  for (const e of evs) if (e.label) expect(e.label.length).toBeLessThanOrEqual(28)
})
it('no two non-icon labels occupy the exact same cell (collision guard)', () => {
  const seen = new Map()
  for (const e of evs) {
    const g = e.grid
    if (!g || g.icon || !e.p) continue
    const k = `${g.row},${g.col}`
    // allow same cell only if one is a bar (colSpan>1) and the other floats elsewhere
    if (seen.has(k) && (g.colSpan||1) === 1) {
      throw new Error(`label collision at ${k}: ${seen.get(k)} vs ${e.slug}`)
    }
    seen.set(k, e.slug)
  }
})
```

**Step 2:** Run it. If it fails, it found a real regression — fix the data, not the test. Expected: PASS (matches the current signed-off state).

**Step 3: Commit**
```bash
git add frontend/webapp/src/views/Timeline/timelineData.integrity.test.js
git commit -m "test(timeline): CI invariants for placement bounds, label length, collisions"
```

---

## Phase 3 — Tooling & Test Harness

### Task 3.1: Make the screenshot script self-contained

**Files:**
- Modify: `scripts/timeline-grid/screenshot.js`
- Modify: `frontend/webapp/package.json` (devDependencies) OR add `scripts/timeline-grid/package.json`

**Step 1:** Decide the playwright home. Preferred: add `"playwright": "^1.58"` to `frontend/webapp` devDependencies (where the app already lives) and change `screenshot.js` to `require(require('path').join(__dirname, '../../frontend/webapp/node_modules/playwright'))`, falling back to a `PLAYWRIGHT_MODULE` env override (already added this session). Run `npm i -D playwright && npx playwright install chromium` in `frontend/webapp`.

**Step 2:** Verify it runs against `:8200` (the real dev port per CLAUDE.md) *and* a local `:8201` CRA:
```bash
node scripts/timeline-grid/screenshot.js --url http://localhost:8200/timeline --out /tmp/tl-verify
```
Expected: writes `full.png` + strips, no MODULE_NOT_FOUND.

**Step 3: Commit**
```bash
git add scripts/timeline-grid/screenshot.js frontend/webapp/package.json frontend/webapp/package-lock.json
git commit -m "chore(timeline): make screenshot.js resolve playwright without env hacks"
```

### Task 3.2: Unblock or quarantine `TimelinePopover.test.js`

**Files:**
- Modify: `frontend/webapp/config-overrides.js` (Jest config) OR `frontend/webapp/src/views/Timeline/TimelinePopover.test.js`

**Step 1:** Reproduce: `CI=true npx react-app-rewired test --testPathPattern TimelinePopover --watchAll=false`. Confirm the failure is the `src/models/Utils.js` → `crypto-browserify`/`dompurify` resolution, not the Timeline code.

**Step 2:** Fix the smallest way: add a Jest `moduleNameMapper`/`transformIgnorePatterns` entry (in config-overrides or jest config) so `crypto-browserify`/`dompurify` resolve under test, OR refactor `TimelinePopover.test.js` to mock `src/models/BoMOnlineAPI` so it doesn't pull `Utils.js` transitively. Prefer the mock — it's isolated to the timeline and doesn't touch global Jest config.

**Step 3:** Run the popover suite, expect PASS. Run the whole timeline test dir, expect all green.

**Step 4: Commit**
```bash
git add frontend/webapp/src/views/Timeline/TimelinePopover.test.js
git commit -m "test(timeline): unblock TimelinePopover suite via API mock"
```

---

## Phase 4 — Accessibility, Performance, Responsive Verification

### Task 4.1: Run the axe-core a11y harness on `/timeline`

**Files:**
- Use: the existing a11y harness (commit `23402eb` "chore(qa): add reusable axe-core a11y harness"); find it under `e2e/` or `test/`.

**Step 1:** Locate and run the harness against `http://localhost:8200/timeline`.

**Step 2:** Triage results. Expected known-good: the grid has `role="region"`, a skip link, focus trap on the modal, `aria-label`s on battle buttons, keyboard focus rings retained (selection ring was removed, focus ring kept). Fix any serious/critical violations (contrast, missing names). Note that floating labels rely on halos for contrast — verify the axe contrast check against the *surface beneath*, not the cream canvas.

**Step 3: Commit** any fixes with `fix(timeline): a11y — <specific>`.

### Task 4.2: Performance check — wedge backing tile count

**Files:**
- Read: `frontend/webapp/src/views/Timeline/Timeline.js` (`fillEls`, `underEls`, `eventEls`)

**Step 1:** Count rendered nodes. The wedge backing adds one extra `<div>` per rounded fill/under/bar tile, and Phase 0 hole-fills added ~300 single-cell tiles. Measure DOM node count on `/timeline` (`document.querySelectorAll('.tg-fill').length`) and first-render + scroll frame timing (Chrome Performance panel) at zoom 1 and max zoom.

**Step 2:** If node count is > ~5000 or scroll jank appears: (a) merge contiguous same-color single-cell fills into spanning tiles in `gridTiles.json` (a build-time optimization — write a small python coalescer), and/or (b) only emit a wedge backing when `wedgeColor` is non-null (already the case) and skip it for tiles whose rounded corners are all interior. Do NOT regress the visual — re-screenshot and eyeball.

**Step 3: Commit** any optimization with `perf(timeline): coalesce single-cell fills / trim wedge backings`.

### Task 4.3: Responsive / mobile widths

**Files:**
- Use: `screenshot.js` with narrow viewports.

**Step 1:** Screenshot `/timeline` at 390px and 768px widths. Verify the `fitScale` ResizeObserver logic shrinks the grid to fit (no horizontal body scroll), labels remain legible or LOD-hide, the modal goes full-screen (`isNarrow` path), and the gutter stays sticky.

**Step 2:** Fix any overflow or unreadable-at-fit issues (adjust `TIER_MIN_SCALE` thresholds or the `naturalW` fit clamp).

**Step 3: Commit** with `fix(timeline): responsive <specific>` if needed.

---

## Phase 5 — Optional Residual Polish (from sign-off minors)

These are non-blocking; do only if time allows and KC wants them. Each is one small task: screenshot before/after.

- **5.1** Record-keeper connector lines: the model draws a thin line from the seam to each succession medallion. Currently medallions sit on the seam. (Decorative.)
- **5.2** Helaman West/East: two medallions touch at ~65 BC — add a few px vertical separation (nudge one event's row/anchor).
- **5.3** "The Nephites" band header: add the `▶` directional chevron (`dir:'r'`) to match the model.
- **5.4** Hover tooltip for unlabeled battle medallions (already have `title`/`aria-label`; confirm it surfaces on hover).
- **5.5** Christ peace-era band: confirm the cream-heavy top of the unity gradient is intended (KC design call).

Commit each independently: `feat(timeline): <polish item>`.

---

## Phase 6 — Docs, Commit Hygiene, Deploy

### Task 6.1: Finalize the audit doc

**Files:**
- Modify: `docs/audits/2026-07-01-timeline-grid-design-audit.md`

**Step 1:** Append a "Final sign-off (2026-07-02)" section recording that all 4 adversarial dimensions passed with 0 blockers, list the residual minors (Phase 5), and link the pipeline doc.

**Step 2: Commit**
```bash
git add docs/audits/2026-07-01-timeline-grid-design-audit.md
git commit -m "docs(timeline): record final 4-dimension sign-off + residual minors"
```

### Task 6.2: Full test + lint gate before deploy

**Step 1:** From `frontend/webapp`: `CI=true npx react-app-rewired test --watchAll=false` — ALL timeline suites green. Then `npm run build` (or the project's build) to confirm the production bundle compiles (the dev server used HMR; a real `build` catches things HMR hides). Note: root `package.json` moved to `_deprecated/` — confirm the build command from `frontend/webapp/package.json`.

**Step 2:** Fix any build/type/lint failures. Do not deploy on a red build.

### Task 6.3: Deploy to dev + Cloudflare cache

**Files:**
- Reference: `CLAUDE.md` (dev = `bom.kckern.net`, systemd `bom-dev`, Cloudflare 4h edge cache on the CRA bundle).

**Step 1:** Confirm with KC before restarting `bom-dev` (it bounces the public dev URL). Then on the dev host: `systemctl --user restart bom-dev` and `journalctl --user -u bom-dev -f` to confirm clean startup.

**Step 2:** Because Cloudflare caches `/static/js/bundle.js` for 4h, purge the Cloudflare cache (dashboard) or verify with a cache-busting query string. Confirm `cf-cache-status` is not `HIT` for the new bundle. Verify the live `/timeline` renders the new design (not the stale bundle).

**Step 3:** Final commit of any remaining tracked changes and push the branch; open a PR against `dev` if that's the team flow.
```bash
git add -A && git status   # confirm clean/intended
git push origin dev        # or the working branch
```

---

## Definition of Done

- [ ] `gridTiles.json` frozen-artifact policy documented; `timelineData.json` regenerates byte-stable from `data-overrides.json` (Phase 1).
- [ ] New model functions (`wedgeColor`, `markerIconSize`, strict `cornerRadii`, two-color bevel, `barPaint`) have unit tests; data-integrity invariants tested in CI (Phase 2).
- [ ] `screenshot.js` runs without env hacks; `TimelinePopover.test.js` green (Phase 3).
- [ ] axe-core: no serious/critical violations; acceptable perf at all zooms; responsive at 390/768px (Phase 4).
- [ ] Audit doc records the final sign-off; production `build` compiles clean; deployed to dev with Cloudflare cache purged and visually verified on `bom.kckern.net` (Phase 6).
- [ ] All work committed; nothing lost to a future regeneration.
