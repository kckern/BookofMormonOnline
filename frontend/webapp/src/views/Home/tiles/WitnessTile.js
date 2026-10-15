import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { flatten, clampWords } from "./textUtils";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import ExpandableText from "./ExpandableText";

// Which witness the previous witness tile in the feed featured — so the same
// principal (David Whitmer has by far the most rows) doesn't clog consecutive
// tiles as fresh batches append on scroll. Module-scoped, resets per page load.
let lastFeaturedWitness = null;

const initials = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

// Editorial marks in a money quote — [Name] (supplied referent) and [...] (elision)
// — are set apart from the quoted words: rendered in grey Roboto, not scripture.
const BRACKET_RE = /(\[[^\]]*\])/g;
const withBrackets = (text) =>
  String(text || "")
    .split(BRACKET_RE)
    .map((part, i) =>
      part.startsWith("[") && part.endsWith("]")
        ? <span key={i} className="editorialMark">{part}</span>
        : part
    );

// Source lines carry light Markdown (publication titles in _italics_). Render
// _x_ / *x* as <em>; an underscore inside a word (snake_case) is left alone.
const MD_RE = /(?<![\w*])([_*])(?=\S)([^_*]+?)(?<=\S)\1(?![\w*])/g;
export const inlineMarkdown = (text) => {
  const s = String(text || "");
  const out = [];
  let last = 0;
  let m;
  MD_RE.lastIndex = 0;
  while ((m = MD_RE.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(<em key={m.index}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
};

/**
 * A single featured Book of Mormon witness — Harris, the Cowderys, the Whitmers,
 * Hyrum & Samuel Smith — from the 'witnesses' history archive. Large portrait,
 * name, their statement (money quote), and source. A third-party account names
 * its reporter as a meta line above the quote (not inside the clamp, where it
 * ate the first line); a long quote clamps with a reversible Layer-1 reveal.
 * The portrait goes to the witness page; the CTA lands on the quoted statement
 * (/history/witnesses/<witness>/<source>, which opens that source).
 * (A monogram stands in if a portrait fails to load.)
 */
export default function WitnessTile({ data }) {
  // Choose the featured witness ONCE — the first render where data is available —
  // then freeze it for this tile's lifetime. Without this, every re-render recomputes
  // pool[0], and because the pool depends on the mutable module-level lastFeaturedWitness
  // (which other witness tiles keep changing), the card's content would randomly swap
  // after it had already loaded. The choice is stable once made.
  const chosenRef = useRef(null);
  if (!chosenRef.current) {
    // Only rows with an editorially-prepared money quote are quotable — NEVER a
    // teaser/transcript (that would fabricate an attribution).
    const witnesses = (data || []).filter((x) => x?.principal && x?.moneyQuote);
    // Avoid repeating the previous tile's witness (David Whitmer has by far the most
    // rows); otherwise feature the seeded-first row, so BOTH first-person quotes and
    // attributed third-party accounts ("Speaker: …") surface across the feed.
    const notLast = witnesses.filter((x) => x.principal !== lastFeaturedWitness);
    const pool = notLast.length ? notLast : witnesses;
    if (pool.length) chosenRef.current = pool[0];
  }
  const w = chosenRef.current;
  // Remember who this tile featured so the next witness tile can skip them.
  // (hook runs unconditionally — before any early return; w is now stable so it fires once)
  useEffect(() => { if (w) lastFeaturedWitness = w.principal; }, [w?.principal]);
  if (!w) return null;
  const quote = flatten(w.moneyQuote);
  // flatten() strips HTML but keeps Markdown marks; clamp on words, then render.
  const source = w.source ? clampWords(flatten(w.source), 18) : null;
  const page = w.witnessSlug ? `/history/witnesses/${w.witnessSlug}` : "/history/witnesses";
  const to = w.witnessSlug && w.slug ? `${page}/${w.slug}` : page;
  const reporter = !w.isWitnessVoice && w.speaker ? w.speaker : null;
  return (
    <RevealProvider>
      <div className="samplerTileInner witnessTile">
        <h3 className="tileHeading">
          <Link to="/history/witnesses">{label("witnesses")}</Link>
        </h3>
        <div className="witnessFeatured">
          <Link to={page} className="witnessLeft">
            <span className="witnessHero">
              {w.witnessSlug ? (
                <TileImage
                  path={`history/witnesses/people/${w.witnessSlug}.jpg`}
                  alt=""
                  onError={(e) => { e.target.style.display = "none"; e.target.parentNode.classList.add("mono"); }}
                />
              ) : null}
              <span className="witnessMono" aria-hidden="true">{initials(w.principal)}</span>
            </span>
            <span className="witnessName">{w.principal}</span>
          </Link>
          <span className="witnessBody">
            {reporter ? <span className="witnessSpeaker">{reporter}:</span> : null}
            <ExpandableText className="witnessStatementWrap" lines={4}>
              <span className="witnessStatement">&ldquo;{withBrackets(quote)}&rdquo;</span>
            </ExpandableText>
            {source ? <span className="witnessSource">{inlineMarkdown(source)}</span> : null}
          </span>
        </div>
        <TileDeepLink to={to} verb="seeInContext" />
      </div>
    </RevealProvider>
  );
}
