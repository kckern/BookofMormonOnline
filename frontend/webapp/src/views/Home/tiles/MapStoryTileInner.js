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
import { legsOf, stopsOf, stopStateAt } from "./mapStoryPath";

// Same FARMS "internal" model as MapTileInner — a non-geographic tile
// projection; lat/lng here are its own coordinates, not real geography.
const SLUG = "internal";
const MIN_ZOOM = 6;
const MAX_ZOOM = 10;
const DRAW_MS = 1500;

const RED = "#8b1e1e";
const DIM = "rgba(139, 30, 30, 0.35)";

/**
 * bom_places_coords stores the internal projection's X in the `lat` column and
 * Y in `lng` (swapped vs the usual convention), so the live map plots
 * fromLonLat([lat, lng]) — see MapContents.js:508. Match that order: passing
 * lng-then-lat feeds a −97 value in as a latitude, and Mercator blows up to
 * Infinity beyond ±90° (which then makes view.fit() throw on an invalid extent).
 */
const project = (lat, lng) => OlProj.fromLonLat([Number(lat), Number(lng)]);

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const legStyle = (state, detached) =>
  new Style({
    stroke: new Stroke({
      color: state === "past" ? DIM : RED,
      width: state === "past" ? 2 : 3,
      // A leg whose start does not match the previous leg's end is drawn with a
      // finer dash — the journey genuinely jumps here, and showing it plainly is
      // what makes the dirty rows findable. See the design doc's discontinuity
      // note: 47 such legs across 21 of 55 stories.
      lineDash: detached ? [2, 5] : [8, 6],
    }),
  });

const stopStyle = (n, state) =>
  new Style({
    image: new CircleStyle({
      radius: state === "current" ? 13 : 10,
      fill: new Fill({ color: state === "future" ? DIM : RED }),
      stroke: new Stroke({ color: "#ffffff", width: state === "current" ? 3 : 2 }),
    }),
    text: new Text({
      text: String(n),
      fill: new Fill({ color: "#ffffff" }),
      font: `bold ${state === "current" ? 13 : 11}px sans-serif`,
    }),
  });

/**
 * The journey on the internal map, rendered as ONE FEATURE PER MOVE rather than
 * a single polyline through every stop. Two defects follow from a polyline: it
 * invents a connection wherever move N's end differs from move N+1's start, and
 * it stacks duplicate markers on revisited places. See mapStoryPath.js.
 *
 * `step` selects the active leg; that leg grows via requestAnimationFrame while
 * earlier legs stay drawn and later ones stay hidden. `animate={false}` (reduced
 * motion) draws everything at once and lets `step` only pick the highlight.
 *
 * Loaded lazily (React.lazy in MapStoryTile) so OL never ships on pages without it.
 */
export default function MapStoryTileInner({ moves, step, animate = true }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const legsRef = useRef([]);
  const stopsRef = useRef([]);
  const rafRef = useRef(null);

  // ── build the map once per story ────────────────────────────────────────
  useEffect(() => {
    if (!elRef.current || mapRef.current) return undefined;

    const legs = legsOf(moves);
    const stops = stopsOf(moves);

    const legFeatures = legs.map((leg) => {
      const f = new Feature({
        geometry: new LineString([
          project(leg.from.lat, leg.from.lng),
          project(leg.to.lat, leg.to.lng),
        ]),
      });
      f.set("detached", leg.detached);
      return f;
    });

    const stopFeatures = stops.map((s, i) => {
      const f = new Feature({ geometry: new Point(project(s.lat, s.lng)) });
      f.set("label", i + 1);
      return f;
    });

    legsRef.current = legFeatures;
    stopsRef.current = stopFeatures;

    const vector = new VectorLayer({
      source: new VectorSource({ features: [...legFeatures, ...stopFeatures] }),
    });

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
      view: new View({ center: project(moves[0].startLat, moves[0].startLng), zoom: MIN_ZOOM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }),
      controls: [],
      interactions: Interaction.defaults({ mouseWheelZoom: false }),
    });

    // Fit to the WHOLE story once, not per step — refitting each leg would make
    // the map lurch as it plays. Only fit a finite extent: a stray NaN/Infinity
    // coordinate would make fit() throw and take the whole tile down.
    const source = vector.getSource();
    const extent = source.getExtent();
    if (extent.every(Number.isFinite)) {
      mapRef.current.getView().fit(extent, { padding: [28, 28, 28, 28], maxZoom: MAX_ZOOM });
    }

    const map = mapRef.current;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      legsRef.current = [];
      stopsRef.current = [];
    };
  }, [moves]);

  // ── paint the current step ──────────────────────────────────────────────
  useEffect(() => {
    const legFeatures = legsRef.current;
    const stopFeatures = stopsRef.current;
    if (!legFeatures.length) return undefined;

    const legs = legsOf(moves);
    const stops = stopsOf(moves);
    // The title card sits one past the last move; on it, show the whole journey.
    const onTitleCard = step >= moves.length;
    const active = onTitleCard ? moves.length - 1 : step;

    stopFeatures.forEach((f, i) => {
      f.setStyle(stopStyle(f.get("label"), stopStateAt(stops[i], active, onTitleCard)));
    });

    legFeatures.forEach((f, i) => {
      const full = [
        project(legs[i].from.lat, legs[i].from.lng),
        project(legs[i].to.lat, legs[i].to.lng),
      ];
      if (onTitleCard || i < active) {
        f.setGeometry(new LineString(full));
        f.setStyle(legStyle("past", legs[i].detached));
      } else if (i === active) {
        f.setStyle(legStyle("current", legs[i].detached));
        f.setGeometry(new LineString(animate ? [full[0], full[0]] : full));
      } else {
        // Hidden rather than removed — keeps feature identity stable across steps.
        f.setStyle(new Style({}));
        f.setGeometry(new LineString(full));
      }
    });

    if (!animate || onTitleCard) return undefined;

    const target = legFeatures[active];
    if (!target) return undefined;
    const from = project(legs[active].from.lat, legs[active].from.lng);
    const to = project(legs[active].to.lat, legs[active].to.lng);
    let start = null;
    const tick = (ts) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / DRAW_MS);
      target.setGeometry(new LineString([from, lerp(from, to, t)]));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [moves, step, animate]);

  return <div ref={elRef} className="mapTileCanvas" />;
}
