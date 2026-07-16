import React, { Suspense } from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { openScripture } from "./ScripturePopup";

// Code-split: OpenLayers loads only when this tile actually renders — same
// pattern as MapTile/MapTileInner.
const MapStoryTileInner = React.lazy(() => import("./MapStoryTileInner"));

/**
 * A scripture journey as a STATIC path on the internal map (MVP: numbered
 * stops + connecting line, no animation) with a readable move list below.
 * Rendered once per page at the masonry tail — below the fold, never repeated
 * by the infinite feed.
 */
export default function MapStoryTile({ data }) {
  const moves = (data?.moves || []).filter((m) => m?.start && m?.end);
  if (moves.length < 2) return null;
  return (
    <div className="samplerTileInner mapStoryTile">
      <h3 className="tileHeading">
        <Link to="/map">{label("map")}</Link>
      </h3>
      {data.title ? <div className="mapStoryTitle">{data.title}</div> : null}
      <div className="mapTileFrame">
        <Suspense fallback={<div className="mapTileLoading">…</div>}>
          <MapStoryTileInner moves={moves} />
        </Suspense>
      </div>
      <ol className="mapStoryMoves">
        {moves.map((m) => (
          <li key={m.seq} className="mapStoryMove">
            <span className="mapStoryLeg">{m.start} → {m.end}</span>
            {m.ref ? (
              <button type="button" className="mapStoryRef" onClick={() => openScripture(m.ref)}>
                {m.ref}
              </button>
            ) : null}
            {m.description ? <div className="mapStoryDesc">{m.description}</div> : null}
          </li>
        ))}
      </ol>
      <Link to="/map" className="mapTileCta tileMoreLink">{label("view_more")}</Link>
    </div>
  );
}
