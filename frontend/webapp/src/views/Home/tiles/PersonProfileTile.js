import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions } from "src/views/_Common/ViewUtils";
import { openScripture } from "./ScripturePopup";
import { flatten, supDigits } from "./textUtils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

const scriptureOpts = getHtmlScriptureLinkParserOptions((ref) => openScripture(ref));

/**
 * A single-person deep profile (portrait + full bio with detected scripture),
 * drawn from a person the People tile didn't feature. A reserve tile the
 * balancer inserts to fill a short column with real, journey-relevant content.
 */
export default function PersonProfileTile({ payload, personIndex = 12 }) {
  const people = payload?.people || [];
  const person = people[personIndex % people.length] || people[people.length - 1];
  if (!person?.slug || !person.description) return null;
  const bio = flatten(person.description);
  return (
    <RevealProvider>
      <div className="samplerTileInner personProfileTile">
        <h3 className="tileHeading">
          <Link to="/people">{label("people")}</Link>
        </h3>
        <div className="peopleFeature">
          <Link to={`/people/${person.slug}`} className="peopleFeatureImgLink">
            <img
              className="peopleFeatureImg"
              src={`${assetUrl}/people/${person.slug}`}
              alt={person.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
          </Link>
          <div className="peopleFeatureBody">
            <Link to={`/people/${person.slug}`} className="peopleFeatureNameLink">
              <span className="peopleFeatureName">{replaceNumbers(person.name)}</span>
              {person.title ? <span className="peopleFeatureTitle">{supDigits(person.title)}</span> : null}
            </Link>
            <ExpandableText className="peopleFeatureDesc" lines={7}>
              {Parser(getDetectedScripturesHtml(bio), scriptureOpts)}
            </ExpandableText>
          </div>
        </div>
        <TileDeepLink to={`/people/${person.slug}`}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
