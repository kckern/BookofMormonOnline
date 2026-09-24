import { test, expect } from '@playwright/test'
import { resolveSlug } from '../../lib/slug-variants'

// Mirrors the real shape of bom_people / bom_places slugs.
const PEOPLE = [
  'noah1', 'noah2', 'noah3', 'noahs-priests', 'people-of-noah',
  'nephi1', 'nephi2', 'nephites', 'nephihah', 'nephite-spies',
  'shem2',
  'angels-to-nephi', 'angels-to-nephi3',
  'abinadi',
]
const PLACES = ['jerusalem-1', 'jerusalem-2', 'zarahemla', 'bountiful-1']

test.describe('resolveSlug', () => {
  test('exact slug wins even when numeric variants exist', () => {
    expect(resolveSlug('angels-to-nephi', PEOPLE)).toEqual({ kind: 'exact', slug: 'angels-to-nephi' })
    expect(resolveSlug('abinadi', PEOPLE)).toEqual({ kind: 'exact', slug: 'abinadi' })
  })

  test('exactly one variant → redirect', () => {
    expect(resolveSlug('shem', PEOPLE)).toEqual({ kind: 'redirect', slug: 'shem2' })
    expect(resolveSlug('bountiful', PLACES)).toEqual({ kind: 'redirect', slug: 'bountiful-1' })
  })

  test('several variants → chooser, in dataset order', () => {
    expect(resolveSlug('noah', PEOPLE)).toEqual({ kind: 'chooser', candidates: ['noah1', 'noah2', 'noah3'] })
    expect(resolveSlug('jerusalem', PLACES)).toEqual({ kind: 'chooser', candidates: ['jerusalem-1', 'jerusalem-2'] })
  })

  test('rejects the loose prefix matches the CRA rule wrongly accepts', () => {
    // startsWith('noah') would also return noahs-priests; startsWith('nephi')
    // would return nephites, nephihah and nephite-spies.
    const noah = resolveSlug('noah', PEOPLE) as { kind: 'chooser'; candidates: string[] }
    expect(noah.candidates).not.toContain('noahs-priests')
    const nephi = resolveSlug('nephi', PEOPLE) as { kind: 'chooser'; candidates: string[] }
    expect(nephi.candidates).toEqual(['nephi1', 'nephi2'])
  })

  test('no match → none', () => {
    expect(resolveSlug('king-noah', PEOPLE)).toEqual({ kind: 'none' })
    expect(resolveSlug('', PEOPLE)).toEqual({ kind: 'none' })
  })

  test('input is case-insensitive and trimmed', () => {
    expect(resolveSlug('NOAH', PEOPLE)).toEqual({ kind: 'chooser', candidates: ['noah1', 'noah2', 'noah3'] })
    expect(resolveSlug('  Shem ', PEOPLE)).toEqual({ kind: 'redirect', slug: 'shem2' })
  })

  test('regex metacharacters in the request are escaped, not interpreted', () => {
    // '.' must not match any character, or 'noah.' would resolve.
    expect(resolveSlug('noah.', PEOPLE)).toEqual({ kind: 'none' })
    expect(resolveSlug('n(o)ah', PEOPLE)).toEqual({ kind: 'none' })
  })

  test('does not decode its input a second time', () => {
    // The App Router already decoded the param. If this module decoded again,
    // '%2531' would become '1' and this would wrongly resolve to noah1.
    expect(resolveSlug('noah%2531', PEOPLE)).toEqual({ kind: 'none' })
    expect(resolveSlug('%E0%A4%A', PEOPLE)).toEqual({ kind: 'none' })
  })
})
