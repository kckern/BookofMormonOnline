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
