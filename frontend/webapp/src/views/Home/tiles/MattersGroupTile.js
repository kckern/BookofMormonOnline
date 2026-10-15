import React from "react";
import { Link } from "react-router-dom";
import { replaceNumbers } from "src/models/Utils";
import RefPill from "./RefPill";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import { verbLabel } from "./_ds/TileCTA";
import { clampWords, flatten, tr } from "./textUtils";

// 5 cards + a 3×4 mosaic end cell. The sampler may send more (the extra one is
// MatterProfileTile's, so the profile never repeats a matter shown here).
export const GROUP_CARDS = 5;
export const GROUP_MOSAIC = 12;
export const GROUP_SHOWN = GROUP_CARDS + GROUP_MOSAIC;

const CARD_SIZES = "(max-width: 480px) 45vw, (max-width: 900px) 30vw, 128px";
const MOSAIC_SIZES = "(max-width: 480px) 15vw, 48px";

/**
 * Shared body for the three matters group tiles (narrative / material / concept).
 * Places-style mosaic: each card is ONE link (image + name, plus the subtitle on
 * the narrative tile) with the seeded scripture ref as a sibling RefPill below
 * it; the end cell is a 3×4 "View all" mosaic into /matters/<group>. The tiles
 * differ only in the group label/route, the count key, and the subtitle.
 */
export default function MattersGroupTile({
  data,
  seed = 0,
  payload,
  className,
  to,
  headingKey,
  headingFallback,
  countKey,
  showSubtitle = false,
}) {
  const list = (Array.isArray(data) ? data : []).filter((m) => m?.slug);
  if (!list.length) return null;
  const cards = list.slice(0, GROUP_CARDS);
  const mosaic = list.slice(GROUP_CARDS, GROUP_SHOWN);
  const total = Number(payload?.[countKey]) || 0;
  const more = total - cards.length - mosaic.length;
  const groupName = tr(headingKey, headingFallback);
  return (
    <div className={`samplerTileInner placesTile mattersTile ${className || ""}`.trim()}>
      <h3 className="tileHeading">
        <Link to={to}>
          {labelOr("menu_matters", "Matters")} <span className="tileHeadingGroup">{groupName}</span>
        </Link>
      </h3>
      <div className="placesTileGrid">
        {cards.map((m, i) => {
          const idx = (m.index || []).filter((x) => x?.ref);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          const gloss = item?.text ? clampWords(flatten(item.text), 16) : "";
          const name = m.name ? replaceNumbers(m.name) : "";
          return (
            <div className="placesTileCard samplerCard mattersCard" key={m.slug}>
              <Link to={`/matters/${m.slug}`} className="mattersCardLink">
                <div className="placesImgWrap">
                  <TileImage
                    path={`matters/${m.slug}`}
                    alt=""
                    sizes={CARD_SIZES}
                    onError={(e) => (e.target.style.visibility = "hidden")}
                  />
                  {name ? (
                    <span className="peopleFaceName placesNameOverlay mattersNameOverlay">
                      <span className="mattersNameText">{name}</span>
                    </span>
                  ) : null}
                  {showSubtitle && m.subtitle ? (
                    <span className="mattersSubtitle">
                      <span className="mattersSubtitleText">{clampWords(m.subtitle, 12)}</span>
                    </span>
                  ) : null}
                </div>
              </Link>
              {item?.ref ? (
                <div className="placesTileInfo samplerCardBody mattersCardInfo">
                  {/* chip outside the clamp: line-clamp's overflow would clip
                      the chip's enlarged touch hit area */}
                  <RefPill refText={item.ref} className="mattersCardRef" />
                  {gloss ? <span className="placesTileIndexRow">{gloss}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <Link to={to} className="placesTileCard samplerCard viewAllCard mattersViewAll">
          {mosaic.length ? (
            <div className="viewAllMosaic viewAllMosaicFull placesMosaic" aria-hidden="true">
              {mosaic.map((m) => (
                <TileImage
                  key={m.slug}
                  path={`matters/${m.slug}`}
                  alt=""
                  widths={[256]}
                  sizes={MOSAIC_SIZES}
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
              ))}
            </div>
          ) : null}
          <span className="peopleFaceName viewAllOverlay mattersViewAllLabel">
            <span className="mattersViewAllVerb">{verbLabel("viewAll")}</span>
            {more > 0 ? (
              <span className="mattersViewAllCount">
                {labelOr("plus_n_more", "+$1 more", [String(more)])}
              </span>
            ) : null}
          </span>
        </Link>
      </div>
    </div>
  );
}
