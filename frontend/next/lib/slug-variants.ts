// Bare-name slugs (/people/noah) are not real slugs: the dataset disambiguates
// homonyms with a numeric suffix — people use noah1/noah2/noah3, places use
// jerusalem-1/jerusalem-2. A crawler or link unfurler hitting the bare name got
// a hard 404 while a browser got PopUp.js's chooser, so every shared bare-name
// link unfurled as dead.
//
// The CRA's rule (PopUp.js:206, `slug.startsWith(input)`) is too loose to reuse:
// 'noah' also matches noahs-priests, and 'nephi' matches 13 slugs including
// nephites and nephihah. Match only the numeric-variant form.
// See docs/specs/2026-09-24-entity-url-presentation-model.md §5.

export type SlugResolution =
  | { kind: 'exact'; slug: string }
  | { kind: 'redirect'; slug: string }
  | { kind: 'chooser'; candidates: string[] }
  | { kind: 'none' }

// The App Router hands params already decoded. Do NOT decode again: a second
// pass turns 'noah%2531' into 'noah1' and resolves a URL that names no entity.
function normalize(input: string): string {
  return (input ?? '').trim().toLowerCase()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function resolveSlug(requested: string, known: readonly string[]): SlugResolution {
  const base = normalize(requested)
  if (!base) return { kind: 'none' }

  const exact = known.find((s) => s.toLowerCase() === base)
  if (exact) return { kind: 'exact', slug: exact }

  // The optional hyphen covers both conventions in the data.
  const variant = new RegExp(`^${escapeRe(base)}-?\\d+$`)
  // Dataset order is the backend's weight order — never re-sort.
  const candidates = known.filter((s) => variant.test(s.toLowerCase()))

  if (candidates.length === 1) return { kind: 'redirect', slug: candidates[0] }
  if (candidates.length > 1) return { kind: 'chooser', candidates }
  return { kind: 'none' }
}
