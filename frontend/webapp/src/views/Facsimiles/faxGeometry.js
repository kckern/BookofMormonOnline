import { convertIntToRomanNumeral } from "../../models/Utils";

/**
 * The fax `item` object carries the front-matter page offset under an
 * ambiguous key — some records use `pgOffset`, some `pgoffset`. Resolve to a
 * single non-negative integer. (Audit §2.16.)
 */
export function resolvePgOffset(item) {
  const raw = item && (item.pgOffset != null ? item.pgOffset : item.pgoffset);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Build the array of "leaf" descriptors for a fax edition. Pure port of the
 * former inline builder in Facsimiles.js (audit §2.14 — was rebuilt every
 * render). `getRef(pageIndex, i)` is injected to avoid a circular import;
 * `assetBaseUrl` is BoMOnlineAPI's `assetUrl`.
 */
/**
 * Distribute a FIXED total footprint (px) between the two edge-stacks in
 * proportion to how many leaves sit before vs after the current spread.
 * This keeps the stacks' combined width constant across turns (no page-width
 * jitter) and never "sticks" at a per-side cap on long books (audit §2.10).
 * `adjustedPageIndex` is the even index of the left page.
 */
export function normalizeStackWidths(adjustedPageIndex, totalPages, totalFootprint = 160) {
  const before = Math.max(0, Math.floor(adjustedPageIndex / 2));
  const after = Math.max(0, Math.floor((totalPages - (adjustedPageIndex + 2)) / 2));
  const sum = before + after;
  if (sum <= 0) return { left: 0, right: 0 };
  const left = Math.round((before / sum) * totalFootprint);
  const right = Math.round((after / sum) * totalFootprint);
  return { left, right };
}

export function buildLeafIndex(item, pgoffset, pageIndex, getRef, assetBaseUrl, faxOffset = 0) {
  const pages = parseInt(item.pages, 10);
  const totalLeaves = pages + 1 + pgoffset;
  const baseUrl = `${assetBaseUrl}/fax/pages/${item.slug}/`;
  const fmt = item.format || "jpg";
  return Array.from({ length: totalLeaves }, (_, idx) => {
    const i = idx - pgoffset;
    const pageNumInt = i > 0 ? i : null;
    const pageNumRoman = i <= 0 ? convertIntToRomanNumeral(pgoffset + i, true) : null;
    // Printed folio = scan image-file number − per-edition offset (backend:
    // imageFile = faxPage + offset). Used for DISPLAY only; assets/routing keep
    // the image-file number (pageNumInt / pageSlugLeaf).
    const faxPageNum = pageNumInt != null ? pageNumInt - faxOffset : null;
    const pageAssetUrl =
      i > 0
        ? `${baseUrl}${i.toString().padStart(3, "0")}.${fmt}`
        : `${baseUrl}000.${(pgoffset + i).toString().padStart(2, "0")}.${fmt}`;
    const thumbAssetUrl = pageAssetUrl.replace("pages", "thumb");
    return {
      leafCursor: idx,
      leafSequence: pageNumInt || idx,
      pageNumInt,
      pageNumRoman,
      pageSlugLeaf: pageNumRoman || pageNumInt,
      faxPageNum,
      faxPageSlug: pageNumRoman || faxPageNum,
      pageReference: getRef(pageIndex, i),
      isLeftSide: i % 2 === 0,
      pageAssetUrl,
      thumbAssetUrl,
    };
  });
}
