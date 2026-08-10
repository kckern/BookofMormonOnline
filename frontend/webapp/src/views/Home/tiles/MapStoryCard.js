import React from "react";
import { openScripture } from "./ScripturePopup";
import { label, tr } from "src/models/Utils";
import { assetUrl } from "src/models/BoMOnlineAPI";

const placeLabel = (name, slug) => name || slug;

const PlaceThumb = ({ slug, name }) =>
  slug ? (
    <img
      className="mapStoryPlaceThumb"
      src={`${assetUrl}/places/${slug}`}
      alt=""
      loading="lazy"
      onError={(event) => { event.currentTarget.style.display = "none"; }}
      title={name}
    />
  ) : null;

const travelerText = (move) => {
  const people = (move?.people || []).filter((person) => person?.slug);
  if (!people.length) return move?.travelers || null;
  const names = people.slice(0, 3).map((person) => person.name || person.slug);
  const overflow = people.length - names.length;
  return `${names.join(", ")}${overflow > 0 ? ` +${overflow}` : ""}`;
};

/** Compact current-beat caption; the people themselves now move on the map. */
export function MapStoryMoveCard({ move, step }) {
  const travelers = travelerText(move);
  return (
    <section className="mapStoryBeat">
      <div className="mapStoryBeatIndex" aria-hidden="true">{step + 1}</div>
      <div className="mapStoryBeatBody">
        <div className="mapStoryLeg">
          <span className="mapStoryLegPlace">
            <PlaceThumb slug={move.start} name={placeLabel(move.startName, move.start)} />
            <span className="mapStoryLegPlaceName">{placeLabel(move.startName, move.start)}</span>
          </span>
          <span className="mapStoryArrow" aria-hidden="true">→</span>
          <span className="mapStoryLegPlace">
            <PlaceThumb slug={move.end} name={placeLabel(move.endName, move.end)} />
            <span className="mapStoryLegPlaceName">{placeLabel(move.endName, move.end)}</span>
          </span>
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
            <strong>{tr("mapstory_traveling", "Traveling:")}</strong> {travelers}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function MapStoryCompleteCard({ title, description, stopCount, moveCount }) {
  return (
    <section className="mapStoryBeat mapStoryComplete">
      <div className="mapStoryCompleteMark" aria-hidden="true">✓</div>
      <div className="mapStoryBeatBody">
        <div className="mapStoryCompleteHeading">{tr("mapstory_complete", "Journey complete")}</div>
        {description ? <p className="mapStoryDesc">{description}</p> : null}
        <div className="mapStoryCompleteMeta">
          {title} · {label("mapstory_meta", [moveCount, stopCount])}
        </div>
      </div>
    </section>
  );
}
