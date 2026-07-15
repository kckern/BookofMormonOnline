import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import green from "src/views/User/svg/green.svg";
import yellow from "src/views/User/svg/yellow.svg";
import blank from "src/views/User/svg/blank.svg";

// Narration text uses the app's internal {Name|slug} / [Name|slug] link syntax.
const flatten = (text) =>
  (text || "")
    .replace(/{(.*?)\|(.*?)}/g, "$1")
    .replace(/\[(.*?)\|(.*?)\]/g, "$1")
    .replace(/<[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const statusDot = { completed: green, started: yellow };

const narrationItems = (section) =>
  (section?.rows || [])
    .map((r) => r?.narration)
    .filter((n) => n && flatten(n.description));

function NarrationList({ section }) {
  const items = narrationItems(section);
  if (!items.length) return null;
  return items.map((n) => (
    // heading = the corresponding bom_text block's heading (its location
    // in the text), NOT the cross-reference list.
    <Link to={`/${section.slug}`} key={n.guid} className="narrationItem">
      <img src={statusDot[n.text?.status] || blank} alt="" className="narrationDot" />
      <span className="narrationText">{flatten(n.description)}</span>
      {n.text?.heading ? <span className="narrationRef">{n.text.heading}</span> : null}
    </Link>
  ));
}

/**
 * One sampled section's narration, listed in full with provenance (page ›
 * section), per-beat read-status dots, and each beat's bom_text heading.
 * A short section leaves room — the NEXT section continues the story.
 */
export default function NarrationTile({ data, next }) {
  const items = narrationItems(data);
  if (!items.length) return null;
  const showNext = items.length < 6 && narrationItems(next).length > 0;
  return (
    <div className="samplerTileInner narrationTile">
      <h3 className="tileHeading">{label("narration")}</h3>
      <div className="narrationCrumbs">
        {data.page?.title ? (
          <>
            <Link to={`/${data.page.slug}`}>{data.page.title}</Link>
            <span className="narrationCrumbSep"> › </span>
          </>
        ) : null}
        <Link to={`/${data.slug}`} className="narrationTileTitle">{data.title}</Link>
      </div>
      <div className="narrationTileList">
        <NarrationList section={data} />
        {showNext ? (
          <>
            <Link to={`/${next.slug}`} className="narrationTileTitle narrationNextTitle">{next.title}</Link>
            <NarrationList section={next} />
          </>
        ) : null}
      </div>
    </div>
  );
}
