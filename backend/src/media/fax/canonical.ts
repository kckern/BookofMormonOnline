import { lookupReference, generateReference } from 'scripture-guide';

/** "1 Nephi 3:2–4" -> "1-nephi-3.2-4" (ASCII hyphen, lowercase, ':'→'.', drop commas/spaces). */
export function slugify(ref: string): string {
  return ref
    .replace(/[–—]/g, '-')       // en/em dash -> hyphen
    .replace(/:/g, '.')
    .replace(/,/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/** "1-nephi-3.2-4" -> "1 nephi 3:2-4". Hyphens adjacent to a non-digit become
 * spaces (word separators); digit-digit hyphens are preserved as verse ranges. */
export function deslugify(slug: string): string {
  return slug.replace(/\./g, ':').replace(/-(?=\D)|(?<=\D)-/g, ' ');
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

const SLUG_OK = /^[a-z0-9.-]+$/;

/** Canonical selector path segment. Ref slug ONLY if it is URL-safe AND slug→ids→slug
 * is a fixed point; otherwise the ids/ form. `ids` must be sorted ascending, de-duped. */
export function canonicalSelector(ids: number[]): string {
  const sorted = [...new Set(ids)].sort((a, z) => a - z);
  try {
    const ref = generateReference(sorted);
    const slug = slugify(ref);
    if (SLUG_OK.test(slug)) {
      const round = lookupReference(deslugify(slug))?.verse_ids ?? [];
      if (sameSet(round, sorted)) return slug;
    }
  } catch { /* fall through */ }
  return `ids/${sorted.join('-')}`;
}
