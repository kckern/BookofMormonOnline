import React, { useEffect, useState } from "react";
import { generateReference } from "scripture-guide";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { determineLanguage } from "src/models/Utils";
import { pairsFor } from "./aggregate";
import { highlightTextJSX } from "./highlighter";

const SAMPLE = 2;

// A concrete "here is what a reference actually is" teaser shown beside the
// aggregate bars: the top few verse pairs, side by side, phrases highlighted.
// Reuses the reader's data path (BoMOnlineAPI + highlighter) at a tiny page size.
export default function SampleStrip({ bomBook, bibleBook, bomChapter, bibleChapter, onOpen }) {
  const lang = determineLanguage();
  const all = pairsFor(bomBook, bibleBook, bomChapter, bibleChapter);
  const pairs = all.slice(0, SAMPLE);

  const [verses, setVerses] = useState({});
  const [highlights, setHighlights] = useState({});

  useEffect(() => {
    if (!pairs.length) return;
    let cancelled = false;
    const needed = [...new Set(pairs.flatMap(([b, k]) => [b, k]))];
    const versePairs = pairs.map(([b, k]) => [b, k]);
    BoMOnlineAPI({ verses: needed, versehighlights: versePairs }).then(
      ({ verses, versehighlights }) => {
        if (cancelled) return;
        const map = {};
        for (const v of Object.values(verses || {})) map[v.verse_id] = v;
        setVerses(map);
        setHighlights(versehighlights || {});
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomBook, bibleBook, bomChapter, bibleChapter]);

  if (!all.length) return null;

  const ready = pairs.some(([b]) => verses[b]);

  return (
    <aside className="xref-sample" aria-label={`Sample references from ${bomBook} to ${bibleBook}`}>
      <div className="xref-sample-head">
        <span className="xref-sample-title">
          {bomBook} × {bibleBook}
        </span>
        <button className="xref-sample-open" onClick={onOpen}>
          Open full reader — all {all.length} ›
        </button>
      </div>
      {!ready ? (
        <div className="xref-sample-skeleton" aria-hidden="true" />
      ) : (
        <ul className="xref-sample-list">
          {pairs.map(([bomVid, bibleVid, isQuote]) => {
            const pair = highlights[`${bomVid},${bibleVid}`] || {};
            const bom = verses[bomVid] || {};
            const bible = verses[bibleVid] || {};
            return (
              <li key={`${bomVid}-${bibleVid}`} className={isQuote ? "quote" : "phrase"}>
                <div className="xref-sample-side">
                  <span className="xref-sample-ref">{generateReference(bomVid, lang)}</span>
                  <p>{highlightTextJSX(bom.text, pair.bom_highlight, bomVid)}</p>
                </div>
                <div className="xref-sample-side">
                  <span className="xref-sample-ref">{generateReference(bibleVid, lang)}</span>
                  <p>{highlightTextJSX(bible.text, pair.bible_highlight, bibleVid)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
