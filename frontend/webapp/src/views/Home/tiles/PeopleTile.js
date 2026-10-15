import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import RefPill from "./RefPill";
import TileImage from "./_ds/TileImage";
import { verbLabel } from "./_ds/TileCTA";
import PersonFeature, { PersonPortrait, personName } from "./PersonFeature";
import { flatten, clampWords, supDigits } from "./textUtils";

const FACES = 9; // 5-up × 2 rows with the view-all card (3-up × 3 on narrow tiles shows 8)
const MOSAIC = 12; // 3×4 fills the view-all card
const MIN_FEATURE_BIO = 600; // chars: a featured bio that rewards Read more

// A good lead: a named individual (unit I) of the Book of Mormon proper (not a
// Bible-only figure, identification B) with a substantial bio. Groups and
// collectives stay in the face strip, where a short title reads fine.
const isStrongLead = (p) =>
  (!p.unit || p.unit === "I") && p.identification !== "B" && flatten(p.description).length >= MIN_FEATURE_BIO;

/**
 * Split the seeded sample into featured / profile reserve / faces / mosaic so
 * no person appears twice on Home. The PersonProfile reserve tile reads
 * `profile` from the same payload, so it never repeats someone shown here.
 */
export function peopleLayout(people) {
  const list = (people || []).filter((p) => p?.slug);
  if (!list.length) return { featured: null, profile: null, faces: [], mosaic: [] };
  const leads = list.filter(isStrongLead);
  const featured = leads[0] || list[0];
  const profile = leads.find((p) => p !== featured) || list.find((p) => p !== featured && flatten(p.description)) || null;
  const rest = list.filter((p) => p !== featured && p !== profile);
  return { featured, profile, faces: rest.slice(0, FACES), mosaic: rest.slice(FACES, FACES + MOSAIC) };
}

/**
 * Sampling, not a mosaic: one FEATURED person (portrait, epithet, bio with live
 * scripture refs, "Open <name>"), a strip of face cards (portrait, name, title,
 * one index ref each), and a view-all card whose 3×4 mosaic of yet more faces
 * is the "there is much more" signal into /people.
 *
 * Face card = a container, not a link: one stretched name link covers the card
 * (one tab stop), and the RefPill is its sibling <button>, raised above it.
 */
export default function PeopleTile({ data, seed = 0, payload }) {
  const { featured, faces, mosaic } = peopleLayout(data);
  if (!featured) return null;
  const more = payload?.peopleCount ? payload.peopleCount - 1 - faces.length : 0;

  return (
    <div className="samplerTileInner peopleTile">
      <h3 className="tileHeading">
        <Link to="/people">{label("people")}</Link>
      </h3>
      <PersonFeature person={featured} eager />
      <div className="peopleFaceRow">
        {faces.map((p, i) => {
          const idx = (p.index || []).filter((x) => x?.ref);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          const text = item ? clampWords(flatten(item.text), 14) : "";
          return (
            <div key={p.slug} className="peopleFaceCard samplerCard">
              <Link to={`/people/${p.slug}`} className="peopleFaceLink">
                <span className="peopleFaceImgWrap">
                  <PersonPortrait slug={p.slug} name={p.name} className="peopleFaceImg" sizes="(max-width: 480px) 30vw, 128px" />
                  <span className="peopleFaceName">
                    <span className="peopleFaceNameText">{personName(p.name)}</span>
                  </span>
                  {p.title ? (
                    <span className="peopleFaceTitle">
                      <span className="peopleFaceTitleText">{clampWords(supDigits(p.title), 8)}</span>
                    </span>
                  ) : null}
                </span>
              </Link>
              {item ? (
                <div className="peopleFaceBody samplerCardBody">
                  <RefPill refText={item.ref} />
                  {text ? <span className="peopleFaceIndexText">{text}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {/* end cell: a 3×4 mosaic filling the whole card — the "much more" signal into /people */}
        <Link to="/people" className="peopleFaceCard samplerCard viewAllCard">
          <span className="viewAllMosaic viewAllMosaicFull" aria-hidden="true">
            {mosaic.map((p) => (
              <TileImage key={p.slug} path={`people/${p.slug}`} sizes="48px" onError={(e) => (e.target.style.visibility = "hidden")} />
            ))}
          </span>
          <span className="peopleFaceName viewAllOverlay">{more > 0 ? `+${more} ${label("people")}` : verbLabel("viewAll")}</span>
        </Link>
      </div>
    </div>
  );
}
