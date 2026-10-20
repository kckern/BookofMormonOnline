import { assetUrl } from "src/models/BoMOnlineAPI";

/**
 * Resized WebP variants of media images, generated + uploaded by the variant
 * script (plan Task 11) under `${assetUrl}/variants/<width>/<path>.webp`.
 * Off until those exist: REACT_APP_MEDIA_VARIANTS=1 turns srcset on.
 *
 * Read through `process.env` (not import.meta.env): vite.config.mjs exposes
 * REACT_APP_* only via `define` on `process.env.REACT_APP_*`, substituting
 * that exact member expression. There is no `process` global in the browser,
 * so NO `typeof process` guard (it would make this permanently false in a real
 * build); the try/catch covers an unset, unsubstituted var (ReferenceError).
 */
export const VARIANT_WIDTHS = [256, 640];

export const variantUrl = (path, width) => `${assetUrl}/variants/${width}/${path}.webp`;

// Only these media families were generated: people/places/matters (by slug) and
// art, history thumbs + pages, fax thumbs + covers, source covers (by key listing;
// backend/scripts/lib/mediaVariantKeys.mjs — keep the prefixes identical).
// Anything else (fax/pages, home banners, absolute URLs…) has no variants:
// offering a srcset for it would 404 once per image before falling back.
const VARIANT_FAMILIES = /^(people|places|matters|art|history\/(thumbs|fax|witnesses\/people)|fax\/(thumb|covers)|source\/cover)\//;
export const hasVariants = (path) => VARIANT_FAMILIES.test(path || "");

// Families generated at 256px only (their originals are small: a 640 would duplicate it).
const SMALL_ONLY = /^(fax\/thumb|source\/cover)\//;
/** The variant widths that exist for `path`. */
export const variantWidthsFor = (path) => (SMALL_ONLY.test(path || "") ? [256] : VARIANT_WIDTHS);

/** An absolute (http/https or root-relative) src is used verbatim, not under assetUrl. */
export const isAbsoluteSrc = (path) => /^(https?:)?\/\//.test(path || "") || /^\//.test(path || "");

export function variantsEnabled() {
  try {
    return process.env.REACT_APP_MEDIA_VARIANTS === "1";
  } catch {
    return false;
  }
}
