import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions } from "src/views/_Common/ViewUtils";
import { openScripture } from "./ScripturePopup";
import RefPill from "./RefPill";
import ExpandableText from "./ExpandableText";

import { flatten, clampWords, supDigits } from "./textUtils";

/**
 * Sampling, not a mosaic: the seeded-first person is FEATURED — portrait,
 * epithet, bio with live scripture links, reference chips. Seven more render
 * as face cards (name + title + one index ref each), and the end cell is a
 * 3×3 mosaic of yet more faces — the "there is much more" signal — into /people.
 */
export default function PeopleTile({ data, seed = 0, payload }) {
  const [featured, ...rest] = data;
  const bio = flatten(featured.description);
  const faces = rest.slice(0, 11);
  const mosaic = rest.slice(11, 23); // 12 → 3×4 fills the end card
  const scriptureOpts = getHtmlScriptureLinkParserOptions((ref) => openScripture(ref));
  
  return (
    <div className="samplerTileInner peopleTile">
      <h3 className="tileHeading">
        <Link to="/people">{label("people")}</Link>
      </h3>
      <div className="peopleFeature">
        <Link to={`/people/${featured.slug}`} className="peopleFeatureImgLink">
          <img
            className="peopleFeatureImg"
            src={`${assetUrl}/people/${featured.slug}`}
            alt={featured.name || ""}
            loading="lazy"
            onError={(e) => (e.target.style.visibility = "hidden")}
          />
        </Link>
        <div className="peopleFeatureBody">
          <Link to={`/people/${featured.slug}`} className="peopleFeatureNameLink">
            {/* replaceNumbers: disambiguation digits render as superscripts (Heth2 → Heth²) */}
            <span className="peopleFeatureName">{replaceNumbers(featured.name)}</span>
            {featured.title ? <span className="peopleFeatureTitle">{supDigits(featured.title)}</span> : null}
          </Link>
          {bio ? (
            <ExpandableText className="peopleFeatureDesc" lines={7}>
              {Parser(getDetectedScripturesHtml(bio), scriptureOpts)}
            </ExpandableText>
          ) : null}
        </div>
      </div>
      <div className="peopleFaceRow">
        {faces.map((p, i) => {
          const idx = (p.index || []).filter((x) => x?.ref);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          return (
            <Link to={`/people/${p.slug}`} key={p.slug} className="peopleFaceCard samplerCard" title={p.title || p.name}>
              <div className="peopleFaceImgWrap">
                <img
                  className="peopleFaceImg"
                  src={`${assetUrl}/people/${p.slug}`}
                  alt={p.name || ""}
                  loading="lazy"
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
                <span className="peopleFaceName">{replaceNumbers(p.name)}</span>
                {/* word-budgeted so the CSS ellipsis never engages mid-word */}
                {p.title ? <span className="peopleFaceTitle">{clampWords(supDigits(p.title), 5)}</span> : null}
              </div>
              {item ? (
                <div className="peopleFaceBody samplerCardBody">
                  <span className="peopleFaceIndexText">
                    <RefPill refText={item.ref} />
                    {" "}
                    {clampWords(flatten(item.text), 26)}
                  </span>
                </div>
              ) : null}
            </Link>
          );
        })}
        {/* end cell: a 3×4 mosaic filling the whole card (no caption) — the
            "much more" signal into /people */}
        <Link to="/people" className="peopleFaceCard samplerCard viewAllCard" title={label("view_all")}>
          <div className="viewAllMosaic viewAllMosaicFull">
            {mosaic.map((p) => (
              <img
                key={p.slug}
                src={`${assetUrl}/people/${p.slug}`}
                alt=""
                loading="lazy"
                onError={(e) => (e.target.style.visibility = "hidden")}
              />
            ))}
          </div>
          <span className="peopleFaceName viewAllOverlay">{payload?.peopleCount ? `+${payload.peopleCount - data.length} ${label("people")}` : label("view_more")}</span>
        </Link>
      </div>
    </div>
  );
}
