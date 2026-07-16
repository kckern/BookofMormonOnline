import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import pin from "src/views/_Common/svg/map-icon.svg";
import RefPill from "./RefPill";
import { clampWords, flatten } from "./textUtils";

/**
 * Place cards follow the people-card convention: name overlaid on the 16:9
 * image, a corner map icon deep-linking to the internal map, and the ref-first
 * index line in the chrome. End cell = 3×3 "much more" mosaic → /places.
 */
export default function PlacesTile({ data, seed = 0, payload }) {
  const cards = data.slice(0, 5);
  const mosaic = data.slice(5, 14); // 9 → true 3×3
  return (
    <div className="samplerTileInner placesTile">
      <h3 className="tileHeading">
        <Link to="/places">{label("places")}</Link>
      </h3>
      <div className="placesTileGrid">
        {cards.map((p, i) => {
          const idx = (p.index || []).filter((x) => x?.ref);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          const ref = item?.ref || null;
          return (
            <div className="placesTileCard samplerCard" key={p.slug}>
              <div className="placesImgWrap">
                <Link to={`/places/${p.slug}`}>
                  <img
                    src={`${assetUrl}/places/${p.slug}`}
                    alt={p.name || ""}
                    loading="lazy"
                    onError={(e) => (e.target.style.visibility = "hidden")}
                  />
                </Link>
                <span className="peopleFaceName placesNameOverlay">{replaceNumbers(p.name)}</span>
                {p.info ? (
                  <span className="peopleFaceTitle placesInfoOverlay">{clampWords(p.info, 8)}</span>
                ) : null}
                <Link
                  to={`/map/internal/place/${p.slug}`}
                  className="placesMapBtn"
                  title={label("map")}
                  aria-label={label("map")}
                >
                  <img src={pin} alt="" />
                </Link>
              </div>
              {(p.description || ref) ? (
                <div className="placesTileInfo samplerCardBody">
                  {p.description ? (
                    <span className="placesTileDesc">{clampWords(flatten(p.description), 16)}</span>
                  ) : null}
                  {ref ? (
                    <span className="placesTileIndexRow">
                      <RefPill refText={ref} />
                      {item?.text ? <> {clampWords(flatten(item.text), 10)}</> : null}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <Link to="/places" className="placesTileCard samplerCard viewAllCard" title={label("view_all")}>
          <div className="placesMosaicWrap">
            <div className="viewAllMosaic placesMosaic">
              {mosaic.map((p) => (
                <img
                  key={p.slug}
                  src={`${assetUrl}/places/${p.slug}`}
                  alt=""
                  loading="lazy"
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
              ))}
            </div>
            <span className="peopleFaceName viewAllOverlay">{payload?.placesCount ? `+${payload.placesCount - data.length} ${label("places")}` : label("view_more")}</span>
          </div>
          <div className="placesTileInfo samplerCardBody placesMosaicCaption">
            {mosaic.slice(0, 2).map((m) => m.name).join(", ")}…
          </div>
        </Link>
      </div>
    </div>
  );
}
