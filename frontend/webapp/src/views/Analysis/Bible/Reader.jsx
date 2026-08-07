import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { generateReference } from "scripture-guide";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { verseIdToSlug } from "src/utils/scriptureUtils";
import { determineLanguage } from "src/models/Utils";
import { Spinner } from "../../_Common/Loader";
import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";
import Rail from "./Rail";
import { highlightTextJSX } from "./highlighter";
import { pairsFor, partnersFor } from "./aggregate";

// Navigation target for a rail book-click: that book paired with its top
// cross-reference partner (choice A — always populates). A book with zero
// partners can't form a pair, so it degrades to its own anchor view.
export function readerTargetForBook(anchorCanon, bookName) {
  const top = partnersFor(anchorCanon, bookName)[0]?.book.name;
  if (!top) return { view: "anchor", canon: anchorCanon, book: bookName };
  return anchorCanon === "kjv"
    ? { view: "reader", bibleBook: bookName, bomBook: top, anchorCanon: "kjv" }
    : { view: "reader", bomBook: bookName, bibleBook: top };
}

const PAGE = 50;

// Side-by-side verse-pair reader, scoped by URL state (book pair + optional
// BoM chapter). Fetches verse text in pages; sorting is client-side over the
// full local pair list.
export default function Reader({ state, navigate }) {
  const { bomBook, bibleBook, bomChapter, bibleChapter } = state;
  const lang = determineLanguage();

  const pairs = useMemo(
    () =>
      pairsFor(bomBook, bibleBook, bomChapter, bibleChapter).map(([bomVid, bibleVid, isQuote]) => ({
        bomVid,
        bibleVid,
        isQuote: !!isQuote,
        bomRef: generateReference(bomVid, lang),
        bibleRef: generateReference(bibleVid, lang),
      })),
    [bomBook, bibleBook, bomChapter, bibleChapter, lang]
  );

  const [sort, setSort] = useState({ column: "bom", direction: "asc" });
  const sorted = useMemo(() => {
    const key = sort.column === "bom" ? "bomVid" : "bibleVid";
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...pairs].sort((a, b) => (a[key] - b[key]) * dir);
  }, [pairs, sort]);

  const quoteTotal = useMemo(() => pairs.filter((p) => p.isQuote).length, [pairs]);

  const [pageCount, setPageCount] = useState(1);
  const visible = sorted.slice(0, pageCount * PAGE);
  const remaining = sorted.length - visible.length;

  const [verseData, setVerseData] = useState({});
  const [highlights, setHighlights] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const needed = visible
      .flatMap(({ bomVid, bibleVid }) => [bomVid, bibleVid])
      .filter((vid, i, self) => self.indexOf(vid) === i)
      .filter((vid) => !verseData[vid]);
    if (!needed.length) return;
    let cancelled = false;
    setLoading(true);
    const versePairs = visible
      .filter(({ bomVid, bibleVid }) => needed.includes(bomVid) || needed.includes(bibleVid))
      .map(({ bomVid, bibleVid }) => [bomVid, bibleVid]);
    BoMOnlineAPI({ verses: needed, versehighlights: versePairs }).then(
      ({ verses, versehighlights }) => {
        if (cancelled) return;
        setVerseData((prev) => {
          const next = { ...prev };
          for (const v of Object.values(verses || {})) next[v.verse_id] = v;
          return next;
        });
        setHighlights((prev) => ({ ...prev, ...(versehighlights || {}) }));
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length, sorted]);

  const anchorCanon = state.anchorCanon === "kjv" ? "kjv" : "bom";
  const backState =
    anchorCanon === "kjv"
      ? {
          view: "anchor",
          canon: "kjv",
          book: bibleBook,
          ...(bibleChapter ? { chapter: bibleChapter } : {}),
        }
      : {
          view: "anchor",
          canon: "bom",
          book: bomBook,
          ...(bomChapter ? { chapter: bomChapter } : {}),
        };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      navigate(backState);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon]);

  // Anchor side = the canon the reader was entered from; the rail browses it.
  const anchorBook = anchorCanon === "kjv" ? bibleBook : bomBook;
  const anchorChapter = anchorCanon === "kjv" ? bibleChapter : bomChapter;
  const partnerBook = anchorCanon === "kjv" ? bomBook : bibleBook;

  const switchBook = (name) => navigate(readerTargetForBook(anchorCanon, name));
  const rescope = (ch) => {
    const target = { view: "reader", bomBook, bibleBook };
    if (anchorCanon === "kjv") {
      target.anchorCanon = "kjv";
      if (ch) target.bibleChapter = ch;
    } else if (ch) {
      target.bomChapter = ch;
    }
    navigate(target);
  };

  const rail = (
    <Rail
      canon={anchorCanon}
      book={anchorBook}
      chapter={anchorChapter}
      partner={partnerBook}
      onAnchor={switchBook}
      onChapter={rescope}
    />
  );

  if (!pairs.length)
    return (
      <div className="xref-reader" data-testid="xref-reader">
        <ReaderHeader {...{ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
        <div className="xref-readerbody">
          {rail}
          <div className="xref-readermain">
            <div className="xref-empty">
              No known correspondences between {bomBook}
              {bomChapter ? ` ${bomChapter}` : ""} and {bibleBook}.
            </div>
          </div>
        </div>
      </div>
    );

  const firstPageReady = visible.some(({ bomVid }) => verseData[bomVid]);
  if (!firstPageReady)
    return (
      <div className="xref-reader" data-testid="xref-reader">
        <ReaderHeader {...{ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
        <Spinner />
      </div>
    );

  const sortButton = (column, label) => (
    <button
      className="xref-sort"
      aria-label={`sort by ${label}`}
      onClick={() =>
        setSort((s) => ({
          column,
          direction: s.column === column && s.direction === "asc" ? "desc" : "asc",
        }))
      }
    >
      {label}
      <span aria-hidden="true">
        {sort.column === column ? (sort.direction === "asc" ? " ▲" : " ▼") : " △"}
      </span>
    </button>
  );

  return (
    <div className="xref-reader" data-testid="xref-reader">
      <ReaderHeader {...{ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total: pairs.length, quoteTotal }} />
      <div className="xref-readerbody">
        {rail}
        <div className="xref-readermain">
      <table className="verseViewerTable">
        <thead>
          <tr>
            <th aria-sort={sort.column === "bom" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
              {sortButton("bom", bomBook)}
            </th>
            <th aria-sort={sort.column === "bible" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
              {sortButton("bible", bibleBook)}
            </th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let lastBomHeading = null;
            let lastBibleHeading = null;
            return visible.map(({ bomVid, bibleVid, isQuote, bomRef, bibleRef }) => {
              const pairHighlights = highlights[`${bomVid},${bibleVid}`] || {};
              const bomData = verseData[bomVid] || {};
              const bibleData = verseData[bibleVid] || {};
              const bomHeading = bomData.heading && bomData.heading !== lastBomHeading ? bomData.heading : "";
              const bibleHeading = bibleData.heading && bibleData.heading !== lastBibleHeading ? bibleData.heading : "";
              if (bomData.heading) lastBomHeading = bomData.heading;
              if (bibleData.heading) lastBibleHeading = bibleData.heading;
              return (
              <React.Fragment key={`${bomVid}-${bibleVid}`}>
                <tr data-testid="xref-pair" className={isQuote ? "quote" : "phrase"}>
                  <td className="scriptureRef left">
                    <div className="header_container">
                      <Link className="ref" to={`/read/${verseIdToSlug([bomVid])}`}>
                        {bomRef}
                      </Link>
                      {isQuote && <span className="xref-quote-badge">QUOTE</span>}
                      <div className="heading noselect">{bomHeading}</div>
                    </div>
                  </td>
                  <td className="scriptureRef right">
                    <div className="header_container">
                      <Link className="ref" to={`/read/${verseIdToSlug([bibleVid])}`}>
                        {bibleRef}
                      </Link>
                      <div className="heading noselect">{bibleHeading}</div>
                    </div>
                  </td>
                </tr>
                <tr className={isQuote ? "quote" : "phrase"}>
                  <td className="scriptureCell left">
                    <p>{highlightTextJSX(bomData.text, pairHighlights.bom_highlight, bomVid)}</p>
                  </td>
                  <td className="scriptureCell right">
                    <p>
                      {highlightTextJSX(bibleData.text, pairHighlights.bible_highlight, bibleVid)}
                    </p>
                  </td>
                </tr>
              </React.Fragment>
            );
            });
          })()}
        </tbody>
      </table>
      {remaining > 0 && (
        <div className="xref-loadrow">
          <button className="xref-loadmore" disabled={loading} onClick={() => setPageCount((c) => c + 1)}>
            Load {Math.min(PAGE, remaining)} more
          </button>
          <button
            className="xref-loadmore"
            disabled={loading}
            onClick={() => setPageCount(Math.ceil(sorted.length / PAGE))}
          >
            Show all {sorted.length}
          </button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

function ReaderHeader({ bomBook, bibleBook, bomChapter, bibleChapter, anchorCanon, navigate, backState, total, quoteTotal }) {
  const anchorBook = anchorCanon === "kjv" ? bibleBook : bomBook;
  return (
    <header className="xref-header">
      <Breadcrumb
        root={{ icon: "⌂", label: "Overview", to: "/analysis/bible" }}
        style={{ "--bc-link": "var(--link)", "--bc-root": "var(--link)", "--bc-link-hover": "var(--link-hover)" }}
      >
        <Breadcrumb.Link onClick={() => navigate(backState)}>
          {anchorBook}
          {anchorCanon === "bom" && bomChapter ? ` › ch. ${bomChapter}` : ""}
          {anchorCanon === "kjv" && bibleChapter ? ` › ch. ${bibleChapter}` : ""}
        </Breadcrumb.Link>
        <Breadcrumb.Current>{bomBook} × {bibleBook}</Breadcrumb.Current>
      </Breadcrumb>
      <h3 className="xref-readertitle">
        <span className="book">{bomBook}{bomChapter ? ` ${bomChapter}` : ""}</span> references to{" "}
        <span className="book">{bibleBook}{bibleChapter ? ` ${bibleChapter}` : ""}</span>
      </h3>
      <p className="xref-readercount">
        {total} references · {quoteTotal} quotes
      </p>
    </header>
  );
}
