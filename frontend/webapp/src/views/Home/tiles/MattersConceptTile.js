import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import RefPill from "./RefPill";
import { clampWords, flatten, tr } from "./textUtils";

/**
 * Concept matters (branch=concepts) — abstractions like Judgment Seat, Family,
 * Oaths. Same places-style image mosaic as its sibling matters tiles: image +
 * name overlay + a seeded scripture ref from the matter's index. End cell = 3×4
 * "much more" mosaic into /matters. Whole card → /matters/<slug>.
 */
export default function MattersConceptTile({ data = [], seed = 0, payload }) {
  const cards = data.slice(0, 5);
  const mosaic = data.slice(5, 17);
  const total = payload?.mattersConceptCount || 0;
  return (
    <div className="samplerTileInner placesTile mattersTile mattersConceptTile">
      <h3 className="tileHeading">
        <Link to="/matters/concepts">
          {label("menu_matters")}<span className="tileHeadingGroup">{tr("matters_group_concepts", "Concepts")}</span>
        </Link>
      </h3>
      <div className="placesTileGrid">
        {cards.map((m, i) => {
          const idx = (m.index || []).filter((x) => x?.ref);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          const ref = item?.ref || null;
          return (
            <Link to={`/matters/${m.slug}`} className="placesTileCard samplerCard" key={m.slug}>
              <div className="placesImgWrap">
                <img
                  src={`${assetUrl}/matters/${m.slug}`}
                  alt={m.name || ""}
                  loading="lazy"
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
                <span className="peopleFaceName placesNameOverlay">{replaceNumbers(m.name)}</span>
              </div>
              {ref ? (
                <div className="placesTileInfo samplerCardBody">
                  <span className="placesTileIndexRow">
                    <RefPill refText={ref} />
                    {item?.text ? <> {clampWords(flatten(item.text), 16)}</> : null}
                  </span>
                </div>
              ) : null}
            </Link>
          );
        })}
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
