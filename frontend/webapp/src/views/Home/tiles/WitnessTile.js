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
 * Book of Mormon witness statements — Harris, the Cowderys, the Whitmers,
 * Hyrum & Samuel Smith — from the 'witnesses' history archive. Each row shows
 * the witness's portrait, their statement, and the source, and deep-links into
 * the Witnesses view. (A monogram stands in if a portrait fails to load.)
 */
export default function WitnessTile({ data }) {
  // redesigned cards lead with the money quote; fall back to the teaser
  const witnesses = (data || [])
    .filter((w) => w?.principal && (w?.moneyQuote || w?.statement))
    .map((w) => ({ ...w, quote: w.moneyQuote || w.statement }));
  if (!witnesses.length) return null;
  return (
    <div className="samplerTileInner witnessTile">
      <h3 className="tileHeading">
        <Link to="/history/witnesses">{label("witnesses")}</Link>
      </h3>
      <div className="witnessList">
        {witnesses.map((w) => (
          <Link
            key={w.slug || w.principal}
            to={w.witnessSlug ? `/history/witnesses/${w.witnessSlug}` : "/history/witnesses"}
            className="witnessRow"
          >
            <span className="witnessAvatar">
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
            <span className="witnessBody">
              <span className="witnessName">{w.principal}</span>
              <span className="witnessStatement">“{clampWords(flatten(w.quote), 32)}”</span>
              {w.source ? <span className="witnessSource">{clampWords(flatten(w.source), 14)}</span> : null}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
