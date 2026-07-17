import React from "react";
import { Link } from "react-router-dom";
import { bookTotal, partnersFor, chapterCounts } from "./aggregate";
import Rail from "./Rail";
import PartnerBars from "./PartnerBars";

// Anchored master-detail: rail (anchor canon) + ranked partner bars.
// All navigation goes through props.navigate — state lives in the URL.
export default function AnchorView({ state, navigate }) {
  const { canon, book, chapter, highlight } = state;
  const partnerLabel = canon === "bom" ? "Bible" : "Book of Mormon";
  const scopeTotal = chapter
    ? chapterCounts(canon, book)[chapter - 1]
    : bookTotal(canon, book);

  // The book the flip lands on — top partner, unless the current highlight is
  // itself a partner book (mirrors flip()'s target logic, kept identical).
  const flipTarget = (() => {
    const partners = partnersFor(canon, book);
    const highlightIsBook = partners.some((p) => p.book.name === highlight);
    return (highlightIsBook && highlight) || partners[0]?.book.name;
  })();

  const flip = () => {
    const partners = partnersFor(canon, book);
    // highlight may be a division name (e.g. "Major Prophets"); only flip to it
    // if it's a real partner book, else fall back to the top partner.
    const highlightIsBook = partners.some((p) => p.book.name === highlight);
    const target = (highlightIsBook && highlight) || partners[0]?.book.name;
    if (!target) return navigate({ view: "overview" });
    navigate({ view: "anchor", canon: canon === "bom" ? "kjv" : "bom", book: target });
  };

  const openReader = (partnerName) => {
    const readerState =
      canon === "bom"
        ? { view: "reader", bomBook: book, bibleBook: partnerName }
        : { view: "reader", bomBook: partnerName, bibleBook: book, anchorCanon: "kjv" };
    if (canon === "bom" && chapter) readerState.bomChapter = chapter;
    navigate(readerState);
  };

  return (
    <div className="xref-anchorview" data-testid="xref-anchor">
      <header className="xref-header">
        <nav className="xref-breadcrumb" aria-label="Breadcrumb">
          <Link to="/analysis/bible">⌂ Overview</Link>
          <span aria-hidden="true"> › </span>
          <span aria-current="page">{book}</span>
        </nav>
        <button className="xref-flip" onClick={flip}>
          ⇄ view from {flipTarget || partnerLabel}
        </button>
      </header>

      <div className="xref-anchorbody">
        <Rail
          canon={canon}
          book={book}
          chapter={chapter}
          onAnchor={(name) => navigate({ view: "anchor", canon, book: name })}
          onChapter={(ch) =>
            navigate(
              ch
                ? { view: "anchor", canon, book, chapter: ch }
                : { view: "anchor", canon, book }
            )
          }
        />

        <main className="xref-detail">
          <div className="xref-detailhead">
            <h3 className="xref-detailheading">
              {book}
              {chapter ? ` ${chapter}` : ""} {canon === "bom" ? "draws on" : "appears in"}
              <span className="xref-detailtotal"> {scopeTotal} references</span>
            </h3>
            <span className="xref-legend" aria-hidden="true">
              <span className="xref-swatch quote" /> quote
              <span className="xref-swatch phrase" /> phrase
            </span>
          </div>
          {chapter && (
            <button
              className="xref-scopechip"
              aria-label={`Clear chapter ${chapter} scope`}
              onClick={() => navigate({ view: "anchor", canon, book })}
            >
              ch. {chapter} ✕
            </button>
          )}
          <PartnerBars
            canon={canon}
            book={book}
            chapter={chapter}
            highlight={highlight}
            onSelect={openReader}
          />
        </main>
      </div>
    </div>
  );
}
