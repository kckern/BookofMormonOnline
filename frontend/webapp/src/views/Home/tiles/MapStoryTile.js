import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { legsOf, stopsOf } from "./mapStoryPath";
import { MapStoryMoveCard, MapStoryTitleCard } from "./MapStoryCard";

// Code-split: OpenLayers loads only when this tile actually renders — same
// pattern as MapTile/MapTileInner.
const MapStoryTileInner = React.lazy(() => import("./MapStoryTileInner"));

const DRAW_MS = 1500;
const DWELL_MS = 4000;
const TITLE_MS = 3500;
// Render imagery for the active card and one either side; everything else holds
// a placeholder. Place images are 358–399 KB and avatars up to 233 KB, so an
// eight-move story would otherwise pull several MB the moment it scrolls in.
const IMAGE_WINDOW = 1;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A scripture journey played as a timed sequence: one shared playhead drives
 * both the map (leg N grows toward its destination) and a card carousel
 * (card N slides in), ending on a title card before looping.
 *
 * Playback only runs while the tile is on screen — an IntersectionObserver
 * gates it so a feed full of these costs nothing below the fold.
 *
 * The pause control is not optional decoration. WCAG 2.2.2 covers any
 * auto-updating content that starts on its own, runs past five seconds, and
 * sits alongside other content; this loop qualifies whatever the user's motion
 * preference says.
 */
export default function MapStoryTile({ data }) {
  // Memoised: MapStoryTileInner rebuilds the whole OL map when `moves` changes
  // identity, and this component now re-renders on every playhead tick.
  const moves = useMemo(
    () => (data?.moves || []).filter((m) => m?.start && m?.end),
    [data]
  );
  const legs = useMemo(() => legsOf(moves), [moves]);
  const stopCount = useMemo(() => stopsOf(moves).length, [moves]);

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [animate, setAnimate] = useState(true);
  const rootRef = useRef(null);

  useEffect(() => setAnimate(!prefersReducedMotion()), []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver !== "function") {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const total = moves.length + 1; // moves, then the title card
  const playing = visible && !paused && moves.length >= 2;

  useEffect(() => {
    if (!playing) return undefined;
    const onTitleCard = step >= moves.length;
    const hold = onTitleCard ? TITLE_MS : (animate ? DRAW_MS : 0) + DWELL_MS;
    const t = setTimeout(() => setStep((s) => (s + 1) % total), hold);
    return () => clearTimeout(t);
  }, [playing, step, total, moves.length, animate]);

  if (moves.length < 2) return null;

  const onTitleCard = step >= moves.length;
  const pickStep = (i) => {
    setPaused(true);
    setStep(i);
  };

  return (
    <div className="samplerTileInner mapStoryTile" ref={rootRef}>
      <h3 className="tileHeading">
        <Link to="/map">{label("map")}</Link>
      </h3>
      {data.title ? <div className="mapStoryTitle">{data.title}</div> : null}
      <div className="mapTileFrame">
        <Suspense fallback={<div className="mapTileLoading">…</div>}>
          <MapStoryTileInner moves={moves} step={step} animate={animate} />
        </Suspense>
        <button
          type="button"
          className="mapStoryPlayToggle"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? label("mapstory_play") : label("mapstory_pause")}
        >
          {paused ? "▶" : "❚❚"}
        </button>
      </div>

      {/* Slides all occupy one grid cell; `isActive` fades the current one in.
          Inactive slides stay mounted (so transitions run) but are hidden from
          assistive tech, which would otherwise read every card at once. */}
      <div className="mapStoryStage" aria-live="polite">
        <div className={`mapStoryTrack${animate ? "" : " mapStoryTrackStatic"}`}>
          {moves.map((m, i) => (
            <div
              className={`mapStorySlide${i === step ? " isActive" : ""}`}
              key={m.seq ?? i}
              aria-hidden={i !== step}
            >
              <MapStoryMoveCard
                move={{ ...m, detached: legs[i]?.detached }}
                near={Math.abs(i - step) <= IMAGE_WINDOW}
              />
            </div>
          ))}
          <div
            className={`mapStorySlide${onTitleCard ? " isActive" : ""}`}
            key="__title"
            aria-hidden={!onTitleCard}
          >
            <MapStoryTitleCard
              title={data.title}
              description={data.description}
              stopCount={stopCount}
              moveCount={moves.length}
            />
          </div>
        </div>
      </div>

      <ol className="mapStoryDots">
        {Array.from({ length: total }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              className={`mapStoryDot${i === step ? " isActive" : ""}`}
              onClick={() => pickStep(i)}
              aria-label={i === moves.length ? label("mapstory_summary") : label("mapstory_move", [i + 1])}
              aria-current={i === step ? "step" : undefined}
            />
          </li>
        ))}
      </ol>

      <Link to="/map" className="mapTileCta tileMoreLink">{label("view_more")}</Link>
    </div>
  );
}
