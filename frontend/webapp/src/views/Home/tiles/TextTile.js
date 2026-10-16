import React from "react";
import { Link } from "react-router-dom";
import { lookup } from "scripture-guide";
import { flattenDescription, renderHTMLContentInFeed } from "src/models/Utils";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import ExpandableText from "./ExpandableText";
import RefPill from "./RefPill";

// "[Alma 10:1–11] Amulek’s family" → { ref, title }; a bare reference heading
// ("Alma 18:18") is all ref; anything else is all title.
const isRef = (s) => {
  if (!s || s.length > 40 || !/\d/.test(s)) return false;
  try {
    return (lookup(s)?.verse_ids?.length || 0) > 0;
  } catch {
    return false;
  }
};
export const splitHeading = (heading) => {
  const h = (heading || "").trim();
  const m = /^\[([^\]]+)\]\s*(.*)$/.exec(h);
  if (m) return { ref: m[1].trim(), title: m[2].trim() || null };
  if (isRef(h)) return { ref: h, title: null };
  return { ref: null, title: h || null };
};

/**
 * One bom_text block from a study page, set as scripture: a context line
 * (page · section), the block's title with its reference as a RefPill (opens
 * the scripture popup), the passage in the Read serif (clamped, reversible),
 * and the narration gloss with one art thumbnail. Single chrome — the tile is
 * the card. One tab stop into the study page ("See in context"); the title is
 * a pointer-only shortcut to the same place.
 */
function TextTileInner({ data }) {
  const to = `/${data.slug}`;
  const { ref, title } = splitHeading(data.heading);
  const pageTitle = data.parent_page?.title || null;
  const sectionTitle = data.parent_section?.title || null;
  // When the heading is only a reference, the section names the passage.
  const headline = title || sectionTitle || pageTitle;
  const meta = [pageTitle, title ? sectionTitle : null].filter((x) => x && x !== headline);
  const narration = data.narration?.description ? flattenDescription(data.narration.description) : null;
  const art = (data.imgIds || []).find(Boolean);
  return (
    <div className="samplerTileInner textTile">
      <h3 className="tileHeading">{labelOr("scripture", "Scripture")}</h3>
      {meta.length ? <div className="textTileMeta">{meta.join(" · ")}</div> : null}
      <div className="textTileHead">
        {headline ? (
          <Link to={to} className="textTileTitle" tabIndex={-1}>
            {headline}
          </Link>
        ) : null}
        {ref ? <RefPill refText={ref} className="textTileRef" /> : null}
      </div>
      <ExpandableText lines={9} className="textTileBody">
        <div className="textTilePassage">{renderHTMLContentInFeed(data.content)}</div>
      </ExpandableText>
      {narration ? (
        <div className="textTileNarration">
          {art ? (
            <TileImage path={`art/${art}`} widths={[]} className="textTileArt" alt="" width={44} height={44} />
          ) : null}
          <div className="textTileNarrationText">{narration}</div>
        </div>
      ) : null}
      <TileDeepLink to={to} verb="seeInContext" className="textTileMore" />
    </div>
  );
}

export default function TextTile({ data }) {
  if (!data?.slug) return null;
  return (
    <RevealProvider>
      <TextTileInner data={data} />
    </RevealProvider>
  );
}
