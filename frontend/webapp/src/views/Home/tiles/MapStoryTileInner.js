import React, { useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import { Style, Stroke } from "ol/style";
import * as OlProj from "ol/proj";
import * as Interaction from "ol/interaction";
import "ol/ol.css";
import { legVisibility, legsOf, stopsOf } from "./mapStoryPath";
import { buildStoryOverlay, storyStepForStop, travelerPosition } from "./mapStoryLayout";

// Same FARMS "internal" model as the full map. These coordinates belong to
// the model artwork; they are not claims about real-world geography.
const SLUG = "internal";
const MIN_ZOOM = 6;
const MAX_ZOOM = 10;
const EMPTY_STYLE = new Style({});

const ACTIVE = "#9f3029";

/**
 * bom_places_coords stores the internal projection's X in `lat` and Y in
 * `lng`. Match the full map's established [lat, lng] conversion order.
 */
const project = (lat, lng) => OlProj.fromLonLat([Number(lat), Number(lng)]);

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const routeStyle = (detached, opacity = 0.35) =>
  new Style({
    stroke: new Stroke({
      color: `rgba(42, 56, 49, ${opacity})`,
      width: 2,
      lineDash: detached ? [2, 6] : [5, 7],
    }),
  });

const visitedStyle = (detached, opacity = 0.72) =>
  new Style({
    stroke: new Stroke({
      color: `rgba(130, 47, 40, ${opacity})`,
      width: 2.5,
      lineDash: detached ? [2, 5] : undefined,
    }),
  });

const activeStyle = (detached) => [
  new Style({
    stroke: new Stroke({ color: "rgba(255, 255, 255, 0.92)", width: 7 }),
  }),
  new Style({
    stroke: new Stroke({
      color: ACTIVE,
      width: 4,
      lineDash: detached ? [3, 6] : [10, 7],
    }),
  }),
];

const participantName = (person) => person?.name || person?.slug;

const travelerLabel = (move) => {
  const people = (move?.people || []).filter((person) => person?.slug);
  if (people.length) {
    const shown = people.slice(0, 2).map(participantName).join(" and ");
    const extra = people.length - 2;
    return extra > 0 ? `${shown} and ${extra} more traveling` : `${shown} traveling`;
  }
  return move?.travelers ? `${move.travelers} traveling` : "Travelers moving to the next place";
};

/**
 * A semantic journey renderer: the complete route remains faintly visible,
 * visited legs accumulate, the active leg and traveler party animate together,
 * key labels survive through a collision-aware HTML overlay, and future stops
 * progressively collapse into deterministic screen-space clusters.
 */
export default function MapStoryTileInner({
  moves,
  step,
  complete = false,
  animate = true,
  playing = false,
  travelMs = 1500,
  describedBy,
  onSelectStep,
  onMapInteraction,
  onRecenter,
}) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const baseFeaturesRef = useRef([]);
  const progressFeaturesRef = useRef([]);
  const rafRef = useRef(null);
  const animationRef = useRef({ step: -1, elapsed: 0, lastTime: null });
  const resizeObserverRef = useRef(null);
  const travelerRef = useRef(null);
  const travelerLeaderRef = useRef(null);
  const travelerRouteRef = useRef(null);
  const overlayRef = useRef({ markers: [], clusters: [], labels: [] });
  const layoutStateRef = useRef(null);
  const updateLayoutRef = useRef(() => {});
  const fitStoryRef = useRef(() => {});
  const programmaticMoveRef = useRef(false);
  const mapMovedRef = useRef(false);
  const [overlay, setOverlay] = useState({ markers: [], clusters: [], labels: [] });
  const [mapMoved, setMapMoved] = useState(false);

  const legs = useMemo(() => legsOf(moves), [moves]);
  const stops = useMemo(() => stopsOf(moves), [moves]);
  const currentMove = complete ? moves[moves.length - 1] : (moves[step] || moves[moves.length - 1]);
  const selectedPeople = (currentMove?.people || []).filter((person) => person?.slug).slice(0, 2);
  const overflowPeople = Math.max(0, (currentMove?.people || []).filter((person) => person?.slug).length - 2);

  layoutStateRef.current = { moves, stops, step, complete };

  updateLayoutRef.current = () => {
    const map = mapRef.current;
    const target = mapElementRef.current;
    const state = layoutStateRef.current;
    if (!map || !target || !state) return;

    const pixels = {};
    state.stops.forEach((stop) => {
      pixels[stop.slug] = map.getPixelFromCoordinate(project(stop.lat, stop.lng));
    });
    const nextOverlay = buildStoryOverlay({
      ...state,
      pixels,
      width: target.clientWidth,
      height: target.clientHeight,
      clusterRadius: target.clientWidth < 360 ? 52 : 46,
      reservedRects: mapMovedRef.current
        ? [{ id: "control:recenter", x: target.clientWidth - 138, y: target.clientHeight - 58, width: 128, height: 48 }]
        : [],
    });
    overlayRef.current = nextOverlay;
    setOverlay(nextOverlay);
    const travelerRoute = travelerRouteRef.current;
    if (travelerRoute) {
      positionTraveler(travelerRoute.coordinate, travelerRoute.from, travelerRoute.to);
    }
  };

  function positionTraveler(coordinate, from, to) {
    travelerRouteRef.current = { coordinate, from, to };
    const map = mapRef.current;
    const target = mapElementRef.current;
    const traveler = travelerRef.current;
    const travelerLeader = travelerLeaderRef.current;
    if (!map || !target || !traveler || !coordinate) return;

    const pixel = map.getPixelFromCoordinate(coordinate);
    const fromPixel = map.getPixelFromCoordinate(from);
    const toPixel = map.getPixelFromCoordinate(to);
    // OpenLayers can briefly return null while the target is mounting or being
    // resized. Wait for the next render/layout pass instead of crashing the
    // entire home feed or pinning the party at an invented screen position.
    if (![pixel, fromPixel, toPixel].every((point) => point?.every?.(Number.isFinite))) {
      traveler.style.opacity = "0";
      if (travelerLeader) travelerLeader.style.opacity = "0";
      return;
    }
    const labelObstacles = overlayRef.current.labels.map((label) => ({
      id: `label:${label.slug}`,
      x: label.x,
      y: label.y,
      width: label.width,
      height: label.height,
    }));
    const clusterObstacles = overlayRef.current.clusters.map((cluster) => ({
      id: `cluster:${cluster.id}`,
      x: cluster.x - 31,
      y: cluster.y - 17,
      width: 62,
      height: 34,
    }));
    const markerObstacles = overlayRef.current.markers.map((marker) => ({
      id: `marker:${marker.slug}`,
      x: marker.x - marker.width / 2,
      y: marker.y - marker.height / 2,
      width: marker.width,
      height: marker.height,
    }));
    const position = travelerPosition({
      x: pixel[0],
      y: pixel[1],
      dx: toPixel[0] - fromPixel[0],
      dy: toPixel[1] - fromPixel[1],
      width: target.clientWidth,
      height: target.clientHeight,
      obstacles: [...labelObstacles, ...clusterObstacles, ...markerObstacles],
      partyWidth: selectedPeople.length
        ? 36 + Math.max(0, selectedPeople.length - 1) * 25 + (overflowPeople > 0 ? 18 : 0)
        : 36,
    });
    traveler.style.left = `${position.x}px`;
    traveler.style.top = `${position.y}px`;
    traveler.style.opacity = "1";
    if (travelerLeader) {
      travelerLeader.setAttribute("x1", pixel[0]);
      travelerLeader.setAttribute("y1", pixel[1]);
      travelerLeader.setAttribute("x2", position.x);
      travelerLeader.setAttribute("y2", position.y);
      travelerLeader.style.opacity = Math.hypot(position.x - pixel[0], position.y - pixel[1]) > 28 ? "1" : "0";
    }
  }

  // Build the map once per story. The underlay and playback layers are split so
  // future route context never disappears when the active feature changes.
  useEffect(() => {
    const target = mapElementRef.current;
    if (!target || mapRef.current) return undefined;

    const baseFeatures = legs.map((leg) => {
      const feature = new Feature({
        geometry: new LineString([
          project(leg.from.lat, leg.from.lng),
          project(leg.to.lat, leg.to.lng),
        ]),
      });
      feature.setStyle(routeStyle(leg.detached));
      return feature;
    });
    const progressFeatures = legs.map((leg) => {
      const from = project(leg.from.lat, leg.from.lng);
      const feature = new Feature({ geometry: new LineString([from, from]) });
      feature.setStyle(EMPTY_STYLE);
      return feature;
    });
    baseFeaturesRef.current = baseFeatures;
    progressFeaturesRef.current = progressFeatures;

    const baseLayer = new VectorLayer({
      source: new VectorSource({ features: baseFeatures }),
    });
    baseLayer.setZIndex(10);
    const progressLayer = new VectorLayer({
      source: new VectorSource({ features: progressFeatures }),
    });
    progressLayer.setZIndex(20);

    const map = new Map({
      target,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: `${assetUrl}/map/${SLUG}/{z}/{x}/{y}`,
            tilePixelRatio: 2,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
          }),
        }),
        baseLayer,
        progressLayer,
      ],
      view: new View({
        center: project(moves[0].startLat, moves[0].startLng),
        zoom: MIN_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      }),
      controls: [],
      interactions: Interaction.defaults({ mouseWheelZoom: false }),
    });
    mapRef.current = map;

    const fitStory = () => {
      const extent = baseLayer.getSource().getExtent();
      if (!extent.every(Number.isFinite)) return;
      programmaticMoveRef.current = true;
      map.updateSize();
      map.getView().fit(extent, {
        padding: [52, 52, 52, 52],
        maxZoom: MAX_ZOOM,
      });
      setMapMoved(false);
      mapMovedRef.current = false;
      map.renderSync();
      updateLayoutRef.current();
      requestAnimationFrame(() => { programmaticMoveRef.current = false; });
    };
    fitStoryRef.current = fitStory;

    const finishMove = () => {
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
      }
      updateLayoutRef.current();
    };
    const markManipulated = () => {
      if (programmaticMoveRef.current) return;
      mapMovedRef.current = true;
      setMapMoved(true);
      if (onMapInteraction) onMapInteraction();
    };
    map.on("moveend", finishMove);
    map.on("pointerdrag", markManipulated);

    resizeObserverRef.current = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          map.updateSize();
          if (!mapMovedRef.current) fitStory();
          else updateLayoutRef.current();
        })
      : null;
    if (resizeObserverRef.current) resizeObserverRef.current.observe(target);

    const initialFrame = requestAnimationFrame(fitStory);
    return () => {
      cancelAnimationFrame(initialFrame);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      map.un("moveend", finishMove);
      map.un("pointerdrag", markManipulated);
      map.setTarget(undefined);
      mapRef.current = null;
      baseFeaturesRef.current = [];
      progressFeaturesRef.current = [];
    };
    // `moves` is memoized by the owner; callbacks are intentionally accessed
    // through refs/closures so control changes do not rebuild OpenLayers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, legs]);

  // Paint stable route state whenever the selected beat changes. Manual
  // selections while paused render their full leg; autoplay starts at origin.
  useEffect(() => {
    const features = progressFeaturesRef.current;
    const baseFeatures = baseFeaturesRef.current;
    if (!features.length) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    animationRef.current = { step, elapsed: 0, lastTime: null };

    features.forEach((feature, index) => {
      const leg = legs[index];
      const from = project(leg.from.lat, leg.from.lng);
      const to = project(leg.to.lat, leg.to.lng);
      const vis = legVisibility(index, step, complete);
      if (vis.role === "active") {
        const drawFull = !animate || !playing;
        feature.setGeometry(new LineString(drawFull ? [from, to] : [from, from]));
        feature.setStyle(activeStyle(leg.detached));
      } else if (vis.role === "recent" || vis.role === "visited") {
        feature.setGeometry(new LineString([from, to]));
        feature.setStyle(visitedStyle(leg.detached, vis.opacity));
      } else {
        // old + future: progress layer stays empty; base carries faint context.
        feature.setGeometry(new LineString([from, from]));
        feature.setStyle(EMPTY_STYLE);
      }
    });

    baseFeatures.forEach((feature, index) => {
      const vis = legVisibility(index, step, complete);
      // Only long-past legs remain as faint route context. Future legs are hidden
      // until reached; active/recent/visited legs are drawn in color above.
      feature.setStyle(vis.role === "old" ? routeStyle(legs[index].detached, vis.opacity) : EMPTY_STYLE);
    });

    updateLayoutRef.current();

    const activeLeg = legs[complete ? legs.length - 1 : Math.min(step, legs.length - 1)];
    if (!activeLeg) return;
    const from = project(activeLeg.from.lat, activeLeg.from.lng);
    const to = project(activeLeg.to.lat, activeLeg.to.lng);
    positionTraveler(complete || !animate || !playing ? to : from, from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, complete, animate, legs]);

  // The route and representative people share one animation clock. Pausing
  // cancels the frame loop without discarding elapsed progress; play resumes
  // from the same rendered point.
  useEffect(() => {
    if (!playing || !animate || complete) return undefined;
    const feature = progressFeaturesRef.current[step];
    const activeLeg = legs[step];
    if (!feature || !activeLeg) return undefined;
    const from = project(activeLeg.from.lat, activeLeg.from.lng);
    const to = project(activeLeg.to.lat, activeLeg.to.lng);

    const tick = (now) => {
      const animation = animationRef.current;
      if (animation.lastTime !== null) animation.elapsed += now - animation.lastTime;
      animation.lastTime = now;
      const progress = Math.min(1, animation.elapsed / Math.max(1, travelMs));
      const eased = 1 - Math.pow(1 - progress, 3);
      const position = lerp(from, to, eased);
      feature.setGeometry(new LineString([from, position]));
      positionTraveler(position, from, to);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    animationRef.current.lastTime = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      animationRef.current.lastTime = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, animate, complete, step, travelMs, legs]);

  const recenter = (event) => {
    event.stopPropagation();
    fitStoryRef.current();
    if (onRecenter) onRecenter();
  };

  const chooseCluster = (event, cluster) => {
    event.stopPropagation();
    if (onSelectStep) onSelectStep(cluster.firstStep);
  };

  const choosePlace = (event, stop) => {
    event.stopPropagation();
    if (!onSelectStep) return;
    onSelectStep(storyStepForStop({ stop, moves, step, complete }));
  };

  return (
    <div className="mapStoryMap" data-testid="map-story-map">
      <div
        ref={mapElementRef}
        className="mapTileCanvas"
        tabIndex="0"
        aria-label="Interactive journey map. Drag or zoom to explore, then use Recenter story to restore the journey view."
        aria-describedby={describedBy}
      />

      <svg className="mapStoryLeaderLines" aria-hidden="true">
        <line ref={travelerLeaderRef} className="isTravelerLeader" />
        {overlay.markers.map((marker) =>
          marker.leader ? (
            <line
              className="isSymbolLeader"
              key={`marker:${marker.slug}`}
              x1={marker.leader.x1}
              y1={marker.leader.y1}
              x2={marker.leader.x2}
              y2={marker.leader.y2}
            />
          ) : null,
        )}
        {overlay.clusters.map((cluster) =>
          cluster.leader ? (
            <line
              className="isSymbolLeader"
              key={`cluster:${cluster.id}`}
              x1={cluster.leader.x1}
              y1={cluster.leader.y1}
              x2={cluster.leader.x2}
              y2={cluster.leader.y2}
            />
          ) : null,
        )}
        {overlay.labels.map((label) =>
          label.leader ? (
            <line
              key={`label:${label.slug}`}
              x1={label.leader.x1}
              y1={label.leader.y1}
              x2={label.leader.x2}
              y2={label.leader.y2}
            />
          ) : null,
        )}
      </svg>

      <div className="mapStoryMapOverlay">
        {overlay.markers.map((marker) => (
          <span
            key={marker.slug}
            className={`mapStoryStopMarker is-${marker.role}`}
            style={{ left: marker.x, top: marker.y }}
            aria-hidden="true"
          />
        ))}
        {overlay.labels.map((label) => (
          <button
            key={label.slug}
            type="button"
            className={`mapStoryPlaceLabel is-${label.role}`}
            style={{ left: label.x, top: label.y, width: label.width, height: label.height }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => choosePlace(event, label)}
            title={label.name}
            aria-label={`${label.name}; go to move ${storyStepForStop({ stop: label, moves, step, complete }) + 1}`}
            aria-current={label.role === "active" ? "location" : undefined}
          >
            {label.name}
          </button>
        ))}
        {overlay.clusters.map((cluster) => (
          <button
            key={cluster.id}
            type="button"
            className="mapStoryCluster"
            style={{ left: cluster.x, top: cluster.y }}
            onClick={(event) => chooseCluster(event, cluster)}
            aria-label={`${cluster.stops.length} future places; go to move ${cluster.firstStep + 1}`}
            title={cluster.stops.map((stop) => stop.name).join(", ")}
          >
            <strong>{cluster.stops.length}</strong>
            <span>places</span>
          </button>
        ))}
      </div>

      <div
        ref={travelerRef}
        className={`mapStoryTravelerParty${complete ? " isComplete" : ""}`}
        role="img"
        aria-label={travelerLabel(currentMove)}
      >
        {selectedPeople.length ? selectedPeople.map((person) => (
          <span className="mapStoryTravelerAvatar" key={person.slug} title={participantName(person)}>
            <span aria-hidden="true">{participantName(person).slice(0, 1)}</span>
            <img
              src={`${assetUrl}/people/${person.slug}`}
              alt=""
              loading="lazy"
              onError={(event) => { event.currentTarget.style.display = "none"; }}
            />
          </span>
        )) : (
          <span className="mapStoryTravelerAvatar isGeneric" aria-hidden="true">↗</span>
        )}
        {overflowPeople > 0 ? <span className="mapStoryTravelerMore">+{overflowPeople}</span> : null}
      </div>

      {mapMoved ? (
        <button type="button" className="mapStoryRecenter" onClick={recenter}>
          <span aria-hidden="true">⌖</span> Recenter story
        </button>
      ) : null}
    </div>
  );
}
