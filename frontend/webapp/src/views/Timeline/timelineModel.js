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
    if (t.k === 'fill' && t.bg !== '#ffffff') stamp(band, t.r, t.c, t.w, t.h, t.bg)
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
