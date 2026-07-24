import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { enDash } from "./textUtils";
import { openScripture } from "./ScripturePopup";

/**
 * Header on top (document title), then two pages sampled from the facsimile's
 * scripture-reference index at their NATURAL aspect — page number and
 * reference overlaid on the sheet, no caption strip below. Each page
 * deep-links into the real viewer (/fax/:version/:page).
 */
export default function FaxTile({ data, payload }) {
  // Per-page natural aspect (w/h). In a flex row, growing each page proportional
  // to its aspect makes their RENDERED HEIGHTS equal while widths differ — a
  // taller (narrower) sheet just takes less horizontal room than a wide one.
  const [aspects, setAspects] = React.useState({});
  if (!data?.slug) return null;
  const format = data.format || "jpg";
  const pages = (payload?.faxPages || []).slice(0, 2);
  const editions = (payload?.faxMore || []).filter((e) => e?.slug);
  return (
    <div className="samplerTileInner faxTile">
      <h3 className="tileHeading">
        <Link to={`/fax/${data.slug}`}>{label("facsimiles")}</Link>
      </h3>
      <Link to={`/fax/${data.slug}`} className="faxTileTitleLink">
        <div className="faxTileTitle">
          {data.title}
          {data.pages ? <span className="faxTileMeta"> · {data.pages} pp.</span> : null}
        </div>
      </Link>
      {pages.length ? (
        <div className="faxTilePages">
          {pages.map((p) => {
            const nnn = String(p.page).padStart(3, "0");
            return (
              <Link
                key={p.page}
                to={`/fax/${data.slug}/${p.page}`}
                className="faxTilePage"
                title={p.ref}
                style={{ flexGrow: aspects[p.page] || 1 }}
              >
                {/* reference rail above the page (indexed editions carry a ref) */}
                {p.ref ? (
                  <span
                    className="faxPageBarRef scripture_link"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openScripture(p.ref); }}
                  >
                    {enDash(p.ref)}
                  </span>
                ) : null}
                <img
                  src={`${assetUrl}/fax/thumb/${data.slug}/${nnn}.${format}`}
                  alt={`${data.title} p.${p.page}`}
                  loading="lazy"
                  onLoad={(e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.target;
                    if (w && h) setAspects((a) => (a[p.page] ? a : { ...a, [p.page]: w / h }));
                  }}
                  onError={(e) => (e.target.style.display = "none")}
                />
                {/* page number kept as a small overlay, bottom-right */}
                <span className="faxPageBarNum">p. {p.page}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
      {editions.length ? (
        /* a small sample of other editions — four covers, title on hover */
        <div className="faxTileEditions">
          {editions.map((e) => (
            <Link key={e.slug} to={`/fax/${e.slug}`} className="faxTileEdition" title={e.title}>
              <img
                src={`${assetUrl}/fax/covers/${e.slug}`}
                alt={e.title}
                loading="lazy"
                onError={(ev) => (ev.target.style.visibility = "hidden")}
              />
              <span className="faxTileEditionTitle">{e.title}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
