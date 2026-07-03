/** @format */
// CI invariants for the baked timeline data — catches regressions the adversarial
// sign-off caught by eye (out-of-bounds placement, over-long timeline labels,
// same-cell label collisions) so they fail in CI, not in a screenshot review.
import data from './timelineData.json'
import tiles from './gridTiles.json'

const evs = data.events

describe('timelineData integrity', () => {
  it('every placed event sits within the grid bounds', () => {
    for (const e of evs) {
      const g = e.grid
      if (!g) continue
      expect(g.row).toBeGreaterThanOrEqual(1)
      expect(g.row + (g.rowSpan || 1) - 1).toBeLessThanOrEqual(tiles.rows)
      expect(g.col).toBeGreaterThanOrEqual(1)
      expect(g.col + (g.colSpan || 1) - 1).toBeLessThanOrEqual(tiles.cols)
    }
  })

  it('short timeline labels stay short (<= 28 chars)', () => {
    for (const e of evs) {
      if (e.label) expect(e.label.length).toBeLessThanOrEqual(28)
    }
  })

  it('no two colSpan-1 floating labels occupy the exact same cell', () => {
    // bars (colSpan>1) and icon markers are allowed to share a cell with a float;
    // two 1-cell floating labels stacked in one cell is the collision we caught.
    const seen = new Map()
    for (const e of evs) {
      const g = e.grid
      if (!g || g.icon || !e.p || (g.colSpan || 1) > 1) continue
      const k = `${g.row},${g.col}`
      if (seen.has(k)) {
        throw new Error(`label collision at ${k}: ${seen.get(k)} vs ${e.slug}`)
      }
      seen.set(k, e.slug)
    }
  })

  it('icon markers have a defined bg (hex for incursion/notch, null for on-surface)', () => {
    // bg:null is valid — the medallion sits flush on the surface beneath and
    // markerCellPaint paints nothing. Only `undefined` (missing key) is a bug.
    for (const e of evs) {
      if (e.grid && e.grid.icon) {
        expect(e.grid.bg === null || typeof e.grid.bg === 'string').toBe(true)
      }
    }
  })
})
