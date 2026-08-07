import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { legsOf, stopsOf } from "./mapStoryPath";
import { MapStoryCompleteCard, MapStoryMoveCard } from "./MapStoryCard";
import TileDeepLink from "./_ds/TileDeepLink";

const MapStoryTileInner = React.lazy(() => import("./MapStoryTileInner"));

export const PLAYBACK_BUDGET_MS = 22000;

export const playbackTiming = (moveCount) => {
  const stepMs = Math.min(2800, Math.max(750, Math.floor(PLAYBACK_BUDGET_MS / Math.max(1, moveCount))));
  return {
    stepMs,
    travelMs: Math.min(1650, Math.max(520, Math.round(stepMs * 0.68))),
  };
};

export const homeStoryTitle = (title) => {
  const clean = String(title || "").trim();
  // This source title is an inverted database label, not readable editorial
  // copy. Keep the correction explicit until Home-specific titles are stored.
  if (clean.toLowerCase() === "recolonization noah") return "Noah’s Recolonization";
  return clean;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  Boolean(window.matchMedia("(prefers-reduced-motion: reduce)")?.matches);

const isValidMove = (move) =>
  move?.start &&
  move?.end &&
  [move.startLat, move.startLng, move.endLat, move.endLng].every((value) =>
    Number.isFinite(Number(value)),
  );

const Icon = ({ children }) => <span className="mapStoryControlIcon" aria-hidden="true">{children}</span>;

class MapStoryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

const MapFallback = ({ title, origin, destination }) => (
  <div className="mapStoryFallback" role="img" aria-label={`${title}: ${origin} to ${destination}`}>
    <div className="mapStoryFallbackRoute" aria-hidden="true">
      <span />
      <i />
      <span />
    </div>
    <div className="mapStoryFallbackPlaces">
      <strong>{origin}</strong>
      <strong>{destination}</strong>
    </div>
  </div>
);

/**
 * A glanceable journey player for Home. Its first frame already contains the
 * route context and exact-story action; controlled animation then answers who
 * moved where without forcing the user to wait for basic meaning.
 */
export default function MapStoryTile({ data }) {
  const moves = useMemo(() => (data?.moves || []).filter(isValidMove), [data]);
  const legs = useMemo(() => legsOf(moves), [moves]);
  const stops = useMemo(() => stopsOf(moves), [moves]);
  const title = homeStoryTitle(data?.title);
  const mapLabel = String(label("map") || "").trim() || "Map";
  const storyHref = `/map/internal/story/${data?.slug}`;
  const reducedInitially = prefersReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(reducedInitially);
  const [complete, setComplete] = useState(reducedInitially);
  const [reducedMotion, setReducedMotion] = useState(reducedInitially);
  const [visible, setVisible] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const rootRef = useRef(null);

  const timing = playbackTiming(moves.length);
  const currentMove = complete
    ? moves[moves.length - 1]
    : moves[Math.min(step, Math.max(0, moves.length - 1))];
  const origin = moves[0] ? (moves[0].startName || moves[0].start) : "Origin";
  const destination = moves.length
    ? (moves[moves.length - 1].endName || moves[moves.length - 1].end)
    : "Destination";
  const playing = visible && mapMounted && !paused && !complete && !reducedMotion && moves.length >= 2;
  const summaryId = `map-story-summary-${String(data?.slug || "journey").replace(/[^a-z0-9_-]/gi, "-")}`;

  useEffect(() => {
    const media = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    if (!media) return undefined;
    const updatePreference = (event) => {
      setReducedMotion(event.matches);
      if (event.matches) {
        setPaused(true);
        setComplete(true);
      }
    };
    if (typeof media.addEventListener === "function") media.addEventListener("change", updatePreference);
    else if (typeof media.addListener === "function") media.addListener(updatePreference);
    return () => {
      if (typeof media.removeEventListener === "function") media.removeEventListener("change", updatePreference);
      else if (typeof media.removeListener === "function") media.removeListener(updatePreference);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver !== "function") {
      setVisible(true);
      setMapMounted(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      const nextVisible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.2);
      setVisible(nextVisible);
      if (nextVisible) setMapMounted(true);
    }, { threshold: [0, 0.2, 0.6] });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => {
      if (step >= moves.length - 1) {
        setComplete(true);
        setPaused(true);
      } else {
        setStep((current) => current + 1);
      }
    }, timing.stepMs);
    return () => clearTimeout(timer);
  }, [playing, step, moves.length, timing.stepMs]);

  if (moves.length < 2) return null;

  const selectStep = (nextStep) => {
    setPaused(true);
    setComplete(false);
    setStep(Math.min(moves.length - 1, Math.max(0, Number(nextStep))));
  };

  const previous = () => {
    if (complete) selectStep(moves.length - 1);
    else selectStep(step - 1);
  };

  const next = () => {
    if (step >= moves.length - 1) {
      setPaused(true);
      setComplete(true);
      return;
    }
    selectStep(step + 1);
  };

  const togglePlayback = () => {
    if (complete) {
      setStep(0);
      setComplete(false);
      setPaused(reducedMotion);
      return;
    }
    setPaused((current) => !current);
  };

  const movementLabel = complete ? "Journey complete" : `Move ${step + 1} of ${moves.length}`;
  const rangeValueText = complete
    ? `Journey complete, ${moves.length} moves`
    : `Move ${step + 1} of ${moves.length}: ${currentMove.startName || currentMove.start} to ${currentMove.endName || currentMove.end}`;
  const travelerNames = (currentMove.people || [])
    .map((person) => person?.name || person?.slug)
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="samplerTileInner mapStoryTile"
      ref={rootRef}
      data-testid="map-story-tile"
      onKeyDownCapture={(event) => {
        if (event.key === "Tab") setPaused(true);
      }}
    >
      <div className="mapStoryHeader">
        <div className="mapStoryHeaderCopy">
          <h3 className="tileHeading"><Link to="/map">{mapLabel}</Link></h3>
          <Link to={storyHref} className="mapStoryTitle">{title}</Link>
        </div>
        <span className="mapStoryCounts">{moves.length} moves · {stops.length} places</span>
      </div>

      <p id={summaryId} className="mapStoryTextEquivalent">
        {title}. A journey of {moves.length} moves across {stops.length} places,
        from {origin} to {destination}. {complete ? "The full journey is shown." : `Current move: ${currentMove.startName || currentMove.start} to ${currentMove.endName || currentMove.end}.`}
        {travelerNames ? ` Traveling: ${travelerNames}.` : ""}
      </p>

      <div className="mapTileFrame">
        <MapStoryErrorBoundary fallback={<MapFallback title={title} origin={origin} destination={destination} />}>
          {mapMounted ? (
            <Suspense fallback={<MapFallback title={title} origin={origin} destination={destination} />}>
              <MapStoryTileInner
                moves={moves}
                step={step}
                complete={complete}
                animate={!reducedMotion}
                playing={playing}
                travelMs={timing.travelMs}
                describedBy={summaryId}
                onSelectStep={selectStep}
                onMapInteraction={() => {
                  setPaused(true);
                  setMapMoved(true);
                }}
                onRecenter={() => setMapMoved(false)}
              />
            </Suspense>
          ) : (
            <MapFallback title={title} origin={origin} destination={destination} />
          )}
        </MapStoryErrorBoundary>
        <div className="mapStoryMapShade" aria-hidden="true" />
      </div>

      <div className="mapStoryPlaybackStatus">
        <span className={`mapStoryMoveState${complete ? " isComplete" : ""}`}>{movementLabel}</span>
        <span className="mapStoryLegend" aria-hidden="true">
          <i className="isActive" /> Active <i className="isVisited" /> Visited <i className="isFuture" /> Later
        </span>
      </div>

      <div className="mapStoryControls" aria-label="Journey playback controls">
        <button
          type="button"
          className="mapStoryControlButton"
          onClick={previous}
          disabled={!complete && step === 0}
          aria-label="Previous move"
        >
          <Icon>‹</Icon>
        </button>
        <button
          type="button"
          className="mapStoryControlButton isPrimary"
          onClick={togglePlayback}
          aria-label={complete ? "Replay journey" : paused ? label("mapstory_play") : label("mapstory_pause")}
          title={reducedMotion ? "Automatic movement is off because reduced motion is enabled" : undefined}
        >
          <Icon>{complete ? "↻" : paused ? "▶" : "Ⅱ"}</Icon>
        </button>
        <label className="mapStoryScrubberLabel">
          <span className="mapStoryTextEquivalent">Choose a journey move</span>
          <input
            className="mapStoryScrubber"
            type="range"
            min="1"
            max={moves.length}
            step="1"
            value={complete ? moves.length : step + 1}
            onChange={(event) => selectStep(Number(event.target.value) - 1)}
            aria-label="Journey move"
            aria-valuetext={rangeValueText}
            style={{ "--map-story-progress": `${complete ? 100 : (step / Math.max(1, moves.length - 1)) * 100}%` }}
          />
        </label>
        <button
          type="button"
          className="mapStoryControlButton"
          onClick={next}
          disabled={complete}
          aria-label="Next move"
        >
          <Icon>›</Icon>
        </button>
      </div>

      {mapMoved ? <div className="mapStoryInteractionHint">Playback paused while you explore the map.</div> : null}

      <div className="mapStoryStage">
        {complete ? (
          <MapStoryCompleteCard
            title={title}
            description={data.description}
            stopCount={stops.length}
            moveCount={moves.length}
          />
        ) : (
          <MapStoryMoveCard
            move={{ ...currentMove, detached: legs[step]?.detached }}
            step={step}
            moveCount={moves.length}
          />
        )}
      </div>

      <div className="mapStoryFooter">
        <span>{origin} <span aria-hidden="true">→</span> {destination}</span>
        <TileDeepLink to={storyHref} always className="mapTileCta tileMoreLink">
          Explore full journey
        </TileDeepLink>
      </div>
    </div>
  );
}
