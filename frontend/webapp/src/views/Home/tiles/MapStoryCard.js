import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { openScripture } from "./ScripturePopup";

// Avatars run 63–233 KB each (group portraits like `nephites` are the heavy
// ones) and a real move carries up to five travelers. Cap what renders and let
// the rest collapse into a count.
const MAX_AVATARS = 4;

const placeLabel = (name, slug) => name || slug;

/**
 * One leg of the journey. Imagery renders only when `near` — the tile keeps a
 * window around the active step so a story doesn't pull every place image
 * (358–399 KB apiece) and every avatar on mount.
 */
export function MapStoryMoveCard({ move, near }) {
  const people = (move.people || []).filter((p) => p?.slug);
  const shown = people.slice(0, MAX_AVATARS);
  const overflow = people.length - shown.length;
  return (
    <div className="mapStoryCard">
      <div className="mapStoryCardArt">
        {near && move.end ? (
          <img
            src={`${assetUrl}/places/${move.end}`}
            alt={placeLabel(move.endName, move.end)}
            loading="lazy"
            onError={(e) => (e.target.style.display = "none")}
          />
        ) : null}
      </div>
      <div className="mapStoryCardBody">
        <div className="mapStoryLeg">
          {placeLabel(move.startName, move.start)}
          <span className="mapStoryArrow" aria-hidden="true"> → </span>
          {placeLabel(move.endName, move.end)}
        </div>
        {move.detached ? (
          <span className="mapStoryDetached" title="This move does not continue from the previous one">
            not continuous
          </span>
        ) : null}
        {move.ref ? (
          <button type="button" className="mapStoryRef" onClick={() => openScripture(move.ref)}>
            {move.ref}
          </button>
        ) : null}
        {move.duration ? <span className="mapStoryDuration">{move.duration}</span> : null}
        {move.description ? <div className="mapStoryDesc">{move.description}</div> : null}
        {shown.length ? (
          <ul className="mapStoryPeople">
            {shown.map((p) => (
              <li key={p.slug} className="mapStoryPerson">
                {near ? (
                  <img
                    src={`${assetUrl}/people/${p.slug}`}
                    alt={p.name || p.slug}
                    loading="lazy"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                ) : null}
                <span className="mapStoryPersonName">{p.name || p.slug}</span>
              </li>
            ))}
            {overflow > 0 ? <li className="mapStoryPersonMore">+{overflow}</li> : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Closes the loop: story identity, then playback restarts. */
export function MapStoryTitleCard({ title, description, stopCount, moveCount }) {
  return (
    <div className="mapStoryCard mapStoryCardTitle">
      <div className="mapStoryCardBody">
        <div className="mapStoryTitleCardHeading">{title}</div>
        {description ? <div className="mapStoryDesc">{description}</div> : null}
        <div className="mapStoryTitleCardMeta">
          {moveCount} moves · {stopCount} places
        </div>
      </div>
    </div>
  );
}
