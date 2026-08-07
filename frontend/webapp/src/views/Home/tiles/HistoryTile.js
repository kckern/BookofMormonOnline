import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { flatten, clampWords } from "./textUtils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

/**
 * Featured document, structured: thumb · title · provenance · lead paragraph ·
 * REAL Key-Points bullets (parsed from the teaser's list markup) · citation.
 * Layer 1 = the expandable lead; Layer 2 = a gated deeplink into the document
 * (revealed after the lead is expanded). Outer element is a div (not a Link) so
 * the inner read-more button is legal — the title carries the primary anchor.
 */
export const parseTeaser = (html) => {
  const raw = html || "";
  const bullets = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => flatten(m[1]))
    .filter(Boolean)
    .slice(0, 4);
  const lead = flatten(raw.split(/key points:/i)[0]);
  return { lead, bullets };
};

export default function HistoryTile({ data }) {
  if (!data?.id) return null;
  const to = data.slug ? `/history/${data.slug}` : "/history";
  const meta = [data.year, data.source, data.author].filter(Boolean).join(" · ");
  const aspect = parseFloat(data.aspect) || null; // stored as height/width
  const { lead, bullets } = parseTeaser(data.teaser);
  const quote = data.mini_quote || (data.money_quote ? clampWords(data.money_quote, 14) : null);
  return (
    <RevealProvider>
      <div className="samplerTileInner historyTile">
        <h3 className="tileHeading">{label("history")}</h3>
        <div className="historyTileBody">
          <div className="historyTileMain">
            <Link to={to} className="historyTileTitle">{data.document}</Link>
            {meta ? <div className="historyTileMeta">{meta}</div> : null}
            {data.archive ? <div className="historyTileArchive">{flatten(data.archive)}</div> : null}
            {quote ? (
              <blockquote className="historyTileQuote">
                {data.quote_speaker && !data.quote_is_witness_voice ? (
                  <span className="historyTileQuoteBy prefix">{data.quote_speaker}:</span>
                ) : null}{" "}
                &ldquo;{quote}&rdquo;
                {data.quote_speaker && data.quote_is_witness_voice ? (
                  <cite className="historyTileQuoteBy">&mdash; {data.quote_speaker}</cite>
                ) : null}
              </blockquote>
            ) : lead ? (
              <ExpandableText className="historyTileTeaser" lines={3}>
                {lead}
              </ExpandableText>
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
          <Link to={to} className="historyTileThumbLink" aria-label={data.document || ""}>
            <img
              className="historyTileThumb"
              style={aspect ? { aspectRatio: `1 / ${aspect}` } : undefined}
              src={`${assetUrl}/history/thumbs/${String(data.id).padStart(4, "0")}`}
              alt={data.document || ""}
              loading="lazy"
              onError={(e) => (e.target.style.display = "none")}
            />
          </Link>
        </div>
        <TileDeepLink to={to}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
