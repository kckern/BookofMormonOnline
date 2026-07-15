import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import pin from "src/views/_Common/svg/maps.svg";
import { openScripture } from "./ScripturePopup";
import { clampWords, flatten } from "./textUtils";

/**
 * Place cards follow the people-card convention: name overlaid on the 16:9
 * image, a corner map icon deep-linking to the internal map, and the ref-first
 * index line in the chrome. End cell = 3×3 "much more" mosaic → /places.
 */
export default function PlacesTile({ data, seed = 0, payload }) {
  const cards = data.slice(0, 3);
  const mosaic = data.slice(3, 12);
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
            <div className="placesTileCard" key={p.slug}>
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
              {ref ? (
                <div className="placesTileInfo">
                  <span
                    className="placesTileRef"
                    role="button"
                    tabIndex={0}
                    onClick={() => openScripture(ref)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openScripture(ref)}
                  >{ref}</span>
                  {item?.text ? <> — {clampWords(flatten(item.text), 12)}</> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <Link to="/places" className="placesTileCard viewAllCard" title={label("view_all")}>
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
        </Link>
      </div>
    </div>
  );
}
