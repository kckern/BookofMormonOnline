// Which original media keys get resized variants, and where the variants live.
// The frontend mirrors the prefixes in tiles/_ds/mediaVariants.js (VARIANT_FAMILIES).
// (people/places/matters were generated earlier by the slug-based path in build-media-variants.mjs.)
// stripExt: S3 stores art/1000.jpg but tiles (and the media host) request art/1000, and the
// frontend builds the variant URL from the path it requests — so the variant key drops the
// extension for those families. fax/thumb and history/fax requests include the extension.
export const FAMILIES = [
  { name: 'art', prefix: 'art/', widths: [256, 640], stripExt: true },
  { name: 'history-thumbs', prefix: 'history/thumbs/', widths: [256, 640], stripExt: true },
  { name: 'history-fax', prefix: 'history/fax/', widths: [256, 640] },
  // fax/thumb originals are ~261px wide: a 640 variant would duplicate the 256 one (35k wasted files)
  { name: 'fax-thumb', prefix: 'fax/thumb/', widths: [256] },
  { name: 'fax-covers', prefix: 'fax/covers/', widths: [256, 640], stripExt: true },
  { name: 'source-cover', prefix: 'source/cover/', widths: [256], stripExt: true },
];

const familyOf = (key) => FAMILIES.find((f) => key.startsWith(f.prefix) && key.length > f.prefix.length && !key.endsWith('/'));

export const variantKey = (width, servedKey) => `variants/${width}/${servedKey}.webp`;

/** The path a tile requests for this S3 key (extension dropped where tiles omit it). */
export function servedPath(key) {
  const fam = familyOf(key);
  return fam?.stripExt ? key.replace(/\.[A-Za-z0-9]+$/, '') : key;
}

/**
 * listedKeys: keys under the family prefixes (from S3 ListObjectsV2).
 * existing:   Set of variant keys already in S3.
 * Returns [{ key, served, family, widths, missing }] for keys that still lack a variant.
 */
export function plan(listedKeys, existing) {
  const out = [];
  const seen = new Set();
  for (const key of listedKeys) {
    const fam = familyOf(key);
    if (!fam) continue;
    const served = servedPath(key);
    if (seen.has(served)) continue; // two originals for one served path (e.g. 1000.jpg + 1000.png): first wins
    seen.add(served);
    const missing = fam.widths.filter((w) => !existing.has(variantKey(w, served)));
    if (missing.length) out.push({ key, served, family: fam.name, widths: fam.widths, missing });
  }
  return out;
}
