import React from "react";
import { Link } from "react-router-dom";
import { flatten, clampWords } from "./textUtils";
import { renderMoneyQuote } from "../../_Common/moneyQuote";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import ExpandableText from "./ExpandableText";

// Shared history-archive doc tile. Quote hero (mini→money→teaser) + title +
// meta + key-points + citation, plus a right-side facsimile rail driven by
// `images` (0 = no rail, 1 = a single thumbnail, >1 = a filmstrip that fills
// the tile height). Gates on `data` — NOT `data.id` — so archives without
// thumbnails (joseph-smith) still render. `images` are media paths (relative
// to assetUrl) or absolute URLs, rendered through TileImage.
//
// One tab stop per destination: the title and the facsimile rail are mouse
// shortcuts to the document (tabIndex -1; the rail is also aria-hidden), the
// CTA is the keyboard/screen-reader stop. The eyebrow links to `headingTo`.
export const parseTeaser = (html) => {
  const raw = html || "";
  const bullets = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => flatten(m[1]))
    .filter(Boolean)
    .slice(0, 4);
  const lead = flatten(raw.split(/key points:/i)[0]);
  return { lead, bullets };
};

export default function ArchiveDocTile({ data, heading, headingTo, to, images = [] }) {
  if (!data) return null;
  const rail = (Array.isArray(images) ? images : [images]).filter(Boolean);
  const meta = [data.year, data.source, data.author].filter(Boolean).join(" · ");
  const aspect = parseFloat(data.aspect) || null; // stored as height/width
  const { lead, bullets } = parseTeaser(data.teaser);
  // Show the FULL money quote with the mini-quote excerpts highlighted in place
  // (falling back to a bare mini quote when there's no money quote).
  const hasQuote = !!(data.money_quote || data.mini_quote);
  const multi = rail.length > 1;
  return (
    <RevealProvider>
      <div className="samplerTileInner historyTile">
        <h3 className="tileHeading">{headingTo ? <Link to={headingTo}>{heading}</Link> : heading}</h3>
        <div className="historyTileBody">
          <div className="historyTileMain">
            {data.document ? (
              <Link to={to} className="historyTileTitle" tabIndex={-1}>{data.document}</Link>
            ) : null}
            {meta ? <div className="historyTileMeta">{meta}</div> : null}
            {hasQuote ? (
              <blockquote className="historyTileQuote">
                {data.quote_speaker && !data.quote_is_witness_voice ? (
                  <span className="historyTileQuoteBy prefix">{data.quote_speaker}:</span>
                ) : null}{" "}
                &ldquo;{data.money_quote
                  ? renderMoneyQuote(data.money_quote, data.mini_quote)
                  : data.mini_quote}&rdquo;
                {data.quote_speaker && data.quote_is_witness_voice ? (
                  <cite className="historyTileQuoteBy">&mdash; {data.quote_speaker}</cite>
                ) : null}
              </blockquote>
            ) : lead ? (
              <ExpandableText className="historyTileTeaser" lines={3}>{lead}</ExpandableText>
            ) : null}
            {bullets.length ? (
              <ul className="historyTileBullets">
                {bullets.map((b, i) => (
                  <li key={i}>{clampWords(b, 16)}</li>
                ))}
              </ul>
            ) : null}
            {data.citation ? <div className="historyTileCitation">{flatten(data.citation)}</div> : null}
          </div>
          {rail.length ? (
            <Link
              to={to}
              className={`historyTileRail${multi ? " multi" : ""}`}
              tabIndex={-1}
              aria-hidden="true"
            >
              {rail.map((src, i) => (
                <TileImage
                  key={i}
                  className="historyTileThumb"
                  aspect={!multi && aspect ? `1 / ${aspect}` : undefined}
                  path={src}
                  alt=""
                  onError={(e) => (e.target.style.display = "none")}
                />
              ))}
            </Link>
          ) : null}
        </div>
        <TileDeepLink to={to} />
      </div>
    </RevealProvider>
  );
}
