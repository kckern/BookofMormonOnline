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

export function variantsEnabled() {
  try {
    return process.env.REACT_APP_MEDIA_VARIANTS === "1";
  } catch {
    return false;
  }
}
