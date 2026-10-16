import React from "react";
import { Link } from "react-router-dom";
import { flatten, clampWords } from "./textUtils";
import { renderMoneyQuote } from "../../_Common/moneyQuote";
import { parseTeaser } from "./ArchiveDocTile";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import ExpandableText from "./ExpandableText";

const PORTRAIT = "history/witnesses/people/joseph-smith.jpg";
const INDEX = "/history/joseph-smith";

/**
 * Joseph-Smith-statements tile, laid out like the Witnesses tile: his portrait +
 * name on the left, the statement's money quote (mini-quote excerpts in place)
 * on the right, with the document/date as the source line. A non-first-hand
 * account names its reporter as a meta line above the quote. A long quote
 * clamps with a reversible Layer-1 reveal.
 *
 * Destinations: the eyebrow → the statements page; the CTA → the featured
 * document itself. The portrait is a mouse shortcut to the statements page
 * (tabIndex -1: the eyebrow already is that tab stop).
 * A "JS" monogram stands in if the portrait fails to load.
 */
export default function JosephSmithTile({ data }) {
  if (!data) return null;
  const name = labelOr("joseph_smith", "Joseph Smith");
  const hasQuote = !!(data.money_quote || data.mini_quote);
  const { lead } = parseTeaser(data.teaser);
  const source =
    [data.year, data.document].filter(Boolean).join(" · ") ||
    (data.citation ? clampWords(flatten(data.citation), 18) : null);
  const reporter = hasQuote && data.quote_speaker && !data.quote_is_witness_voice ? data.quote_speaker : null;
  const to = data.slug ? `/history/${data.slug}` : INDEX;
  return (
    <RevealProvider>
      <div className="samplerTileInner witnessTile josephSmithTile">
        <h3 className="tileHeading">
          <Link to={INDEX}>{name}</Link>
        </h3>
        <div className="witnessFeatured">
          <Link to={INDEX} className="witnessLeft" tabIndex={-1}>
            <span className="witnessHero">
              <TileImage
                path={PORTRAIT}
                alt=""
                onError={(e) => { e.target.style.display = "none"; e.target.parentNode.classList.add("mono"); }}
              />
              <span className="witnessMono" aria-hidden="true">JS</span>
            </span>
            <span className="witnessName">{name}</span>
          </Link>
          <span className="witnessBody">
            {reporter ? <span className="witnessSpeaker">{reporter}:</span> : null}
            {hasQuote || lead ? (
              <ExpandableText className="witnessStatementWrap" lines={4} persistKey={data.slug ? `josephSmith:${data.slug}` : undefined}>
                <span className="witnessStatement">
                  {hasQuote ? (
                    <>
                      &ldquo;{data.money_quote
                        ? renderMoneyQuote(data.money_quote, data.mini_quote)
                        : data.mini_quote}&rdquo;
                    </>
                  ) : (
                    lead
                  )}
                </span>
              </ExpandableText>
            ) : null}
            {source ? <span className="witnessSource">{source}</span> : null}
          </span>
        </div>
        <TileDeepLink to={to} verb="seeInContext" />
      </div>
    </RevealProvider>
  );
}
