import {
  tokenOf, bandVar, resolvedHex,
  textOn, humanize, cleanLabel, cornerRadii, dominantNeighbor,
  buildComposite, markerCellPaint, radiusFor, cornerStyleFor,
  anchorOf, chipBg, tierOf, tierVisible,
  formatAxisTick, isCenturyTick, apiMarkers,
  popoverPlace,
  BEVEL_CLIP, FILLET_BG, shapeTileStyle, barPaint,
} from './timelineModel'

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

describe('color + text utils', () => {
  it('resolvedHex mirrors the parchment theme for contrast math', () => {
    expect(resolvedHex('#fff2cc')).toBe('#c9c2b0')
    expect(resolvedHex('#134f5c')).toBe('#134f5c')
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

describe('buildComposite', () => {
  const tilesData = {
    rows: 10, cols: 10,
    tiles: [
      { r: 2, c: 2, w: 3, h: 3, k: 'fill', bg: '#111111' },   // band A
      { r: 5, c: 2, w: 3, h: 1, k: 'fill', bg: '#222222' },   // band B below A
    ],
  }
  const events = [
    // API bar crossing open parchment at row 3, cols 5..8
    { slug: 'exp', p: true, grid: { row: 3, col: 5, rowSpan: 1, colSpan: 4, bg: '#555555' } },
  ]
  const markers = [{ r: 3, c: 6, bg: '#333333' }, { r: 2, c: 3, bg: '#444444' }]
  const comp = buildComposite(tilesData, events, markers)

  it('stamps band and bar layers separately', () => {
    expect(comp.fillAt(2, 2)).toBe('#111111')
    expect(comp.barAt(3, 6)).toBe('#555555')
    expect(comp.fillAt(3, 6)).toBe(null)
  })
  it('battle on an API bar takes the BAR as territory (not parchment)', () => {
    const b = comp.markerFor({ r: 3, c: 6 })
    expect(b.territory).toBe('#555555')
    expect(b.incursion).toBe(true) // attacker #333333 ≠ territory #555555
  })
  it('battle cell over an existing surface paints NO background of its own', () => {
    expect(markerCellPaint(comp, { r: 3, c: 6 })).toBe(null)  // bar beneath
    expect(markerCellPaint(comp, { r: 2, c: 3 })).toBe(null)  // band beneath
  })
  it('battle in a genuine band-edge notch paints the inferred territory', () => {
    // battle at (2,5): outside band A (cols 2..4) but adjacent — no surface beneath
    const c2 = buildComposite(tilesData, [], [...markers, { r: 2, c: 5, bg: '#999999' }])
    expect(markerCellPaint(c2, { r: 2, c: 5 })).toBe('#111111')
  })
  it('icon-events never stamp the bar layer (they are markers, not bars)', () => {
    const ci = buildComposite(tilesData, [
      { slug: 'b1', p: true, grid: { row: 7, col: 7, rowSpan: 1, colSpan: 1, bg: '#666666', icon: 'battle' } },
    ], [])
    expect(ci.barAt(7, 7)).toBe(null)
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
  it('leaves multi-color-border holes unpatched (duration gaps)', () => {
    const t4 = {
      rows: 6, cols: 6,
      tiles: [
        { r: 2, c: 2, w: 3, h: 1, k: 'fill', bg: '#111111' }, // top #111111
        { r: 4, c: 2, w: 3, h: 1, k: 'fill', bg: '#222222' }, // bottom #222222
        { r: 3, c: 2, w: 1, h: 1, k: 'fill', bg: '#111111' },
        { r: 3, c: 4, w: 1, h: 1, k: 'fill', bg: '#222222' },
      ],
    }
    const c4 = buildComposite(t4, [])
    expect(c4.holePatches).toEqual([])
    expect(c4.bandAt(3, 3)).toBe(null)
  })
  it('markerFor falls back safely for a cell never registered as a marker', () => {
    const f = comp.markerFor({ r: 9, c: 9, bg: '#777777' })
    expect(f).toEqual({ territory: '#777777', attacker: '#777777', incursion: false, hasSurface: false })
    expect(markerCellPaint(comp, { r: 9, c: 9, bg: '#777777' })).toBe('#777777')
  })
})

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
  it('barPaint: flat bg when no bgTo, gradient (default 90deg) when bgTo present', () => {
    const up = (c) => `var(${c})`
    expect(barPaint({ bg: '#111111' }, up)).toBe('var(#111111)')
    expect(barPaint({ bg: '#111111', bgTo: '#222222' }, up))
      .toBe('linear-gradient(90deg, var(#111111), var(#222222))')
    expect(barPaint({ bg: '#111111', bgTo: '#222222', gradDeg: 270 }, up))
      .toBe('linear-gradient(270deg, var(#111111), var(#222222))')
  })
  it('shapeTileStyle applies a color resolver (renderer paints through bandVar)', () => {
    const up = (c) => `var(${c})`
    expect(shapeTileStyle({ k: 'grad', from: '#111111', to: '#222222', dir: 'h' }, up).background)
      .toBe('linear-gradient(90deg, var(#111111), var(#222222))')
    expect(shapeTileStyle({ k: 'bevel', dir: 'tl', bg: '#111111' }, up).background)
      .toBe('var(#111111)')
  })
  it('pass-under (u:1) tiles are painted beneath and never stamp any layer', () => {
    const comp = buildComposite({
      rows: 6, cols: 6,
      tiles: [
        { r: 3, c: 3, w: 1, h: 1, k: 'fill', u: 1, bg: '#111111' },
      ],
    }, [])
    expect(comp.fillAt(3, 3)).toBe(null)
    expect(comp.bandAt(3, 3)).toBe(null)
  })
})

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

describe('anchorOf', () => {
  it('defaults to center for events (KC directive)', () =>
    expect(anchorOf({ p: true, grid: { row: 1, col: 1 } })).toBe('center'))
  it('defaults to start for places (quiet captions)', () =>
    expect(anchorOf({ p: false, grid: { row: 1, col: 1 } })).toBe('start'))
  it('honors an explicit anchor', () =>
    expect(anchorOf({ grid: { anchor: 'start' } })).toBe('start'))
  it('rejects unknown values back to the kind default', () =>
    expect(anchorOf({ p: true, grid: { anchor: 'bogus' } })).toBe('center'))
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

describe('LOD tiers', () => {
  it('defaults: events tier 2, places tier 3, explicit tier wins', () => {
    expect(tierOf({ p: true, grid: {} })).toBe(2)
    expect(tierOf({ p: false, grid: {} })).toBe(3)
    expect(tierOf({ p: true, grid: { tier: 1 } })).toBe(1)
  })
  it('labels default to tier 3; explicit tier still wins', () => {
    expect(tierOf({ kind: 'label', p: true, grid: {} })).toBe(3)
    expect(tierOf({ kind: 'label', p: true, grid: { tier: 1 } })).toBe(1)
  })
  it('tier 1 (band names) never hides; 2 hides <0.55; 3 hides <0.85', () => {
    expect(tierVisible(1, 0.2)).toBe(true)
    expect(tierVisible(2, 0.5)).toBe(false)
    expect(tierVisible(2, 0.6)).toBe(true)
    expect(tierVisible(3, 0.7)).toBe(false)
    expect(tierVisible(3, 0.9)).toBe(true)
  })
})

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

describe('apiMarkers', () => {
  it('extracts marker descriptors from icon-events only', () => {
    const evs = [
      { slug: 'a', grid: { row: 1, col: 2, bg: '#111111', icon: 'battle' } },
      { slug: 'b', grid: { row: 3, col: 4, bg: '#222222' } },
      { slug: 'c', grid: null },
    ]
    expect(apiMarkers(evs)).toEqual([{ r: 1, c: 2, bg: '#111111', icon: 'battle', slug: 'a' }])
  })
})

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
