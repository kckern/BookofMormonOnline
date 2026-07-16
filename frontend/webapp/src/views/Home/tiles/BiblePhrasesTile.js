import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DiffMatchPatch from "diff-match-patch";
import { generateReference } from "scripture-guide";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { label, determineLanguage } from "src/models/Utils";
import { index } from "src/views/Analysis/Bible/data";
import RefPill from "./RefPill";

const dmp = new DiffMatchPatch();

// Isaiah dominates the intertext index (600+ of ~3000 pairs) and the 2 Nephi
// block quotes are the ones every reader already knows — sample from the rest.
const ISAIAH = [17656, 18947];
const eligiblePairs = index.filter(([, kjv]) => kjv < ISAIAH[0] || kjv > ISAIAH[1]);

/** Common phrases (4+ words shared verbatim) marked in both passages. */
const markShared = (a, b) => {
  const diffs = dmp.diff_main(a.toLowerCase(), b.toLowerCase());
  dmp.diff_cleanupSemantic(diffs);
  let posA = 0;
  const shared = [];
  for (const [op, text] of diffs) {
    if (op === 0 && text.trim().split(/\s+/).length >= 4) shared.push([posA, posA + text.length]);
    if (op !== 1) posA += text.length;
  }
  const cut = (text, spansSource) => {
    // re-locate each shared span in the ORIGINAL casing via lowercase offsets
    const lower = text.toLowerCase();
    const spans = spansSource
      .map(([s, e]) => {
        const frag = a.toLowerCase().slice(s, e).trim();
        const i = lower.indexOf(frag);
        return i >= 0 ? [i, i + frag.length] : null;
      })
      .filter(Boolean)
      .sort((x, y) => x[0] - y[0]);
    const out = [];
    let p = 0;
    for (const [s, e] of spans) {
      if (s < p) continue;
      if (s > p) out.push(text.slice(p, s));
      out.push(<mark key={s}>{text.slice(s, e)}</mark>);
      p = e;
    }
    out.push(text.slice(p));
    return out;
  };
  return [cut(a, shared), cut(b, shared)];
};

const passageText = (result, ref) =>
  (result?.[ref]?.passages || [])
    .flatMap((p) => p.verses || [])
    .map((v) => v.text)
    .join(" ")
    .trim();

/**
 * One sampled Book of Mormon ↔ Bible intertext pair with the shared wording
 * highlighted in both passages — a live taste of /analysis/bible.
 */
export default function BiblePhrasesTile({ seed }) {
  const [pair, setPair] = useState(null);
  const lang = determineLanguage();

  useEffect(() => {
    if (!eligiblePairs.length) return;
    let cancelled = false;
    // Not every indexed pair shares a phrase long enough to mark — walk from
    // the seeded index until one visibly does (the highlights ARE the tile).
    const tryPair = (offset) => {
      if (cancelled || offset >= 5) return;
      const [bomVid, kjvVid] = eligiblePairs[((seed || 1) + offset) % eligiblePairs.length];
      const bomRef = generateReference([bomVid], lang);
      const kjvRef = generateReference([kjvVid], lang);
      // the scripture query takes ONE ref per request — fetch the pair in parallel
      Promise.all([
        BoMOnlineAPI({ scripture: bomRef }),
        BoMOnlineAPI({ scripture: kjvRef }),
      ]).then(([bomR, kjvR]) => {
        if (cancelled) return;
        const bomText = passageText(bomR?.scripture, bomRef);
        const kjvText = passageText(kjvR?.scripture, kjvRef);
        if (!bomText || !kjvText) return tryPair(offset + 1);
        const [bomJsx, kjvJsx] = markShared(bomText, kjvText);
        const marked = bomJsx.some((n) => typeof n !== "string");
        if (!marked) return tryPair(offset + 1);
        setPair({ bomRef, kjvRef, bomJsx, kjvJsx });
      });
    };
    tryPair(0);
    return () => {
      cancelled = true;
    };
  }, [seed, lang]);

  if (!pair) return null;
  // deep link into the ACTUAL comparison grid (/analysis/bible/{bom}~{bible}),
  // not the analysis landing page — same slugs the Bible view pushes itself
  const bookSlug = (ref) => (ref || "").replace(/\s+\d+[:.].*$/, "").trim().toLowerCase().replace(/\s/g, "-");
  const deepTo = `/analysis/bible/${bookSlug(pair.bomRef)}~${bookSlug(pair.kjvRef)}`;
  return (
    <div className="samplerTileInner biblePhrasesTile">
      <h3 className="tileHeading">
        <Link to={deepTo}>{label("analysis_bible")}</Link>
      </h3>
      <div className="biblePhrasesPair">
        <div className="biblePhrasesPassage">
          <RefPill refText={pair.bomRef} />
          <p>{pair.bomJsx}</p>
        </div>
        <div className="biblePhrasesPassage kjv">
          <RefPill refText={pair.kjvRef} />
          <p>{pair.kjvJsx}</p>
        </div>
      </div>
      <Link to={deepTo} className="tileMoreLink">
        {label("view_in_context")}
      </Link>
    </div>
  );
}
