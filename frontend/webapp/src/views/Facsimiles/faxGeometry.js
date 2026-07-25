import { convertIntToRomanNumeral, determineLanguage } from "../../models/Utils";
import { generateReference } from "scripture-guide";

/**
 * Resolve the scripture reference for an image-file page from the DENSE,
 * page-keyed pageIndex (element i == image page i+1; [0,0] for pageless scans).
 * Returns null for gap pages / out-of-range / editions whose index hasn't loaded.
 */
export const getRefFromIndex = (pageIndex, pageNum) => {
  const itemIndex = parseInt(pageNum) - 1;
  const [startingVerseId, verseCount] = pageIndex?.[itemIndex] || [0, 0];
  const verseRangeArray = Array.from({ length: verseCount }, (_, i) => startingVerseId + i);
  const lang = determineLanguage();
  const ref = generateReference(verseRangeArray, lang);
  const showRef = pageIndex.length > 0 && startingVerseId > 0;
  return showRef ? ref : null;
};

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
    // The CANONICAL user-facing page number is the scan image-file number
    // (pageNumInt): it drives the route slug, the page input, the "Page X" label,
    // and the boxes join. Navigating to /fax/{slug}/500 opens scan 500, whose
    // visible printed number matches for editions where print tracks the scan.
    // (The per-edition `faxOffset` folio scheme was reverted — it made the URL
    // number run offset from the visible page. faxPageNum/faxPageSlug are kept as
    // aliases so callers don't churn.)
    const faxPageNum = pageNumInt;
    const faxPageSlug = pageNumRoman || pageNumInt;
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
      pageSlugLeaf: faxPageSlug,   // route slug = scan image-file number
      faxPageNum,
      faxPageSlug,
      pageReference: getRef(pageIndex, i),
      isLeftSide: i % 2 === 0,
      pageAssetUrl,
      thumbAssetUrl,
    };
  });
}
