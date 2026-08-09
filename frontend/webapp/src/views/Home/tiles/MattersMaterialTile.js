import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { clampWords } from "./textUtils";

/**
 * Material/Indefinite matters — typological classes (branch=concrete,
 * specificity!=instance) like Swords, Gold, Houses. These appear everywhere, so
 * the hook is ubiquity: a ref-count badge (nrefs) + the subtitle, not one
 * arbitrary verse. Whole card → /matters/<slug> (opens the matters popup).
 */
export default function MattersMaterialTile({ data = [], seed = 0, payload }) {
  const cards = data.slice(0, 5);
  const mosaic = data.slice(5, 17);
  const total = payload?.mattersMaterialCount || 0;
  return (
    <div className="samplerTileInner placesTile mattersTile mattersMaterialTile">
      <h3 className="tileHeading">
        <Link to="/matters">{label("menu_matters")}</Link>
      </h3>
      <div className="placesTileGrid">
        {cards.map((m) => (
          <Link to={`/matters/${m.slug}`} className="placesTileCard samplerCard" key={m.slug}>
            <div className="placesImgWrap">
              <img
                src={`${assetUrl}/matters/${m.slug}`}
                alt={m.name || ""}
                loading="lazy"
                onError={(e) => (e.target.style.visibility = "hidden")}
              />
              <span className="peopleFaceName placesNameOverlay">{replaceNumbers(m.name)}</span>
              {m.nrefs ? (
                <span className="mattersRefBadge" title={label("references")}>{m.nrefs}×</span>
              ) : null}
            </div>
            {m.subtitle ? (
              <div className="placesTileInfo samplerCardBody">
                <span className="mattersMaterialSub">{clampWords(m.subtitle, 12)}</span>
              </div>
            ) : null}
          </Link>
        ))}
        <Link to="/matters" className="placesTileCard samplerCard viewAllCard" title={label("view_all")}>
          <div className="viewAllMosaic viewAllMosaicFull placesMosaic">
            {mosaic.map((m) => (
              <img
                key={m.slug}
                src={`${assetUrl}/matters/${m.slug}`}
                alt=""
                loading="lazy"
                onError={(e) => (e.target.style.visibility = "hidden")}
              />
            ))}
          </div>
          <span className="peopleFaceName viewAllOverlay">
            {total ? `+${total - data.length} ${label("menu_matters")}` : label("view_more")}
          </span>
        </Link>
      </div>
    </div>
  );
}
