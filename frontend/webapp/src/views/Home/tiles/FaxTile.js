import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import labelOr from "./_ds/labelOr";
import TileImage, { knownSize } from "./_ds/TileImage";
import TileDeepLink from "./_ds/TileDeepLink";
import RefPill from "./RefPill";
import { shortEdition } from "./faxLabels";

// Rendered page height cap. The thumbnails are 400px tall with no 2x variant,
// so on a 2x screen anything above 200 CSS px is upscaled and the page text
// goes soft beside the crisp covers (blind R7 fax-A2: 252px desktop, 320px
// tablet). Capping the row width at (sum of aspects × this height) keeps both
// pages at ≤ 200px tall and the tile a sampler card, not a poster.
const THUMB_PX = 400;
const PAGE_MAX_H_REM = THUMB_PX / 2 / 16; // 12.5rem
const PAGES_GAP_REM = 0.4;
// Box reserved for a page whose thumbnail hasn't loaded yet (a typical octavo
// leaf, w/h). Once a page has loaded this session its real aspect is reused,
// so a remount on Back has its final height at once (blind audit fax-B1/XC2).
const DEFAULT_PAGE_ASPECT = 0.64;
// The scan image-file number: the thumbnail asset key AND the viewer's route
// segment (faxGeometry.buildLeafIndex — "/fax/{slug}/N opens scan N", labelled
// "Page N"). The index's `page` is offset from it per edition (1981: −9), so it
// must never reach the link or the "p. N" label (blind audit fax-D4).
const scanOf = (p) => p.imageFile ?? p.page;
const thumbPath = (slug, p, format) => `fax/thumb/${slug}/${String(scanOf(p)).padStart(3, "0")}.${format}`;
const learnedAspect = (path) => {
  const s = knownSize(path);
  return s ? s.w / s.h : null;
};

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
  const format = data?.format || "jpg";
  const pages = (payload?.faxPages || []).filter((p) => p?.page != null).slice(0, 2);
  const [aspects, setAspects] = React.useState(() => {
    const out = {};
    if (data?.slug) pages.forEach((p) => { const a = learnedAspect(thumbPath(data.slug, p, format)); if (a) out[p.page] = a; });
    return out;
  });
  if (!data?.slug) return null;
  const editions = (payload?.faxMore || []).filter((e) => e?.slug);
  const to = `/fax/${data.slug}`;
  const title = data.title || data.slug;
  const pageCount = Number(data.pages) || 0;
  const aspectOf = (p) => aspects[p.page] || DEFAULT_PAGE_ASPECT;
  const aspectSum = pages.reduce((s, p) => s + aspectOf(p), 0);
  const pagesW = pages.length
    ? `calc(${aspectSum.toFixed(4)} * ${PAGE_MAX_H_REM}rem + ${(pages.length - 1) * PAGES_GAP_REM}rem)`
    : null;
  const rowStyle = pagesW ? { maxWidth: pagesW } : undefined;
  // a wide card sets the editions beside the pages (Sampler.css @container
  // faxCard) instead of leaving the row's right side empty
  const bodyStyle = pagesW ? { "--fax-pages-w": pagesW } : undefined;
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
      <div className="faxTileBody" style={bodyStyle}>
      {pages.length ? (
        <div className="faxTilePages" style={rowStyle}>
          {pages.map((p) => {
            // Thumbnail, deep-link and "p. N" label all use the scan number, so
            // the tile, its label and the viewer show the same leaf.
            return (
              <div
                key={p.page}
                className={`faxTilePage${p.ref ? " hasRef" : ""}`}
                style={{ flexGrow: aspectOf(p) }}
              >
                {p.ref ? <RefPill refText={p.ref} className="faxPageBarRef" /> : null}
                <Link to={`${to}/${scanOf(p)}`} className="faxTilePageLink">
                  <TileImage
                    path={thumbPath(data.slug, p, format)}
                    sizes="140px"
                    aspect={String(aspectOf(p))}
                    uncapped /* the row is height-bounded (PAGE_MAX_H_REM) */
                    remember
                    alt={labelOr("x_page_n", "$1, page $2", [title, scanOf(p)])}
                    onLoad={(e) => {
                      const { naturalWidth: w, naturalHeight: h } = e.target;
                      if (w && h) setAspects((a) => (a[p.page] ? a : { ...a, [p.page]: w / h }));
                    }}
                    onError={(e) => (e.target.closest(".faxTilePage").style.display = "none")}
                  />
                  {/* page number kept as a small overlay, bottom-right */}
                  <span className="faxPageBarNum" aria-hidden="true">{labelOr("page_n", "p. $1", [scanOf(p)])}</span>
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
                sizes="120px"
                alt=""
                onError={(ev) => (ev.target.style.visibility = "hidden")}
              />
              <span className="faxTileEditionTitle">{shortEdition(e.title) || e.slug}</span>
            </Link>
          ))}
        </div>
      ) : null}
      </div>
      <TileDeepLink to={to} always verb="open" name={shortEdition(title)} />
    </div>
  );
}
