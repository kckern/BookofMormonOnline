import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions } from "src/views/_Common/ViewUtils";
import { openScripture } from "./ScripturePopup";
import { flatten } from "./textUtils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

const scriptureOpts = getHtmlScriptureLinkParserOptions((ref) => openScripture(ref));

// Which sampler array each group draws from.
const GROUP_KEY = {
  narrative: "mattersNarrative",
  material: "mattersMaterial",
  concept: "mattersConcept",
};

/**
 * A single-matter deep profile — hero image, name, subtitle, and description with
 * detected scripture links. Reserve tile drawn from a matter the group grid tile
 * didn't card. Mirrors PlaceProfileTile; `group` selects which sampler array to
 * feature.
 */
export default function MatterProfileTile({ payload, group = "concept", matterIndex = 6 }) {
  const list = payload?.[GROUP_KEY[group]] || [];
  if (!list.length) return null;
  const matter = list[matterIndex % list.length] || list[list.length - 1];
  if (!matter?.slug) return null;
  const desc = flatten(matter.description || matter.subtitle || "");
  return (
    <RevealProvider>
      <div className="samplerTileInner placeProfileTile matterProfileTile">
        <h3 className="tileHeading">
          <Link to="/matters">{label("menu_matters")}</Link>
        </h3>
        <div className="placeProfileHead">
          <Link to={`/matters/${matter.slug}`} className="placeProfileImgLink">
            <img
              src={`${assetUrl}/matters/${matter.slug}`}
              alt={matter.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <span className="peopleFaceName placesNameOverlay">{replaceNumbers(matter.name)}</span>
          </Link>
        </div>
        {matter.subtitle ? <div className="matterProfileSub">{matter.subtitle}</div> : null}
        {desc ? (
          <ExpandableText className="placeProfileDesc" lines={5}>
            {Parser(getDetectedScripturesHtml(desc), scriptureOpts)}
          </ExpandableText>
        ) : null}
        <TileDeepLink to={`/matters/${matter.slug}`}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
