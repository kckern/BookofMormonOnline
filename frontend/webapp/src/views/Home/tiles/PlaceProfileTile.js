import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import pin from "src/views/_Common/svg/map-icon.svg";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions } from "src/views/_Common/ViewUtils";
import { openScripture } from "./ScripturePopup";
import { flatten } from "./textUtils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

const scriptureOpts = getHtmlScriptureLinkParserOptions((ref) => openScripture(ref));

/**
 * A single-place deep profile — hero image, name, description with detected
 * scripture, and a jump to the internal map. Reserve tile drawn from a place
 * the Places tile didn't card.
 */
export default function PlaceProfileTile({ payload, placeIndex = 10 }) {
  const places = payload?.places || [];
  const place = places[placeIndex % places.length] || places[places.length - 1];
  if (!place?.slug) return null;
  const desc = flatten(place.description || place.info || "");
  return (
    <RevealProvider>
      <div className="samplerTileInner placeProfileTile">
        <h3 className="tileHeading">
          <Link to="/places">{label("places")}</Link>
        </h3>
        <div className="placeProfileHead">
          <Link to={`/places/${place.slug}`} className="placeProfileImgLink">
            <img
              src={`${assetUrl}/places/${place.slug}`}
              alt={place.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <span className="peopleFaceName placesNameOverlay">{place.name}</span>
          </Link>
          <Link
            to={`/map/internal/place/${place.slug}`}
            className="placesMapBtn placeProfileMapBtn"
            title={label("map")}
            aria-label={label("map")}
          >
            <img src={pin} alt="" />
          </Link>
        </div>
        {desc ? (
          <ExpandableText className="placeProfileDesc" lines={5}>
            {Parser(getDetectedScripturesHtml(desc), scriptureOpts)}
          </ExpandableText>
        ) : null}
        <TileDeepLink to={`/places/${place.slug}`}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
