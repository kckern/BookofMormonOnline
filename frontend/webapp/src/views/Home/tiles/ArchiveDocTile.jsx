import React from "react";
import { Link } from "react-router-dom";
import { flatten, clampWords } from "./textUtils";
import { renderMoneyQuote } from "../../_Common/moneyQuote";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

// Shared history-archive doc tile. Quote hero (mini→money→teaser) + title +
// meta + key-points + citation, plus a right-side facsimile rail driven by
// `images` (0 = no rail, 1 = a single thumbnail, >1 = a filmstrip that fills
// the tile height). Gates on `data` — NOT `data.id` — so archives without
// thumbnails (joseph-smith) still render.
export const parseTeaser = (html) => {
  const raw = html || "";
  const bullets = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => flatten(m[1]))
    .filter(Boolean)
    .slice(0, 4);
  const lead = flatten(raw.split(/key points:/i)[0]);
  return { lead, bullets };
};

export default function ArchiveDocTile({ data, heading, to, images = [] }) {
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
        <h3 className="tileHeading">{heading}</h3>
        <div className="historyTileBody">
          <div className="historyTileMain">
            <Link to={to} className="historyTileTitle">{data.document}</Link>
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
              <div className="historyTileTeaser clampLines" style={{ WebkitLineClamp: 3 }}>{lead}</div>
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
              aria-label={data.document || ""}
            >
              {rail.map((src, i) => (
                <img
                  key={i}
                  className="historyTileThumb"
                  style={!multi && aspect ? { aspectRatio: `1 / ${aspect}` } : undefined}
                  src={src}
                  alt={data.document || ""}
                  loading="lazy"
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
