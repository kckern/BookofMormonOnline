import React from "react";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Identicon from "../_Common/Identicon";
import { withBrackets, renderMoneyQuote } from "../_Common/moneyQuote";
import "./HistorySourceCard.css";

// Re-exported for backward compatibility (tests import withBrackets from here).
export { withBrackets, renderMoneyQuote };

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

      <div className="historySupport">
        {doc.id && (
          <div className="historyThumb">
            <img
              style={{ aspectRatio: "1 / " + (parseFloat(doc.aspect) || 1) }}
              src={`${assetUrl}/history/thumbs/${String(doc.id).padStart(4, "0")}`}
              alt={doc.document}
              loading="lazy"
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
