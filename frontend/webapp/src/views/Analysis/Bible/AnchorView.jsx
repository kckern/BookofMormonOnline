import React from "react";
import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";
import { bookTotal, partnersFor, chapterCounts } from "./aggregate";
import Rail from "./Rail";
import PartnerBars from "./PartnerBars";
import SampleStrip from "./SampleStrip";

// Anchored master-detail: rail (anchor canon) + ranked partner bars.
// All navigation goes through props.navigate — state lives in the URL.
export default function AnchorView({ state, navigate }) {
  const { canon, book, chapter, highlight } = state;
  const scopeTotal = chapter
    ? chapterCounts(canon, book)[chapter - 1]
    : bookTotal(canon, book);

  // Single source of truth for the flip destination — the top partner, unless
  // the current highlight is itself a partner book (highlight may be a division
  // name like "Major Prophets", which we never flip to). Both the button label
  // and flip()'s navigation derive from this one value.
  const partners = partnersFor(canon, book);
  const flipTarget =
    (partners.some((p) => p.book.name === highlight) && highlight) ||
    partners[0]?.book.name;

  // The partner we show a concrete text sample for: the highlighted one if it
  // is a real partner book, otherwise the top-ranked partner.
  const sampleTarget =
    (partners.some((p) => p.book.name === highlight) && highlight) ||
    partners[0]?.book.name;

  const flip = () => {
    if (!flipTarget) return navigate({ view: "overview" });
    navigate({ view: "anchor", canon: canon === "bom" ? "kjv" : "bom", book: flipTarget });
  };

  const openReader = (partnerName) => {
    const readerState =
      canon === "bom"
        ? { view: "reader", bomBook: book, bibleBook: partnerName }
        : { view: "reader", bomBook: partnerName, bibleBook: book, anchorCanon: "kjv" };
    if (chapter) {
      if (canon === "bom") readerState.bomChapter = chapter;
      else readerState.bibleChapter = chapter;
    }
    navigate(readerState);
  };

  return (
    <div className="xref-anchorview" data-testid="xref-anchor">
      <header className="xref-header">
        <Breadcrumb
          root={{ icon: "⌂", label: "Overview", to: "/analysis/bible" }}
          style={{ "--bc-link": "var(--link)", "--bc-root": "var(--link)", "--bc-link-hover": "var(--link-hover)" }}
        >
          <Breadcrumb.Current>{book}</Breadcrumb.Current>
        </Breadcrumb>
        {flipTarget && (
          <button className="xref-flip" onClick={flip}>
            ⇄ view from {flipTarget}
          </button>
        )}
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
          {sampleTarget && (
            <SampleStrip
              bomBook={canon === "bom" ? book : sampleTarget}
              bibleBook={canon === "bom" ? sampleTarget : book}
              bomChapter={canon === "bom" ? chapter : undefined}
              bibleChapter={canon === "kjv" ? chapter : undefined}
              onOpen={() => openReader(sampleTarget)}
            />
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
