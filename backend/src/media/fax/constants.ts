// backend/src/media/fax/constants.ts
// The renderable version allowlist is NOT hardcoded here — it is derived at
// runtime from `SELECT DISTINCT version FROM bom_xtras_fax_index`. See
// ./versions.ts (isRenderableVersion / renderableVersions).

export const WIDTH_WHITELIST = [200, 400, 800, 1600] as const; // plus 'full'
export const MAX_PAGES = 5;            // clamp
export const MAX_VERSE_IDS = 40;       // ids/ selector cap (K)
export const DIM_OPACITY = 0.55;       // page-mode dark overlay
export const JPEG_QUALITY = 82;
export const EPSILON_PX = 4;           // column overlap tolerance — CONFIRMED by spike
export const DEDUPE_PX = 2;            // near-duplicate box corner tolerance

// Notch convention (CONFIRMED in spike):
//   TL notch rect = [X, Y, TLW, TLH] (top-left corner of the box)
//   BR notch rect = [X + W - BRW, Y + H - BRH, BRW, BRH] (bottom-right corner)
// Paper-filling these two rects erases neighboring verses' text.

export const MEDIA_BASE = 'https://media.bookofmormon.online';
export function pageKey(version: string, page: number, format = 'jpg'): string {
  return `fax/pages/${version}/${String(page).padStart(3, '0')}.${format}`;
}
