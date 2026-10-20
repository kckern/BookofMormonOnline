import React from "react";
import { Link } from "react-router-dom";
import { label, processName } from "src/models/Utils";
import RefPill from "./RefPill";
import TileImage from "./_ds/TileImage";
import { verbLabel } from "./_ds/TileCTA";
import labelOr from "./_ds/labelOr";
import PersonFeature, { PersonPortrait, personName } from "./PersonFeature";
import { flatten, clampWords, supDigits, tidy } from "./textUtils";

const FACES = 9; // 5-up × 2 rows with the view-all card (3-up × 3 on narrow tiles shows 8)
const MOSAIC = 12; // 3×4 fills the view-all card
// chars: a featured bio that always overflows its 7-line clamp, so the lead
// earns its Read more. At 600 the slot drew walk-ons whose whole bio is "the
// record gives no account of his deeds" (blind R7 people-H1); every sample of
// 24 measured 2026-10-20 holds 8-16 individuals past 900 chars.
const MIN_FEATURE_BIO = 1000;

// A good lead: a named individual (unit I) of the Book of Mormon proper (not a
// Bible-only figure, identification B) with a substantial bio. Groups and
// collectives stay in the face strip, where a short title reads fine.
// A face card's hook line: index entries shorter than this are concordance
// stubs ("Is pacified", "Falls by sword") that read like a random index.
const MIN_HOOK_WORDS = 5;
const wordCount = (s) => (s ? s.split(" ").filter(Boolean).length : 0);
const indexItems = (p) => (p?.index || []).filter((x) => x?.ref);
const hooks = (p) => indexItems(p).filter((x) => wordCount(flatten(x.text)) >= MIN_HOOK_WORDS);

/**
 * The face card's one index ref + line, seeded. Prefers an entry whose text is
 * a real phrase; with only stubs it keeps the ref and drops the stub text.
 */
export function faceHook(p, seed = 0, i = 0) {
  const good = hooks(p);
  const pool = good.length ? good : indexItems(p);
  if (!pool.length) return null;
  const item = pool[(seed + i) % pool.length];
  return { ref: item.ref, text: good.length ? tidy(clampWords(flatten(item.text), 14)) : "" };
}

// A face card's title band is two lines of 0.7rem in a ~118px column: about
// 38 characters. Budget words to fit it, so the phrase-safe JS cut decides the
// end instead of the CSS line clamp ("…father of…", audit H3).
const FACE_TITLE_CHARS = 38;
export function faceTitle(title) {
  const t = tidy(supDigits(title || ""));
  if (t.length <= FACE_TITLE_CHARS) return t;
  // epithet lists ("prophet, king in Zarahemla, father of …"): keep whole
  // comma clauses when the first one fits
  const clauses = t.split(/,\s+/);
  let kept = "";
  for (const c of clauses) {
    const next = kept ? `${kept}, ${c}` : c;
    if (next.length + 1 > FACE_TITLE_CHARS) break;
    kept = next;
  }
  if (kept && kept.split(" ").length >= 2) return `${kept}…`;
  for (let n = 8; n >= 2; n--) {
    const cut = clampWords(t, n, { phrase: true });
    if (cut.length <= FACE_TITLE_CHARS) return cut;
  }
  return clampWords(t, 2, { phrase: true });
}

// unit must be exactly "I": a missing/blank unit let a concept ("Holy Order of
// God") take the portrait slot (blind R7 people-H1).
const isIndividual = (p) => p.unit === "I" && p.identification !== "B";
const bioLength = (p) => flatten(p.description).length;
const isStrongLead = (p) => isIndividual(p) && bioLength(p) >= MIN_FEATURE_BIO;
// no strong lead in the sample: the named individual with the richest bio, so
// the hero is still a person with the most to say (stable on ties)
const richestIndividual = (list) =>
  list.filter(isIndividual).reduce((best, p) => (!best || bioLength(p) > bioLength(best) ? p : best), null);

/**
 * Split the seeded sample into featured / profile reserve / faces / mosaic so
 * no person appears twice on Home. The PersonProfile reserve tile reads
 * `profile` from the same payload, so it never repeats someone shown here.
 */
// Alias entries: the database keeps some figures twice under two names
// ("Ishmael's Daughter" and "Wife of Nephi", titled "Daughter of Ishmael").
// A person's NAME read as a role ("X's Y" / "Y of X" → "y of x") is matched
// against the other's name and title clauses; title-to-title matches are
// ignored, so people who merely share an epithet ("King of the Lamanites")
// stay apart (audit H4).
const roleKey = (s) => {
  const t = String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  const poss = t.match(/^([a-z0-9]+)'s? ([a-z ]+)$/);
  if (poss) return `${poss[2]} of ${poss[1]}`;
  const of = t.match(/^([a-z ]+?) of (?:the )?([a-z0-9]+)$/);
  return of ? `${of[1]} of ${of[2]}` : null;
};
const clauses = (s) => String(s || "").split(/\s*[,;—–]\s*|\s+-\s+/).filter(Boolean);
const nameRole = (p) => roleKey(processName(p.name));
const roles = (p) => [nameRole(p), ...clauses(p.title).map(roleKey)].filter(Boolean);
const sameFigure = (a, b) => {
  const ra = nameRole(a);
  const rb = nameRole(b);
  return (ra && roles(b).includes(ra)) || (rb && roles(a).includes(rb));
};
const dedupeAliases = (list) => list.reduce((kept, p) => (kept.some((k) => sameFigure(k, p)) ? kept : [...kept, p]), []);

export function peopleLayout(people) {
  const list = dedupeAliases((people || []).filter((p) => p?.slug));
  if (!list.length) return { featured: null, profile: null, faces: [], mosaic: [] };
  const leads = list.filter(isStrongLead);
  const featured = leads[0] || richestIndividual(list) || list[0];
  const profile =
    leads.find((p) => p !== featured) ||
    richestIndividual(list.filter((p) => p !== featured && bioLength(p))) ||
    list.find((p) => p !== featured && bioLength(p)) ||
    null;
  // Faces lead with people whose hook line is a real phrase; stub-only people
  // still appear, in the view-all mosaic (stable order otherwise).
  const others = list.filter((p) => p !== featured && p !== profile);
  const rest = [...others.filter((p) => hooks(p).length), ...others.filter((p) => !hooks(p).length)];
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
          const item = faceHook(p, seed, i);
          const text = item?.text || "";
          return (
            <div key={p.slug} className="peopleFaceCard samplerCard">
              <Link to={`/people/${p.slug}`} className="peopleFaceLink">
                <span className="peopleFaceImgWrap">
                  <PersonPortrait slug={p.slug} name={p.name} className="peopleFaceImg" sizes="(max-width: 480px) 34vw, 180px" />
                  <span className="peopleFaceName">
                    <span className="peopleFaceNameText">{personName(p.name)}</span>
                  </span>
                  {p.title ? (
                    <span className="peopleFaceTitle">
                      <span className="peopleFaceTitleText">{faceTitle(p.title)}</span>
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
          {/* the card-grid family's one end-card label, as Places/Matters:
              "View all" over "+N more" — two short lines that fit the ~99px
              phone card (blind R7 people-A1/H2) */}
          <span className="peopleFaceName viewAllOverlay mattersViewAllLabel">
            <span className="mattersViewAllVerb viewAllVerb">{verbLabel("viewAll")}</span>
            {more > 0 ? (
              <span className="mattersViewAllCount viewAllCount">{labelOr("plus_n_more", "+$1 more", [String(more)])}</span>
            ) : null}
          </span>
        </Link>
      </div>
    </div>
  );
}
