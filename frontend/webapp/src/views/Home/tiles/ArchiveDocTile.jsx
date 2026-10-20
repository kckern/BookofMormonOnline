import React from "react";
import { Link } from "react-router-dom";
import { flatten, clampWords } from "./textUtils";
import { renderMoneyQuote } from "../../_Common/moneyQuote";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import ExpandableText from "./ExpandableText";

// Shared history-archive doc tile. Quote hero (mini→money→teaser) + title +
// meta + key-points + citation, plus a right-side facsimile rail driven by
// `images` (0 = no rail, 1 = a single thumbnail, >1 = a filmstrip that fills
// the tile height). Gates on `data` — NOT `data.id` — so archives without
// thumbnails (joseph-smith) still render. `images` are media paths (relative
// to assetUrl) or absolute URLs, rendered through TileImage.
//
// One tab stop per destination: the title and the facsimile rail are mouse
// shortcuts to the document (tabIndex -1; the rail is also aria-hidden), the
// CTA is the keyboard/screen-reader stop. The eyebrow links to `headingTo`.
export const parseTeaser = (html) => {
  const raw = html || "";
  const bullets = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => tidyText(flatten(m[1])))
    .filter(Boolean)
    .slice(0, 4);
  const lead = tidyText(flatten(raw.split(/key points:/i)[0]));
  return { lead, bullets };
};

// Catalog-form authors ("Howe, Eber D., b. 1798", "Scott, Walter") read as raw
// database text in a human meta line: drop life dates, flip to display order
// (blind audit history-A7). Anything else is left alone.
// `datedOnly`: flip only when life dates marked it as a catalog name — a
// source field also holds publications ("Wayne Sentinel, Palmyra").
const stripLifeDates = (s) =>
  s
    // parenthesised life dates anywhere: "Raumer, Fredrich von (1781-1873)"
    .replace(/\s*\([^)]*\d{3,4}[^)]*\)/g, "")
    .replace(/,?\s*(?:b\.|d\.|fl\.)\s*\d{3,4}\??\s*$/i, "")
    // trailing life dates, incl. catalog hedges: "1789-1849", "1875 or 6-1853", "1801-", "1801- 1877"
    .replace(/,?\s*(?:ca\.\s*)?\d{3,4}\??(?:\s*or\s*\d{1,4})?\s*[-–]\s*(?:ca\.\s*)?(?:\d{1,4}\??(?:\s*or\s*\d{1,4})?)?\s*$/i, "")
    .trim();
// a single catalogue surname ("Kimball", "O'Neil", "Smith-Jones")
const SURNAME = /^[A-Z][\p{L}'’-]+$/u;

export const displayAuthor = (a, { datedOnly = false } = {}) => {
  const raw = String(a || "").trim();
  // "O., W. [Owen, William]": initials, then the cataloguer's bracketed full
  // name — the full name is the display form. A wholly bracketed name
  // ("[Pratt, Parley P.]", supplied by the cataloguer) just loses its brackets
  // (R7 history-A7: it flipped to "Parley P.] [Pratt").
  const bracket = /\[([^\]]*,[^\]]*)\]\s*$/.exec(raw);
  const unbracketed = bracket ? bracket[1].trim() : raw;
  const s = stripLifeDates(unbracketed);
  if (datedOnly && s === raw) return raw;
  const m = /^([^,]+),\s*([^,]+)$/.exec(s);
  if (!m) {
    // multi-author, catalogue lead: "Kimball, Heber C., Orson Hyde, and
    // Willard Richards" — undo only the lead's inversion
    const multi = /^([^,]+),\s*([^,]+?),\s*(.*\band\b.*)$/.exec(s);
    if (multi && SURNAME.test(multi[1].trim()) && !/\band\b|\d/.test(multi[2])) {
      return `${multi[2].trim()} ${multi[1].trim()}, ${multi[3].trim()}`;
    }
    return s;
  }
  const flipped = `${m[2].trim()} ${m[1].trim()}`;
  // a fragment we don't understand left digits behind — the raw form is clearer
  // than a scrambled one ("1875 or 6 Tyler Parsons")
  return /\d/.test(flipped) ? raw : flipped;
};

// Flattened catalogue HTML leaves its seams: a tag beside punctuation becomes
// " ." / " ,", and some rows were keyed with words run together ("theFirst",
// "inPittsburgh", "Independence,Missouri") (R7 history-A7). Only a short
// function word glued to a capitalised word is split, so real names with an
// inner capital (McKay, LeGrand, MacDonald) are left alone.
const GLUED = /\b(the|to|in|of|and|on|at|for|from|by|with)(?=[A-Z][a-z])/g;
export const tidyText = (s) =>
  String(s || "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?=[A-Za-z])/g, "$1 ")
    .replace(GLUED, "$1 ");

// The full bibliographic citation (a whole 1834 long title) dominated the card
// below the quote (blind audit history-H3): a word clamp keeps it a meta line;
// the destination carries it in full.
const CITATION_WORDS = 22;
const tidyCitation = (c) => clampWords(tidyText(flatten(c)), CITATION_WORDS);

export default function ArchiveDocTile({ data, heading, headingTo, to, images = [] }) {
  if (!data) return null;
  const rail = (Array.isArray(images) ? images : [images]).filter(Boolean);
  const meta = [...new Set([data.year, displayAuthor(data.source, { datedOnly: true }), displayAuthor(data.author)].filter(Boolean))].join(" · ");
  const aspect = parseFloat(data.aspect) || null; // stored as height/width
  const { lead, bullets } = parseTeaser(data.teaser);
  // Show the FULL money quote with the mini-quote excerpts highlighted in place
  // (falling back to a bare mini quote when there's no money quote).
  const hasQuote = !!(data.money_quote || data.mini_quote);
  const multi = rail.length > 1;
  // A multi-page document stretches its filmstrip down the tile's right edge.
  // A single thumbnail floats top-right INSIDE the text column so the quote,
  // bullets and citation wrap under it — as a flex sibling it reserved a
  // 7.5rem strip for the full tile height, blank below the 160px thumb, and
  // squeezed the text into ~206px (blind R7 history-A1).
  const railLink = rail.length ? (
    <Link
      to={to}
      className={`historyTileRail${multi ? " multi" : " single"}`}
      tabIndex={-1}
      aria-hidden="true"
    >
      {rail.map((src, i) => (
        <TileImage
          key={i}
          className="historyTileThumb"
          sizes="120px"
          aspect={!multi && aspect ? `1 / ${aspect}` : undefined}
          path={src}
          alt=""
          onError={(e) => (e.target.style.display = "none")}
        />
      ))}
    </Link>
  ) : null;
  return (
    <RevealProvider>
      <div className="samplerTileInner historyTile">
        <h3 className="tileHeading">{headingTo ? <Link to={headingTo}>{heading}</Link> : heading}</h3>
        <div className="historyTileBody">
          <div className={`historyTileMain${rail.length && !multi ? " hasFloat" : ""}`}>
            {!multi ? railLink : null}
            {data.document ? (
              <Link to={to} className="historyTileTitle" tabIndex={-1}>{data.document}</Link>
            ) : null}
            {meta ? <div className="historyTileMeta">{meta}</div> : null}
            {hasQuote ? (
              // clamped like the witness / Joseph Smith quotes: an 88-word quote
              // ran 19 lines on phone (blind audit history-H3)
              // the clamp sits INSIDE the quote frame, so its line unit is the
              // quote's own serif line and the gold-ruled box stays whole
              <blockquote className="historyTileQuote">
                <ExpandableText className="historyTileQuoteWrap" lines={6} fade persistKey={data.slug ? `history:${data.slug}` : undefined}>
                {data.quote_speaker && !data.quote_is_witness_voice ? (
                  <span className="historyTileQuoteBy prefix">{data.quote_speaker}:</span>
                ) : null}{" "}
                &ldquo;{data.money_quote
                  ? renderMoneyQuote(data.money_quote, data.mini_quote)
                  : data.mini_quote}&rdquo;
                </ExpandableText>
                {/* attribution outside the clamp: always visible */}
                {data.quote_speaker && data.quote_is_witness_voice ? (
                  <cite className="historyTileQuoteBy">&mdash; {data.quote_speaker}</cite>
                ) : null}
              </blockquote>
            ) : lead ? (
              <ExpandableText className="historyTileTeaser" lines={3}>{lead}</ExpandableText>
            ) : null}
            {bullets.length ? (
              <ul className="historyTileBullets">
                {bullets.map((b, i) => (
                  <li key={i}>{clampWords(b, 16)}</li>
                ))}
              </ul>
            ) : null}
            {data.citation ? <div className="historyTileCitation">{tidyCitation(data.citation)}</div> : null}
          </div>
          {multi ? railLink : null}
        </div>
        <TileDeepLink to={to} />
      </div>
    </RevealProvider>
  );
}
