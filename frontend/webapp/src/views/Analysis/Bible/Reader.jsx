import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { generateReference } from "scripture-guide";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { verseIdToSlug } from "src/utils/scriptureUtils";
import { determineLanguage } from "src/models/Utils";
import { Spinner } from "../../_Common/Loader";
import { highlightTextJSX } from "./highlighter";
import { pairsFor } from "./aggregate";

const PAGE = 20;

// Side-by-side verse-pair reader, scoped by URL state (book pair + optional
// BoM chapter). Fetches verse text in pages; sorting is client-side over the
// full local pair list.
export default function Reader({ state, navigate }) {
  const { bomBook, bibleBook, bomChapter } = state;
  const lang = determineLanguage();

  const pairs = useMemo(
    () =>
      pairsFor(bomBook, bibleBook, bomChapter).map(([bomVid, bibleVid, isQuote]) => ({
        bomVid,
        bibleVid,
        isQuote: !!isQuote,
        bomRef: generateReference(bomVid, lang),
        bibleRef: generateReference(bibleVid, lang),
      })),
    [bomBook, bibleBook, bomChapter, lang]
  );

  const [sort, setSort] = useState({ column: "bom", direction: "asc" });
  const sorted = useMemo(() => {
    const key = sort.column === "bom" ? "bomVid" : "bibleVid";
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...pairs].sort((a, b) => (a[key] - b[key]) * dir);
  }, [pairs, sort]);

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
      ? { view: "anchor", canon: "kjv", book: bibleBook }
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
  }, [bomBook, bibleBook, bomChapter, anchorCanon]);

  if (!pairs.length)
    return (
      <div className="xref-reader" data-testid="xref-reader">
        <ReaderHeader {...{ bomBook, bibleBook, bomChapter, anchorCanon, navigate, backState }} />
        <div className="xref-empty">
          No known correspondences between {bomBook}
          {bomChapter ? ` ${bomChapter}` : ""} and {bibleBook}.
        </div>
      </div>
    );

  const firstPageReady = visible.some(({ bomVid }) => verseData[bomVid]);
  if (!firstPageReady)
    return (
      <div className="xref-reader" data-testid="xref-reader">
        <ReaderHeader {...{ bomBook, bibleBook, bomChapter, anchorCanon, navigate, backState }} />
        <Spinner />
      </div>
    );

  const sortButton = (column, label) => (
    <button
      className="xref-sort"
      aria-label={`sort by ${label}`}
      aria-pressed={sort.column === column && sort.direction === "desc"}
      onClick={() =>
        setSort((s) => ({
          column,
          direction: s.column === column && s.direction === "asc" ? "desc" : "asc",
        }))
      }
    >
      {label}
      <span className="xref-sortarrow" aria-hidden="true">
        {sort.column === column ? (sort.direction === "asc" ? " ▲" : " ▼") : " △"}
      </span>
    </button>
  );

  return (
    <div className="xref-reader" data-testid="xref-reader">
      <ReaderHeader {...{ bomBook, bibleBook, bomChapter, anchorCanon, navigate, backState }} />
      <table className="verseViewerTable">
        <thead>
          <tr>
            <th>{sortButton("bom", bomBook)}</th>
            <th>{sortButton("bible", bibleBook)}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(({ bomVid, bibleVid, isQuote, bomRef, bibleRef }) => {
            const pairHighlights = highlights[`${bomVid},${bibleVid}`] || {};
            const bomData = verseData[bomVid] || {};
            const bibleData = verseData[bibleVid] || {};
            return (
              <React.Fragment key={`${bomVid}-${bibleVid}`}>
                <tr data-testid="xref-pair" className={isQuote ? "quote" : "phrase"}>
                  <td className="scriptureRef left">
                    <div className="header_container">
                      <Link className="ref" to={`/read/${verseIdToSlug([bomVid])}`}>
                        {bomRef}
                      </Link>
                      {isQuote && <span className="xref-quote-badge">QUOTE</span>}
                      <div className="heading noselect">{bomData.heading}</div>
                    </div>
                  </td>
                  <td className="scriptureRef right">
                    <div className="header_container">
                      <div className="heading noselect">{bibleData.heading}</div>
                      <span className="ref">{bibleRef}</span>
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
          })}
        </tbody>
      </table>
      {remaining > 0 && (
        <button
          className="xref-loadmore"
          disabled={loading}
          onClick={() => setPageCount((c) => c + 1)}
        >
          Load more ({remaining} remaining)
        </button>
      )}
    </div>
  );
}

function ReaderHeader({ bomBook, bibleBook, bomChapter, anchorCanon, navigate, backState }) {
  const anchorBook = anchorCanon === "kjv" ? bibleBook : bomBook;
  return (
    <header className="xref-header">
      <nav className="xref-breadcrumb" aria-label="Breadcrumb">
        <Link to="/analysis/bible">⌂ Overview</Link>
        <span aria-hidden="true"> › </span>
        <button className="xref-backlink" onClick={() => navigate(backState)}>
          {anchorBook}
          {anchorCanon === "bom" && bomChapter ? ` › ch. ${bomChapter}` : ""}
        </button>
        <span aria-hidden="true"> › </span>
        <span aria-current="page">{bomBook} × {bibleBook}</span>
      </nav>
      <h3 className="xref-readertitle">
        <span className="book">{bomBook}{bomChapter ? ` ${bomChapter}` : ""}</span> references to{" "}
        <span className="book">{bibleBook}</span>
      </h3>
    </header>
  );
}
