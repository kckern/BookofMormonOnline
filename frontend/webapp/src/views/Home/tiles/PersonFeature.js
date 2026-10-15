import React, { useState } from "react";
import { Link } from "react-router-dom";
import { processName } from "src/models/Utils";
import TileImage from "./_ds/TileImage";
import TileDeepLink from "./_ds/TileDeepLink";
import refProse from "./_ds/refProse";
import ExpandableText from "./ExpandableText";
import { flatten, supDigits } from "./textUtils";

/**
 * Display name for a person row: DB names are stored inverted ("Gideon, Chief
 * Judge of") and carry disambiguation digits ("Mosiah2", "Nephi₂") — render
 * "Chief Judge of Gideon", "Mosiah²", "Nephi²".
 */
export const personName = (name) => supDigits(processName(name || "")).trim();

/**
 * A person's portrait as a TileImage, falling back to a monogram tile in the
 * same box when the image (and its variants) fail — never a blank hole.
 * Decorative by default (alt=""): the name always sits beside it.
 */
export function PersonPortrait({ slug, name, className = "", eager = false, sizes }) {
  const [failed, setFailed] = useState(false);
  if (failed || !slug) {
    return (
      <span className={`personMonogram ${className}`.trim()} aria-hidden="true">
        {(personName(name).match(/[A-Za-z]/) || [""])[0].toUpperCase()}
      </span>
    );
  }
  return (
    <TileImage
      path={`people/${slug}`}
      className={className}
      eager={eager}
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The featured-person anatomy shared by the People tile and the PersonProfile
 * reserve: portrait, name + epithet, a reversible bio clamp whose detected refs
 * are RefPill buttons, and ONE tab stop into the person page ("Open <name>").
 * The portrait and name stay clickable for pointer users but sit out of the
 * Tab order, so the destination has exactly one keyboard stop.
 *
 * Layout is a grid (Sampler.css .peopleFeature): portrait beside the text on
 * wide tiles; in a narrow container the portrait shrinks to a header avatar and
 * the bio runs full width (no dead gutter under the portrait).
 */
export default function PersonFeature({ person, eager = false, lines = 7 }) {
  const href = `/people/${person.slug}`;
  const name = personName(person.name);
  const bio = flatten(person.description);
  return (
    <div className="peopleFeature">
      <Link to={href} className="peopleFeatureImgLink" tabIndex={-1} aria-hidden="true">
        <PersonPortrait slug={person.slug} name={person.name} className="peopleFeatureImg" eager={eager} sizes="128px" />
      </Link>
      <div className="peopleFeatureHead">
        <Link to={href} className="peopleFeatureNameLink" tabIndex={-1}>
          <span className="peopleFeatureName">{name}</span>
        </Link>
        {person.title ? <span className="peopleFeatureTitle">{supDigits(person.title)}</span> : null}
      </div>
      {bio ? (
        <ExpandableText className="peopleFeatureDesc" lines={lines}>
          {refProse(bio)}
        </ExpandableText>
      ) : null}
      <TileDeepLink always verb="open" name={name} to={href} className="peopleFeatureOpen" />
    </div>
  );
}
