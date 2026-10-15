import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import pin from "src/views/_Common/svg/map-icon.svg";
import RefPill from "./RefPill";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import { verbLabel } from "./_ds/TileCTA";
import { clampWords, flatten, supDigits } from "./textUtils";

const CARDS = 5;

// info strings are terse data labels: flatten markup and drop trailing junk
// punctuation ("record depository;")
const cleanInfo = (s) => flatten(s).replace(/[\s;,:]+$/, "");
const MOSAIC_MAX = 12; // 3×4 fills the end card

/**
 * Which payload place the PlaceProfile tile profiles: the first one past what
 * the Places tile can show (index 17), or — on the usual 17-place payload —
 * the last one, which the mosaic below then skips. Shared so the two tiles in
 * one sample never show the same place twice (audit placeProfile H4).
 */
export const profiledPlaceIndex = (places) => {
  const n = places?.length || 0;
  if (!n) return -1;
  return n > CARDS + MOSAIC_MAX ? CARDS + MOSAIC_MAX : n - 1;
};

/**
 * Place cards follow the people-card convention: name overlaid on the square
 * image, info band along its bottom, a corner map pin deep-linking to the
 * internal map, and the seeded index line (RefPill + gloss) underneath. The
 * image link is stretched over the whole card (one link per destination); the
 * pin and the pill sit above it. End cell = the "much more" mosaic → /places.
 */
export default function PlacesTile({ data, seed = 0, payload }) {
  const list = (data || []).filter((p) => p?.slug);
  if (!list.length) return null;
  const cards = list.slice(0, CARDS);
  const skip = profiledPlaceIndex(list);
  const pool = list.slice(CARDS).filter((_, i) => i + CARDS !== skip);
  // full rows only: 3×4 when the pool allows, else 3×3 (never a ragged hole)
  const mosaic = pool.slice(0, Math.min(MOSAIC_MAX, Math.floor(pool.length / 3) * 3));
  const more = payload?.placesCount ? payload.placesCount - list.length : 0;
  return (
    <div className="samplerTileInner placesTile placesTilePlaces">
      <h3 className="tileHeading">
        <Link to="/places">{label("places")}</Link>
      </h3>
      <div className="placesTileGrid">
        {cards.map((p, i) => {
          const name = supDigits(flatten(p.name || ""));
          const idx = (p.index || []).filter((x) => x?.ref);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          const ref = item?.ref || null;
          const gloss = item?.text ? clampWords(flatten(item.text), 10) : "";
          return (
            <div className="placesTileCard samplerCard" key={p.slug}>
              <div className="placesImgWrap">
                <Link to={`/places/${p.slug}`} className="placesCardLink">
                  <TileImage
                    path={`places/${p.slug}`}
                    alt={name}
                    sizes="(max-width: 480px) 45vw, (max-width: 900px) 30vw, 120px"
                    onError={(e) => (e.target.style.visibility = "hidden")}
                  />
                </Link>
                <span className="peopleFaceName placesNameOverlay">{name}</span>
                {p.info ? (
                  <span className="peopleFaceTitle placesInfoOverlay">
                    <span className="placesInfoText">{cleanInfo(p.info)}</span>
                  </span>
                ) : null}
                <Link
                  to={`/map/internal/place/${p.slug}`}
                  className="placesMapBtn"
                  title={label("map")}
                  aria-label={`${label("map")}: ${name}`}
                >
                  <img src={pin} alt="" />
                </Link>
              </div>
              {ref ? (
                <div className="placesTileInfo samplerCardBody">
                  <span className="placesTileIndexRow">
                    <RefPill refText={ref} />
                    {gloss ? <> {gloss}</> : null}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
        {/* end cell: a full-row mosaic filling the whole card (no caption) */}
        <Link to="/places" className="placesTileCard samplerCard viewAllCard">
          <div className="viewAllMosaic viewAllMosaicFull placesMosaic">
            {mosaic.map((p) => (
              <TileImage
                key={p.slug}
                path={`places/${p.slug}`}
                alt=""
                widths={[256]}
                sizes="48px"
                onError={(e) => (e.target.style.visibility = "hidden")}
              />
            ))}
          </div>
          <span className="peopleFaceName viewAllOverlay">
            {more > 0 ? labelOr("plus_n_places", "+$1 Places", [more]) : verbLabel("viewAll")}
          </span>
        </Link>
      </div>
    </div>
  );
}
