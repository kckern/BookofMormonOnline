import React from "react";
import { Link } from "react-router-dom";
import { replaceNumbers } from "src/models/Utils";
import RefPill from "./RefPill";
import TileImage from "./_ds/TileImage";
import FitWords from "./_ds/FitWords";
import labelOr from "./_ds/labelOr";
import { verbLabel } from "./_ds/TileCTA";
import { flatten, stripEditorNote, tidy, tr } from "./textUtils";

// 5 cards + a 3×4 mosaic end cell. The sampler may send more (the extra one is
// MatterProfileTile's, so the profile never repeats a matter shown here).
export const GROUP_CARDS = 5;
export const GROUP_MOSAIC = 12;
export const GROUP_SHOWN = GROUP_CARDS + GROUP_MOSAIC;

// One casing rule for every group (R7 XC2): the concept rows are dictionary
// headwords ("Ridding the garments", "Persecute, persecution") beside Title
// Case siblings. Small words stay low except first; a word already carrying a
// capital (or a digit/superscript) is left as the data spells it.
const SMALL = /^(a|an|and|as|at|but|by|for|from|in|into|nor|of|on|or|the|to|upon|with)$/i;
export const matterName = (raw) =>
  tidy(replaceNumbers(raw || ""))
    .split(" ")
    .map((w, i) => {
      if (!w || /[A-Z\d]/.test(w) || !/^[a-z]/.test(w)) return w;
      if (i > 0 && SMALL.test(w)) return w;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");

// Which payload arrays the three group tiles draw from; the concept array also
// feeds MatterProfileTile (index GROUP_SHOWN, the first matter past the grid).
const GROUP_KEYS = ["mattersNarrative", "mattersMaterial", "mattersConcept"];
const PROFILE_KEY = "mattersConcept";

/** Slugs a payload FEATURES: each group tile's cards and the profiled matter. */
export const featuredMatterSlugs = (payload) => {
  const out = new Set();
  GROUP_KEYS.forEach((k) => {
    const list = (payload?.[k] || []).filter((m) => m?.slug);
    list.slice(0, GROUP_CARDS).forEach((m) => out.add(m.slug));
    if (k === PROFILE_KEY && list[GROUP_SHOWN]) out.add(list[GROUP_SHOWN].slug);
  });
  return out;
};

/**
 * An infinite batch re-samples each group (108 concepts, ~17 per draw), so a
 * matter featured higher up the feed came back as a card or the profile (R7
 * concept-H4). As withoutSeenPlaces: unseen matters take the card slots (and
 * the profile slot), seen ones only feed the mosaic. Unchanged when nothing
 * in the batch was seen.
 */
export const withoutSeenMatters = (payload, seen) => {
  if (!payload || !seen?.size) return payload;
  let next = payload;
  GROUP_KEYS.forEach((k) => {
    const list = payload[k];
    if (!Array.isArray(list) || !list.some((m) => seen.has(m?.slug))) return;
    const unseen = list.filter((m) => !seen.has(m?.slug));
    const old = list.filter((m) => seen.has(m?.slug));
    const out = [...unseen, ...old];
    // the profile slot takes the last unseen matter when the grid would
    // otherwise leave it a seen one
    if (k === PROFILE_KEY && out.length > GROUP_SHOWN && unseen.length > GROUP_CARDS && unseen.length <= GROUP_SHOWN) {
      const prof = out.splice(unseen.length - 1, 1)[0];
      out.splice(GROUP_SHOWN, 0, prof);
    }
    next = { ...next, [k]: out };
  });
  return next;
};

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
          // fit to three whole lines by measurement (FitWords): a word budget fed
          // into a CSS line-clamp cut mid-word ("the people's dut…", audit matters-04)
          const gloss = item?.text ? tidy(stripEditorNote(flatten(item.text))) : "";
          const name = m.name ? matterName(m.name) : "";
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
                    <span className={`peopleFaceName placesNameOverlay mattersNameOverlay${name.length > 16 ? " isLong" : ""}`}>
                      <span className="mattersNameText">{name}</span>
                    </span>
                  ) : null}
                  {showSubtitle && m.subtitle ? (
                    <span className="mattersSubtitle">
                      <FitWords className="mattersSubtitleText" text={tidy(m.subtitle)} lines={2} />
                    </span>
                  ) : null}
                </div>
              </Link>
              {item?.ref ? (
                <div className="placesTileInfo samplerCardBody mattersCardInfo">
                  {/* chip outside the clamp: line-clamp's overflow would clip
                      the chip's enlarged touch hit area */}
                  <RefPill refText={item.ref} className="mattersCardRef" />
                  {gloss ? <FitWords className="placesTileIndexRow" text={gloss} lines={3} /> : null}
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
            <span className="mattersViewAllVerb viewAllVerb">{verbLabel("viewAll")}</span>
            {more > 0 ? (
              <span className="mattersViewAllCount viewAllCount">
                {labelOr("plus_n_more", "+$1 more", [String(more)])}
              </span>
            ) : null}
          </span>
        </Link>
      </div>
    </div>
  );
}
