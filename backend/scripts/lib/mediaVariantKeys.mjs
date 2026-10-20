// Which original media keys get resized variants, and where the variants live.
// The frontend mirrors the prefixes in tiles/_ds/mediaVariants.js (VARIANT_FAMILIES).
// (people/places/matters were generated earlier by the slug-based path in build-media-variants.mjs.)
export const FAMILIES = [
  { name: 'art', prefix: 'art/', widths: [256, 640] },
  { name: 'history-thumbs', prefix: 'history/thumbs/', widths: [256, 640] },
  { name: 'history-fax', prefix: 'history/fax/', widths: [256, 640] },
  // fax/thumb originals are ~261px wide: a 640 variant would duplicate the 256 one (35k wasted files)
  { name: 'fax-thumb', prefix: 'fax/thumb/', widths: [256] },
  { name: 'fax-covers', prefix: 'fax/covers/', widths: [256, 640] },
  { name: 'source-cover', prefix: 'source/cover/', widths: [256] },
];

export const variantKey = (width, originalKey) => `variants/${width}/${originalKey}.webp`;

/**
 * listedKeys: keys under the family prefixes (from S3 ListObjectsV2).
 * existing:   Set of variant keys already in S3.
 * Returns [{ key, family, widths, missing }] for keys that still lack a variant.
 */
export function plan(listedKeys, existing) {
  const out = [];
  for (const key of listedKeys) {
    const fam = FAMILIES.find((f) => key.startsWith(f.prefix) && key.length > f.prefix.length && !key.endsWith('/'));
    if (!fam) continue;
    const missing = fam.widths.filter((w) => !existing.has(variantKey(w, key)));
    if (missing.length) out.push({ key, family: fam.name, widths: fam.widths, missing });
  }
  return out;
}
