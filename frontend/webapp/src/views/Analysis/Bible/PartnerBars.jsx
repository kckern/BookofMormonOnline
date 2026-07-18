import React, { useState } from "react";
import { partnersFor, scopedPartnersFor } from "./aggregate";

const FOLD = 8;

// Ranked horizontal bars, one per partner book, split quote/phrase.
// Bars share one linear scale (max = the unscoped top partner) so lengths are
// comparable — and a chapter-scoped view reads shorter than the whole book.
export default function PartnerBars({ canon, book, chapter, highlight, onSelect }) {
  const [showAll, setShowAll] = useState(false);
  const partners = chapter
    ? scopedPartnersFor(canon, book, chapter)
    : partnersFor(canon, book);
  const visible = showAll ? partners : partners.slice(0, FOLD);

  if (!partners.length)
    return (
      <div className="xref-empty">
        No known correspondences between {book}
        {chapter ? ` ${chapter}` : ""} and the{" "}
        {canon === "bom" ? "Bible" : "Book of Mormon"}.
      </div>
    );

  const scopeMax = partnersFor(canon, book)[0]?.total || 1; // unscoped — stable across chapter scoping

  return (
    <div className="xref-bars" role="list">
      {visible.map(({ book: partner, total, quotes, phrases }) => (
        <div role="listitem" key={partner.name}>
          <button
            className={`xref-bar ${
              highlight === partner.name || (canon === "bom" && highlight === partner.group)
                ? "highlighted"
                : ""
            }`}
            aria-label={`${partner.name}, ${total} references, ${quotes} quotes`}
            onClick={() => onSelect(partner.name)}
          >
            <span className="xref-bar-label">{partner.name}</span>
            <span className="xref-bar-track">
              {quotes > 0 && (
                <span className="xref-bar-quote" style={{ width: `${(quotes / scopeMax) * 100}%` }} />
              )}
              {phrases > 0 && (
                <span className="xref-bar-phrase" style={{ width: `${(phrases / scopeMax) * 100}%` }} />
              )}
            </span>
            <span className="xref-bar-count">{total}</span>
          </button>
        </div>
      ))}
      {partners.length > FOLD && !showAll && (
        <button className="xref-showall" onClick={() => setShowAll(true)}>
          Show all {partners.length}
        </button>
      )}
    </div>
  );
}
