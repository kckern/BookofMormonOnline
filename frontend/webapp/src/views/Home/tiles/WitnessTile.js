import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { flatten, clampWords } from "./textUtils";

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

/**
 * A single featured Book of Mormon witness — Harris, the Cowderys, the Whitmers,
 * Hyrum & Samuel Smith — from the 'witnesses' history archive. Large portrait,
 * name, their statement (money quote, else teaser), and source; deep-links into
 * the Witnesses view. (A monogram stands in if a portrait fails to load.)
 */
export default function WitnessTile({ data }) {
  // Only rows with an editorially-prepared money quote are quotable — NEVER a
  // teaser/transcript (that would fabricate an attribution). Prefer a first-person
  // (witness-voice) quote so the featured card can carry the portrait.
  const witnesses = (data || []).filter((w) => w?.principal && w?.moneyQuote);
  // Avoid repeating the previous tile's witness (David Whitmer has by far the most
  // rows); otherwise feature the seeded-first row, so BOTH first-person quotes and
  // attributed third-party accounts ("Speaker: …") surface across the feed — no
  // witness-voice bias that would hide the reported accounts.
  const notLast = witnesses.filter((x) => x.principal !== lastFeaturedWitness);
  const pool = notLast.length ? notLast : witnesses;
  const w = pool[0];
  // Remember who this tile featured so the next witness tile can skip them.
  // (hook runs unconditionally — before any early return)
  useEffect(() => { if (w) lastFeaturedWitness = w.principal; }, [w?.principal]);
  if (!w) return null;
  const quote = clampWords(flatten(w.moneyQuote), 60);
  const source = w.source ? clampWords(flatten(w.source), 18) : null;
  const to = w.witnessSlug ? `/history/witnesses/${w.witnessSlug}` : "/history/witnesses";
  return (
    <div className="samplerTileInner witnessTile">
      <h3 className="tileHeading">
        <Link to="/history/witnesses">{label("witnesses")}</Link>
      </h3>
      {/* Always show the witness (the SUBJECT) portrait + name. For a
          non-first-hand account, the actual speaker is named in the quote
          prefix — they said it, the witness is who it's about. */}
      <Link to={to} className="witnessFeatured">
        <span className="witnessLeft">
          <span className="witnessHero">
            {w.witnessSlug ? (
              <img
                src={`${assetUrl}/history/witnesses/people/${w.witnessSlug}.jpg`}
                alt={w.principal}
                loading="lazy"
                onError={(e) => { e.target.style.display = "none"; e.target.parentNode.classList.add("mono"); }}
              />
            ) : null}
            <span className="witnessMono" aria-hidden="true">{initials(w.principal)}</span>
          </span>
          <span className="witnessName">{w.principal}</span>
        </span>
        <span className="witnessBody">
          <blockquote className="witnessStatement">
            {!w.isWitnessVoice && w.speaker ? <span className="witnessSpeaker">{w.speaker}:</span> : null}
            {!w.isWitnessVoice && w.speaker ? " " : null}
            &ldquo;{withBrackets(quote)}&rdquo;
          </blockquote>
          {source ? <span className="witnessSource">{source}</span> : null}
        </span>
      </Link>
    </div>
  );
}
