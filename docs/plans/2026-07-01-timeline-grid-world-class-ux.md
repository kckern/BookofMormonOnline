# Timeline Grid — World-Class UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the tile-grid Timeline to visual/content parity-or-better with the legacy Leaflet timeline, fixing every defect in `docs/audits/2026-07-01-timeline-grid-ux-audit.md`.

**Architecture:** Extract all grid logic into a pure, unit-tested model module (`timelineModel.js`) built around ONE unified layer/occupancy compositor (band fills < event bars < battle tabs < markers < labels). Rendering consumes the compositor for corner rounding, reveal colors, battle territory, and label contrast — no layer ever guesses what's behind it. On top of that: a four-tier label system with anchor + zoom-LOD params, SVG iconography, an anchored speech-bubble popover, clickable battles, and diagonal bevel tiles.

**Tech Stack:** React 17 (CRA, jest via `react-scripts test`), plain CSS (`Timeline.css`), GraphQL Yoga + Kysely backend (`backend/`, vitest, graphql-codegen), Python data pipeline (`scripts/timeline-grid/`), Playwright (repo root `node_modules`) for screenshot verification.

---

## Context for a zero-context engineer

- The Timeline view lives at `frontend/webapp/src/views/Timeline/`. It renders a CSS grid: hardcoded canvas tiles from `gridTiles.json` (lineage band fills, battle markers, place pins, date axis) plus API events (GraphQL `timeline` query → `Event.grid` placement + `Event.label` text).
- **Read these first:** `docs/audits/2026-07-01-timeline-grid-ux-audit.md` (the spec for this plan), `docs/reference/timeline-corner-rounding.md` (corner heuristic), `docs/reference/timeline-grid-handoff.md` (history).
- The live dev backend is **`backend/` on :5006** (systemd unit `bom-greenfield`), NOT the deprecated `_deprecated/src/` Apollo server. Frontend CRA dev server is on :8201 (`:8200` is the Next front door). Restarting units is authorized; batch restarts per task.
- The dev DB user is read-only; schema migrations are applied out-of-band via the `BoMOnlineWorkspace` repo (not on this host). Tasks that need DB changes produce a `.sql` artifact and are **human-gated** — the frontend/backend code must work with the columns absent (null-tolerant).
- Verify visuals against **`localhost:8201`**, never `bom.kckern.net` (Cloudflare caches the bundle 4h).

**Run commands** (used throughout):

```bash
# frontend unit tests (CRA jest; src/ alias is configured in package.json "jest")
cd frontend/webapp && CI=true npm test -- --watchAll=false --testPathPattern=Timeline

# backend unit tests
cd backend && npx vitest run test/graphql/timeline-grid.test.ts

# screenshot harness (created in Task 3)
node scripts/timeline-grid/screenshot.js --out /tmp/tl-verify
```

## File map (what exists / what this plan creates)

```
frontend/webapp/src/views/Timeline/
├── Timeline.js            # MODIFY heavily — becomes render-only; logic moves out
├── Timeline.css           # MODIFY — label tiers, anchors, gutter, popover, bevels
├── gridTiles.json         # MODIFY — bevel tiles, break glyph (hand-authored cells)
├── timelineModel.js       # CREATE — pure logic: compositor, corners, tiers, axis
├── timelineModel.test.js  # CREATE — jest tests for everything in the model
├── icons.js               # CREATE — SWORDS / PIN / CHEV_L / CHEV_R inline SVGs
├── battleSlugs.json       # CREATE — "r,c" → slug binding for canvas battle tiles
├── TimelinePopover.js     # CREATE — anchored speech-bubble callout
└── TimelinePopover.test.js# CREATE — RTL test for placement logic

frontend/webapp/src/models/GraphQLQueries.js   # MODIFY — grid { … anchor tier dir }
backend/schema/BomPage.graphql                 # MODIFY — EventGrid + anchor/tier/dir
backend/src/data/loaders/mediamisc.ts          # MODIFY — TimelineRow optional cols
backend/src/graphql/resolvers/mediamisc.ts     # MODIFY — Event.grid mapping
backend/test/graphql/timeline-grid.test.ts     # CREATE — resolver unit test
scripts/timeline-grid/bind_battles.py          # CREATE — battle↔slug draft matcher
scripts/timeline-grid/gen_battle_placements.py # CREATE — SQL for workspace handoff
scripts/timeline-grid/screenshot.js            # CREATE — reusable Playwright harness
docs/reference/timeline-grid-handoff.md        # MODIFY — close-out (final task)
```

Execution order matters through Phase 2 (compositor unblocks everything); Phases 4–8 are parallelizable after it.

---

## Phase 1 — Extract the pure model (no behavior change)

### Task 1: Create `timelineModel.js` + tests; slim `Timeline.js`

**Files:**
- Create: `frontend/webapp/src/views/Timeline/timelineModel.js`
- Create: `frontend/webapp/src/views/Timeline/timelineModel.test.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js` (delete lines 44–115 & 160–183: `MINOR/humanize/BG_FIX/fixBg/cleanLabel/textOn/RAD/cornerStyle/dominantNeighbor`; import from the model instead)

- [ ] **Step 1: Write the failing test**

```js
// frontend/webapp/src/views/Timeline/timelineModel.test.js
import {
  fixBg, textOn, humanize, cleanLabel, cornerRadii, dominantNeighbor,
} from './timelineModel'

describe('color + text utils', () => {
  it('remaps problem band colors, passes others through', () => {
    expect(fixBg('#274e13')).toBe('#2f6f4f')
    expect(fixBg('#134f5c')).toBe('#134f5c')
    expect(fixBg(null)).toBe(null)
  })
  it('picks contrast ink from luminance', () => {
    expect(textOn('#000000')).toBe('#fff')
    expect(textOn('#fff2cc')).toBe('#222')
    expect(textOn(null)).toBe('#222')
  })
  it('humanizes slugs with minor-word rules', () => {
    expect(humanize('land-of-first-inheritance')).toBe('Land of First Inheritance')
    expect(humanize('of-things')).toBe('Of Things') // leading minor word capitalizes
  })
  it('strips glued disambiguation digits only', () => {
    expect(cleanLabel('Land of Bountiful1')).toBe('Land of Bountiful')
    expect(cleanLabel('Mosiah II')).toBe('Mosiah II')
    expect(cleanLabel('1 Nephi')).toBe('1 Nephi')
  })
})

describe('cornerRadii (corner rule v2 — see step note below)', () => {
  // 3×3 world: single cell of color C at (5,5), everything else empty
  const lone = (r, c) => (r === 5 && c === 5 ? '#111111' : null)
  it('rounds all four corners of an isolated cell', () => {
    expect(cornerRadii({ r: 5, c: 5, w: 1, h: 1 }, lone))
      .toEqual({ tl: true, tr: true, bl: true, br: true })
  })
  it('keeps a junction corner square when another band sits diagonally', () => {
    const world = (r, c) =>
      r === 5 && c === 5 ? '#111111' : r === 4 && c === 4 ? '#222222' : null
    expect(cornerRadii({ r: 5, c: 5, w: 1, h: 1 }, world).tl).toBe(false)
  })
  it('keeps an edge square where the band continues', () => {
    const world = (r, c) => (r === 5 && (c === 5 || c === 6) ? '#111111' : null)
    const k = cornerRadii({ r: 5, c: 5, w: 1, h: 1 }, world)
    expect(k.tr).toBe(false)
    expect(k.br).toBe(false)
    expect(k.tl).toBe(true)
  })
  it('keeps a flush handoff square when another band abuts an orthogonal edge', () => {
    // band #222222 directly below, left edges aligned — the junction-sliver
    // config the audit photographed (rule v1 wrongly rounded BOTH corners here)
    const world = (r, c) =>
      r === 5 && c === 5 ? '#111111' : r === 6 && c === 5 ? '#222222' : null
    expect(cornerRadii({ r: 5, c: 5, w: 1, h: 1 }, world).bl).toBe(false)
    expect(cornerRadii({ r: 6, c: 5, w: 1, h: 1 }, world).tl).toBe(false)
  })
})

describe('dominantNeighbor', () => {
  it('returns the most common surrounding color', () => {
    const world = (r, c) => (r === 4 ? '#aa0000' : c === 4 ? '#00aa00' : null)
    expect(dominantNeighbor({ r: 5, c: 5 }, world)).toBe('#aa0000')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false --testPathPattern=timelineModel`
Expected: FAIL — `Cannot find module './timelineModel'`

- [ ] **Step 3: Create the model (verbatim moves from Timeline.js, plus the generalized `cornerRadii`)**

```js
// frontend/webapp/src/views/Timeline/timelineModel.js
/** @format */
// Pure logic for the Timeline tile grid. No React, no DOM — everything here is
// unit-tested in timelineModel.test.js. Rendering lives in Timeline.js.

// A few source band colors don't render well on the parchment canvas.
export const BG_FIX = {
  '#fff2cc': '#e6cf8c', // post-Christ cream (revised again in Task 14)
  '#274e13': '#2f6f4f', // Nephite-kings green: too close to judges green
  '#6fa8dc': '#7d8596', // Gadianton blue: too close to Zeniff's blue
}
export const fixBg = (c) => (c && BG_FIX[c]) || c

// Black/white ink for legibility over a band color.
export function textOn(bg) {
  if (!bg) return '#222'
  const h = bg.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#222' : '#fff'
}

const MINOR = new Set(['of', 'the', 'and', 'vs', 'in', 'to', 'a', 'for'])
export const humanize = (slug) =>
  (slug || '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\S+/g, (w, i) =>
      i > 0 && MINOR.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1)
    )

// "Land of Bountiful1" → "Land of Bountiful"; Roman numerals / book numbers kept.
export const cleanLabel = (s) => (s || '').replace(/([A-Za-z])\d+\b/g, '$1')

// Dominant surrounding color for a cell with no fill of its own (battle cells).
export function dominantNeighbor(t, colorAt) {
  const ns = [
    colorAt(t.r - 1, t.c), colorAt(t.r + 1, t.c),
    colorAt(t.r, t.c - 1), colorAt(t.r, t.c + 1),
    colorAt(t.r, t.c - 2), colorAt(t.r, t.c + 2),
  ].filter(Boolean)
  if (!ns.length) return null
  const count = {}
  let best = null, bestN = 0
  for (const c of ns) {
    count[c] = (count[c] || 0) + 1
    if (count[c] > bestN) { bestN = count[c]; best = c }
  }
  return best
}

// Corner rounding — RULE v2 (supersedes docs/reference/timeline-corner-rounding.md v1).
// Round a corner IFF all three neighbour cells at that corner (both orthogonals
// AND the diagonal) are empty parchment — a corner only rounds into fully open
// space. Rationale: v1 ("orthogonals ≠ own ∧ D empty") still rounds flush
// handoffs whose edges align exactly (other band on ONE orthogonal, diagonal
// empty) — a junction notch observed in the 2026-07-01 dev captures at
// band-join seams. CAUTION: v2 also squares the "band tip sliding alongside
// another band" case that v1 deliberately rounded per KC (corner doc v1,
// "consequences" §3) — this trade is KC-GATED at the Task 4 visual review.
// Ribbon ends and true protrusions into open space still round under v2.
export function cornerRadii(rect, colorAt) {
  const top = rect.r, left = rect.c
  const right = rect.c + (rect.w || 1) - 1
  const bottom = rect.r + (rect.h || 1) - 1
  const round = (oh, ov, od) => oh === null && ov === null && od === null
  return {
    tl: round(colorAt(top, left - 1), colorAt(top - 1, left), colorAt(top - 1, left - 1)),
    tr: round(colorAt(top, right + 1), colorAt(top - 1, right), colorAt(top - 1, right + 1)),
    bl: round(colorAt(bottom, left - 1), colorAt(bottom + 1, left), colorAt(bottom + 1, left - 1)),
    br: round(colorAt(bottom, right + 1), colorAt(bottom + 1, right), colorAt(bottom + 1, right + 1)),
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false --testPathPattern=timelineModel`
Expected: PASS (all 4 describes)

- [ ] **Step 5: Rewire `Timeline.js`**

Delete the moved definitions (`MINOR`, `humanize`, `BG_FIX`, `fixBg`, `cleanLabel`, `textOn`, `cornerStyle`, `dominantNeighbor`) and add:

```js
import {
  fixBg, textOn, humanize, cleanLabel, cornerRadii, dominantNeighbor,
} from './timelineModel'

const RAD = `var(--rad)`
// Thin adapter: cornerStyle(t, colorAt) keeps the existing call sites working.
function cornerStyle(t, colorAt) {
  const k = cornerRadii(t, colorAt)
  if (!(k.tl || k.tr || k.bl || k.br)) return undefined
  return {
    borderTopLeftRadius: k.tl ? RAD : 0,
    borderTopRightRadius: k.tr ? RAD : 0,
    borderBottomLeftRadius: k.bl ? RAD : 0,
    borderBottomRightRadius: k.br ? RAD : 0,
  }
}
```

- [ ] **Step 6: Verify the app still renders identically**

Run: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8201/timeline` → `200`; then eyeball `http://localhost:8201/timeline` in a browser or via the Task 3 harness once it exists. CRA compiles with no errors in `journalctl --user -u bom-dev -n 50`.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Timeline/timelineModel.js \
        frontend/webapp/src/views/Timeline/timelineModel.test.js \
        frontend/webapp/src/views/Timeline/Timeline.js
git commit -m "refactor(timeline): extract pure grid logic into tested timelineModel"
```

---

## Phase 2 — Unified layer compositor (audit §3.2, P0a)

### Task 2: `buildComposite` — one occupancy model for fills, bars, battles

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js`
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.test.js`

The compositor replaces `Timeline.js`'s fill-only `useMemo` occupancy block (lines ~316–394). Layers, bottom→top: **BAND** (canvas `k:'fill'`) < **BAR** (API event tiles + canvas event tiles with a bg) < battle tab < marker < label.

- [ ] **Step 1: Write the failing tests**

Append to `timelineModel.test.js`:

```js
import { buildComposite, battleCellPaint } from './timelineModel'

describe('buildComposite', () => {
  const tilesData = {
    rows: 10, cols: 10,
    tiles: [
      { r: 2, c: 2, w: 3, h: 3, k: 'fill', bg: '#111111' },   // band A
      { r: 5, c: 2, w: 3, h: 1, k: 'fill', bg: '#222222' },   // band B below A
      { r: 3, c: 6, w: 1, h: 1, k: 'battle', bg: '#333333' }, // battle in open space next to bar
      { r: 2, c: 3, w: 1, h: 1, k: 'battle', bg: '#444444' }, // battle ON band A (incursion)
    ],
  }
  const events = [
    // API bar crossing open parchment at row 3, cols 5..8
    { slug: 'exp', p: true, grid: { row: 3, col: 5, rowSpan: 1, colSpan: 4, bg: '#555555' } },
  ]
  const comp = buildComposite(tilesData, events)

  it('stamps band and bar layers separately', () => {
    expect(comp.fillAt(2, 2)).toBe('#111111')
    expect(comp.barAt(3, 6)).toBe('#555555')
    expect(comp.fillAt(3, 6)).toBe(null)
  })
  it('battle on an API bar takes the BAR as territory (not parchment)', () => {
    const b = comp.battleFor({ r: 3, c: 6 })
    expect(b.territory).toBe('#555555')
    expect(b.incursion).toBe(true) // attacker #333333 ≠ territory #555555
  })
  it('battle cell over an existing surface paints NO background of its own', () => {
    expect(battleCellPaint(comp, { r: 3, c: 6 })).toBe(null)  // bar beneath
    expect(battleCellPaint(comp, { r: 2, c: 3 })).toBe(null)  // band beneath
  })
  it('battle in a genuine band-edge notch paints the inferred territory', () => {
    // battle at (2,5): outside band A (cols 2..4) but adjacent — no surface beneath
    const t2 = { ...tilesData, tiles: [...tilesData.tiles, { r: 2, c: 5, w: 1, h: 1, k: 'battle', bg: '#999999' }] }
    const c2 = buildComposite(t2, [])
    expect(battleCellPaint(c2, { r: 2, c: 5 })).toBe('#111111')
  })
  it('bandAt folds battle cells into the band so corners stay continuous', () => {
    expect(comp.bandAt(2, 3)).toBe('#111111')
  })
  it('stacked bands stay flush (junction square) via bandAt', () => {
    // BL corner of band A: band B abuts the bottom edge → junction → square
    expect(cornerRadii({ r: 2, c: 2, w: 3, h: 3 }, comp.bandAt).bl).toBe(false)
  })
  it('fills enclosed single-color holes', () => {
    const t3 = {
      rows: 6, cols: 6,
      tiles: [
        // ring of #111111 around an empty center at (3,3)
        { r: 2, c: 2, w: 3, h: 1, k: 'fill', bg: '#111111' },
        { r: 4, c: 2, w: 3, h: 1, k: 'fill', bg: '#111111' },
        { r: 3, c: 2, w: 1, h: 1, k: 'fill', bg: '#111111' },
        { r: 3, c: 4, w: 1, h: 1, k: 'fill', bg: '#111111' },
      ],
    }
    const c3 = buildComposite(t3, [])
    expect(c3.holePatches).toEqual([{ r: 3, c: 3, bg: '#111111' }])
    expect(c3.bandAt(3, 3)).toBe('#111111')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false --testPathPattern=timelineModel`
Expected: FAIL — `buildComposite is not a function`

- [ ] **Step 3: Implement in `timelineModel.js`**

```js
const stamp = (map, r0, c0, w, h, bg) => {
  for (let dr = 0; dr < (h || 1); dr++)
    for (let dc = 0; dc < (w || 1); dc++) map.set(`${r0 + dr},${c0 + dc}`, bg)
}

// ONE occupancy model for every colored layer. Rendering + corner logic + battle
// territory + label contrast all consume this — no layer guesses what's behind it.
// Layers bottom→top: BAND (canvas fills) < BAR (event tiles) < tab < marker < label.
export function buildComposite(tilesData, events) {
  const { rows, cols, tiles } = tilesData
  const band = new Map()
  const bar = new Map()
  for (const t of tiles) {
    if (t.k === 'fill' && t.bg !== '#ffffff') stamp(band, t.r, t.c, t.w, t.h, t.bg)
    // future-proofing: no k:'event' canvas tiles exist in today's data
    // (fill/battle/place only) — this line is inert until one is authored
    if (t.k === 'event' && t.bg) stamp(bar, t.r, t.c, t.w, t.h, t.bg)
  }
  for (const e of events || []) {
    if (!e.grid || !e.p || !e.grid.bg) continue
    stamp(bar, e.grid.row, e.grid.col, e.grid.colSpan, e.grid.rowSpan, e.grid.bg)
  }
  const fillAt = (r, c) => band.get(`${r},${c}`) || null
  const barAt = (r, c) => bar.get(`${r},${c}`) || null
  const surfaceAt = (r, c) => barAt(r, c) || fillAt(r, c)

  // Battle territory = what is genuinely beneath the cell (bar first, then band),
  // falling back to the dominant neighbour only for band-edge notch cells.
  const battles = new Map()
  const combined = new Map(band)
  for (const t of tiles) {
    if (t.k !== 'battle') continue
    const beneath = surfaceAt(t.r, t.c)
    const territory = beneath || dominantNeighbor(t, surfaceAt)
    battles.set(`${t.r},${t.c}`, {
      territory,
      attacker: t.bg || null,
      incursion: !!(territory && t.bg && territory !== t.bg),
      hasSurface: !!beneath,
    })
    if (territory) combined.set(`${t.r},${t.c}`, territory)
  }

  // Enclosed single-color holes → patch to the band color (no parchment notches
  // inside a band; also stops corner logic rounding into the hole).
  const isEmpty = (r, c) => !combined.has(`${r},${c}`)
  const outside = new Set()
  const st = []
  for (let c = 0; c <= cols + 1; c++) st.push([0, c], [rows + 1, c])
  for (let r = 0; r <= rows + 1; r++) st.push([r, 0], [r, cols + 1])
  while (st.length) {
    const [r, c] = st.pop()
    if (r < 0 || r > rows + 1 || c < 0 || c > cols + 1) continue
    const k = `${r},${c}`
    if (outside.has(k) || !isEmpty(r, c)) continue
    outside.add(k)
    st.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1])
  }
  const holePatches = []
  const seen = new Set()
  for (let r = 1; r <= rows; r++)
    for (let c = 1; c <= cols; c++) {
      const k = `${r},${c}`
      if (!isEmpty(r, c) || outside.has(k) || seen.has(k)) continue
      const comp = []
      const colors = new Set()
      const q = [[r, c]]
      seen.add(k)
      while (q.length) {
        const [rr, cc] = q.pop()
        comp.push([rr, cc])
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = rr + dr, nc = cc + dc, nk = `${nr},${nc}`
          const nv = combined.get(nk)
          if (nv) colors.add(nv)
          else if (isEmpty(nr, nc) && !outside.has(nk) && !seen.has(nk)) {
            seen.add(nk)
            q.push([nr, nc])
          }
        }
      }
      if (colors.size === 1) {
        const col = [...colors][0]
        for (const [rr, cc] of comp) {
          combined.set(`${rr},${cc}`, col)
          holePatches.push({ r: rr, c: cc, bg: col })
        }
      }
    }

  return {
    fillAt,
    barAt,
    surfaceAt,
    bandAt: (r, c) => combined.get(`${r},${c}`) || null,
    battleFor: (t) =>
      battles.get(`${t.r},${t.c}`) ||
      { territory: t.bg || null, attacker: t.bg || null, incursion: false, hasSurface: false },
    holePatches,
  }
}

// What background (if any) a battle CELL should paint. null = paint nothing —
// the surface beneath (band fill or event bar) already provides the territory.
// Only a genuine band-edge notch (no surface beneath) gets the inferred color,
// which keeps the band silhouette continuous under the marker.
export function battleCellPaint(comp, t) {
  const b = comp.battleFor(t)
  return b.hasSurface ? null : b.territory
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false --testPathPattern=timelineModel`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Timeline/timelineModel.js \
        frontend/webapp/src/views/Timeline/timelineModel.test.js
git commit -m "feat(timeline): unified layer compositor (bands+bars+battles, correct territory)"
```

### Task 3: Wire the compositor into `Timeline.js` + screenshot harness

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Create: `scripts/timeline-grid/screenshot.js`

- [ ] **Step 1: Replace the occupancy `useMemo` (lines ~316–394) with the compositor**

```js
// Unified occupancy/compositing model — see timelineModel.buildComposite.
// Depends on `timeline` (API bars are a layer) — rebuilds once data arrives.
const comp = useMemo(() => buildComposite(tilesData, timeline || []), [timeline])
const { bandAt, battleFor, holePatches } = comp
```

Import `buildComposite, battleCellPaint` from `./timelineModel`. Update `fillEls` deps (`[tiles, comp]`) and every `colorAt` call site to `bandAt` (fills/corners). The old `battleInfo` callers switch to `battleFor` — its `eff` is now named `territory`.

- [ ] **Step 2: Fix battle rendering — background-free layering**

Replace the battle branch inside the `marks.map` (both the `!layers.battles` early return and the marker return):

```js
if (t.k === 'battle') {
  const { incursion, territory, attacker } = battleFor(t)
  const paint = battleCellPaint(comp, t) // null when a real surface is beneath
  // Battles layer off: only a notch cell needs a territory patch to keep the
  // band continuous; cells over real surfaces render nothing at all.
  if (!layers.battles) {
    return paint ? (
      <div key={key} className="tg-fill" style={{ ...pos, background: fixBg(paint) }}
           data-lin={linKey(paint)} />
    ) : null
  }
  return (
    <div
      key={key}
      className={'tg-anchor tg-battle' + (incursion ? ' tg-battle-inc' : '')}
      style={paint ? { ...pos, background: fixBg(paint) } : pos}
      data-lin={territory ? linKey(territory) : undefined}
      role="img"
      aria-label="Battle"
      title="Battle"
    >
      {incursion && (
        <span
          className="tg-battle-tab"
          aria-hidden="true"
          data-lin={linKey(attacker)}
          style={{
            background: fixBg(attacker),
            borderTopRightRadius: RAD,
            borderBottomRightRadius: RAD,
          }}
        />
      )}
      <span className="tg-battle-medallion">{SWORDS}</span>
    </div>
  )
}
```

Key change vs. today: the cell's `background` is only set for notch cells (`paint`), so a battle sitting on an event bar or band **never paints parchment over it**, and the tab's rounded corners reveal the true surface beneath.

- [ ] **Step 3: Create the reusable screenshot harness**

```js
// scripts/timeline-grid/screenshot.js
// Usage: node scripts/timeline-grid/screenshot.js [--url http://localhost:8201/timeline] [--out /tmp/tl-verify]
// Captures: full tall canvas, three 2x detail strips, hover state, zoomed gutter.
const { chromium } = require(require('path').join(__dirname, '../../node_modules/playwright'))
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null)).filter(Boolean)
)
const URL = args.url || 'http://localhost:8201/timeline'
const OUT = args.out || '/tmp/tl-verify'
;(async () => {
  require('fs').mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const tall = await browser.newPage({ viewport: { width: 1600, height: 3000 } })
  await tall.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
  await tall.waitForTimeout(5000)
  await tall.screenshot({ path: `${OUT}/full.png` })
  await tall.close()
  const d = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })
  await d.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
  await d.waitForTimeout(5000)
  const sc = await d.$('.timeline-grid-scroller')
  for (const [name, frac] of [['strip1', 0], ['strip2', 0.5], ['strip3', 1]]) {
    await sc.evaluate((el, f) => { el.scrollTop = (el.scrollHeight - el.clientHeight) * f }, frac)
    await d.waitForTimeout(400)
    await d.screenshot({ path: `${OUT}/${name}.png`, clip: await sc.boundingBox() })
  }
  const zin = await d.$('.tg-zoom button[aria-label="Zoom in"]')
  if (zin) { await zin.click(); await zin.click(); await zin.click(); await d.waitForTimeout(600) }
  await sc.evaluate((el) => { el.scrollTop = el.scrollHeight * 0.4; el.scrollLeft = 350 })
  await d.waitForTimeout(400)
  await d.screenshot({ path: `${OUT}/zoom-gutter.png`, clip: await sc.boundingBox() })
  await d.close()
  await browser.close()
  console.log('screenshots →', OUT)
})()
```

- [ ] **Step 4: Verify**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=timelineModel` (still green), then
`node scripts/timeline-grid/screenshot.js --out /tmp/tl-task3`.
Check in `strip*.png`: no battle cell paints a parchment square over anything;
incursion tabs reveal the true surface at their rounded corners. NOTE: in
today's data all 38 battle tiles sit on open parchment (none coincide with an
API bar or fill — verified 2026-07-01), so the battle-on-surface path is proven
by the unit tests now and exercised by real data only after Task 7's placements
land; the visual check here is "nothing regressed, notch cells still patch
territory".

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Timeline/Timeline.js scripts/timeline-grid/screenshot.js
git commit -m "feat(timeline): battles composite over real surfaces; screenshot harness"
```

### Task 4: Size-aware corner radius + event bars join the corner system

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (+ tests)
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`

- [ ] **Step 1: Write the failing tests**

```js
import { radiusFor, cornerStyleFor } from './timelineModel'

describe('radiusFor', () => {
  it('caps at the base radius for big tiles', () => expect(radiusFor(6, 4)).toBe(13))
  it('halves against the short side for thin bars', () => expect(radiusFor(4, 1)).toBe(10)) // h=1 → 20px/2
  it('handles 1×1', () => expect(radiusFor(1, 1)).toBe(10))
})

describe('cornerStyleFor', () => {
  const lone = (r, c) => (r === 5 && c === 5 ? '#111111' : null)
  it('emits scale-aware radii for rounded corners only', () => {
    const s = cornerStyleFor({ r: 5, c: 5, w: 1, h: 1 }, lone)
    expect(s.borderTopLeftRadius).toBe('calc(10px * var(--scale))')
  })
  it('returns undefined when no corner rounds', () => {
    const world = (r, c) => (r >= 4 && r <= 6 && c >= 4 && c <= 6 ? '#111111' : null)
    expect(cornerStyleFor({ r: 5, c: 5, w: 1, h: 1 }, world)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `radiusFor is not a function`.

- [ ] **Step 3: Implement**

```js
// Natural (scale-1) cell metrics — must match Timeline.css --col-w/--row-h.
export const COL_W = 26
export const ROW_H = 20
const RADIUS_BASE = 13

// Radius respects tile size: a 1-row bar gets a stadium cap (h/2), a 40-row
// band gets the base radius — prod's hand-drawn corners scaled the same way.
export const radiusFor = (w, h) =>
  Math.min(RADIUS_BASE, ((h || 1) * ROW_H) / 2, ((w || 1) * COL_W) / 2)

export function cornerStyleFor(rect, colorAt) {
  const k = cornerRadii(rect, colorAt)
  if (!(k.tl || k.tr || k.bl || k.br)) return undefined
  const rad = `calc(${radiusFor(rect.w, rect.h)}px * var(--scale))`
  return {
    borderTopLeftRadius: k.tl ? rad : 0,
    borderTopRightRadius: k.tr ? rad : 0,
    borderBottomLeftRadius: k.bl ? rad : 0,
    borderBottomRightRadius: k.br ? rad : 0,
  }
}
```

- [ ] **Step 4: Run tests to verify pass.**

- [ ] **Step 5: Consume in `Timeline.js` + record rule v2**

- Delete the Task 1 `cornerStyle` adapter and the `RAD` const for fills; fills use `cornerStyleFor(t, bandAt)`.
- Event bars (in `eventEls`): replace the flat CSS radius with composite-driven caps (add `comp` to the `eventEls` useMemo deps) —

```js
const rect = { r: g.row, c: g.col, w: g.colSpan, h: g.rowSpan }
const capStyle = bg ? cornerStyleFor(rect, comp.barAt) : undefined
const style = isPlace ? pos : { ...pos, background: bg || '#5a5a5a', color: tcol, ...capStyle }
```

- Update `docs/reference/timeline-corner-rounding.md`: add a "Rule v2 (2026-07)" section stating the new rule — *round a corner iff both orthogonals AND the diagonal are empty parchment* — and why v1 was insufficient (it rounded flush aligned-edge handoffs, producing the junction slivers in audit §3.2/§3.3; ribbon ends and true protrusions have all three cells empty, so they keep rounding).

(Rounded bar caps reveal whatever is genuinely beneath — band or parchment — which is now correct by construction.)
- Battle tabs: replace `borderTopRightRadius: RAD` with `calc(10px * var(--scale))` (1-cell tab → stadium cap).
- In `Timeline.css`, remove `border-radius: 4px` from `.tg-event`.

- [ ] **Step 6: Verify (KC GATE on rule v2)** — model tests green; `node scripts/timeline-grid/screenshot.js --out /tmp/tl-task4`; check migration bars now have stadium caps, large bands unchanged, no UI-button look. Then put before/after strips in front of KC: rule v2 kills the aligned-edge junction notches but ALSO squares band tips that slide alongside another band — a case corner-doc v1 rounded at KC's request. KC approves v2, or we add the alongside-tip exception, before proceeding.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): size-aware corner radii; event bars join the corner system"
```

---

## Phase 2b — Color tokens & themes (KC directive 2026-07-01)

> **Colors are tokens, not values.** Everything below and every LATER task that
> shows a hex in example code is implemented through this token layer — the hex
> literals in later snippets are shorthand for `var(--c-<token>)`.

### Task 4b: Semantic color schema + swappable theme swatches

**Spec:** `docs/reference/timeline-source-design-language.md` § "Colors are TOKENS".
Source-data hexes (`gridTiles.json` `bg`, `grid_bg`) become KEYS that resolve to
a semantic token; all painting goes through CSS custom properties declared once,
so whole themes flip by swapping one class. `BG_FIX` dissolves into the
parchment theme's swatch values.

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (+ tests)
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`

- [ ] **Step 1: Failing tests**

```js
import { tokenOf, bandVar } from './timelineModel'

describe('color tokens', () => {
  it('maps every source hex to its semantic token', () => {
    expect(tokenOf('#134f5c')).toBe('jaredites')
    expect(tokenOf('#351c75')).toBe('lehi')
    expect(tokenOf('#85200c')).toBe('lamanites')
    expect(tokenOf('#fff2cc')).toBe('unity')
    expect(tokenOf('#000000')).toBe('destruction')
  })
  it('passes unknown hexes through as-is (fallback paint)', () => {
    expect(tokenOf('#abcdef')).toBe(null)
    expect(bandVar('#abcdef')).toBe('#abcdef')
  })
  it('bandVar resolves known hexes to a css var with hex fallback', () => {
    expect(bandVar('#134f5c')).toBe('var(--c-jaredites, #134f5c)')
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement in the model**

```js
// ── Color tokens (KC: colors are tokens, not values) ─────────────────────────
// Source-data hexes are identity KEYS from the sheet; painting resolves through
// CSS vars so themes swap wholesale. Order/names mirror the legend.
export const COLOR_TOKENS = {
  '#134f5c': 'jaredites',
  '#351c75': 'lehi',
  '#1c4587': 'nephites',
  '#073763': 'nephilands',
  '#85200c': 'lamanites',
  '#3c78d8': 'zeniff',
  '#b45f06': 'alma',
  '#274e13': 'kings',
  '#bf9000': 'mulek',
  '#38761d': 'judges',
  '#6fa8dc': 'gadianton',
  '#000000': 'destruction',
  '#fff2cc': 'unity',
}
export const tokenOf = (hex) => COLOR_TOKENS[hex] || null
export const bandVar = (hex) => {
  const t = tokenOf(hex)
  return t ? `var(--c-${t}, ${hex})` : hex
}
```

- [ ] **Step 4: Run tests to verify pass.**

- [ ] **Step 5: Theme swatches in `Timeline.css` — schema up top, themes as classes**

```css
/* ══ COLOR SCHEMA — the only place swatch values live ══════════════════════
   Identity = semantic token. Data hexes resolve here via bandVar()/var().
   Default theme: parchment. Alternates swap the whole palette in one class. */
.timeline-grid-wrap {
  --c-jaredites: #134f5c;
  --c-lehi: #351c75;
  --c-nephites: #1c4587;
  --c-nephilands: #073763;
  --c-lamanites: #85200c;
  --c-zeniff: #3c78d8;
  --c-alma: #b45f06;
  --c-kings: #2f6f4f;      /* sheet #274e13 remapped for parchment (was BG_FIX) */
  --c-mulek: #bf9000;
  --c-judges: #38761d;
  --c-gadianton: #7d8596;  /* sheet #6fa8dc remapped for parchment (was BG_FIX) */
  --c-destruction: #000000;
  --c-unity: #c9c2b0;      /* gray family per source artwork (measures ~#8f9490
                              there); tuned lighter for parchment contrast —
                              adjust HERE only, at the Task 14 visual check */
  --canvas-bg: radial-gradient(140% 90% at 50% -10%, #f8f1dd 0%, #f0e6c8 52%, #e6d6b0 100%);
  --gutter-bg: #f0e6c8;
  --ink: #4a3a18;
}
/* dark theme = the legacy charcoal canvas; band swatches stay closer to sheet */
.timeline-grid-wrap.tg-theme-dark {
  --c-kings: #274e13;
  --c-gadianton: #6fa8dc;
  --c-unity: #b8b2a6;
  --canvas-bg: radial-gradient(140% 90% at 50% -10%, #35322e 0%, #2b2926 60%, #221f1c 100%);
  --gutter-bg: #2b2926;
  --ink: #d8cdb4;
}
```

Replace hardcoded uses: `.timeline-grid-wrap { background: var(--canvas-bg); }`,
`.tg-gutter-bg { background: var(--gutter-bg); }`, title/date colors → `var(--ink)`.

- [ ] **Step 6: Paint through tokens in `Timeline.js`**

- Every inline `background: fixBg(x)` becomes `background: bandVar(x)` (fills,
  hole patches, event bars, battle notch paint, battle tabs, legend swatches,
  statusbar swatch). `fixBg`/`BG_FIX` are deleted from the model once no caller
  remains (their remaps now live in the parchment theme's values above).
  Identity/comparison logic (compositor equality, `data-lin`, hover keys)
  keeps using the RAW sheet hex — only painting goes through `bandVar`.
- `textOn()` still needs a concrete hex per theme: give the model
  `export const TOKEN_TEXT = { dark: new Set(['unity']) }`-style override is NOT
  needed — instead call `textOn()` with the *parchment-theme resolved hex*
  (a `RESOLVED` map exported next to `COLOR_TOKENS`, parchment values as in the
  CSS block). Dark theme keeps the same ink choice per band (acceptable: band
  swatches stay in the same lightness family across themes by design).

```js
// parchment-theme resolved values, for contrast math only (must mirror the CSS)
export const RESOLVED = {
  '#274e13': '#2f6f4f',
  '#6fa8dc': '#7d8596',
  '#fff2cc': '#c9c2b0',
}
export const resolvedHex = (hex) => RESOLVED[hex] || hex
// call sites: textOn(resolvedHex(bg))
```

- Theme switcher: add `const [theme, setTheme] = useState('parchment')` and a
  third item in the existing Layers menu —

```jsx
<label className="tg-layers-item">
  <input type="checkbox" checked={theme === 'dark'}
    onChange={(e) => setTheme(e.target.checked ? 'dark' : 'parchment')} />
  <span className="tg-layers-text" aria-hidden="true">◐</span>
  Dark canvas
</label>
```

with `className={'timeline-grid-wrap' + (theme === 'dark' ? ' tg-theme-dark' : '')}`
on the root div.

- [ ] **Step 6b: Rewrite `LINEAGES` to sheet-hex keys + delete `fixBg` legacy**

`LINEAGES` (`Timeline.js:120-133`) currently stores PRE-remapped hexes
(`'#2f6f4f'`, `'#e6cf8c'`, `'#7d8596'`) and the legend paints them raw
(`Timeline.js:576` `style={{ background: l.c }}`) — it would never theme.
Rewrite each entry to its SHEET hex (`'#274e13'`, `'#fff2cc'`, `'#6fa8dc'`, …)
and paint through the token layer:

```jsx
<span className="tg-key-sw" style={{ background: bandVar(l.c) }} aria-hidden="true" />
```

Same for the statusbar swatch (`bandVar('#' + hoverLin)`). In the SAME commit:
delete `BG_FIX`/`fixBg` from the model AND delete/replace the Task 1 `fixBg`
test block with `RESOLVED`/`resolvedHex` tests — the suite must never contain
tests for a deleted function:

```js
it('resolvedHex mirrors the parchment theme for contrast math', () => {
  expect(resolvedHex('#fff2cc')).toBe('#c9c2b0')
  expect(resolvedHex('#134f5c')).toBe('#134f5c')
})
```

- [ ] **Step 7: Verify** — model tests green; parchment theme renders visually
identical to before EXCEPT the post-Christ band (deliberately silver-gray now —
the one intended change); toggling "Dark canvas" flips the whole canvas to
charcoal with bands/gutter/ink following; `data-hover` band highlighting and the
legend/statusbar swatches stay correct in BOTH themes (identity keys unchanged).

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): semantic color tokens + swappable theme swatches"
```

---

## Phase 3 — Content parity (audit §3.1, P0b)

### Task 5: `bind_battles.py` — draft battle↔slug binding

**Files:**
- Create: `scripts/timeline-grid/bind_battles.py`
- Create (generated, then human-reviewed): `frontend/webapp/src/views/Timeline/battleSlugs.json`

- [ ] **Step 1: Write the matcher script**

```python
#!/usr/bin/env python3
"""Draft-match canvas battle tiles (gridTiles.json k='battle') to bom_timeline
slugs, so battles become clickable (audit §3.1). Emits a DRAFT mapping +
report; a human reviews/edits the draft, then saves it as battleSlugs.json.

Usage: python3 scripts/timeline-grid/bind_battles.py \
    [--api http://localhost:5006/graphql] [--outdir scripts/timeline-grid]
"""
import argparse, json, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TILES = ROOT / "frontend/webapp/src/views/Timeline/gridTiles.json"
BATTLE_RE = re.compile(
    r"battle|attack|war|-vs-|siege|assault|conflict|massacre|raid|army|invasion|destruction",
    re.I,
)

def year_of(date_str):
    # Handles both DB dates ("326 AD", "590 BC") and axis decade ticks with the
    # suffix-s form ("30s AD", "385s AD", "~3100 BC") — the era must be searched
    # AFTER the optional 's', or every AD tick silently defaults to BC and the
    # whole post-Christ era becomes unmatchable.
    m = re.search(r"(\d+)s?\s*(BC|AD)", date_str or "", re.I)
    if not m:
        m = re.search(r"(\d+)", date_str or "")
        if not m:
            return None
        return -int(m.group(1))  # era-less: assume BC (dominant in this data)
    n = int(m.group(1))
    return -n if m.group(2).upper() == "BC" else n

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:5006/graphql")
    ap.add_argument("--outdir", default=str(ROOT / "scripts/timeline-grid"))
    args = ap.parse_args()

    tiles = json.loads(TILES.read_text())
    battles = [t for t in tiles["tiles"] if t.get("k") == "battle"]

    # Row → year via linear interpolation between dateAxis ticks.
    axis = sorted(
        [(d["r"], year_of(d["t"])) for d in tiles.get("dateAxis", []) if year_of(d["t"]) is not None]
    )
    def row_year(r):
        prev = next((a for a in reversed(axis) if a[0] <= r), axis[0])
        nxt = next((a for a in axis if a[0] > r), axis[-1])
        if nxt[0] == prev[0]:
            return prev[1]
        return prev[1] + (nxt[1] - prev[1]) * (r - prev[0]) / (nxt[0] - prev[0])

    q = '{"query":"{timeline{slug p heading date html grid{row col}}}"}'
    req = urllib.request.Request(args.api, q.encode(), {"Content-Type": "application/json"})
    rows = json.loads(urllib.request.urlopen(req).read())["data"]["timeline"]
    cands = [
        r for r in rows
        if r["p"] and not r.get("grid") and BATTLE_RE.search(r["slug"] + " " + (r.get("heading") or ""))
    ]

    # Greedy nearest-year assignment, one slug per tile.
    scored = []
    for b in battles:
        by = row_year(b["r"])
        for c in cands:
            cy = year_of(c.get("date"))
            if cy is None:
                continue
            scored.append((abs(by - cy), f'{b["r"]},{b["c"]}', c["slug"]))
    scored.sort()
    mapping, used_tiles, used_slugs = {}, set(), set()
    for dist, key, slug in scored:
        if key in used_tiles or slug in used_slugs or dist > 15:
            continue
        mapping[key] = slug
        used_tiles.add(key)
        used_slugs.add(slug)

    outdir = Path(args.outdir)
    (outdir / "battleSlugs.draft.json").write_text(json.dumps(mapping, indent=1, sort_keys=True) + "\n")
    unmatched_tiles = [f'{b["r"]},{b["c"]}' for b in battles if f'{b["r"]},{b["c"]}' not in mapping]
    unmatched_slugs = sorted({c["slug"] for c in cands} - used_slugs)
    report = [
        f"battle tiles: {len(battles)}  candidate slugs: {len(cands)}  matched: {len(mapping)}",
        f"UNMATCHED TILES ({len(unmatched_tiles)}): {', '.join(unmatched_tiles)}",
        f"UNMATCHED SLUGS ({len(unmatched_slugs)}): {', '.join(unmatched_slugs)}",
    ]
    (outdir / "battle-binding-report.md").write_text("\n\n".join(report) + "\n")
    print("\n".join(report))

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python3 scripts/timeline-grid/bind_battles.py`
Expected: prints counts; writes `battleSlugs.draft.json` + `battle-binding-report.md` under `scripts/timeline-grid/`.

- [ ] **Step 3: HUMAN GATE — review the draft**

Review every `"r,c": slug` pair against the prod timeline (headings/dates in `docs/audits/2026-07-01-timeline-grid-unplaced-rows.md`). Correct mismatches, then save the approved mapping to `frontend/webapp/src/views/Timeline/battleSlugs.json`. Tiles with no confident slug stay OUT of the file (they remain decorative until data exists).

- [ ] **Step 4: Commit**

```bash
git add scripts/timeline-grid/bind_battles.py scripts/timeline-grid/battle-binding-report.md \
        frontend/webapp/src/views/Timeline/battleSlugs.json
git commit -m "feat(timeline): battle tile → slug binding (draft matcher + reviewed mapping)"
```

### Task 6: Clickable battles

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`

- [ ] **Step 1: Bind slugs at render**

At the top of `Timeline.js`:

```js
import battleSlugs from './battleSlugs.json'
```

In the battle branch (from Task 3), after computing `paint`:

```js
const slug = battleSlugs[`${t.r},${t.c}`] || null
const data = slug ? bySlug[slug] : null
const clickable = !!(data && (data.heading || data.html))
const battleLabel = clickable
  ? `Battle: ${cleanLabel(data.heading) || humanize(slug)}${data.date ? `, ${data.date}` : ''}`
  : 'Battle'
```

Render a `<button>` when clickable (same layered children — tab + medallion), `<div role="img">` otherwise:

```js
const Cell = clickable ? 'button' : 'div'
return (
  <Cell
    key={key}
    {...(clickable
      ? { type: 'button', onClick: () => openInfo(slug), 'aria-label': battleLabel,
          ref: (n) => { if (n) cellRefs.current[slug] = n } }
      : { role: 'img', 'aria-label': 'Battle' })}
    className={
      'tg-anchor tg-battle' + (incursion ? ' tg-battle-inc' : '') +
      (clickable ? ' is-clickable' : '') + (selected === slug ? ' is-selected' : '')
    }
    style={paint ? { ...pos, background: bandVar(paint) } : pos}
    data-lin={territory ? linKey(territory) : undefined}
    title={battleLabel}
  >
    {incursion && (
      <span className="tg-battle-tab" aria-hidden="true" data-lin={linKey(attacker)}
        style={{ background: bandVar(attacker),
                 borderTopRightRadius: 'calc(10px * var(--scale))',
                 borderBottomRightRadius: 'calc(10px * var(--scale))' }} />
    )}
    <span className="tg-battle-medallion">{SWORDS}</span>
  </Cell>
)
```

(paint through `bandVar` — `fixBg` no longer exists after Task 4b)

- [ ] **Step 2: CSS affordance**

```css
/* battle cells render as <button> when bound — reset UA chrome like tg-event */
.tg-battle {
  margin: 0;
  border: none;
  background: none;
  font: inherit;
  appearance: none;
  padding: 0;
}
/* clickable battles: medallion lifts on hover/focus */
.tg-battle.is-clickable { pointer-events: auto; cursor: pointer; }
.tg-battle.is-clickable:hover .tg-battle-medallion,
.tg-battle.is-clickable:focus-visible .tg-battle-medallion {
  transform: scale(1.18);
  box-shadow: 0 2px 6px rgba(60, 28, 8, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}
.tg-battle-medallion { transition: transform 0.12s ease, box-shadow 0.12s ease; }
```

- [ ] **Step 3: Verify** — on `localhost:8201/timeline`, click a bound battle → URL becomes `/timeline/<slug>` and the info surface opens with heading/art; unbound battles keep the plain "Battle" tooltip. Keyboard: Tab reaches bound battles, Enter opens.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): battles with bound slugs are clickable content"
```

### Task 7: Placement backlog SQL (workspace hand-off)

**Files:**
- Create: `scripts/timeline-grid/gen_battle_placements.py`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js` (reconciliation — Step 0)
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (reconciliation)
- Output artifact: `scripts/timeline-grid/2026-07-XX_bom_timeline_battle_placements.sql`

**Reconciliation policy (MANDATORY, ships BEFORE the SQL is applied):** once a
battle row gains a grid placement, it would (a) render a duplicate API event
chip on top of its canvas battle tile, and (b) stamp the bar layer at the
battle's own cell, making `battleFor` see `territory === attacker` — killing
every incursion tab. Both are prevented by treating `battleSlugs.json` as the
single renderer for bound slugs:

- [ ] **Step 0: Suppress bound battle rows in the event pipeline**

In `timelineModel.js`:

```js
import battleSlugs from './battleSlugs.json'
// Slugs whose renderer is the canvas battle tile — the API row provides content
// (heading/html/date) but must NOT render an event chip or stamp the bar layer.
export const BATTLE_BOUND = new Set(Object.values(battleSlugs))
```

In `buildComposite`, skip them when stamping bars:

```js
    if (!e.grid || !e.p || !e.grid.bg || BATTLE_BOUND.has(e.slug)) continue
```

In `Timeline.js` `eventEls`, extend the filter:

```js
      .filter((e) => e.grid && e.slug && !BATTLE_BOUND.has(e.slug))
```

Add a model test: a bound slug's event is absent from `barAt` even with a grid
placement (assert `comp.barAt(row, col)` is null for a placement whose slug is
in `BATTLE_BOUND`).

- [ ] **Step 1: Write the generator**

```python
#!/usr/bin/env python3
"""Emit UPDATE statements giving bound battle rows a grid placement (1×1 at the
tile cell, bg = attacker color). Apply via BoMOnlineWorkspace/sql/migrations —
the dev DB user here is read-only. Idempotent: only touches rows with
grid_row IS NULL."""
import json, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
tiles = {
    f'{t["r"]},{t["c"]}': t
    for t in json.loads((ROOT / "frontend/webapp/src/views/Timeline/gridTiles.json").read_text())["tiles"]
    if t.get("k") == "battle"
}
mapping = json.loads((ROOT / "frontend/webapp/src/views/Timeline/battleSlugs.json").read_text())
out = ["-- battle placements from battleSlugs.json (gen_battle_placements.py)",
       "-- Apply to bom_prd via BoMOnlineWorkspace. Idempotent (grid_row IS NULL guard).",
       "-- PRECONDITION: the frontend BATTLE_BOUND suppression (plan Task 7 Step 0)",
       "-- must be deployed FIRST, or these rows render duplicate chips and kill",
       "-- incursion detection. ROLLBACK: the paired _rollback.sql below."]
rollback = ["-- rollback: clear the battle placements applied by the paired file"]
for key, slug in sorted(mapping.items()):
    t = tiles.get(key)
    if not t:
        raise SystemExit(f"mapping key {key} has no battle tile")
    r, c = key.split(",")
    bg = t.get("bg") or ""
    out.append(
        "UPDATE bom_timeline SET "
        f"grid_row={r}, grid_col={c}, grid_w=1, grid_h=1, grid_bg='{bg}', "
        f"label_category='event' WHERE slug='{slug}' AND grid_row IS NULL LIMIT 1;"
        # LIMIT 1: prod has 5 duplicated slugs (audit §3.1); place only one row
    )
    rollback.append(
        "UPDATE bom_timeline SET grid_row=NULL, grid_col=NULL, grid_w=NULL, "
        f"grid_h=NULL, grid_bg=NULL WHERE slug='{slug}' AND grid_row={r} AND grid_col={c};"
    )
stamp = datetime.date.today().isoformat()
dest = ROOT / "scripts/timeline-grid" / f"{stamp}_bom_timeline_battle_placements.sql"
dest.write_text("\n".join(out) + "\n")
(dest.with_name(dest.stem + "_rollback.sql")).write_text("\n".join(rollback) + "\n")
print(f"{len(mapping)} updates → {dest} (+ rollback)")
```

- [ ] **Step 2: Run it** — `python3 scripts/timeline-grid/gen_battle_placements.py`; inspect the SQL.

- [ ] **Step 3: HUMAN GATE — apply + residue triage**

Hand the `.sql` to KC for application via `BoMOnlineWorkspace/sql/migrations/` (prod `bom_prd`, same process as the 2026-06-13 grid migrations). Then re-run the audit diff to size the residue:

```bash
curl -s http://localhost:5006/graphql -H 'Content-Type: application/json' \
  --data-raw '{"query":"{timeline{slug grid{row}}}"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['data']['timeline']; print('unplaced:', sorted(t['slug'] for t in d if not t['grid']))"
```

Non-battle residue (`captain-moroni`, `arabia`, `jaredite-voyage`, …) is editorial: place each via `scripts/timeline-grid/overrides.json` + the existing workspace `gen_*.mjs` flow, or record it in `docs/reference/timeline-grid-handoff.md` as deliberately retired **with a reason**. Acceptance: the unplaced list is empty or every remaining slug has a written retirement reason.

- [ ] **Step 4: Commit**

```bash
git add scripts/timeline-grid/gen_battle_placements.py scripts/timeline-grid/*_battle_placements.sql
git commit -m "feat(timeline): battle placement SQL generator for workspace hand-off"
```

---

## Phase 4 — Label & icon design system (audit §3.5, P1a)

### Task 8: SVG icon set (`icons.js`)

**Files:**
- Create: `frontend/webapp/src/views/Timeline/icons.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js` (delete the inline `SWORDS`, import instead)

- [ ] **Step 1: Create the icon module**

```jsx
// frontend/webapp/src/views/Timeline/icons.js
/** @format */
// Inline SVG iconography for the Timeline. currentColor throughout so CSS themes
// them. NEVER use emoji for canvas iconography — emoji rendering varies per
// OS/browser (📍 renders as tofu in headless Chromium) and can't be themed.
import React from 'react'

export const SWORDS = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1="6" y1="18" x2="18" y2="6" />
      <line x1="18" y1="18" x2="6" y2="6" />
    </g>
    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <line x1="3.5" y1="13.5" x2="9" y2="19" />
      <line x1="15" y1="19" x2="20.5" y2="13.5" />
    </g>
  </svg>
)

export const PIN = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
      fill="currentColor"
    />
    <circle cx="12" cy="9" r="2.6" fill="#f7efd9" />
  </svg>
)

export const CHEV_L = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M14.5 4 7 12l7.5 8" fill="none" stroke="currentColor" strokeWidth="3.2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const CHEV_R = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9.5 4 17 12l-7.5 8" fill="none" stroke="currentColor" strokeWidth="3.2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
```

- [ ] **Step 2: Rewire** — in `Timeline.js` delete the inline `SWORDS` const (lines 13–31) and `import { SWORDS, PIN, CHEV_L, CHEV_R } from './icons'`. Replace both `📍` usages (`eventEls` place span and `marks.map` place inner, plus the legend `tg-key-pin`) with `<span className="tg-pin" aria-hidden="true">{PIN}</span>`.

- [ ] **Step 3: CSS for the pin**

```css
.tg-pin {
  display: inline-flex;
  width: calc(11px * var(--scale));
  height: calc(11px * var(--scale));
  flex: 0 0 auto;
  color: #8a6a2f; /* muted sepia — places are the QUIET layer (audit §2.3) */
}
.tg-pin svg { width: 100%; height: 100%; display: block; }
```

- [ ] **Step 4: Verify** — app compiles; pins render as sepia SVG teardrops at every former 📍 site (grid places, legend). Screenshot harness: no tofu ticks around place labels.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): SVG icon set replaces emoji (pin, chevrons, swords)"
```

### Task 9: Anchoring, content-sized chips, fallback chip color, place restyle

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (+ tests)
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`

- [ ] **Step 1: Write the failing tests**

```js
import { anchorOf, chipBg } from './timelineModel'

describe('anchorOf', () => {
  it('defaults to center (KC directive)', () =>
    expect(anchorOf({ grid: { row: 1, col: 1 } })).toBe('center'))
  it('honors an explicit anchor', () =>
    expect(anchorOf({ grid: { anchor: 'start' } })).toBe('start'))
  it('rejects unknown values back to center', () =>
    expect(anchorOf({ grid: { anchor: 'bogus' } })).toBe('center'))
})

describe('chipBg', () => {
  const comp = { surfaceAt: (r, c) => (r === 3 ? '#111111' : null) }
  it('uses the placement bg when present', () =>
    expect(chipBg({ row: 3, col: 1, bg: '#222222' }, comp)).toBe('#222222'))
  it('falls back to the surface beneath', () =>
    expect(chipBg({ row: 3, col: 1, bg: null }, comp)).toBe('#111111'))
  it('falls back to themed sepia ink, never grey', () =>
    expect(chipBg({ row: 9, col: 1, bg: null }, comp)).toBe('#6a5326'))
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement in the model**

```js
const ANCHORS = new Set(['center', 'start', 'end', 'above', 'below'])
// Label anchoring is a data param (bom_timeline.label_anchor). Default CENTER.
export const anchorOf = (e) => {
  const a = e && e.grid && e.grid.anchor
  return ANCHORS.has(a) ? a : 'center'
}

// Chip background for events with no grid_bg: the surface genuinely beneath the
// tile, else themed sepia ink. Never an off-palette grey.
export const chipBg = (g, comp) =>
  g.bg || comp.surfaceAt(g.row, g.col) || '#6a5326'
```

- [ ] **Step 4: Run tests to verify pass.**

- [ ] **Step 5: Renderer changes (`eventEls` in `Timeline.js`)**

```js
const anchor = anchorOf(e)
const rawBg = chipBg(g, comp)            // identity hex (sheet value or sepia fallback)
const bg = bandVar(rawBg)                // paint via the token layer (Task 4b)
const tcol = textOn(resolvedHex(rawBg))  // contrast math needs a concrete hex, never a var()
const cls =
  'tg-anchor ' + (isPlace ? 'tg-place' : 'tg-event') + ` tg-a-${anchor}` +
  (isPlace ? '' : tcol === '#fff' ? ' tg-on-dark' : ' tg-on-light') +
  (clickable ? ' is-clickable' : ' is-static') +
  (selected === e.slug ? ' is-selected' : '')
```

Apply the same `tg-a-*` class in the canvas `marks.map` place branch (canvas
places default to `above` — hardcode it there; the only canvas mark kinds are
`battle` and `place`, there are no canvas event tiles in today's data).

- [ ] **Step 6: CSS — anchors + content-sized chips + place restyle**

```css
/* Chips size to CONTENT, never clip text mid-word: the tile is the anchor area,
   the chip may exceed it symmetrically (center) or grow one way (start/end). */
.tg-event { width: max-content; min-width: 100%; }

/* Anchor variants — justify-self places the (possibly overflowing) chip within
   the grid area; text-align covers multi-line fallback. Default: CENTER. */
.tg-anchor.tg-a-center { justify-self: center; justify-content: center; text-align: center; }
.tg-anchor.tg-a-start  { justify-self: start;  justify-content: flex-start; text-align: left; }
.tg-anchor.tg-a-end    { justify-self: end;    justify-content: flex-end; text-align: right; }
/* above/below: captions that sit OUTSIDE the anchor row (places, band captions) */
.tg-anchor.tg-a-above  { transform: translateY(-100%); }
.tg-anchor.tg-a-below  { transform: translateY(100%); }

/* Places: prod's quiet caption layer — small, sepia, italic, single soft halo
   (the 4-way ±0.6px shadow left dirty ticks at glyph corners; see audit §3.5). */
.tg-place > span {
  font-family: 'Roboto Condensed', 'Arial Narrow', sans-serif;
  font-size: calc(10px * var(--scale));
  font-weight: 700;
  font-style: italic;
  color: #6d5423;
  text-shadow: 0 0 3px rgba(255, 250, 235, 0.9), 0 0 6px rgba(255, 250, 235, 0.7);
}
```

Also in `Timeline.css`: `.tg-event { padding: 0 6px; text-align: left; }` loses `text-align: left` (anchors own it now).

- [ ] **Step 7: Verify** — screenshot harness. Check: "The Great Tower" chip now wraps its full text (no mid-word background cut) and is a sepia chip, not grey; labels sit centered over their bars by default; place captions are quiet sepia, no red, no tofu, no corner ticks.

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): anchor param (center default), content-sized chips, quiet place captions"
```

### Task 10: Zoom LOD tiers

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (+ tests)
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`

- [ ] **Step 1: Write the failing tests**

```js
import { tierOf, tierVisible } from './timelineModel'

describe('LOD tiers', () => {
  it('defaults: events tier 2, places tier 3, explicit tier wins', () => {
    expect(tierOf({ p: true, grid: {} })).toBe(2)
    expect(tierOf({ p: false, grid: {} })).toBe(3)
    expect(tierOf({ p: true, grid: { tier: 1 } })).toBe(1)
  })
  it('tier 1 (band names) never hides; 2 hides <0.55; 3 hides <0.85', () => {
    expect(tierVisible(1, 0.2)).toBe(true)
    expect(tierVisible(2, 0.5)).toBe(false)
    expect(tierVisible(2, 0.6)).toBe(true)
    expect(tierVisible(3, 0.7)).toBe(false)
    expect(tierVisible(3, 0.9)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
// Zoom LOD: tier 1 = band/era names (always visible — the wayfinding layer),
// tier 2 = major events, tier 3 = detail (places, rosters). Data override via
// bom_timeline.grid_tier; defaults by kind.
export const TIER_MIN_SCALE = { 1: 0, 2: 0.55, 3: 0.85 }
export const tierOf = (e) =>
  (e && e.grid && e.grid.tier) || (e && e.p ? 2 : 3)
export const tierVisible = (tier, scale) =>
  scale >= (TIER_MIN_SCALE[tier] !== undefined ? TIER_MIN_SCALE[tier] : 0)
```

- [ ] **Step 4: Run tests to verify pass.**

- [ ] **Step 5: Renderer** — in `eventEls`, add `const tier = tierOf(e)` and `tg-tier-${tier}` +
(`tierVisible(tier, scale) ? '' : ' tg-lod-hidden'`) to `cls`; pass `scale` into the memo deps.
Canvas place tiles get `tg-tier-3` (canvas marks are only `battle`/`place` — no
canvas event tiles exist in the data). Remove the global
`LABEL_HIDE_BELOW`/`tg-compact` scale gate (keep `tg-compact` solely for the Labels layer toggle).

```css
.tg-lod-hidden .tg-event-label, .tg-lod-hidden > span { display: none; }
/* type ramp per tier: band names larger + serif (prod's display layer) */
.tg-tier-1 .tg-event-label {
  font-family: 'Nanum Myeongjo', Georgia, serif;
  font-size: calc(13px * var(--scale));
  letter-spacing: 0.5px;
}
.tg-tier-3 .tg-event-label { font-size: calc(10px * var(--scale)); font-weight: 600; }
/* hover ink chip only relieves DENSE layers — not tier-1 wayfinding labels */
.tg-tier-1.tg-event.is-clickable:hover .tg-event-label { background: none; box-shadow: none; padding: 0; margin: 0; }
```

- [ ] **Step 6: Verify** — zoom out on `localhost:8201/timeline`: places + detail vanish first, major events next, band names (once tier 1 data lands in Task 13) persist. Zoom in: tiers reappear.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): zoom LOD tiers replace binary label hiding"
```

### Task 11: Time-axis normalization + century rules

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (+ tests)
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`

- [ ] **Step 1: Write the failing tests**

```js
import { formatAxisTick, isCenturyTick } from './timelineModel'

describe('formatAxisTick', () => {
  it('strips the bogus plural from non-decades', () => {
    expect(formatAxisTick('545s BC')).toBe('545 BC')
    expect(formatAxisTick('75s BC')).toBe('75 BC')
  })
  it('keeps real decades/centuries and approximations', () => {
    expect(formatAxisTick('600s BC')).toBe('600s BC')
    expect(formatAxisTick('90s BC')).toBe('90s BC')
    expect(formatAxisTick('~3100 BC')).toBe('~3100 BC')
  })
  it('passes through anything unparsable', () => expect(formatAxisTick('AD 34')).toBe('AD 34'))
})

describe('isCenturyTick', () => {
  it('true only for century multiples', () => {
    expect(isCenturyTick('600s BC')).toBe(true)
    expect(isCenturyTick('90s BC')).toBe(false)
    expect(isCenturyTick('545s BC')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
// The source sheet glues a plural "s" onto arbitrary years ("545s BC"). Keep the
// s only for genuine decades/centuries; otherwise show the exact year.
export function formatAxisTick(t) {
  const m = /^(~?)(\d+)s? (BC|AD)$/.exec(t || '')
  if (!m) return t
  const n = +m[2]
  const isRange = /s /.test(t) && n % 10 === 0
  return `${m[1]}${n}${isRange ? 's' : ''} ${m[3]}`
}
export function isCenturyTick(t) {
  const m = /^~?(\d+)s? (BC|AD)$/.exec(t || '')
  return !!m && +m[1] % 100 === 0
}
```

- [ ] **Step 4: Run tests to verify pass.**

- [ ] **Step 5: Renderer** — in the `dateAxis.map`, render `formatAxisTick(d.t)`, and for century ticks add a full-width hairline so row=time stays legible across the parchment:

```jsx
{dateAxis.map((d) => (
  <React.Fragment key={`dt${d.r}`}>
    <div className="tg-date" style={{ gridColumn: 1, gridRow: `${d.r} / span 1` }}>
      {formatAxisTick(d.t)}
    </div>
    {isCenturyTick(d.t) && (
      <div className="tg-century-rule" aria-hidden="true"
           style={{ gridColumn: `2 / ${cols + 2}`, gridRow: `${d.r} / span 1` }} />
    )}
  </React.Fragment>
))}
```

```css
.tg-century-rule {
  align-self: start;
  height: 0;
  border-top: 1px dashed rgba(120, 90, 40, 0.16);
  pointer-events: none;
}
```

- [ ] **Step 6: Verify** — axis shows `545 BC`, `75 BC` (no bogus plurals); faint dashes at century rows sit BELOW bands visually (z default 0 vs fills' content order — confirm on screenshot; if they overpaint bands, add `z-index: 0` on the rule and `position: relative; z-index: 1` is already on fills' parent grid).

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): normalized axis ticks + century hairlines"
```

---

## Phase 5 — Data model: anchor / tier / dir end-to-end (audit §5)

### Task 12: DB columns + backend schema/resolver

**Files:**
- Create: `scripts/timeline-grid/2026-07-XX_bom_timeline_label_params.sql` (workspace hand-off)
- Modify: `backend/schema/BomPage.graphql` (EventGrid block, ~line 149)
- Modify: `backend/src/data/loaders/mediamisc.ts` (TimelineRow, after `label_category`)
- Modify: `backend/src/graphql/resolvers/mediamisc.ts` (Event.grid, ~line 152)
- Create: `backend/test/graphql/timeline-grid.test.ts`

- [ ] **Step 1: Author the migration SQL (HUMAN GATE — applied via BoMOnlineWorkspace)**

```sql
-- 2026-07-XX_bom_timeline_label_params.sql
-- Label/LOD params for the tile-grid timeline (audit §5). All nullable —
-- frontend defaults apply when NULL (anchor=center, tier by kind, no dir).
ALTER TABLE bom_timeline
  ADD COLUMN label_anchor ENUM('center','start','end','above','below') NULL DEFAULT NULL AFTER label_category,
  ADD COLUMN grid_tier TINYINT NULL DEFAULT NULL AFTER label_anchor,
  ADD COLUMN grid_dir ENUM('l','r') NULL DEFAULT NULL AFTER grid_tier;

-- Seed tier 1 (always-visible band names) for the main lineage-name rows.
-- Band-name rows are the people-category placements spanning wide/tall tiles;
-- seed the obvious set and refine editorially:
UPDATE bom_timeline SET grid_tier = 1 WHERE slug IN
  ('jaredites','lehite-family','nephites','lamanites','mulekites') AND grid_row IS NOT NULL;

-- Seed anchors: place rows (p=0) read as floating captions above their anchor
-- row, matching the source artwork's quiet-caption convention:
UPDATE bom_timeline SET label_anchor = 'above' WHERE p = 0 AND grid_row IS NOT NULL;

-- Seed movement direction for the known expedition/migration bars (starter set;
-- extend editorially — without ANY dir rows, the chevron mechanism ships dark):
UPDATE bom_timeline SET grid_dir = 'l' WHERE slug IN
  ('colonial-expedition','sons-of-mosiah') AND grid_row IS NOT NULL;
UPDATE bom_timeline SET grid_dir = 'r' WHERE slug IN
  ('ill-fated-expedition','limhis-explorers') AND grid_row IS NOT NULL;
-- (verify each slug exists first: SELECT slug FROM bom_timeline WHERE slug IN (…);
--  directions follow the source artwork's travel geometry — adjust on review)
```

The backend/frontend below tolerate the columns being absent (optional fields, null-safe reads), so code can merge and deploy BEFORE the DDL is applied.

- [ ] **Step 2: Write the failing backend test**

```ts
// backend/test/graphql/timeline-grid.test.ts
import { describe, expect, it } from 'vitest';
import { mediamiscResolvers } from '../../src/graphql/resolvers/mediamisc.js';

const grid = (mediamiscResolvers.Event as any).grid;

describe('Event.grid resolver', () => {
  it('maps grid_* including anchor/tier/dir', () => {
    expect(
      grid({
        grid_row: 5, grid_col: 3, grid_w: 2, grid_h: 1, grid_bg: '#123456',
        label_anchor: 'start', grid_tier: 1, grid_dir: 'r',
      })
    ).toEqual({
      row: 5, col: 3, rowSpan: 1, colSpan: 2, bg: '#123456',
      anchor: 'start', tier: 1, dir: 'r',
    });
  });
  it('nulls the new fields when columns are absent (pre-migration)', () => {
    expect(grid({ grid_row: 5, grid_col: 3, grid_w: 1, grid_h: 1, grid_bg: null }))
      .toEqual({ row: 5, col: 3, rowSpan: 1, colSpan: 1, bg: null, anchor: null, tier: null, dir: null });
  });
  it('returns null with no placement', () => {
    expect(grid({ grid_row: null })).toBeNull();
  });
});
```

Run: `cd backend && npx vitest run test/graphql/timeline-grid.test.ts` → FAIL (anchor undefined ≠ null).

- [ ] **Step 3: Schema** — in `backend/schema/BomPage.graphql`, extend `EventGrid`:

```graphql
type EventGrid {
  row: Int
  col: Int
  rowSpan: Int
  colSpan: Int
  bg: String
  """Label anchor within/around the tile: center|start|end|above|below. Null → center."""
  anchor: String
  """Zoom LOD tier: 1 band names (always visible) · 2 major · 3 detail. Null → by kind."""
  tier: Int
  """Movement direction for migration/expedition bars: l|r. Null → none."""
  dir: String
}
```

- [ ] **Step 4: Types + resolver**

`backend/src/data/loaders/mediamisc.ts` — extend `TimelineRow` (same optional-columns pattern as the grid_* comment there):

```ts
  label_anchor?: 'center' | 'start' | 'end' | 'above' | 'below' | null;
  grid_tier?: number | null;
  grid_dir?: 'l' | 'r' | null;
```

`backend/src/graphql/resolvers/mediamisc.ts` — `Event.grid` return becomes:

```ts
      return {
        row: t.grid_row,
        col: t.grid_col,
        rowSpan: t.grid_h,
        colSpan: t.grid_w,
        bg: t.grid_bg,
        anchor: t.label_anchor ?? null,
        tier: t.grid_tier ?? null,
        dir: t.grid_dir ?? null,
      };
```

- [ ] **Step 5: Regenerate resolver types + run tests**

```bash
cd backend && npm run codegen:graphql && npx vitest run test/graphql/timeline-grid.test.ts && npx tsc --noEmit
```

Expected: PASS + clean typecheck. (Skip `codegen:db` — grid_* columns intentionally are not in `codegen/db.d.ts`; the optional-field pattern covers them.)

- [ ] **Step 6: Restart + smoke**

```bash
systemctl --user restart bom-greenfield
curl -s http://localhost:5006/graphql -H 'Content-Type: application/json' \
  --data-raw '{"query":"{timeline{slug grid{row anchor tier dir}}}"}' | head -c 300
```

Expected: 200 with `anchor/tier/dir` keys (null until the DDL lands).

- [ ] **Step 7: Commit**

```bash
git add backend scripts/timeline-grid/*label_params.sql
git commit -m "feat(timeline): EventGrid anchor/tier/dir (schema, resolver, migration SQL)"
```

### Task 13: Frontend consumes anchor/tier/dir

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js:1028`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`

**Deploy-order warning (dev AND prod):** the backend must be serving the new
fields first (Task 12), or the whole `timeline` query errors → blank grid (the
handoff doc's "labels missing" failure). **PROD PRECONDITION:** the handoff doc
warns there are TWO backends; prod historically ran the legacy `src/` Apollo
server (now `_deprecated/src/`), which will never serve `anchor/tier/dir`. This
frontend change must NOT reach prod until prod is confirmed cut over to
`backend/` (or the same schema fields are added to whatever prod actually runs).
Verify with the team before any prod deploy that includes this commit.

- [ ] **Step 1: Query** — in `GraphQLQueries.js` line 1028:

```
        grid { row col rowSpan colSpan bg anchor tier dir }
```

- [ ] **Step 2: Chevrons from `dir`** — in `eventEls` inner span:

```jsx
const inner = isPlace ? (
  <span><span className="tg-pin" aria-hidden="true">{PIN}</span> {label}</span>
) : (
  <span className="tg-event-label">
    {g.dir === 'l' && <span className="tg-chev" aria-hidden="true">{CHEV_L}</span>}
    {label}
    {g.dir === 'r' && <span className="tg-chev" aria-hidden="true">{CHEV_R}</span>}
  </span>
)
```

```css
.tg-chev {
  display: inline-flex;
  width: calc(9px * var(--scale));
  height: calc(9px * var(--scale));
  vertical-align: -1px;
  margin: 0 2px;
}
.tg-chev svg { width: 100%; height: 100%; }
```

(`anchorOf`/`tierOf` from Tasks 9–10 already read `g.anchor`/`g.tier` — no further wiring.)

- [ ] **Step 3: Verify** — grid renders with data (`anchor/tier/dir` null-safe); after the DDL + seed land, band-name rows persist at min zoom and any seeded `dir` rows show chevrons.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/models/GraphQLQueries.js frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): query + render anchor/tier/dir (chevrons, LOD, anchors from DB)"
```

---

## Phase 6 — Fades & contrast (audit §3.4, P1b)

### Task 14: Opaque gutter, post-Christ band, light-band hairline

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (+ test tweak)
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js` (LINEAGES swatch)

- [ ] **Step 1: Gutter — bands must never bleed through**

```css
/* Continuous parchment backing for the sticky gutter. OPAQUE: band tiles
   scrolling beneath must never bleed through (the old 78%→transparent gradient
   smeared band colors into a brown smudge — audit §3.4). The soft edge is a
   shadow ON TOP of the solid backing instead. */
.tg-gutter-bg {
  position: sticky;
  left: 0;
  z-index: 7;
  background: var(--gutter-bg); /* opaque token (Task 4b) — themes follow */
  border-right: 1px solid rgba(120, 90, 40, 0.35);
  box-shadow: 4px 0 10px -4px rgba(70, 48, 16, 0.28);
}
```

- [ ] **Step 2: Post-Christ band** — verify the `--c-unity` token value (set to
`#c9c2b0` silver-gray in Task 4b's schema, per the source artwork — the sheet's
cream was a spreadsheet approximation; see
`docs/reference/timeline-source-design-language.md` region 12) reads as a BAND
against the parchment canvas in screenshots; tune the swatch in ONE place
(`Timeline.css` schema block + the model's `RESOLVED` map) if it doesn't.
`LINEAGES` legend renders through `bandVar('#fff2cc')`, so it follows automatically.

- [ ] **Step 3: Hairline for light bands on parchment**

```css
/* Light bands get a sepia hairline so their silhouette reads on parchment */
.tg-fill[data-lin='fff2cc'] { box-shadow: inset 0 0 0 1px rgba(120, 90, 40, 0.35); }
```

- [ ] **Step 4: Verify** — model tests green (updated expectation). Harness `zoom-gutter.png`: hard clean gutter edge, zero color smear. `full.png`: the post-Christ era clearly reads as a band; "Twelve Disciples"/"The People of Christ" sit ON something.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "fix(timeline): opaque gutter edge (no band smear); post-Christ band contrast"
```

---

## Phase 7 — Anchored speech-bubble popover (audit §3.8, P2a)

### Task 15: `TimelinePopover` replaces the centered modal (≥640px)

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (+ tests — placement math)
- Create: `frontend/webapp/src/views/Timeline/TimelinePopover.js`
- Create: `frontend/webapp/src/views/Timeline/TimelinePopover.test.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`

- [ ] **Step 1: Failing tests for the placement math (pure, in the model)**

```js
import { popoverPlace } from './timelineModel'

describe('popoverPlace', () => {
  const pop = { w: 340, h: 420 }
  const canvas = { w: 1200, h: 2600 }
  it('prefers the right side of the anchor', () => {
    const p = popoverPlace({ left: 100, top: 500, width: 60, height: 20 }, pop, canvas)
    expect(p.side).toBe('right')
    expect(p.left).toBe(100 + 60 + 14)
  })
  it('flips left when the right edge would overflow', () => {
    const p = popoverPlace({ left: 1000, top: 500, width: 60, height: 20 }, pop, canvas)
    expect(p.side).toBe('left')
    expect(p.left).toBe(1000 - 340 - 14)
  })
  it('clamps vertically inside the canvas', () => {
    const p = popoverPlace({ left: 100, top: 10, width: 60, height: 20 }, pop, canvas)
    expect(p.top).toBeGreaterThanOrEqual(8)
    const q = popoverPlace({ left: 100, top: 2590, width: 60, height: 20 }, pop, canvas)
    expect(q.top + pop.h).toBeLessThanOrEqual(canvas.h - 8)
  })
  it('reports the tail offset so it stays pointed at the anchor', () => {
    const p = popoverPlace({ left: 100, top: 10, width: 60, height: 20 }, pop, canvas)
    expect(p.tailTop).toBe(10 + 10 - p.top) // anchor mid-Y − popover top
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement in the model**

```js
// Google-Maps-style callout placement, all in grid-content coordinates.
// anchor: the tile's offset rect; pop: {w,h}; canvas: grid {w,h}.
export function popoverPlace(anchor, pop, canvas) {
  const GAP = 14, PAD = 8
  const rightLeft = anchor.left + anchor.width + GAP
  const side = rightLeft + pop.w <= canvas.w - PAD ? 'right' : 'left'
  const left = side === 'right' ? rightLeft : anchor.left - pop.w - GAP
  const midY = anchor.top + anchor.height / 2
  const top = Math.min(Math.max(midY - pop.h / 3, PAD), Math.max(PAD, canvas.h - pop.h - PAD))
  const tailTop = Math.min(Math.max(midY - top, 12), pop.h - 12)
  return { side, left: Math.max(PAD, left), top, tailTop }
}
```

- [ ] **Step 4: Run tests to verify pass.**

- [ ] **Step 5: The component (content identical to today's modal body)**

```jsx
// frontend/webapp/src/views/Timeline/TimelinePopover.js
/** @format */
import React from 'react'
import Parser from 'html-react-parser'
import { Link } from 'react-router-dom'
import { assetUrl } from 'src/models/BoMOnlineAPI'
import Loader from '../_Common/Loader'
import { cleanLabel } from './timelineModel'

// Anchored speech-bubble callout (replaces the centered modal on wide screens).
// Positioned by the parent in grid-content coordinates; the tail points at the
// anchor tile. Focus / Escape / URL behavior is owned by Timeline.js.
export default function TimelinePopover({ place, info, slug, loading, onClose, dialogRef, closeBtnRef }) {
  return (
    <div
      className={`tg-popover tg-popover-${place.side}`}
      style={{ left: place.left, top: place.top, '--tail-top': `${place.tailTop}px` }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-popover-title"
      ref={dialogRef}
    >
      <button className="tg-infobox-close" onClick={onClose} aria-label="Close" ref={closeBtnRef}>
        ×
      </button>
      {info ? (
        <>
          <div className="tg-infobox-head">
            <h2 id="tg-popover-title">{cleanLabel(info.heading) || slug}</h2>
            {info.date && <span className="tg-infobox-date">{info.date}</span>}
          </div>
          <div
            className="tg-infobox-art"
            role="img"
            aria-label={cleanLabel(info.heading) || slug}
            style={{ backgroundImage: `url(${assetUrl}/timeline/art/${info.slug})` }}
          />
          {info.html && <div className="tg-infobox-body">{Parser(info.html)}</div>}
          {info.text && info.text.slug && (
            <Link className="tg-infobox-link" to={`/${info.text.slug}`}>
              Read in the Book of Mormon →
            </Link>
          )}
        </>
      ) : (
        <div className="tg-infobox-loading">
          <h2 id="tg-popover-title">Loading…</h2>
          {loading && <Loader />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: RTL test**

```jsx
// frontend/webapp/src/views/Timeline/TimelinePopover.test.js
import React from 'react'
import '@testing-library/jest-dom' // no setupTests.js in this app — import per-file like the Search tests do
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TimelinePopover from './TimelinePopover'

const place = { side: 'right', left: 120, top: 300, tailTop: 40 }

it('renders heading, date and close control', () => {
  render(
    <MemoryRouter>
      <TimelinePopover
        place={place}
        slug="great-tower"
        info={{ heading: 'The Great Tower', date: '3100 BC', slug: 'great-tower', html: '<p>hi</p>' }}
        onClose={() => {}}
      />
    </MemoryRouter>
  )
  expect(screen.getByRole('dialog')).toHaveStyle({ left: '120px', top: '300px' })
  expect(screen.getByText('The Great Tower')).toBeInTheDocument()
  expect(screen.getByLabelText('Close')).toBeInTheDocument()
})
```

Run: `CI=true npm test -- --watchAll=false --testPathPattern=TimelinePopover` → PASS.

- [ ] **Step 7: Wire into `Timeline.js`**

- Placement is **state set from a layout effect** — NOT derived in the render
  body. Refs populate on commit, so a render-body read shows the wrong UI on
  direct `/timeline/<slug>` loads (refs are null during the data-arrival render
  and nothing re-renders until unrelated state changes):

```js
const [place, setPlace] = useState(null)
const isNarrow = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
useLayoutEffect(() => {
  if (!showModal || isNarrow()) return setPlace(null)
  const node = cellRefs.current[selected]
  const grid = document.getElementById('tg-grid')
  if (!node || !grid) return setPlace(null)
  setPlace(
    popoverPlace(
      { left: node.offsetLeft, top: node.offsetTop,
        width: node.offsetWidth, height: node.offsetHeight },
      { w: 340, h: 420 },
      { w: grid.scrollWidth, h: grid.scrollHeight }
    )
  )
  // timeline: refs exist only after data renders; scale: zoom moves the anchor
}, [showModal, selected, timeline, scale])
```

- Render the popover **inside** `#tg-grid` (it's `position: relative`), after `{eventEls}`:

```jsx
{place && (
  <TimelinePopover place={place} info={info} slug={selected} loading={loading}
    onClose={closeInfo} dialogRef={dialogRef} closeBtnRef={closeBtnRef} />
)}
```

- The existing modal JSX becomes the fallback: `{showModal && !place && ( …existing backdrop/modal… )}`.
- Set `aria-modal="true"` on the popover (it keeps the focus trap, so it IS
  modal in interaction terms — `aria-modal="false"` + trap would contradict).
- The focus/Escape effect (`Timeline.js:280-309`) keeps its `[showModal, closeInfo]`
  deps exactly — do NOT add `place` (a fresh object each set would re-fire
  `closeBtnRef.current.focus()` spuriously). Change only its body: apply the
  `document.body.style.overflow` lock **only when `isNarrow()`** (the popover
  must scroll WITH the canvas; the narrow modal keeps the lock).
- After `place` is set, keep the anchor AND popover on-screen: the existing
  `scrollIntoView` effect on `[markerSlug, timeline]` already centers the tile;
  that's sufficient (the popover sits within ±360px of it).
- Drop the `title=` attribute from clickable event/battle tiles (audit §3.9): with the popover, native tooltips triple up on the same text (`aria-label` still carries it for screen readers). Keep `title` on non-clickable tiles only.

- [ ] **Step 8: CSS**

```css
/* Anchored callout — parchment speech bubble with a tail toward the tile */
.tg-popover {
  position: absolute;
  z-index: 40;
  width: 340px;
  max-height: 440px;
  overflow: auto;
  background: linear-gradient(180deg, #fdf8ec 0%, #f7efd9 100%);
  border: 1px solid rgba(120, 90, 40, 0.35);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(40, 26, 8, 0.45);
  padding: 20px 20px 22px;
}
.tg-popover::before {
  content: '';
  position: absolute;
  top: var(--tail-top);
  width: 14px;
  height: 14px;
  transform: rotate(45deg);
  background: #fdf8ec;
  border: 1px solid rgba(120, 90, 40, 0.35);
}
.tg-popover-right::before { left: -8px; border-right: none; border-top: none; }
.tg-popover-left::before  { right: -8px; border-left: none; border-bottom: none; }
```

- [ ] **Step 9: Verify** — click events/battles across the canvas: bubble opens beside the tile (flips near the right edge, clamps at top/bottom, tail points at the tile), canvas stays visible and scrollable, Escape/close/Back all work, `scrollIntoView` still centers deep links (`/timeline/<slug>` direct load). Narrow window (<640px): old modal appears.

- [ ] **Step 10: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): anchored speech-bubble popover replaces centered modal"
```

---

## Phase 8 — Shape language: the source-artwork vocabulary (audit §3.6–3.7, P2b)

### Task 16: Shape tiles — bevel, gradient, fillet, fade + break glyph

**Spec:** `docs/reference/timeline-source-design-language.md` — the decoded
vocabulary of the original artwork. Four canvas-tile mechanisms (no DB changes):
**bevel** (diagonal drift/schism), **grad** (succession/assimilation dissolve),
**fillet** (concave inner elbows — the real fix for wedding-cake steps), and
**fade** (the record's end). Pilot sites are ranked by storytelling weight in
that doc; this task builds all four mechanisms and authors the top pilots.

**Files:**
- Modify: `frontend/webapp/src/views/Timeline/timelineModel.js` (+ tests)
- Modify: `frontend/webapp/src/views/Timeline/Timeline.js`
- Modify: `frontend/webapp/src/views/Timeline/Timeline.css`
- Modify: `frontend/webapp/src/views/Timeline/gridTiles.json` (hand-authored cells)

- [ ] **Step 1: Failing tests**

```js
import { BEVEL_CLIP, FILLET_BG, shapeTileStyle, buildComposite } from './timelineModel'

describe('shape tiles', () => {
  it('bevel: clip-path per right-angle corner', () => {
    expect(BEVEL_CLIP.tl).toBe('polygon(0 0, 100% 0, 0 100%)')
    expect(BEVEL_CLIP.br).toBe('polygon(100% 0, 100% 100%, 0 100%)')
  })
  it('fillet: paints the cell except a parchment quarter-ellipse at the open corner', () => {
    expect(FILLET_BG('tl', '#111111')).toBe(
      'radial-gradient(ellipse 100% 100% at 0% 0%, transparent calc(100% - 1px), #111111 100%)'
    )
  })
  it('grad + fade: linear-gradient styles by direction', () => {
    expect(shapeTileStyle({ k: 'grad', from: '#111111', to: '#222222', dir: 'v' }).background)
      .toBe('linear-gradient(180deg, #111111, #222222)')
    expect(shapeTileStyle({ k: 'fade', bg: '#111111', dir: 'v' }).background)
      .toBe('linear-gradient(180deg, #111111, transparent)')
  })
  it('all shape cells count as filled so neighbours stay square against them', () => {
    const comp = buildComposite({
      rows: 8, cols: 8,
      tiles: [
        { r: 3, c: 3, w: 1, h: 1, k: 'fill', bg: '#111111' },
        { r: 4, c: 4, w: 1, h: 1, k: 'bevel', dir: 'tl', bg: '#111111' },
        { r: 5, c: 4, w: 1, h: 1, k: 'grad', from: '#111111', to: '#222222', dir: 'v' },
        { r: 6, c: 4, w: 1, h: 1, k: 'fillet', dir: 'tl', bg: '#222222' },
        { r: 7, c: 4, w: 1, h: 1, k: 'fade', bg: '#222222', dir: 'v' },
      ],
    }, [])
    expect(comp.bandAt(4, 4)).toBe('#111111')
    expect(comp.bandAt(5, 4)).toBe('#111111') // grad stamps its `from` color
    expect(comp.bandAt(6, 4)).toBe('#222222')
    expect(comp.bandAt(7, 4)).toBe('#222222')
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — in the model:

```js
// ── Shape-language tiles (docs/reference/timeline-source-design-language.md) ──
// bevel: right triangle, right angle at the named corner (diagonal drift/schism)
export const BEVEL_CLIP = {
  tl: 'polygon(0 0, 100% 0, 0 100%)',
  tr: 'polygon(0 0, 100% 0, 100% 100%)',
  bl: 'polygon(0 0, 0 100%, 100% 100%)',
  br: 'polygon(100% 0, 100% 100%, 0 100%)',
}
// fillet: concave inner-elbow. GEOMETRY, read carefully before authoring `dir`:
// a full-cell ellipse centered at the named corner is transparent; ONLY the
// concave sliver at the OPPOSITE corner is painted. So `dir` names the OPEN
// (parchment) corner, and the painted material hugs the diagonally-opposite
// corner — for an elbow whose band is below+right, the fillet cell's open
// corner is 'tl'. (ellipse: % radii are valid CSS and match the 26×20 cell.)
// Fixes wedding-cake width transitions the way the source artwork does.
const FILLET_AT = { tl: '0% 0%', tr: '100% 0%', bl: '0% 100%', br: '100% 100%' }
export const FILLET_BG = (dir, bg) =>
  `radial-gradient(ellipse 100% 100% at ${FILLET_AT[dir]}, transparent calc(100% - 1px), ${bg} 100%)`
// grad: succession/assimilation dissolve; fade: the record ends, the people go on
const GRAD_DEG = { v: '180deg', h: '90deg' }
export function shapeTileStyle(t) {
  if (t.k === 'grad')
    return { background: `linear-gradient(${GRAD_DEG[t.dir || 'v']}, ${t.from}, ${t.to})` }
  if (t.k === 'fade')
    return { background: `linear-gradient(${GRAD_DEG[t.dir || 'v']}, ${t.bg}, transparent)` }
  if (t.k === 'fillet') return { background: FILLET_BG(t.dir, t.bg) }
  if (t.k === 'bevel') return { background: t.bg, clipPath: BEVEL_CLIP[t.dir] }
  return undefined
}
```

In `buildComposite`, shape tiles stamp the band layer so neighbours stay square
against them — extend the fill condition:

```js
    const SHAPE_KINDS = new Set(['fill', 'bevel', 'fillet', 'fade'])
    if (SHAPE_KINDS.has(t.k) && t.bg && t.bg !== '#ffffff') stamp(band, t.r, t.c, t.w, t.h, t.bg)
    if (t.k === 'grad') stamp(band, t.r, t.c, t.w, t.h, t.from)
```

- [ ] **Step 4: Run tests to verify pass.**

- [ ] **Step 5: Render in `Timeline.js` `fillEls`** — before the plain-fill map:

```js
const SHAPES = new Set(['bevel', 'grad', 'fillet', 'fade'])
for (const t of tiles) {
  if (SHAPES.has(t.k)) {
    els.push(
      <div key={`sh${t.r}-${t.c}`} className="tg-fill tg-shape" data-lin={linKey(t.bg || t.from)}
        style={{ ...gridPos(t), ...shapeTileStyle(t) }} />
    )
  }
  if (t.k === 'break') {
    els.push(
      <div key={`bk${t.r}-${t.c}`} className="tg-break" style={gridPos(t)} aria-hidden="true">
        <svg viewBox="0 0 60 20"><path d="M2 7 Q 12 1, 22 7 T 42 7 T 58 7 M2 14 Q 12 8, 22 14 T 42 14 T 58 14"
          fill="none" stroke="rgba(120,90,40,0.45)" strokeWidth="2" strokeLinecap="round" /></svg>
      </div>
    )
  }
}
```

**CRITICAL — also update the `marks` filter** (`Timeline.js` ~line 428), or every
shape tile double-renders as an empty event chip painted OVER the shape div:

```js
const CANVAS_MARK_KINDS = new Set(['battle', 'place'])
const marks = useMemo(() => tiles.filter((t) => CANVAS_MARK_KINDS.has(t.k)), [tiles])
```

(band-hover highlighting works because shape divs carry `data-lin`; paint through
`bandVar()` per Task 4b)

```css
.tg-shape { border-radius: 0 !important; }
.tg-break { display: flex; align-items: center; justify-content: center; }
.tg-break svg { width: calc(52px * var(--scale)); }
```

- [ ] **Step 6: Author the pilot cells (exploratory, visually gated)**

Locate each site's exact cells by scanning the data:

```bash
python3 - <<'EOF'
import json
t = json.load(open('frontend/webapp/src/views/Timeline/gridTiles.json'))
# rows/cols for a transition: list fills of the two colors near the boundary
for tile in t['tiles']:
    if tile['k'] == 'fill' and tile['bg'] in ('#351c75', '#85200c', '#1c4587') and tile['r'] < 60:
        print(tile['r'], tile['c'], tile['w'], tile['bg'])
EOF
```

Author, in priority order (spec doc has the full ranked list; examples show the
shape of each edit — adjust r/c to the actual boundary rows from the scan):

1. **Post-Christ dissolves** (unified gray → green and → maroon): replace the
   last 3–4 rows of the gray band above each successor band with
   `{ "k": "grad", "from": "#c9c2b0", "to": "#38761d", "dir": "v", ... }` (and maroon twin).
2. **Lehi schism** (purple → dark): 2 rows of `grad` purple→schism-dark above the
   split, plus `bevel` cells along the red/navy divergence stair-steps. The dark
   endpoint is a NEW token — add `--c-schism: #20123f` to the Task 4b schema and
   `'#20123f': 'schism'` to `COLOR_TOKENS` (no off-token hex literals in tiles).
3. **Kings→judges** (`#2f6f4f`… navy `#073763` → green `#38761d`): 2-row `grad`.
4. **Record-end fade**: bottom 2 rows of the final maroon mass → `fade` tiles.
5. **Jaredite→Mulekite handoff**: 2-row teal→mustard `grad` at the elbow column.
6. **Ammon-block shoulders**: `fillet` cells at the gold block's inner elbows
   (each concave step corner gets one fillet tile of the gold color).
7. **Break glyph**: ONE `{ "k": "break", "w": 4, "h": 2 }` in the 3100→600 BC void.
8. **Pass-under ribbons** (occlusion — "goes under and pops out the far side"):
   support an optional `"u": 1` flag on canvas event/ribbon tiles. Rendering:
   `u:1` tiles are pushed to an `underEls` array rendered BEFORE `{fillEls}` in
   the grid (band fills paint over them; the ribbon re-emerges wherever the band
   ends — no masking needed). The compositor does NOT stamp `u:1` tiles into the
   bar layer (they are beneath everything, so they can't be battle territory or
   block corner logic). Pilot: the Ill-Fated Expedition U-turn crossing the
   judges-green column (out through, loop, back through), per the design-language
   doc's occlusion rows.

- [ ] **Step 7: Verify (visual gate)** — harness screenshots against the
source artwork master (`docs/audits/timeline-ux-screenshots-2026-07-01/source-artwork-master.png`):
dissolves read as one people *becoming* another (no hard seam); schism diagonals
have no scallops; fillet shoulders read as one organic block; the record end
feathers out; neighbours stay flush against all shape tiles. **Any site that
doesn't convincingly improve gets its JSON cells reverted and the finding filed
in the handoff doc — the mechanisms stay either way.**

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/Timeline
git commit -m "feat(timeline): shape-language tiles (bevel/grad/fillet/fade) + pilot sites"
```

---

## Phase 9 — Final verification & close-out

### Task 17: Full-canvas visual QA + docs

**Files:**
- Modify: `docs/reference/timeline-grid-handoff.md`
- Output: `/tmp/tl-final/*` screenshots reviewed against the checklist

- [ ] **Step 1: Run everything**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npm test -- --watchAll=false --testPathPattern=Timeline
cd /home/bom/BookofMormonOnline/backend && npx vitest run && npx tsc --noEmit
cd /home/bom/BookofMormonOnline && node scripts/timeline-grid/screenshot.js --out /tmp/tl-final
```

Expected: all suites PASS; screenshots captured.

- [ ] **Step 2: Walk the audit checklist against `/tmp/tl-final`**

Every line must pass (each maps to an audit finding):

- §3.1 — clicking any bound battle opens its story; unplaced-slug list is empty or documented-retired.
- §3.2 — no parchment squares on bars/bands under battles; incursion-tab corners reveal the true surface; no slivers where bars overlap; no label crosses a color boundary mid-word (anchors + content-sized chips).
- §3.3 — thin bars have stadium caps; big bands base radius; stacked bands flush; pilot diagonals clean.
- §3.4 — zoomed+scrolled gutter edge is hard and clean; post-Christ band clearly a band.
- §3.5 — no grey chips; no emoji; place captions quiet sepia; chevrons on `dir` rows; tier-1 labels survive min zoom, tier-3 gone below 0.85.
- §3.7 — no `545s BC`-style ticks; century hairlines subtle.
- §3.8 — popover anchored with tail, flips/clamps correctly; narrow-screen modal fallback works.
- Source-artwork cross-check — walk the 13-region table in
  `docs/reference/timeline-source-design-language.md` against `/tmp/tl-final`:
  every ✗ row is either fixed or explicitly deferred in the handoff doc.
- Themes — toggling "Dark canvas" flips canvas/bands/gutter/ink coherently; band
  hover + legend stay correct in both themes.
- a11y spot-check: Tab order reaches events AND bound battles; Escape closes; focus returns to opener; `aria-label`s carry headings+dates.

Fix anything that fails before proceeding (bugs found here are in-scope for this plan).

- [ ] **Step 3: Update the handoff doc** — in `docs/reference/timeline-grid-handoff.md`: move the delivered items into "Done", record retired slugs + bevel pilot outcome, and note the two standing HUMAN GATES if still pending (label-params DDL; battle-placements SQL). Add a pointer to this plan and the audit.

- [ ] **Step 4: Commit**

```bash
git add docs/reference/timeline-grid-handoff.md
git commit -m "docs(timeline): handoff close-out for world-class UX round"
```

---

## Out of scope (explicitly deferred — pre-declared, not silently dropped)

- **Duration-bar "barcode" in-band tint** (audit §3.4 last item): re-evaluate AFTER Tasks 4+9+13 land — stadium caps, centered labels, and chevrons may resolve the barcode reading on their own. If not, design a corridor-underlay pass as a follow-up plan.
- **Non-EN translations** for event labels (`bom_translation` rows, handoff item #3) — data work, separate effort.
- **Retiring legacy `x/y/w/h/o/z`** from schema/query — only after prod cuts over to the grid.
- Variable row heights for era compression (the break glyph is the cheap 90% solution).
- **Enclosed-island hairline/inset** (audit §3.3): revisit after rule v2 + fillets land — islands may read intentional once their surroundings are clean.
- **`grid_bg` data backfill** for the rows using the chip fallback (audit §3.1): the Task 9 renderer fallback (surface-beneath → sepia) covers display; a data pass via `overrides.json` is follow-up.
- **Prod duplicate-slug row cleanup** (5 slugs, audit §5): Task 7's SQL guards with `LIMIT 1`; actual dedup is a workspace data chore.
- **Source-artwork devices without a pilot in this round** (design-language doc regions): tone-on-tone insets (10), interior lozenges (8b), full Zeniff journey-ribbon re-authoring (5). Mechanisms from Task 16 support all three; authoring them is the next data round after the pilots prove out.

## Human gates summary (KC)

1. Task 4 Step 6 — approve corner rule v2 (it squares one case v1 deliberately rounded per KC's earlier direction).
2. Task 5 Step 3 — review/approve `battleSlugs.draft.json` → `battleSlugs.json`.
3. Task 7 Step 3 — apply battle-placements SQL (+ rollback file) via BoMOnlineWorkspace, AFTER the Step 0 suppression code is deployed; triage non-battle residue (place or retire-with-reason).
4. Task 12 Step 1 — apply `label_params` DDL + tier/anchor/dir seeds via BoMOnlineWorkspace.
5. Task 13 — confirm prod backend cutover before any prod deploy containing the query change.
6. Task 16 Step 7 — accept or revert each shape-language pilot on visual review.
