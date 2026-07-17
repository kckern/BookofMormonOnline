import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { openScripture } from "./ScripturePopup";

// entity-type → profile route (matches src/models/Routes.js). No `group` entry:
// groups have no landing page, so group names render unlinked here — the group
// popup (see XrelSection) is the richer surface for them.
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
          // reverse edges (hub is the row's destination) read name-before-verb;
          // forward edges read verb-before-name — same two-fragment approach as
          // XrelSection.
          const verb = <span className="relEdgeRel">{e.rel}</span>;
          const name = to
            ? <Link to={to} className="relEdgeName">{e.dstName}</Link>
            : <span className="relEdgeName">{e.dstName}</span>;
          return (
            <li key={`${e.dstSlug}-${i}`} className="relEdge">
              {e.reverse ? <>{name}{" "}{verb}</> : <>{verb}{" "}{name}</>}
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
