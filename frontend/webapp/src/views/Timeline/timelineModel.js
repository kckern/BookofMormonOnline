/** @format */
// Pure logic for the Timeline tile grid. No React, no DOM — everything here is
// unit-tested in timelineModel.test.js. Rendering lives in Timeline.js.

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
  '#20123f': 'schism', // Lehi-schism dark endpoint (grad-only, no band of its own)
}
export const tokenOf = (hex) => COLOR_TOKENS[hex] || null
export const bandVar = (hex) => {
  const t = tokenOf(hex)
  return t ? `var(--c-${t}, ${hex})` : hex
}

// Parchment-theme resolved values, for contrast math only (must mirror the CSS).
// These are the DISPLAYED hex values under the parchment theme — used by textOn()
// so ink choice is always computed against a real hex, never a var(...) string.
export const RESOLVED = {
  '#274e13': '#2f6f4f',
  '#6fa8dc': '#7d8596',
  '#fff2cc': '#c9c2b0',
}
export const resolvedHex = (hex) => RESOLVED[hex] || hex

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

const stamp = (map, r0, c0, w, h, bg) => {
  for (let dr = 0; dr < (h || 1); dr++)
    for (let dc = 0; dc < (w || 1); dc++) map.set(`${r0 + dr},${c0 + dc}`, bg)
}

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
// grad: succession/assimilation dissolve; fade: the record ends, the people go on.
// `resolve` maps an identity hex → its paint value (bandVar in the renderer);
// the default identity keeps the model pure/unit-testable.
const GRAD_DEG = { v: '180deg', h: '90deg' }
export function shapeTileStyle(t, resolve = (c) => c) {
  if (t.k === 'grad')
    return { background: `linear-gradient(${GRAD_DEG[t.dir || 'v']}, ${resolve(t.from)}, ${resolve(t.to)})` }
  if (t.k === 'fade')
    return { background: `linear-gradient(${GRAD_DEG[t.dir || 'v']}, ${resolve(t.bg)}, transparent)` }
  if (t.k === 'fillet') return { background: FILLET_BG(t.dir, resolve(t.bg)) }
  if (t.k === 'bevel') {
    // Two-color diagonal: a hard-stop gradient splits the cell along the diagonal
    // so one territory color meets another CLEANLY — no parchment wedge shows in
    // the cut (the clip-path form left the cut half transparent → cream bleed).
    // `dir` names the right-angle corner the `bg` triangle fills; `to` is the
    // color behind it. Without `to`, fall back to the clip (bg over whatever).
    if (t.to) return { background: `linear-gradient(${BEVEL_DEG[t.dir]}, ${resolve(t.bg)} 0 49.6%, ${resolve(t.to)} 50.4% 100%)` }
    return { background: resolve(t.bg), clipPath: BEVEL_CLIP[t.dir] }
  }
  return undefined
}
// Gradient angle whose split line is the cell diagonal, with `bg` on the side of
// the named right-angle corner. tl/br split on the ╲ diagonal; tr/bl on the ╱.
const BEVEL_DEG = { tl: '45deg', br: '225deg', tr: '135deg', bl: '315deg' }
// Event-bar paint: a flat band color, OR an along-bar dissolve when the row
// carries a `bgTo` (defection/join/assimilation bars — one people becoming
// another over the bar's length). `gradDeg` names the travel direction: 90 =
// rightward (origin left → dest right), 270 = leftward. The source artwork's
// grammar: the bar reads as the ORIGIN color for most of its run, then
// dissolves into the destination over the arrival tail — never a full-length
// 50/50 blend (which on a short bar collapses into a smudge). `resolve` maps
// identity hex → paint value (bandVar in the renderer); default keeps it pure.
// The handoff is a NARROW crossfade (68%→82%), not a wide dissolve: two dark
// saturated lineage colors (e.g. Lamanite maroon → judges green) interpolate
// through a muddy brown-black, so a long blend zone reads as a low-contrast
// smear. Keeping origin solid to 68% and landing solid destination by 82%
// compresses the mud to a thin seam and lets each end read as its true color.
export const barPaint = (g, resolve = (c) => c) =>
  g.bgTo
    ? `linear-gradient(${g.gradDeg || 90}deg, ${resolve(g.bg)} 0%, ${resolve(g.bg)} 68%, ${resolve(g.bgTo)} 82%, ${resolve(g.bgTo)} 100%)`
    : resolve(g.bg)

// Shape tiles that stamp the band layer with a solid color so neighbours stay
// square against them (grad stamps its `from`, handled separately below).
export const SHAPE_KINDS = new Set(['fill', 'bevel', 'fillet', 'fade'])

// ONE occupancy model for every colored layer. Rendering + corner logic + battle
// territory + label contrast all consume this — no layer guesses what's behind it.
// Layers bottom→top: BAND (canvas fills) < BAR (event tiles) < tab < marker < label.
// markers: ICON-EVENTS ({r,c,bg} descriptors) supplied by the caller — battles today,
// ships/"?" later; from legacy canvas battle tiles now, from DB rows with grid.icon later.
export function buildComposite(tilesData, events, markers = []) {
  const { rows, cols, tiles } = tilesData
  const band = new Map()
  const bar = new Map()
  for (const t of tiles) {
    // pass-under tiles (u:1) paint BENEATH band fills in the renderer — they are
    // beneath everything, so they must never stamp band OR bar territory.
    if (t.u) continue
    // fill + solid shape kinds (bevel/fillet/fade) stamp the band so neighbours
    // stay square against them; grad stamps its `from` color.
    if (SHAPE_KINDS.has(t.k) && t.bg && t.bg !== '#ffffff') stamp(band, t.r, t.c, t.w, t.h, t.bg)
    if (t.k === 'grad') stamp(band, t.r, t.c, t.w, t.h, t.from)
    // future-proofing: no k:'event' canvas tiles exist in today's data
    // (fill/battle/place only) — this line is inert until one is authored
    if (t.k === 'event' && t.bg) stamp(bar, t.r, t.c, t.w, t.h, t.bg)
  }
  for (const e of events || []) {
    // a marker is a point event, not a bar — it must never become its own territory
    if (!e.grid || !e.p || !e.grid.bg || e.grid.icon) continue
    stamp(bar, e.grid.row, e.grid.col, e.grid.colSpan, e.grid.rowSpan, e.grid.bg)
  }
  const fillAt = (r, c) => band.get(`${r},${c}`) || null
  const barAt = (r, c) => bar.get(`${r},${c}`) || null
  const surfaceAt = (r, c) => barAt(r, c) || fillAt(r, c)

  // Marker territory = what is genuinely beneath the cell (bar first, then band),
  // falling back to the dominant neighbour only for band-edge notch cells.
  const markersMap = new Map()
  const combined = new Map(band)
  for (const m of markers) {
    const beneath = surfaceAt(m.r, m.c)
    const territory = beneath || dominantNeighbor(m, surfaceAt)
    // last marker wins on cell collision — callers must dedupe if that matters
    markersMap.set(`${m.r},${m.c}`, {
      territory,
      attacker: m.bg || null,
      incursion: !!(territory && m.bg && territory !== m.bg),
      hasSurface: !!beneath,
    })
    if (territory) combined.set(`${m.r},${m.c}`, territory)
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
      const cells = []
      const colors = new Set()
      const stack = [[r, c]]
      seen.add(k)
      while (stack.length) {
        const [rr, cc] = stack.pop()
        cells.push([rr, cc])
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = rr + dr, nc = cc + dc, nk = `${nr},${nc}`
          const nv = combined.get(nk)
          if (nv) colors.add(nv)
          else if (isEmpty(nr, nc) && !outside.has(nk) && !seen.has(nk)) {
            seen.add(nk)
            stack.push([nr, nc])
          }
        }
      }
      if (colors.size === 1) {
        const col = [...colors][0]
        for (const [rr, cc] of cells) {
          combined.set(`${rr},${cc}`, col)
          holePatches.push({ r: rr, c: cc, bg: col })
        }
      }
    }

  return {
    fillAt,
    barAt,
    surfaceAt,
    // bandAt: band-silhouette only (bars excluded by design — event overlays
    // don't define band corners; do NOT substitute surfaceAt into cornerRadii)
    bandAt: (r, c) => combined.get(`${r},${c}`) || null,
    markerFor: (t) =>
      markersMap.get(`${t.r},${t.c}`) ||
      // non-marker tile: territory = its own color (not an incursion into itself)
      { territory: t.bg || null, attacker: t.bg || null, incursion: false, hasSurface: false },
    holePatches,
  }
}

// What background (if any) a marker CELL should paint. null = paint nothing —
// the surface beneath (band fill or event bar) already provides the territory.
// Only a genuine band-edge notch (no surface beneath) gets the inferred color,
// which keeps the band silhouette continuous under the marker.
export function markerCellPaint(comp, t) {
  const b = comp.markerFor(t)
  return b.hasSurface ? null : b.territory
}

// Natural (scale-1) cell metrics — must match Timeline.css --col-w/--row-h.
export const COL_W = 26
export const ROW_H = 20
const RADIUS_BASE = 13

// Radius respects tile size: a 1-row bar gets a stadium cap (h/2), a 40-row
// band gets the base radius — prod's hand-drawn corners scaled the same way.
export const radiusFor = (w, h) =>
  Math.min(RADIUS_BASE, ((h || 1) * ROW_H) / 2, ((w || 1) * COL_W) / 2)

export function cornerStyleFor(rect, colorAt, overrides, strict) {
  const k = cornerRadii(rect, colorAt, strict)
  // Per-tile data escape hatch: `rd` force-rounds, `sq` force-squares — JSON wins
  // over the algorithm (the corner artwork carries cases v2.1 cannot express).
  if (overrides) {
    for (const corner of overrides.rd || []) if (corner in k) k[corner] = true
    for (const corner of overrides.sq || []) if (corner in k) k[corner] = false
  }
  if (!(k.tl || k.tr || k.bl || k.br)) return undefined
  const rad = `calc(${radiusFor(rect.w, rect.h)}px * var(--scale))`
  return {
    borderTopLeftRadius: k.tl ? rad : 0,
    borderTopRightRadius: k.tr ? rad : 0,
    borderBottomLeftRadius: k.bl ? rad : 0,
    borderBottomRightRadius: k.br ? rad : 0,
  }
}

// Wedge backing color: what a rounded band corner should REVEAL beneath it (the
// territory it sits on) instead of falling through to the cream canvas. The
// strict rule only rounds a corner when its immediate neighbours are empty, so
// the intended fill is the nearest band along each rounded corner's diagonal —
// scan outward up to 3 cells. Returns null when the corner faces genuine open
// canvas (no band nearby) — there cream IS correct (an outer ribbon edge).
export function wedgeColor(rect, colorAt, overrides) {
  // Explicit data override wins: `wedge` is the hex to reveal (or 'none'/null for
  // cream). Lets the artwork force a corner's reveal color the heuristic can't
  // infer (e.g. the "top color" of a band that emerged from the one above it).
  if (rect.wedge !== undefined) return rect.wedge === 'none' ? null : rect.wedge
  const k = cornerRadii(rect, colorAt, true)
  if (overrides) {
    for (const cn of overrides.rd || []) if (cn in k) k[cn] = true
    for (const cn of overrides.sq || []) if (cn in k) k[cn] = false
  }
  if (!(k.tl || k.tr || k.bl || k.br)) return null
  const r = rect.r, c = rect.c, w = rect.w || 1, h = rect.h || 1, own = rect.bg
  // Nearest band along a ray (distance + color); null if only cream/own within 3.
  const ray = (sr, sc, dr, dc) => {
    for (let i = 1; i <= 3; i++) {
      const v = colorAt(sr + dr * i, sc + dc * i)
      if (v) return v === own ? null : { d: i, v }
    }
    return null
  }
  // A corner reveals a band ONLY if that band WRAPS it — appears in ≥2 of the
  // corner's 3 outward directions (diagonal + both orthogonals). One direction
  // means the band is merely nearby (a floating card over canvas with a band off
  // to one side) → the corner reveals cream, not the stray band.
  const cornerReveal = (sr, sc, vr, hc) => {
    const rays = [ray(sr, sc, vr, 0), ray(sr, sc, 0, hc), ray(sr, sc, vr, hc)].filter(Boolean)
    const byColor = {}
    for (const g of rays) (byColor[g.v] = byColor[g.v] || []).push(g.d)
    let best = null, bd = 99
    for (const col in byColor) {
      if (byColor[col].length < 2) continue           // not wrapping → ignore
      const d = Math.min(...byColor[col])
      if (d < bd) { bd = d; best = col }
    }
    return best ? { v: best, d: bd } : null
  }
  const reveals = []
  if (k.tl) reveals.push(cornerReveal(r, c, -1, -1))
  if (k.tr) reveals.push(cornerReveal(r, c + w - 1, -1, 1))
  if (k.bl) reveals.push(cornerReveal(r + h - 1, c, 1, -1))
  if (k.br) reveals.push(cornerReveal(r + h - 1, c + w - 1, 1, 1))
  const hits = reveals.filter(Boolean).sort((a, b) => a.d - b.d)
  return hits.length ? hits[0].v : null
}

const ANCHORS = new Set(['center', 'start', 'end', 'above', 'below'])
// Label anchoring is a data param (bom_timeline.label_anchor). Defaults:
// events CENTER (KC directive); places START (quiet pin-led captions — the
// tg-a-center justify-content would defeat .tg-place's flex-start).
export const anchorOf = (e) => {
  const a = e && e.grid && e.grid.anchor
  if (ANCHORS.has(a)) return a
  return e && e.p ? 'center' : 'start'
}

// Chip background for events with no grid_bg: the surface genuinely beneath the
// tile, else themed sepia ink. Never an off-palette grey.
export const chipBg = (g, comp) =>
  g.bg || comp.surfaceAt(g.row, g.col) || '#6a5326'

// Zoom LOD: tier 1 = band/era names (always visible — the wayfinding layer),
// tier 2 = major events, tier 3 = detail (places, rosters). Data override via
// bom_timeline.grid_tier; defaults by kind.
export const TIER_MIN_SCALE = { 1: 0, 2: 0.55, 3: 0.85 }
export const tierOf = (e) =>
  (e && e.grid && e.grid.tier) ||
  (e && e.kind === 'label' ? 3 : e && e.p ? 2 : 3)
export const tierVisible = (tier, scale) =>
  scale >= (TIER_MIN_SCALE[tier] !== undefined ? TIER_MIN_SCALE[tier] : 0)

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

// DB icon-events (grid.icon set) render via the marker path, not as chips/bars.
// w/h (from colSpan/rowSpan) let a single major battle occupy several cells —
// the source artwork scales its starburst to the event's weight (Cumorah is
// huge); the medallion sizes to the spanned area in the renderer.
export const apiMarkers = (events) =>
  (events || [])
    .filter((e) => e.grid && e.grid.icon)
    .map((e) => ({
      r: e.grid.row, c: e.grid.col,
      w: e.grid.colSpan || 1, h: e.grid.rowSpan || 1,
      bg: e.grid.bg, icon: e.grid.icon, slug: e.slug,
      ...(e.grid.iconScale ? { iconScale: e.grid.iconScale } : {}),
    }))

// Medallion diameter (px, pre-scale) for a marker spanning w×h cells: fill the
// spanned area's short side, floored at the classic 18px single-cell size. An
// `iconScale` multiplier lets the two narrative-apex battles (Cumorah, the Final
// Jaredite Battle) render dramatically larger than routine skirmishes, matching
// the reference's oversized climax starbursts.
export const markerIconSize = (w, h, scale = 1) =>
  Math.max(18, (Math.min((w || 1) * COL_W, (h || 1) * ROW_H) - 2) * (scale || 1))

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

// Corner rounding — RULE v2.1 (2026-07, Round 2; supersedes v2 and doc v1).
// Round a corner IFF BOTH orthogonal neighbour cells are empty parchment; the
// diagonal is IGNORED. Rationale: v2 additionally required the diagonal empty,
// which over-squared protrusion corners that only TOUCH another band diagonally
// — prod ROUNDS those (a corner facing open space on both edges reads fine at
// 13px radii even with a diagonal pinch point; KC flagged the over-squaring).
// The actual sliver bug v2 fixed was the ORTHOGONAL flush handoff (other band
// sharing a full edge) — that still stays square here (one orthogonal occupied
// → not both empty → square). So: diagonal-only touch rounds; edge-flush handoff
// squares. `d` (diagonal) retained in the signature for call-site clarity.
export function cornerRadii(rect, colorAt, strict) {
  const top = rect.r, left = rect.c
  const right = rect.c + (rect.w || 1) - 1
  const bottom = rect.r + (rect.h || 1) - 1
  // strict also requires the DIAGONAL neighbour empty — squares band-to-band
  // junction corners (which otherwise round and expose a cream sliver) while
  // still rounding true outer ribbon corners that face open parchment.
  const round = (oh, ov, od) => oh === null && ov === null && (!strict || od === null)
  return {
    tl: round(colorAt(top, left - 1), colorAt(top - 1, left), colorAt(top - 1, left - 1)),
    tr: round(colorAt(top, right + 1), colorAt(top - 1, right), colorAt(top - 1, right + 1)),
    bl: round(colorAt(bottom, left - 1), colorAt(bottom + 1, left), colorAt(bottom + 1, left - 1)),
    br: round(colorAt(bottom, right + 1), colorAt(bottom + 1, right), colorAt(bottom + 1, right + 1)),
  }
}
