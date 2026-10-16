import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import labelOr from "./_ds/labelOr";
import { RevealProvider } from "./_ds/Reveal";
import PersonFeature from "./PersonFeature";
import { peopleLayout } from "./PeopleTile";
import { flatten } from "./textUtils";

/**
 * A single-person deep profile (portrait + full bio with detected scripture),
 * a reserve tile the balancer inserts to fill a short column. It profiles the
 * payload's `profile` pick — someone the People tile does not show — unless a
 * `personIndex` is given. Same anatomy as the People tile's featured block
 * (PersonFeature), which stacks portrait-over-bio in this narrow column.
 */
const pickPerson = (payload, personIndex) => {
  const people = (payload?.people || []).filter((p) => p?.slug);
  if (!people.length) return null;
  const person = personIndex != null ? people[personIndex % people.length] : peopleLayout(people).profile || people[0];
  return person?.slug && flatten(person.description) ? person : null;
};

/**
 * Registry isReady: true only when the tile would actually render (someone with
 * a bio). Otherwise an infinite batch draws the bordered shell around a null
 * component — a blank card (audit B4).
 */
export const hasPersonProfile = (payload) => !!pickPerson(payload);

export default function PersonProfileTile({ payload, personIndex }) {
  const person = pickPerson(payload, personIndex);
  if (!person) return null;
  return (
    <RevealProvider>
      <div className="samplerTileInner personProfileTile">
        <h3 className="tileHeading">
          <Link to="/people">
            {label("people")} · {labelOr("profile", "Profile")}
          </Link>
        </h3>
        <PersonFeature person={person} />
      </div>
    </RevealProvider>
  );
}
