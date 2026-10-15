import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { label } from "src/models/Utils";
import pin from "src/views/_Common/svg/map-icon.svg";
import { getDetectedScripturesHtml } from "src/views/_Common/ViewUtils";
import { flatten, supDigits } from "./textUtils";
import ExpandableText from "./ExpandableText";
import RefPill from "./RefPill";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import { profiledPlaceIndex } from "./PlacesTile";

// Detected scripture → the sampler's one RefPill (a real <button>, so prose
// refs are keyboard-reachable). The detection pass emits an anchor with
// className "scripture_link"; attribute case depends on the parser.
const refPillOpts = {
  replace: (node) => {
    const cls = node?.attribs?.className ?? node?.attribs?.classname ?? node?.attribs?.class;
    if (node?.name !== "a" || cls !== "scripture_link") return undefined;
    return <RefPill refText={node.children?.[0]?.data || ""} />;
  },
};

// "(" + pill + ")" travel together: a nowrap run, so a line break never
// orphans a parenthesis (audit A3/A4).
const attachParens = (html) =>
  html.replace(
    /\(\s*(<a className="scripture_link">[^<]*<\/a>)\s*\)/g,
    '<span class="refParen">($1)</span>',
  );

/**
 * A single-place deep profile: hero image (→ the place page) with the map pin,
 * the description with detected scripture (Layer 1: Read more ⇄ Show less),
 * then "Open <place>" (Layer 2). Profiles a place the same sample's Places tile
 * doesn't show (see profiledPlaceIndex).
 */
export default function PlaceProfileTile({ payload, placeIndex }) {
  // slug-filtered exactly as PlacesTile does, so profiledPlaceIndex agrees
  const places = (payload?.places || []).filter((p) => p?.slug);
  if (!places.length) return null;
  const i = placeIndex != null ? placeIndex % places.length : profiledPlaceIndex(places);
  const place = places[i] || places[places.length - 1];
  if (!place?.slug) return null;
  const name = supDigits(flatten(place.name || ""));
  const desc = flatten(place.description || place.info || "");
  return (
    <RevealProvider>
      <div className="samplerTileInner placeProfileTile placeProfilePlace">
        <h3 className="tileHeading">
          <Link to="/places">{label("places")}</Link>
        </h3>
        <div className="placeProfileHead">
          <Link to={`/places/${place.slug}`} className="placeProfileImgLink">
            <TileImage
              path={`places/${place.slug}`}
              alt={name}
              sizes="(max-width: 900px) 92vw, 380px"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <span className="peopleFaceName placesNameOverlay">{name}</span>
          </Link>
          <Link
            to={`/map/internal/place/${place.slug}`}
            className="placesMapBtn placeProfileMapBtn"
            title={label("map")}
            aria-label={`${label("map")}: ${name}`}
          >
            <img src={pin} alt="" />
          </Link>
        </div>
        {desc ? (
          <ExpandableText className="placeProfileDesc" lines={5}>
            {Parser(attachParens(getDetectedScripturesHtml(desc)), refPillOpts)}
          </ExpandableText>
        ) : null}
        <TileDeepLink to={`/places/${place.slug}`} verb="open" name={name} />
      </div>
    </RevealProvider>
  );
}
