/**
 * Derive the v5-shaped page route params from a react-router 7 splat.
 *
 * react-router 5 matched these three shapes with distinct patterns:
 *   /:pageSlug+                         -> page
 *   /:pageSlug+/:textId(\d+)            -> text block
 *   /:pageSlug+/:textId(\d+)/fax/:faxVersion+
 *
 * v7 supports neither multi-segment params (`+`) nor regex params, and the slug
 * really can be several segments — so models/Routes.js collapses all three into
 * one `path: "*"` entry and Page calls this to recover the same fields.
 *
 * The classification deliberately mirrors frontend/next/app/[...path]/page.tsx,
 * which decides the same thing server-side for crawlers: a numeric LAST segment
 * means a text block and everything before it is the slug. Keep the two in step
 * — if they disagree, a crawler and a browser render different pages for one URL.
 */
export function parsePagePath(splat) {
  const segs = String(splat || "")
    .split("/")
    .filter(Boolean);

  // /<slug...>/<n>/fax/<version...> — `fax` must follow the numeric text id, so
  // a page whose slug merely contains "fax" is not mistaken for a facsimile.
  const faxIdx = segs.indexOf("fax");
  if (faxIdx > 0 && /^\d+$/.test(segs[faxIdx - 1] || "")) {
    return {
      pageSlug: segs.slice(0, faxIdx - 1).join("/") || undefined,
      textId: segs[faxIdx - 1],
      faxVersion: segs.slice(faxIdx + 1).join("/") || undefined,
    };
  }

  const last = segs[segs.length - 1];
  if (segs.length >= 2 && /^\d+$/.test(last)) {
    return { pageSlug: segs.slice(0, -1).join("/"), textId: last };
  }

  return { pageSlug: segs.join("/") || undefined };
}

export default parsePagePath;
