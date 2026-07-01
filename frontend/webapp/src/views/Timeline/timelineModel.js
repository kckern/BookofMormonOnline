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
