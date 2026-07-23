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
export function buildLeafIndex(item, pgoffset, pageIndex, getRef, assetBaseUrl) {
  const pages = parseInt(item.pages, 10);
  const totalLeaves = pages + 1 + pgoffset;
  const baseUrl = `${assetBaseUrl}/fax/pages/${item.slug}/`;
  const fmt = item.format || "jpg";
  return Array.from({ length: totalLeaves }, (_, idx) => {
    const i = idx - pgoffset;
    const pageNumInt = i > 0 ? i : null;
    const pageNumRoman = i <= 0 ? convertIntToRomanNumeral(pgoffset + i, true) : null;
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
      pageReference: getRef(pageIndex, i),
      isLeftSide: i % 2 === 0,
      pageAssetUrl,
      thumbAssetUrl,
    };
  });
}
