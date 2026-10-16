import React from "react";
import RefPill from "./RefPill";
import TileImage from "./_ds/TileImage";
import ExpandableText from "./ExpandableText";
import labelOr from "./_ds/labelOr";
import { supDigits } from "./textUtils";

const placeLabel = (name, slug) => name || slug || "";

const hide = (event) => { event.currentTarget.style.display = "none"; };

// 24px thumbnails: the 256w variant is plenty even at 3x DPR.
const PlaceThumb = ({ slug }) =>
  slug ? (
    <TileImage
      className="mapStoryPlaceThumb"
      path={`places/${slug}`}
      widths={[256]}
      sizes="24px"
      width={24}
      height={24}
      alt=""
      onError={hide}
    />
  ) : null;

const travelerText = (move) => {
  const people = (move?.people || []).filter((person) => person?.slug);
  if (!people.length) return move?.travelers ? supDigits(move.travelers) : null;
  const names = people.slice(0, 3).map((person) => supDigits(person.name || person.slug));
  const overflow = people.length - names.length;
  return `${names.join(", ")}${overflow > 0 ? ` +${overflow}` : ""}`;
};

/** Compact current-beat caption; the people themselves now move on the map. */
export function MapStoryMoveCard({ move, step }) {
  const travelers = travelerText(move);
  const from = placeLabel(move.startName, move.start);
  const to = placeLabel(move.endName, move.end);
  return (
    <section className="mapStoryBeat">
      <div className="mapStoryBeatIndex" aria-hidden="true">{step + 1}</div>
      <div className="mapStoryBeatBody">
        <div className="mapStoryLeg">
          <span className="mapStoryLegPlace">
            <PlaceThumb slug={move.start} />
            <span className="mapStoryLegPlaceName" title={from}>{from}</span>
          </span>
          <span className="mapStoryArrow" aria-hidden="true">→</span>
          <span className="mapStoryLegPlace">
            <PlaceThumb slug={move.end} />
            <span className="mapStoryLegPlaceName" title={to}>{to}</span>
          </span>
        </div>
        <div className="mapStoryBeatMeta">
          <RefPill refText={move.ref} className="mapStoryRef" />
          {move.duration ? <span className="mapStoryDuration">{move.duration}</span> : null}
          {move.detached ? (
            <span
              className="mapStoryDetached"
              title={labelOr("mapstory_detached_title", "This movement begins a new geographic run")}
            >
              {labelOr("mapstory_detached", "story resumes elsewhere")}
            </span>
          ) : null}
        </div>
        {/* Word-safe fade clamp + in-place Read more (audit C4/H3: the CSS
            ellipsis cut "ministerin…" with no way to read on in Layer 1). */}
        {move.description ? (
          <ExpandableText className="mapStoryDesc" lines={3} fade>{move.description}</ExpandableText>
        ) : null}
        {travelers ? (
          <p className="mapStoryTravelerText">
            <span aria-hidden="true">●</span>
            <strong>{labelOr("mapstory_traveling", "Traveling:")}</strong> {travelers}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Whole-journey summary: the route as its heading, then the story's description. */
export function MapStoryCompleteCard({ heading, description }) {
  return (
    <section className="mapStoryBeat mapStoryComplete">
      <div className="mapStoryCompleteMark" aria-hidden="true">✓</div>
      <div className="mapStoryBeatBody">
        <div className="mapStoryCompleteHeading">{heading}</div>
        {description ? (
          <ExpandableText className="mapStoryDesc" lines={5} fade>{description}</ExpandableText>
        ) : null}
      </div>
    </section>
  );
}
