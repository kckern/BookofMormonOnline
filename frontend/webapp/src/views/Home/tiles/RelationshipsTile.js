import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { openScripture } from "./ScripturePopup";

// entity-type → profile route (matches src/models/Routes.js)
const PROFILE_PATH = {
  people: (slug) => `/people/${slug}`,
  place: (slug) => `/places/${slug}`,
  object: (slug) => `/objects/${slug}`,
};
const profileTo = (type, slug) => (PROFILE_PATH[type] ? PROFILE_PATH[type](slug) : null);

/**
 * A connections card from bom_xrels: one hub entity and its typed relations,
 * every name deep-linking to the entity's profile. Notes render as subtitles;
 * a parsed scripture ref (when the note carried one) opens the popup.
 */
export default function RelationshipsTile({ data }) {
  const edges = (data?.edges || []).filter((e) => e?.dstName && e?.dstSlug);
  if (!data?.hubName || edges.length < 2) return null;
  const hubTo = profileTo(data.hubType, data.hubSlug);
  return (
    <div className="samplerTileInner relationshipsTile">
      <h3 className="tileHeading">
        <Link to="/relationships">{label("relationships")}</Link>
      </h3>
      {hubTo ? (
        <Link to={hubTo} className="relHub">{data.hubName}</Link>
      ) : (
        <span className="relHub">{data.hubName}</span>
      )}
      {data.hubTitle ? <div className="relHubTitle">{data.hubTitle}</div> : null}
      <ul className="relEdges">
        {edges.map((e, i) => {
          const to = profileTo(e.dstType, e.dstSlug);
          return (
            <li key={`${e.dstSlug}-${i}`} className="relEdge">
              <span className="relEdgeRel">{e.rel}</span>{" "}
              {to ? <Link to={to} className="relEdgeName">{e.dstName}</Link> : <span className="relEdgeName">{e.dstName}</span>}
              {e.ref ? (
                <button type="button" className="relEdgeRef" onClick={() => openScripture(e.ref)}>
                  {e.ref}
                </button>
              ) : null}
              {e.note ? <div className="relEdgeNote">{e.note}</div> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
