import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { flatten, clampWords } from "./textUtils";

const initials = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

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
  if (!witnesses.length) return null;
  const w = witnesses.find((x) => x.isWitnessVoice) || witnesses[0];
  const quote = clampWords(flatten(w.moneyQuote), 60);
  const source = w.source ? clampWords(flatten(w.source), 18) : null;
  const to = w.witnessSlug ? `/history/witnesses/${w.witnessSlug}` : "/history/witnesses";
  return (
    <div className="samplerTileInner witnessTile">
      <h3 className="tileHeading">
        <Link to="/history/witnesses">{label("witnesses")}</Link>
      </h3>
      {w.isWitnessVoice ? (
        // The witness's own words — portrait + name (the speaker) + quote.
        <Link to={to} className="witnessFeatured">
          <span className="witnessLeft">
            <span className="witnessHero">
              {w.witnessSlug ? (
                <img
                  src={`${assetUrl}/history/witnesses/people/${w.witnessSlug}.jpg`}
                  alt={w.speaker || w.principal}
                  loading="lazy"
                  onError={(e) => { e.target.style.display = "none"; e.target.parentNode.classList.add("mono"); }}
                />
              ) : null}
              <span className="witnessMono" aria-hidden="true">{initials(w.speaker || w.principal)}</span>
            </span>
            <span className="witnessName">{w.speaker || w.principal}</span>
          </span>
          <span className="witnessBody">
            <blockquote className="witnessStatement">“{quote}”</blockquote>
            {source ? <span className="witnessSource">{source}</span> : null}
          </span>
        </Link>
      ) : (
        // Someone else's words about the witness — speaker prefix, NO portrait
        // (the witness's face beside a reporter's line is the same misattribution).
        <Link to={to} className="witnessFeatured witness-reported">
          <span className="witnessBody">
            <blockquote className="witnessStatement">
              {w.speaker ? <span className="witnessSpeaker">{w.speaker}:</span> : null}{" "}
              &ldquo;{quote}&rdquo;
            </blockquote>
            {source ? <span className="witnessSource">{source}</span> : null}
          </span>
        </Link>
      )}
    </div>
  );
}
