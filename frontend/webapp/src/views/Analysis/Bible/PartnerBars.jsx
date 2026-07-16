import React, { useState } from "react";
import { partnersFor, scopedPartnersFor } from "./aggregate";

const FOLD = 8;

// Ranked horizontal bars, one per partner book, split quote/phrase.
// Bars share one linear scale (max = top partner) so lengths are comparable.
export default function PartnerBars({ canon, book, chapter, highlight, onSelect }) {
  const [showAll, setShowAll] = useState(false);
  const partners = chapter
    ? scopedPartnersFor(canon, book, chapter)
    : partnersFor(canon, book);
  const max = partners[0]?.total || 1;
  const visible = showAll ? partners : partners.slice(0, FOLD);

  if (!partners.length)
    return (
      <div className="xref-empty">
        No known correspondences between {book}
        {chapter ? ` ${chapter}` : ""} and the{" "}
        {canon === "bom" ? "Bible" : "Book of Mormon"}.
      </div>
    );

  return (
    <div className="xref-bars" role="list">
      {visible.map(({ book: partner, total, quotes, phrases }) => (
        <button
          key={partner.name}
          role="listitem"
          className={`xref-bar ${highlight === partner.name ? "highlighted" : ""}`}
          aria-label={`${partner.name}, ${total} references, ${quotes} quotes`}
          onClick={() => onSelect(partner.name)}
        >
          <span className="xref-bar-label">{partner.name}</span>
          <span className="xref-bar-track">
            <span className="xref-bar-quote" style={{ width: `${(quotes / max) * 100}%` }} />
            <span className="xref-bar-phrase" style={{ width: `${(phrases / max) * 100}%` }} />
          </span>
          <span className="xref-bar-count">{total}</span>
        </button>
      ))}
      {partners.length > FOLD && !showAll && (
        <button className="xref-showall" onClick={() => setShowAll(true)}>
          Show all {partners.length}
        </button>
      )}
    </div>
  );
}
