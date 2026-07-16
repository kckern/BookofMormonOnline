import React, { Suspense } from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";

// Code-split: the OpenLayers runtime + the map module load ONLY when this tile
// actually renders (the reserve balancer inserts it below the fold), so a home
// page that never shows the map pays nothing for it.
const MapTileInner = React.lazy(() => import("./MapTileInner"));

/**
 * A live, zoomed-out interactive map as a home tile — a taster that links into
 * the full /map experience. Always placed below the fold by the sampler.
 */
export default function MapTile() {
  return (
    <div className="samplerTileInner mapTile">
      <h3 className="tileHeading">
        <Link to="/map">{label("map")}</Link>
      </h3>
      <div className="mapTileFrame">
        <Suspense fallback={<div className="mapTileLoading">…</div>}>
          <MapTileInner />
        </Suspense>
      </div>
      <Link to="/map" className="mapTileCta tileMoreLink">{label("view_more")}</Link>
    </div>
  );
}
