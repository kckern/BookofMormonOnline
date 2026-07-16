import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { openScripture } from "./ScripturePopup";

/**
 * Header on top (document title), then two pages sampled from the facsimile's
 * scripture-reference index at their NATURAL aspect — page number and
 * reference overlaid on the sheet, no caption strip below. Each page
 * deep-links into the real viewer (/fax/:version/:page).
 */
export default function FaxTile({ data, payload }) {
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
              <Link key={p.page} to={`/fax/${data.slug}/${p.page}`} className="faxTilePage" title={p.ref}>
                <img
                  src={`${assetUrl}/fax/thumb/${data.slug}/${nnn}.${format}`}
                  alt={`${data.title} p.${p.page}`}
                  loading="lazy"
                  onError={(e) => (e.target.style.display = "none")}
                />
                <span className="faxPageBar">
                  <span
                    className="faxPageBarRef"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openScripture(p.ref); }}
                  >
                    {p.ref}
                  </span>
                  <span className="faxPageBarNum">p. {p.page}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
      {editions.length ? (
        <div className="faxTileEditions">
          {editions.map((e) => (
            <Link key={e.slug} to={`/fax/${e.slug}`} className="faxTileEdition" title={e.title}>
              <img
                src={`${assetUrl}/fax/covers/${e.slug}`}
                alt={e.title}
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
