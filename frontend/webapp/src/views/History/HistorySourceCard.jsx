import React from "react";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Identicon from "../_Common/Identicon";
import { withBrackets, renderMoneyQuote } from "../_Common/moneyQuote";
import "./HistorySourceCard.css";

// Re-exported for backward compatibility (tests import withBrackets from here).
export { withBrackets, renderMoneyQuote };

// Reliability facets, currently carried only by the lost-116-pages archive.
// Three independent facets, deliberately NOT collapsed into one score: a
// single-witness contemporaneous notice and a well-corroborated late
// recollection are differently trustworthy, not rankable on one axis.
// Renders nothing when a doc carries none of them, so other archives are
// untouched. See docs/specs/2026-08-18-lost-116-pages-archive.md §4.
export function ReliabilityFacets({ doc }) {
  if (!doc) return null;
  const chain = Array.isArray(doc.provenance_chain) ? doc.provenance_chain : null;
  if (!doc.proximity && !doc.attestation && !(chain && chain.length)) return null;
  return (
    <div className="historyFacets">
      {chain && chain.length > 0 && (
        <div className="facetChain" title="How the information reached this document">
          {chain.map((step, i) => (
            <span key={i} className="facetChainStep">
              {i > 0 && <span className="facetChainArrow"> &rarr; </span>}
              {step}
            </span>
          ))}
        </div>
      )}
      {(doc.proximity || doc.attestation) && (
        <div className="facetChips">
          {doc.proximity && (
            <span className={"facetChip facetProximity is-" + doc.proximity}>
              {doc.proximity === "contemporaneous" ? "contemporaneous" : "recollection"}
            </span>
          )}
          {doc.attestation && (
            <span className={"facetChip facetAttestation is-" + doc.attestation}>
              {doc.attestation === "independent" ? "independently attested" : "single witness"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// One historical-source card, money-quote-led. Shared by the witness view and
// the reception main view. variant="reception" additionally shows the source
// (header) and document title (support); variant="witness" is the original
// witness card, unchanged. onOpen(doc) fires on click (both open a popup).
export default function HistorySourceCard({ doc, variant = "reception", displayDate, onOpen }) {
  if (!doc) return null;
  const isReception = variant === "reception";
  const dateText = displayDate ? displayDate(doc.date) : (doc.date || "");
  return (
    <div className="historycard historySourceCard card" onClick={() => onOpen && onOpen(doc)}>
      <div className="historyHeader">
        <Identicon seed={doc.slug || doc.document || doc.source || ""} size={34} className="historyIdenticon" />
        {dateText && <span className="dateChip">{dateText}</span>}
        {isReception && doc.source && <div className="historySource">{doc.source}</div>}
      </div>

      {/* Lead with the money quote when present. Witness testimony is attributed
          (two voices); reception press quotes are unattributed (the source in the
          header is the context) — a speaker-less quote shows bare. */}
      {doc.money_quote && (
        doc.quote_speaker && doc.quote_is_witness_voice ? (
          <blockquote className="historyLead is-firsthand">
            <span className="money_quote_text">&ldquo;{renderMoneyQuote(doc.money_quote, doc.mini_quote)}&rdquo;</span>
            <footer className="money_quote_attribution">
              <span className="money_quote_speaker">&mdash; {doc.quote_speaker}</span>
            </footer>
          </blockquote>
        ) : doc.quote_speaker ? (
          <blockquote className="historyLead">
            <span className="money_quote_text">
              <span className="money_quote_speaker-prefix">{doc.quote_speaker}:</span>{" "}
              &ldquo;{renderMoneyQuote(doc.money_quote, doc.mini_quote)}&rdquo;
            </span>
          </blockquote>
        ) : (
          <blockquote className="historyLead">
            <span className="money_quote_text">&ldquo;{renderMoneyQuote(doc.money_quote, doc.mini_quote)}&rdquo;</span>
          </blockquote>
        )
      )}

      {doc.teaser && <div className="historyTeaserText">{Parser(doc.teaser)}</div>}

      <ReliabilityFacets doc={doc} />

      <div className="historySupport">
        {doc.id && (
          <div className="historyThumb">
            <img
              style={{ aspectRatio: "1 / " + (parseFloat(doc.aspect) || 1) }}
              src={`${assetUrl}/history/thumbs/${String(doc.id).padStart(4, "0")}`}
              alt={doc.document}
              loading="lazy"
              onError={(e) => {
                const wrap = e.currentTarget.closest(".historyThumb");
                if (wrap) wrap.style.display = "none";
              }}
            />
          </div>
        )}
        {isReception ? (
          <div className="historySupportMain">
            {doc.document && <h5 className="historyDocTitle">{doc.document}</h5>}
            {doc.citation && <div className="citation">{Parser(doc.citation + "")}</div>}
          </div>
        ) : (
          doc.citation && <div className="citation">{Parser(doc.citation + "")}</div>
        )}
      </div>
    </div>
  );
}
