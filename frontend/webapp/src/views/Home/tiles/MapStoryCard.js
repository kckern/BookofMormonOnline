import React from "react";
import { openScripture } from "./ScripturePopup";
import { label } from "src/models/Utils";

const placeLabel = (name, slug) => name || slug;

const travelerText = (move) => {
  const people = (move?.people || []).filter((person) => person?.slug);
  if (!people.length) return move?.travelers || null;
  const names = people.slice(0, 3).map((person) => person.name || person.slug);
  const overflow = people.length - names.length;
  return `${names.join(", ")}${overflow > 0 ? ` +${overflow}` : ""}`;
};

/** Compact current-beat caption; the people themselves now move on the map. */
export function MapStoryMoveCard({ move, step, moveCount }) {
  const travelers = travelerText(move);
  return (
    <section
      className="mapStoryBeat"
      aria-label={`Move ${step + 1} of ${moveCount}: ${placeLabel(move.startName, move.start)} to ${placeLabel(move.endName, move.end)}`}
    >
      <div className="mapStoryBeatIndex" aria-hidden="true">{step + 1}</div>
      <div className="mapStoryBeatBody">
        <div className="mapStoryLeg">
          <span>{placeLabel(move.startName, move.start)}</span>
          <span className="mapStoryArrow" aria-hidden="true">→</span>
          <span>{placeLabel(move.endName, move.end)}</span>
        </div>
        <div className="mapStoryBeatMeta">
          {move.ref ? (
            <button type="button" className="mapStoryRef" onClick={() => openScripture(move.ref)}>
              {move.ref}
            </button>
          ) : null}
          {move.duration ? <span className="mapStoryDuration">{move.duration}</span> : null}
          {move.detached ? (
            <span className="mapStoryDetached" title={label("mapstory_detached_title")}>
              {label("mapstory_detached")}
            </span>
          ) : null}
        </div>
        {move.description ? <p className="mapStoryDesc">{move.description}</p> : null}
        {travelers ? (
          <p className="mapStoryTravelerText">
            <span aria-hidden="true">●</span>
            <strong>Traveling:</strong> {travelers}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function MapStoryCompleteCard({ title, description, stopCount, moveCount }) {
  return (
    <section className="mapStoryBeat mapStoryComplete" aria-label="Journey complete">
      <div className="mapStoryCompleteMark" aria-hidden="true">✓</div>
      <div className="mapStoryBeatBody">
        <div className="mapStoryCompleteHeading">Journey complete</div>
        {description ? <p className="mapStoryDesc">{description}</p> : null}
        <div className="mapStoryCompleteMeta">
          {title} · {label("mapstory_meta", [moveCount, stopCount])}
        </div>
      </div>
    </section>
  );
}
