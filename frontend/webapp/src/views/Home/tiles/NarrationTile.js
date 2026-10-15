import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import green from "src/views/User/svg/green.svg";
import yellow from "src/views/User/svg/yellow.svg";
import blank from "src/views/User/svg/blank.svg";

import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";
import { flatten } from "./textUtils";
import RefPill from "./RefPill";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";

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

/**
 * The beats. Each row: optional read-status dot, the block's scripture ref as
 * a RefPill (popup), then the beat text as THE link into its block's study
 * page (e.g. /ammon/22). The pill is a sibling of the link — never nested.
 */
function NarrationList({ section, showStatus }) {
  const items = narrationItems(section);
  if (!items.length) return null;
  return items.map((n) => {
    const status = n.text?.status;
    return (
      <div key={n.guid} className="narrationItem">
        {showStatus ? (
          <img src={statusDot[status] || blank} alt="" className={`narrationDot${statusDot[status] ? "" : " isBlank"}`} />
        ) : null}
        <div className="narrationText">
          {n.text?.heading ? <RefPill refText={n.text.heading} /> : null}
          <Link to={`/${n.text?.slug || section.slug}`} className="narrationBeatLink">
            {flatten(n.description)}
          </Link>
        </div>
      </div>
    );
  });
}

/**
 * One sampled section's narration, listed in full with provenance (page ›
 * section title), a strip of the section's art, read-status dots (only once
 * the reader has progress in these beats), and each beat's bom_text ref. A
 * short section leaves room — the NEXT section continues the story under a
 * quieter "Next" divider. Layer 2: "See in context" → the section's page.
 */
export default function NarrationTile({ data, next, seed = 0 }) {
  const items = narrationItems(data);
  if (!items.length) return null;
  const art = sectionArt(data, seed);
  const nextItems = narrationItems(next);
  const showNext = items.length < 6 && nextItems.length > 0;
  // A guest (or a reader new to these beats) would see a column of identical
  // grey "not read" dots that says nothing — show status only when it informs.
  const showStatus = [...items, ...(showNext ? nextItems : [])].some((n) => statusDot[n.text?.status]);
  const artAlt = (i) => labelOr("art_for_x", "Art for $1", [data.title]) + (art.length > 1 ? ` (${i + 1})` : "");
  return (
    <div className="samplerTileInner narrationTile">
      <h3 className="tileHeading">{label("narration")}</h3>
      {data.page?.title ? (
        <Breadcrumb
          size="sm"
          className="narrationCrumbs"
          items={[{ label: data.page.title, to: `/${data.page.slug}` }]}
        />
      ) : null}
      {data.title ? <h4 className="narrationTileTitle">{data.title}</h4> : null}
      {art.length ? (
        <div className={`narrationArtRow${art.length === 1 ? " single" : ""}`} style={{ "--art-n": art.length }}>
          {art.map((id, i) => (
            <Link key={id} to={`/art/${id}`} className="narrationArtLink">
              <TileImage
                path={`art/${id}`}
                widths={[]}
                alt={artAlt(i)}
                onError={(e) => {
                  const link = e.target.closest(".narrationArtLink");
                  if (link) link.style.display = "none";
                }}
              />
            </Link>
          ))}
        </div>
      ) : null}
      <div className="narrationTileList">
        <NarrationList section={data} showStatus={showStatus} />
        {showNext ? (
          <>
            <div className="narrationNext">
              <span className="narrationNextLabel">{labelOr("next", "Next")}</span>
              <Link to={`/${next.slug}`} className="narrationNextTitle">{next.title}</Link>
            </div>
            <NarrationList section={next} showStatus={showStatus} />
          </>
        ) : null}
      </div>
      <TileDeepLink to={`/${data.slug}`} always verb="seeInContext" />
    </div>
  );
}
