import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { legsOf, stopsOf } from "./mapStoryPath";
import { MapStoryCompleteCard, MapStoryMoveCard } from "./MapStoryCard";
import TileDeepLink from "./_ds/TileDeepLink";
import labelOr from "./_ds/labelOr";
import { supDigits } from "./textUtils";

const MapStoryTileInner = React.lazy(() => import("./MapStoryTileInner"));

// Each move gets a fixed, readable window regardless of story length. Beats with
// something to read (a description or a scripture ref) hold longer. The old
// fixed-total budget made longer stories play *faster* per move — the opposite of
// what a reader needs.
export const TRAVEL_MS = 1400;
export const DWELL_MS = 2000;
export const DWELL_MS_RICH = 3200;

export const playbackTiming = (move) => {
  const hasReading = Boolean(move?.description || move?.ref);
  const dwellMs = hasReading ? DWELL_MS_RICH : DWELL_MS;
  return { travelMs: TRAVEL_MS, dwellMs, stepMs: TRAVEL_MS + dwellMs };
};

export const homeStoryTitle = (title) => {
  const clean = String(title || "").trim();
  // "Recolonization <Name>" source titles are inverted database labels, not
  // readable editorial copy ("Recolonization Limhi"). Keep the correction
  // explicit until Home-specific titles are stored.
  const inverted = clean.match(/^recolonization\s+(.+)$/i);
  if (inverted) return `${supDigits(inverted[1])}’s Recolonization`;
  return supDigits(clean);
};

/** Display name for a traveler: disambiguation digits as superscripts (Alma2 → Alma²). */
export const personName = (person) => supDigits(person?.name || person?.slug || "");

/** "A → B", or "Round trip from A" when the journey ends where it began. */
export const routeText = (origin, destination) =>
  origin && origin === destination
    ? labelOr("mapstory_round_trip", "Round trip from $1", [origin])
    : `${origin} → ${destination}`;

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

  componentDidCatch(error) {
    // Tell the player: autoplay must stop and the transport must hide, or the
    // tile keeps "playing" moves over a static fallback (audit M2).
    console.warn("map story map failed:", error);
    this.props.onFailed?.();
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

const MapFallback = ({ title, origin, destination }) => (
  <div className="mapStoryFallback" role="img" aria-label={`${title}: ${routeText(origin, destination)}`}>
    <div className="mapStoryFallbackRoute" aria-hidden="true">
      <span />
      <i />
      <span />
    </div>
    <div className="mapStoryFallbackPlaces">
      <strong>{origin}</strong>
      {origin !== destination ? <strong>{destination}</strong> : null}
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
  const mapLabel = labelOr("map", "Map");
  const storyHref = `/map/internal/story/${data?.slug}`;
  const reducedInitially = prefersReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(reducedInitially);
  const [complete, setComplete] = useState(reducedInitially);
  const [reducedMotion, setReducedMotion] = useState(reducedInitially);
  const [visible, setVisible] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const rootRef = useRef(null);

  const currentMove = complete
    ? moves[moves.length - 1]
    : moves[Math.min(step, Math.max(0, moves.length - 1))];
  const timing = playbackTiming(currentMove);
  const origin = moves[0] ? (moves[0].startName || moves[0].start) : labelOr("mapstory_origin", "Origin");
  const destination = moves.length
    ? (moves[moves.length - 1].endName || moves[moves.length - 1].end)
    : labelOr("mapstory_destination", "Destination");
  // Autoplay runs only while the tile is on screen, the tab is visible, the map
  // is alive, and the reader hasn't asked for reduced motion (audit J2/M2/A6).
  const playing = visible && !pageHidden && mapMounted && !mapFailed && !paused && !complete && !reducedMotion
    && moves.length >= 2;
  // A failed map shows the static route + whole-journey summary, never a
  // stepping transport over a fallback that cannot show the steps.
  const showComplete = complete || mapFailed;
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
    const syncHidden = () => setPageHidden(Boolean(document.hidden));
    document.addEventListener("visibilitychange", syncHidden);
    return () => document.removeEventListener("visibilitychange", syncHidden);
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

  const moveFrom = currentMove.startName || currentMove.start;
  const moveTo = currentMove.endName || currentMove.end;
  const countsText = labelOr("mapstory_meta", "$1 moves · $2 places", [moves.length, stops.length]);
  const completeLabel = labelOr("mapstory_complete", "Journey complete");
  const movementLabel = showComplete
    ? completeLabel
    : labelOr("mapstory_move_of", "Move $1 of $2", [step + 1, moves.length]);
  const rangeValueText = complete
    ? labelOr("mapstory_valuetext_complete", "Journey complete, $1 moves", [moves.length])
    : labelOr("mapstory_valuetext", "Move $1 of $2: $3 to $4", [step + 1, moves.length, moveFrom, moveTo]);
  const travelerNames = (currentMove.people || [])
    .map(personName)
    .filter(Boolean)
    .join(", ");
  const route = routeText(origin, destination);
  const summary = [
    labelOr("mapstory_summary", "$1. A journey of $2 moves across $3 places: $4.", [title, moves.length, stops.length, route]),
    showComplete
      ? labelOr("mapstory_summary_complete", "The full journey is shown.")
      : labelOr("mapstory_summary_current", "Current move: $1 to $2.", [moveFrom, moveTo]),
    travelerNames ? `${labelOr("mapstory_traveling", "Traveling:")} ${travelerNames}.` : "",
  ].filter(Boolean).join(" ");

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
        <span className="mapStoryCounts">{countsText}</span>
      </div>

      <p id={summaryId} className="mapStoryTextEquivalent">{summary}</p>

      <div className="mapTileFrame">
        <MapStoryErrorBoundary
          key={data?.slug || "story"}
          onFailed={() => setMapFailed(true)}
          fallback={<MapFallback title={title} origin={origin} destination={destination} />}
        >
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

      {mapFailed ? null : (
        <>
          <div className="mapStoryPlaybackStatus">
            <span className={`mapStoryMoveState${complete ? " isComplete" : ""}`}>{movementLabel}</span>
            <span className="mapStoryLegend" aria-hidden="true">
              {complete ? null : <><i className="isActive" /> {labelOr("mapstory_active", "Now")}</>}
              <i className="isVisited" /> {labelOr("mapstory_visited", "Visited")}
              {complete ? null : <><i className="isFuture" /> {labelOr("mapstory_later", "Later")}</>}
            </span>
          </div>

          <div className="mapStoryControls" role="group" aria-label={labelOr("mapstory_controls", "Journey playback controls")}>
            <button
              type="button"
              className="mapStoryControlButton"
              onClick={previous}
              disabled={!complete && step === 0}
              aria-label={labelOr("mapstory_previous", "Previous move")}
            >
              <Icon>‹</Icon>
            </button>
            <button
              type="button"
              className="mapStoryControlButton isPrimary"
              onClick={togglePlayback}
              aria-label={complete
                ? labelOr("mapstory_replay", "Replay journey")
                : paused ? labelOr("mapstory_play", "Play journey") : labelOr("mapstory_pause", "Pause journey")}
              title={reducedMotion
                ? labelOr("mapstory_reduced_motion", "Automatic movement is off because reduced motion is enabled")
                : undefined}
            >
              <Icon>{complete ? "↻" : paused ? "▶" : "Ⅱ"}</Icon>
            </button>
            <label className="mapStoryScrubberLabel">
              <span className="mapStoryTextEquivalent">{labelOr("mapstory_choose_move", "Choose a journey move")}</span>
              <input
                className="mapStoryScrubber"
                type="range"
                min="1"
                max={moves.length}
                step="1"
                value={complete ? moves.length : step + 1}
                onChange={(event) => selectStep(Number(event.target.value) - 1)}
                aria-label={labelOr("mapstory_scrubber", "Journey move")}
                aria-valuetext={rangeValueText}
                style={{ "--map-story-progress": `${complete ? 100 : (step / Math.max(1, moves.length - 1)) * 100}%` }}
              />
            </label>
            <button
              type="button"
              className="mapStoryControlButton"
              onClick={next}
              disabled={complete}
              aria-label={labelOr("mapstory_next", "Next move")}
            >
              <Icon>›</Icon>
            </button>
          </div>
        </>
      )}

      {mapMoved ? (
        <div className="mapStoryInteractionHint">
          {labelOr("mapstory_paused_hint", "Playback paused while you explore the map.")}
        </div>
      ) : null}

      <div className="mapStoryStage">
        {showComplete ? (
          <MapStoryCompleteCard
            heading={route}
            description={data.description}
          />
        ) : (
          <MapStoryMoveCard
            move={{ ...currentMove, detached: legs[step]?.detached }}
            step={step}
          />
        )}
      </div>

      <div className="mapStoryFooter">
        {/* The complete card already names the route; don't say it twice. */}
        <span>{showComplete ? null : route}</span>
        <TileDeepLink to={storyHref} always verb="explore" className="mapTileCta" />
      </div>
    </div>
  );
}
