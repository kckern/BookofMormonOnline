import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import pin from "src/views/_Common/svg/maps.svg";
import { openScripture } from "./ScripturePopup";
import { clampWords } from "./textUtils";

/**
 * Place cards follow the people-card convention: name overlaid on the 16:9
 * image, a corner map icon deep-linking to the internal map, and the ref-first
 * index line in the chrome. End cell = 3×3 "much more" mosaic → /places.
 */
export default function PlacesTile({ data, seed = 0 }) {
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
          const ref = idx.length ? idx[(seed + i) % idx.length].ref : null;
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
                <Link
                  to={`/map/internal/place/${p.slug}`}
                  className="placesMapBtn"
                  title={label("map")}
                  aria-label={label("map")}
                >
                  <img src={pin} alt="" />
                </Link>
              </div>
              {ref || p.info ? (
                <div className="placesTileInfo">
                  {ref ? (
                    <span
                      className="placesTileRef"
                      role="button"
                      tabIndex={0}
                      onClick={() => openScripture(ref)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openScripture(ref)}
                    >{ref}</span>
                  ) : null}
                  {ref && p.info ? " — " : ""}
                  {p.info ? clampWords(p.info, 10) : ""}
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
            <span className="peopleFaceName viewAllOverlay">{label("view_all")} →</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
