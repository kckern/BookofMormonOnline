import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DiffMatchPatch from "diff-match-patch";
import { generateReference } from "scripture-guide";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { label, determineLanguage } from "src/models/Utils";
import bibleData from "src/views/Analysis/Bible/data";
import { bookOfVid } from "src/views/Analysis/Bible/canon";
import { serialize } from "src/views/Analysis/Bible/urlState";
import RefPill from "./RefPill";
import TileDeepLink from "./_ds/TileDeepLink";
import labelOr from "./_ds/labelOr";
import { skeletonHeight } from "./_ds/skeletonHeights";
import useSingleColumn from "./_ds/useSingleColumn";

// data.js is ESM with a default export (it was CommonJS); destructure after
// the imports so import/first stays satisfied.
const { index } = bibleData;

const dmp = new DiffMatchPatch();

// Isaiah dominates the intertext index (600+ of ~3000 pairs) and the 2 Nephi
// block quotes are the ones every reader already knows — sample from the rest.
const ISAIAH = [17656, 18947];
export const eligiblePairs = index.filter(([, kjv]) => kjv < ISAIAH[0] || kjv > ISAIAH[1]);

// How many pairs one tile considers. They arrive in ONE request (verses +
// curated highlights), so a wider walk costs bytes, not round trips. The
// curated `versehighlights` rows cover ~all pairs and ~69% carry a 4+ word
// phrase (~87% at 3+), so six spread candidates leave a dud rate near zero.
export const CANDIDATES = 6;
const STRONG = 4; // words in a phrase worth showing outright
const PARTIAL = 3; // best-of fallback when no candidate reaches STRONG
const COMFORT_CHARS = 420; // prefer pairs whose verses fit the tile unclamped

/** The candidate pairs for a seed: spread across the index, not adjacent rows. */
export const candidatePairs = (seed) => {
  const n = eligiblePairs.length;
  if (!n) return [];
  const base = Math.abs(Math.floor(seed || 1)) * 7919;
  const out = [];
  for (let k = 0; out.length < Math.min(CANDIDATES, n) && k < CANDIDATES * 4; k++) {
    const p = eligiblePairs[(base + k * 389) % n];
    if (!out.includes(p)) out.push(p);
  }
  return out;
};

// Words: letters/digits with inner apostrophes ("lord's"). Matching works on
// these tokens, so a mark always starts and ends on a word boundary and never
// swallows the punctuation around it.
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const words = (text) =>
  [...String(text || "").matchAll(WORD)].map((m) => ({
    w: m[0].toLowerCase().replace(/’/g, "'"),
    s: m.index,
    e: m.index + m[0].length,
  }));

/** Runs of >= minWords words shared verbatim (case/punctuation-insensitive), as char ranges in a and b. */
export const sharedRuns = (a, b, minWords = STRONG) => {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return [];
  // one char per distinct word, so the diff runs on words, not characters
  const dict = new Map();
  const enc = (ws) =>
    ws
      .map(({ w }) => {
        if (!dict.has(w)) dict.set(w, String.fromCharCode(dict.size + 1));
        return dict.get(w);
      })
      .join("");
  const diffs = dmp.diff_main(enc(wa), enc(wb), false);
  const runs = [];
  let ia = 0;
  let ib = 0;
  for (const [op, chunk] of diffs) {
    const n = chunk.length;
    if (op === 0) {
      if (n >= minWords) runs.push({ words: n, a: [wa[ia].s, wa[ia + n - 1].e], b: [wb[ib].s, wb[ib + n - 1].e] });
      ia += n;
      ib += n;
    } else if (op === -1) ia += n;
    else ib += n;
  }
  return runs;
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Char range of a curated phrase inside `text`, on word boundaries, punctuation-tolerant. */
const findPhrase = (text, phrase) => {
  const tokens = String(phrase || "").match(WORD) || [];
  if (!tokens.length) return null;
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${tokens.map(escapeRe).join("[^\\p{L}\\p{N}]+")}(?![\\p{L}\\p{N}])`,
    "iu",
  );
  const m = re.exec(text || "");
  return m ? { words: tokens.length, range: [m.index, m.index + m[0].length] } : null;
};

/** Text → nodes with each (non-overlapping, sorted) range wrapped in <mark>. */
const renderMarks = (text, ranges) => {
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  const out = [];
  let p = 0;
  for (const [s, e] of sorted) {
    if (s < p) continue;
    if (s > p) out.push(text.slice(p, s));
    out.push(<mark key={s}>{text.slice(s, e)}</mark>);
    p = e;
  }
  out.push(text.slice(p));
  return out;
};

/** Common phrases (minWords+ words shared verbatim) marked in both passages, on word boundaries. */
export const markShared = (a, b, minWords = STRONG) => {
  const runs = sharedRuns(a, b, minWords);
  return [renderMarks(a, runs.map((r) => r.a)), renderMarks(b, runs.map((r) => r.b))];
};

/**
 * Score one pair: prefer the curated highlights (the same ones the analysis
 * view shows) located in BOTH texts; fall back to the computed shared runs
 * (e.g. a translation the curated English phrases don't match).
 */
export const scorePair = (bomText, kjvText, hl) => {
  const bomPh = hl?.bom_highlight || [];
  const kjvPh = hl?.bible_highlight || [];
  const bomHits = bomPh.map((p) => findPhrase(bomText, p)).filter(Boolean);
  const kjvHits = kjvPh.map((p) => findPhrase(kjvText, p)).filter(Boolean);
  if (bomHits.length && kjvHits.length) {
    const score = Math.min(Math.max(...bomHits.map((h) => h.words)), Math.max(...kjvHits.map((h) => h.words)));
    return { score, bomRanges: bomHits.map((h) => h.range), kjvRanges: kjvHits.map((h) => h.range) };
  }
  const runs = sharedRuns(bomText, kjvText, PARTIAL);
  if (!runs.length) return { score: 0, bomRanges: [], kjvRanges: [] };
  return { score: Math.max(...runs.map((r) => r.words)), bomRanges: runs.map((r) => r.a), kjvRanges: runs.map((r) => r.b) };
};

/** Pick the pair to show: the first strong one that fits, else the first strong, else the best partial. */
export const choosePair = (scored) => {
  const strong = scored.filter((c) => c.score >= STRONG);
  const fits = (c) => c.bomText.length + c.kjvText.length <= COMFORT_CHARS * 2;
  if (strong.length) return strong.find(fits) || strong[0];
  const partial = scored.filter((c) => c.score >= PARTIAL).sort((x, y) => y.score - x.score);
  return partial[0] || null;
};

// Chapter of a verse id, from its English reference ("Alma 9:15" → 9);
// single-chapter books ("Jude 1:3" or "Omni 1:5") → 1.
const chapterOf = (vid) => {
  try {
    const m = String(generateReference([vid])).match(/(\d+):\d+\s*$/);
    return m ? Number(m[1]) : 1;
  } catch {
    return undefined;
  }
};

/**
 * The comparison grid scoped to the sampled pair's two chapters, built from
 * verse ids and the English canon (never the localized reference string), so
 * the reader lands on a handful of rows with this pair among them.
 */
export const pairPath = (bomVid, kjvVid) => {
  const bom = bookOfVid("bom", bomVid);
  const bible = bookOfVid("kjv", kjvVid);
  if (!bom || !bible) return "/analysis/bible";
  return serialize({
    view: "reader",
    bomBook: bom.name,
    bibleBook: bible.name,
    bomChapter: bom.chapters > 1 ? chapterOf(bomVid) : undefined,
    bibleChapter: bible.chapters > 1 ? chapterOf(kjvVid) : undefined,
  });
};

const heading = () => labelOr("analysis_bible", "Biblical language");

/**
 * One sampled Book of Mormon ↔ Bible intertext pair with the shared wording
 * highlighted in both passages — a live taste of /analysis/bible.
 *
 * States: loading → a skeleton the size of the tile; a pick → the pair; no
 * candidate with a 3+ word shared phrase, or a failed fetch → null, which the
 * `.tile-biblephrases:empty` rule collapses (no 2px shell).
 */
export default function BiblePhrasesTile({ seed }) {
  const [state, setState] = useState({ status: "loading", pair: null });
  const single = useSingleColumn();
  const lang = determineLanguage();

  useEffect(() => {
    const cands = candidatePairs(seed);
    if (!cands.length) {
      setState({ status: "empty", pair: null });
      return undefined;
    }
    let cancelled = false;
    setState({ status: "loading", pair: null });
    const ids = [...new Set(cands.flatMap(([b, k]) => [b, k]))];
    Promise.resolve(
      BoMOnlineAPI({ verses: ids, versehighlights: cands.map(([b, k]) => [b, k]) }),
    )
      .then((r) => {
        if (cancelled) return;
        const verses = {};
        for (const v of Object.values(r?.verses || {})) if (v?.verse_id) verses[v.verse_id] = v;
        const hls = r?.versehighlights || {};
        const scored = cands
          .map(([bomVid, kjvVid]) => {
            const bomText = (verses[bomVid]?.text || "").trim();
            const kjvText = (verses[kjvVid]?.text || "").trim();
            if (!bomText || !kjvText) return null;
            return { bomVid, kjvVid, bomText, kjvText, ...scorePair(bomText, kjvText, hls[`${bomVid},${kjvVid}`]) };
          })
          .filter(Boolean);
        const pick = choosePair(scored);
        setState(pick ? { status: "ready", pair: pick } : { status: "empty", pair: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "empty", pair: null });
      });
    return () => {
      cancelled = true;
    };
  }, [seed, lang]);

  if (state.status === "loading") {
    return (
      <div
        className="samplerTileInner biblePhrasesTile isLoading"
        aria-busy="true"
        style={{ minHeight: `calc(${skeletonHeight("tile-biblephrases", single)} - 2px)` }}
      >
        <h3 className="tileHeading">{heading()}</h3>
        <div className="tileInnerSkeleton" aria-hidden="true" />
      </div>
    );
  }
  if (state.status !== "ready") return null;

  const { bomVid, kjvVid, bomText, kjvText, bomRanges, kjvRanges } = state.pair;
  const bomRef = generateReference([bomVid], lang);
  const kjvRef = generateReference([kjvVid], lang);
  return (
    <div className="samplerTileInner biblePhrasesTile">
      <h3 className="tileHeading">
        <Link to="/analysis/bible">{heading()}</Link>
      </h3>
      <div className="biblePhrasesPair">
        <div className="biblePhrasesPassage">
          <RefPill refText={bomRef} />
          <p>{renderMarks(bomText, bomRanges)}</p>
        </div>
        <div className="biblePhrasesPassage kjv">
          <RefPill refText={kjvRef} />
          <p>{renderMarks(kjvText, kjvRanges)}</p>
        </div>
      </div>
      <TileDeepLink to={pairPath(bomVid, kjvVid)} always verb="seeInContext" />
    </div>
  );
}
