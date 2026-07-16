import React, { useEffect, useRef } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import * as OlProj from "ol/proj";
import * as Interaction from "ol/interaction";
import "ol/ol.css";

// FARMS "internal" model, zoomed out. Center mirrors MapContents' [centery,
// centerx] → fromLonLat convention (the internal map is a non-geographic tile
// projection, so these are its own coordinates, not real lat/lng).
const SLUG = "internal";
const CENTER = [-97.157, 18.517];
const MIN_ZOOM = 6;
const MAX_ZOOM = 10;
const INIT_ZOOM = 6; // one below default → a wider, "zoomed out" view

/**
 * Minimal standalone OpenLayers map — a single tile layer + a zoomed-out view.
 * Deliberately NO markers/stories/context (that's the full /map experience);
 * this is a lightweight, self-contained taster. Instantiated only when the
 * reserve balancer inserts the tile (and this whole module is code-split via
 * React.lazy), so the OL runtime never loads on a page that doesn't show it.
 */
export default function MapTileInner() {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    if (!elRef.current || mapRef.current) return undefined;
    mapRef.current = new Map({
      target: elRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: `${assetUrl}/map/${SLUG}/{z}/{x}/{y}`,
            tilePixelRatio: 2,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
          }),
        }),
      ],
      view: new View({
        center: OlProj.fromLonLat(CENTER),
        zoom: INIT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      }),
      controls: [],
      interactions: Interaction.defaults({ mouseWheelZoom: false }),
    });
    const map = mapRef.current;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);
  return <div ref={elRef} className="mapTileCanvas" />;
}
