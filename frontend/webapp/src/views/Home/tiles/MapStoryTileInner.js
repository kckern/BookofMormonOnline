import React, { useEffect, useRef } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import { Style, Stroke, Fill, Text, Circle as CircleStyle } from "ol/style";
import * as OlProj from "ol/proj";
import * as Interaction from "ol/interaction";
import "ol/ol.css";

// Same FARMS "internal" model as MapTileInner — a non-geographic tile
// projection; lat/lng here are its own coordinates, not real geography.
const SLUG = "internal";
const MIN_ZOOM = 6;
const MAX_ZOOM = 10;

/** Ordered journey coordinates: first move's start, then every move's end. */
const pathCoords = (moves) => {
  const coords = [];
  moves.forEach((m, i) => {
    if (i === 0) coords.push(OlProj.fromLonLat([Number(m.startLng), Number(m.startLat)]));
    coords.push(OlProj.fromLonLat([Number(m.endLng), Number(m.endLat)]));
  });
  return coords;
};

const stopStyle = (n) =>
  new Style({
    image: new CircleStyle({
      radius: 10,
      fill: new Fill({ color: "#8b1e1e" }),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),
    text: new Text({
      text: String(n),
      fill: new Fill({ color: "#ffffff" }),
      font: "bold 11px sans-serif",
    }),
  });

/**
 * Static journey path on the internal map: one LineString through the ordered
 * stops plus numbered circle markers, view fitted to the path extent. Loaded
 * lazily (React.lazy in MapStoryTile) so OL never ships on pages without it.
 */
export default function MapStoryTileInner({ moves }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    if (!elRef.current || mapRef.current) return undefined;
    const coords = pathCoords(moves);
    const line = new Feature({ geometry: new LineString(coords) });
    line.setStyle(new Style({ stroke: new Stroke({ color: "#8b1e1e", width: 3, lineDash: [8, 6] }) }));
    const stops = coords.map((c, i) => {
      const f = new Feature({ geometry: new Point(c) });
      f.setStyle(stopStyle(i + 1));
      return f;
    });
    const vector = new VectorLayer({ source: new VectorSource({ features: [line, ...stops] }) });
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
        vector,
      ],
      view: new View({ center: coords[0], zoom: MIN_ZOOM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }),
      controls: [],
      interactions: Interaction.defaults({ mouseWheelZoom: false }),
    });
    mapRef.current.getView().fit(line.getGeometry().getExtent(), {
      padding: [28, 28, 28, 28],
      maxZoom: MAX_ZOOM,
    });
    const map = mapRef.current;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [moves]);
  return <div ref={elRef} className="mapTileCanvas" />;
}
