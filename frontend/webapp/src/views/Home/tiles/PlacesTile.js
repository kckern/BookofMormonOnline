import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import pin from "src/views/_Common/svg/map-icon.svg";
import RefPill from "./RefPill";
import TileImage from "./_ds/TileImage";
import FitWords from "./_ds/FitWords";
import labelOr from "./_ds/labelOr";
import { verbLabel } from "./_ds/TileCTA";
import { flatten, supDigits, tidy } from "./textUtils";

const CARDS = 5;

// info strings are terse data labels: flatten markup and drop trailing junk
// punctuation ("record depository;")
const cleanInfo = (s) => tidy(flatten(s).replace(/[\s;,:]+$/, ""));
// source-name hygiene: "City of and Land of Shilom" → "City and Land of Shilom"
export const placeName = (s) => supDigits(flatten(s || "")).replace(/\bof and\b/g, "and");
// a card hook needs a real phrase: one-word glosses ("Retained") lose to any
// index line of 3+ words when the place has one (audit H1)
const wordCount = (s) => flatten(s || "").split(/\s+/).filter(Boolean).length;
// …and a statement beats a quoted rhetorical question or an alias note ("Is
// not Hamath as Arpad?", "Also known as Ai…") — duds on the card (audit H2)
const weakHook = (s) => /\?\s*$/.test(flatten(s || "")) || /^\s*(also )?(known|called) as\b/i.test(flatten(s || ""));
export const hookLines = (index) => {
  const idx = (index || []).filter((x) => x?.ref);
  const good = idx.filter((x) => wordCount(x.text) >= 3);
  const best = good.filter((x) => !weakHook(x.text));
  if (best.length) return best;
  return good.length ? good : idx;
};
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

/** Slugs a payload FEATURES: the Places tile's cards and the profiled place. */
export const featuredPlaceSlugs = (payload) => {
  const list = (payload?.places || []).filter((p) => p?.slug);
  const out = new Set(list.slice(0, CARDS).map((p) => p.slug));
  const pi = profiledPlaceIndex(list);
  if (pi >= 0) out.add(list[pi].slug);
  return out;
};

/**
 * An infinite batch re-samples from the same ~188 places, so a place already
 * featured higher up the feed (a card, the profile) could come back as a card
 * or the profile (audit H4). Reorder the batch: unseen places take the card
 * slots and the profile slot; seen ones only feed the mosaic. Returns the
 * payload unchanged when nothing in it was seen.
 */
export const withoutSeenPlaces = (payload, seen) => {
  const list = payload?.places;
  if (!Array.isArray(list) || !seen?.size || !list.some((p) => seen.has(p?.slug))) return payload;
  const unseen = list.filter((p) => !seen.has(p?.slug));
  const old = list.filter((p) => seen.has(p?.slug));
  const out = [...unseen, ...old];
  // the profile slot gets an unseen place too, when there are enough of them
  if (unseen.length > CARDS) {
    const prof = out.splice(unseen.length - 1, 1)[0];
    out.splice(profiledPlaceIndex([...out, prof]), 0, prof);
  }
  return { ...payload, places: out };
};

/**
 * Place cards follow the people-card convention: name overlaid on the square
 * image, info band along its bottom, a corner map pin deep-linking to the
 * internal map, and the seeded index line (RefPill + gloss) underneath. One
 * place link is stretched over the WHOLE card (image + body, audit C1); the
 * pin and the pill sit above it. Both text bands fit by whole words
 * (FitWords), never a mid-word ellipsis (audit H3). End cell = the "much
 * more" mosaic → /places.
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
          const name = placeName(p.name);
          const idx = hookLines(p.index);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          const ref = item?.ref || null;
          const gloss = item?.text ? tidy(flatten(item.text)) : "";
          return (
            <div className="placesTileCard samplerCard" key={p.slug}>
              <Link to={`/places/${p.slug}`} className="placesCardLink" aria-label={name} />
              <div className="placesImgWrap">
                <TileImage
                  path={`places/${p.slug}`}
                  alt={name}
                  sizes="(max-width: 480px) 45vw, (max-width: 900px) 30vw, 120px"
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
                <span className="peopleFaceName placesNameOverlay">{name}</span>
                {p.info ? (
                  <span className="peopleFaceTitle placesInfoOverlay">
                    <FitWords className="placesInfoText" text={cleanInfo(p.info)} lines={2} />
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
                  <FitWords className="placesTileIndexRow" prefix={<RefPill refText={ref} />} text={gloss} lines={3} />
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
          {/* the card-grid family's one end-card label: "View all" + "+N more",
              exactly as the Matters twin (audit places-C3) */}
          <span className="peopleFaceName viewAllOverlay mattersViewAllLabel">
            <span className="mattersViewAllVerb viewAllVerb">{verbLabel("viewAll")}</span>
            {more > 0 ? (
              <span className="mattersViewAllCount viewAllCount">{labelOr("plus_n_more", "+$1 more", [String(more)])}</span>
            ) : null}
          </span>
        </Link>
      </div>
    </div>
  );
}
