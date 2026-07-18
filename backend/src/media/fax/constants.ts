// backend/src/media/fax/constants.ts
export const VERSION_SLUGS = [
  '1829', '1830', '1837', '1840', '1841', '1879', '1920', '1981', '2013',
  'earliest', 'poetic', 'printer', 'rebom',
] as const;
export type VersionSlug = (typeof VERSION_SLUGS)[number];

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
export function pageKey(version: string, page: number): string {
  return `fax/pages/${version}/${String(page).padStart(3, '0')}.jpg`;
}
