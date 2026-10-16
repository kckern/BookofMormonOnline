import React, { useState } from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { replaceNumbers } from "src/models/Utils";
import { getDetectedScripturesHtml } from "src/views/_Common/ViewUtils";
import { flatten } from "./textUtils";
import ExpandableText from "./ExpandableText";
import RefPill from "./RefPill";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import { GROUP_SHOWN } from "./MattersGroupTile";

// Which sampler array each group draws from.
const GROUP_KEY = {
  narrative: "mattersNarrative",
  material: "mattersMaterial",
  concept: "mattersConcept",
};

// The group tile for the same array shows indexes 0..16 (5 cards + 12 mosaic
// cells), so the profile takes the first matter past them — never a repeat of
// a thumbnail already on the page. The sampler sends one extra per group.
export const PROFILE_MATTER_INDEX = GROUP_SHOWN;

/** True when the payload carries a matter the group tile does not show. */
export const hasProfileMatter = (payload, group = "concept") =>
  (payload?.[GROUP_KEY[group]]?.length || 0) > PROFILE_MATTER_INDEX;

// Prose scripture refs become the one RefPill <button> (focusable, keyboard-
// operable). A ref that is the sole content of a parenthesis loses the parens:
// the pill already reads as a citation, and "( Alma 34:17 )" wraps apart.
const LONE_REF_IN_PARENS = /\(\s*(<(a) className="scripture_link">[^<]*<\/\2>)\s*\)/g;
const stripParens = (html) => html.replace(LONE_REF_IN_PARENS, "$1");
const proseOpts = {
  replace: (node) => {
    const cls = node?.attribs?.className ?? node?.attribs?.classname ?? node?.attribs?.class;
    if (node?.name !== "a" || cls !== "scripture_link") return undefined;
    const ref = node.children?.[0]?.data || "";
    return ref ? <RefPill refText={ref} /> : undefined;
  },
};

/**
 * A single-matter deep profile — hero image, name, subtitle deck, and the
 * description with scripture refs as RefPills, behind a reversible Read more;
 * Layer 2 is "Open <name>". Reserve/batch tile drawn from a matter the group
 * tile didn't show. `group` selects the sampler array.
 */
export default function MatterProfileTile({ payload, group = "concept", matterIndex = PROFILE_MATTER_INDEX }) {
  // A hero that 404s collapses (slug-keyed, so a new matter retries).
  const [failedSlug, setFailedSlug] = useState(null);
  const list = payload?.[GROUP_KEY[group]] || [];
  const matter = list[matterIndex];
  if (!matter?.slug) return null;
  const heroFailed = failedSlug === matter.slug;
  const name = matter.name ? replaceNumbers(matter.name) : "";
  const desc = flatten(matter.description || "");
  const href = `/matters/${matter.slug}`;
  return (
    <RevealProvider>
      <div className="samplerTileInner placeProfileTile matterProfileTile">
        <h3 className="tileHeading">
          <Link to="/matters">
            {labelOr("menu_matters", "Matters")} · {labelOr("profile", "Profile")}
          </Link>
        </h3>
        <div className="placeProfileHead">
          {/* Mouse/touch shortcut only — the CTA below is the one tab stop. */}
          <Link to={href} className={`placeProfileImgLink${heroFailed ? " isNoImage" : ""}`} tabIndex={-1}>
            {heroFailed ? null : (
              <TileImage
                path={`matters/${matter.slug}`}
                alt=""
                sizes="(max-width: 900px) 100vw, 420px"
                onError={(e) => {
                  e.target.style.visibility = "hidden";
                  setFailedSlug(matter.slug);
                }}
              />
            )}
            {name ? (
              <span className="peopleFaceName placesNameOverlay mattersNameOverlay">
                <span className="mattersNameText">{name}</span>
              </span>
            ) : null}
          </Link>
        </div>
        {matter.subtitle ? <p className="matterProfileSub">{matter.subtitle}</p> : null}
        {desc ? (
          <ExpandableText className="placeProfileDesc" lines={5} fade persistKey={`matterProfile:${matter.slug}`}>
            {Parser(stripParens(getDetectedScripturesHtml(desc)), proseOpts)}
          </ExpandableText>
        ) : null}
        <TileDeepLink to={href} verb="open" name={name || matter.slug} />
      </div>
    </RevealProvider>
  );
}
