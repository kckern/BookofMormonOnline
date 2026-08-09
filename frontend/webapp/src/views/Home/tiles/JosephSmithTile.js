import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { flatten, clampWords, tr } from "./textUtils";
import { renderMoneyQuote } from "../../_Common/moneyQuote";
import { parseTeaser } from "./ArchiveDocTile";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

const PORTRAIT = `${assetUrl}/history/witnesses/people/joseph-smith.jpg`;
const TO = "/history/joseph-smith";

/**
 * Joseph-Smith-statements tile, laid out like the Witnesses tile: his portrait +
 * name on the left, the statement's money quote (mini-quote excerpts highlighted
 * in place, speaker-prefixed when it isn't his own voice) on the right, with the
 * document/date as the source line. Deep-links into the witnesses-format page.
 * A "JS" monogram stands in if the portrait fails to load.
 */
export default function JosephSmithTile({ data }) {
  if (!data) return null;
  const hasQuote = !!(data.money_quote || data.mini_quote);
  const { lead } = parseTeaser(data.teaser);
  const source =
    [data.year, data.document].filter(Boolean).join(" · ") ||
    (data.citation ? clampWords(flatten(data.citation), 18) : null);
  return (
    <RevealProvider>
      <div className="samplerTileInner witnessTile">
        <h3 className="tileHeading">
          <Link to={TO}>{tr("joseph_smith", "Joseph Smith")}</Link>
        </h3>
        <div className="witnessFeatured">
          <Link to={TO} className="witnessLeft">
            <span className="witnessHero">
              <img
                src={PORTRAIT}
                alt="Joseph Smith"
                loading="lazy"
                onError={(e) => { e.target.style.display = "none"; e.target.parentNode.classList.add("mono"); }}
              />
              <span className="witnessMono" aria-hidden="true">JS</span>
            </span>
            <span className="witnessName">Joseph Smith</span>
          </Link>
          <span className="witnessBody">
            {hasQuote ? (
              <span className="witnessStatement clampLines" style={{ WebkitLineClamp: 4 }}>
                {data.quote_speaker && !data.quote_is_witness_voice ? (
                  <span className="witnessSpeaker">{data.quote_speaker}: </span>
                ) : null}
                &ldquo;{data.money_quote
                  ? renderMoneyQuote(data.money_quote, data.mini_quote)
                  : data.mini_quote}&rdquo;
              </span>
            ) : lead ? (
              <span className="witnessStatement clampLines" style={{ WebkitLineClamp: 4 }}>{lead}</span>
            ) : null}
            {source ? <span className="witnessSource">{source}</span> : null}
          </span>
        </div>
        <TileDeepLink to={TO}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
