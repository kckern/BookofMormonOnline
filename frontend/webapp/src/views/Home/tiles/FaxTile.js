import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import labelOr from "./_ds/labelOr";
import TileImage from "./_ds/TileImage";
import TileDeepLink from "./_ds/TileDeepLink";
import RefPill from "./RefPill";
import { shortEdition } from "./faxLabels";

// Rendered page height cap. Two pages side by side at natural aspect get very
// tall on a wide (tablet) tile and upscale the 400px thumbnails; capping the
// row width at (sum of aspects × this height) keeps both crisp and the tile a
// sampler card, not a poster.
const PAGE_MAX_H_REM = 20;
const PAGES_GAP_REM = 0.4;

/**
 * Header on top (document title), then two pages sampled from the facsimile's
 * scripture-reference index at their NATURAL aspect, then a few other editions.
 *
 * One destination per control: the ref rail above each page is a RefPill
 * (scripture popup) BESIDE the page link, not inside it; each page links into
 * the viewer at that folio; the CTA opens the edition. The eyebrow goes to the
 * facsimiles index.
 */
export default function FaxTile({ data, payload }) {
  // Per-page natural aspect (w/h). In a flex row, growing each page proportional
  // to its aspect makes their RENDERED HEIGHTS equal while widths differ — a
  // taller (narrower) sheet just takes less horizontal room than a wide one.
  const [aspects, setAspects] = React.useState({});
  if (!data?.slug) return null;
  const format = data.format || "jpg";
  const pages = (payload?.faxPages || []).filter((p) => p?.page != null).slice(0, 2);
  const editions = (payload?.faxMore || []).filter((e) => e?.slug);
  const to = `/fax/${data.slug}`;
  const title = data.title || data.slug;
  const pageCount = Number(data.pages) || 0;
  const known = pages.every((p) => aspects[p.page]);
  const aspectSum = pages.reduce((s, p) => s + (aspects[p.page] || 0), 0);
  const rowStyle =
    pages.length && known
      ? { maxWidth: `calc(${aspectSum.toFixed(4)} * ${PAGE_MAX_H_REM}rem + ${(pages.length - 1) * PAGES_GAP_REM}rem)` }
      : undefined;
  return (
    <div className="samplerTileInner faxTile">
      <h3 className="tileHeading">
        <Link to="/fax">{label("facsimiles")}</Link>
      </h3>
      {/* mouse shortcut to the edition; keyboard users get the CTA (one tab stop) */}
      <Link to={to} className="faxTileTitleLink" tabIndex={-1}>
        <div className="faxTileTitle">
          {title}
          {pageCount ? <span className="faxTileMeta"> · {labelOr("x_pages", "$1 pages", [pageCount])}</span> : null}
        </div>
      </Link>
      {pages.length ? (
        <div className="faxTilePages" style={rowStyle}>
          {pages.map((p) => {
            // Thumbnail is keyed by the scan image-file number; the deep-link and
            // the "p. N" label stay on p.page (the printed folio, canonical route id).
            const nnn = String(p.imageFile ?? p.page).padStart(3, "0");
            return (
              <div
                key={p.page}
                className={`faxTilePage${p.ref ? " hasRef" : ""}`}
                style={{ flexGrow: aspects[p.page] || 1 }}
              >
                {p.ref ? <RefPill refText={p.ref} className="faxPageBarRef" /> : null}
                <Link to={`${to}/${p.page}`} className="faxTilePageLink">
                  <TileImage
                    path={`fax/thumb/${data.slug}/${nnn}.${format}`}
                    alt={labelOr("x_page_n", "$1, page $2", [title, p.page])}
                    onLoad={(e) => {
                      const { naturalWidth: w, naturalHeight: h } = e.target;
                      if (w && h) setAspects((a) => (a[p.page] ? a : { ...a, [p.page]: w / h }));
                    }}
                    onError={(e) => (e.target.closest(".faxTilePage").style.display = "none")}
                  />
                  {/* page number kept as a small overlay, bottom-right */}
                  <span className="faxPageBarNum" aria-hidden="true">{labelOr("page_n", "p. $1", [p.page])}</span>
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}
      {editions.length ? (
        /* a small sample of other editions — covers with a compact name */
        <div className="faxTileEditions">
          {editions.map((e) => (
            <Link key={e.slug} to={`/fax/${e.slug}`} className="faxTileEdition" title={e.title}>
              <TileImage
                path={`fax/covers/${e.slug}`}
                alt=""
                onError={(ev) => (ev.target.style.visibility = "hidden")}
              />
              <span className="faxTileEditionTitle">{shortEdition(e.title) || e.slug}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <TileDeepLink to={to} always verb="open" name={shortEdition(title)} />
    </div>
  );
}
