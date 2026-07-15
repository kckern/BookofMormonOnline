import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { enDash } from "./textUtils";

/**
 * Two pages sampled from the facsimile's scripture-reference index, each
 * captioned with its reference and deep-linking into the REAL viewer at that
 * page (/fax/:version/:page — verse overlays and all). No dead-end lightbox.
 */
export default function FaxTile({ data, payload }) {
  if (!data?.slug) return null;
  const format = data.format || "jpg";
  const pages = (payload?.faxPages || []).slice(0, 2);
  return (
    <div className="samplerTileInner faxTile">
      <h3 className="tileHeading">
        <Link to={`/fax/${data.slug}`}>{label("facsimiles")}</Link>
      </h3>
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
                <span className="faxTilePageRef">{enDash(p.ref)}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
      <Link to={`/fax/${data.slug}`} className="faxTileTitleLink">
        <div className="faxTileTitle">{data.title}</div>
        {data.pages ? <div className="faxTileMeta">{data.pages} pp.</div> : null}
      </Link>
    </div>
  );
}
