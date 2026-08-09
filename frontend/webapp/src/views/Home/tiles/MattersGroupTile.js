import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import RefPill from "./RefPill";
import { clampWords, flatten, tr } from "./textUtils";

/**
 * Shared body for the three matters group tiles (narrative / material / concept).
 * Places-style image mosaic: image + name overlay (+ optional subtitle overlay) +
 * a seeded scripture ref from the matter's index; end cell = 3×4 "much more"
 * mosaic into /matters. Whole card → /matters/<slug>. The tiles differ only in
 * the group label/route, the count key, and whether the subtitle overlay shows.
 */
export default function MattersGroupTile({
  data = [],
  seed = 0,
  payload,
  className,
  to,
  headingKey,
  headingFallback,
  countKey,
  showSubtitle = false,
}) {
  const cards = data.slice(0, 5);
  const mosaic = data.slice(5, 17);
  const total = payload?.[countKey] || 0;
  return (
    <div className={`samplerTileInner placesTile mattersTile ${className}`}>
      <h3 className="tileHeading">
        <Link to={to}>
          {label("menu_matters")}<span className="tileHeadingGroup">{tr(headingKey, headingFallback)}</span>
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
                {showSubtitle && m.subtitle ? (
                  <span className="peopleFaceTitle placesInfoOverlay">{clampWords(m.subtitle, 8)}</span>
                ) : null}
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
        <Link to={to} className="placesTileCard samplerCard viewAllCard" title={label("view_all")}>
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
