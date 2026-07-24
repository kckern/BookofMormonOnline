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
  // lead with the money quote; fall back to the teaser
  const witnesses = (data || [])
    .filter((w) => w?.principal && (w?.moneyQuote || w?.statement))
    .map((w) => ({ ...w, quote: w.moneyQuote || w.statement }));
  if (!witnesses.length) return null;
  const w = witnesses[0]; // featured single witness
  return (
    <div className="samplerTileInner witnessTile">
      <h3 className="tileHeading">
        <Link to="/history/witnesses">{label("witnesses")}</Link>
      </h3>
      <Link
        to={w.witnessSlug ? `/history/witnesses/${w.witnessSlug}` : "/history/witnesses"}
        className="witnessFeatured"
      >
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
          <blockquote className="witnessStatement">“{clampWords(flatten(w.quote), 60)}”</blockquote>
          {w.source ? <span className="witnessSource">{clampWords(flatten(w.source), 18)}</span> : null}
        </span>
      </Link>
    </div>
  );
}
