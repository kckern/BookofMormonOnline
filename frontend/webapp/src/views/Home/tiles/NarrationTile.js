import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import green from "src/views/User/svg/green.svg";
import yellow from "src/views/User/svg/yellow.svg";
import blank from "src/views/User/svg/blank.svg";

const SUPS = { 1: "¹", 2: "²", 3: "³", 4: "⁴" };

// Narration text uses the app's internal {Name|slug} / [Name|slug] link syntax;
// name-attached disambiguation digits render as superscripts.
const flatten = (text) =>
  (text || "")
    .replace(/{(.*?)\|(.*?)}/g, "$1")
    .replace(/\[(.*?)\|(.*?)\]/g, "$1")
    .replace(/<[^>]*>/gi, " ")
    .replace(/([A-Za-z])([1-4])\b/g, (m, a, d) => a + SUPS[d])
    .replace(/\s+/g, " ")
    .trim();

const statusDot = { completed: green, started: yellow };

const narrationItems = (section) =>
  (section?.rows || [])
    .map((r) => r?.narration)
    .filter((n) => n && flatten(n.description));

/** Seeded pick of up to `count` distinct art ids across the section's blocks. */
const sectionArt = (section, seed, count = 4) => {
  const ids = [...new Set(
    (section?.rows || []).flatMap((r) => r?.narration?.text?.imgIds || []),
  )];
  if (ids.length <= count) return ids;
  const start = seed % ids.length;
  return Array.from({ length: count }, (_, i) => ids[(start + i) % ids.length]);
};

function NarrationList({ section }) {
  const items = narrationItems(section);
  if (!items.length) return null;
  return items.map((n) => (
    // Each beat deep-links to ITS block's study page (e.g. /ammon/22);
    // heading = that bom_text block's heading, NOT the cross-reference list.
    <Link to={`/${n.text?.slug || section.slug}`} key={n.guid} className="narrationItem">
      <img src={statusDot[n.text?.status] || blank} alt="" className="narrationDot" />
      <span className="narrationText">{flatten(n.description)}</span>
      {n.text?.heading ? <span className="narrationRef">{n.text.heading}</span> : null}
    </Link>
  ));
}

/**
 * One sampled section's narration, listed in full with provenance (page ›
 * section), a strip of the section's art, per-beat read-status dots, and each
 * beat's bom_text heading. A short section leaves room — the NEXT section
 * continues the story; the list flex-fills the tile.
 */
export default function NarrationTile({ data, next, seed = 0 }) {
  const items = narrationItems(data);
  if (!items.length) return null;
  const art = sectionArt(data, seed);
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
      {art.length ? (
        <Link to={`/${data.slug}`} className="narrationArtRow">
          {art.map((id) => (
            <img
              key={id}
              src={`${assetUrl}/art/${id}`}
              alt=""
              loading="lazy"
              onError={(e) => (e.target.style.display = "none")}
            />
          ))}
        </Link>
      ) : null}
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
