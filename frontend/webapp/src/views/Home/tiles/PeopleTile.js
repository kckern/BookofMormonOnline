import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

const stripTags = (html, words = 42) => {
  const text = (html || "").replace(/<[^>]*>/gi, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const parts = text.split(" ");
  return parts.slice(0, words).join(" ") + (parts.length > words ? "…" : "");
};

/**
 * Sampling, not a mosaic: the seeded-first person is FEATURED with a taste of
 * their index entry — portrait, epithet, bio excerpt, and scripture-reference
 * chips — while the rest render as a compact face strip underneath.
 */
export default function PeopleTile({ data }) {
  const [featured, ...rest] = data;
  const refs = (featured.index || []).filter((i) => i?.ref).slice(0, 3);
  return (
    <div className="samplerTileInner peopleTile">
      <h3 className="tileHeading">
        <Link to="/people">{label("people")}</Link>
      </h3>
      <Link to={`/people/${featured.slug}`} className="peopleFeature">
        <img
          className="peopleFeatureImg"
          src={`${assetUrl}/people/${featured.slug}`}
          alt={featured.name || ""}
          loading="lazy"
          onError={(e) => (e.target.style.visibility = "hidden")}
        />
        <div className="peopleFeatureBody">
          <div className="peopleFeatureName">{featured.name}</div>
          {featured.title ? <div className="peopleFeatureTitle">{featured.title}</div> : null}
          {featured.description ? (
            <p className="peopleFeatureDesc">{stripTags(featured.description)}</p>
          ) : null}
          {refs.length ? (
            <div className="peopleFeatureRefs">
              {refs.map((r) => (
                <span className="refChip" key={r.ref}>{r.ref}</span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
      <div className="peopleFaceRow">
        {rest.map((p) => (
          <Link to={`/people/${p.slug}`} key={p.slug} className="peopleFaceCard" title={p.title || p.name}>
            <img
              src={`${assetUrl}/people/${p.slug}`}
              alt={p.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <div className="peopleFaceName">{p.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
