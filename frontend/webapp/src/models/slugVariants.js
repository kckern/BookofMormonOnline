/**
 * Bare-name entity slugs (/people/noah) are not real slugs — the dataset
 * disambiguates homonyms with a numeric suffix (people: noah1/noah2/noah3;
 * places: jerusalem-1/jerusalem-2).
 *
 * This is a deliberate port of frontend/next/lib/slug-variants.ts so the CRA
 * and SSR agree on what /people/noah means. __tests__/slugVariants.test.js
 * guards the two against drift — edit both or neither.
 *
 * Supersedes the old PopUp.js rule (`slug.startsWith(input)`), which was too
 * loose: 'noah' also matched noahs-priests, and 'nephi' matched 13 slugs
 * including nephites and nephihah.
 */

function normalize(input) {
  // Route params arrive decoded. Do NOT decode again: a second pass turns
  // 'noah%2531' into 'noah1' and resolves a URL that names no entity.
  return (input ?? "").trim().toLowerCase();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveSlug(requested, known = []) {
  const base = normalize(requested);
  if (!base) return { kind: "none" };

  const exact = known.find((s) => String(s).toLowerCase() === base);
  if (exact) return { kind: "exact", slug: exact };

  // The optional hyphen covers both conventions in the data.
  const variant = new RegExp(`^${escapeRe(base)}-?\\d+$`);
  // Dataset order is the backend's weight order — never re-sort.
  const candidates = known.filter((s) => variant.test(String(s).toLowerCase()));

  if (candidates.length === 1) return { kind: "redirect", slug: candidates[0] };
  if (candidates.length > 1) return { kind: "chooser", candidates };
  return { kind: "none" };
}
