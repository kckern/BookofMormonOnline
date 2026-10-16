import React from "react";
import { Link } from "react-router-dom";
import { renderBaseUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";
import labelOr from "./_ds/labelOr";
import TileImage, { knownSize } from "./_ds/TileImage";
import TileDeepLink from "./_ds/TileDeepLink";
import { shortEdition } from "./faxLabels";

const CROP_WIDTH = 800;
// Matches the .faxEditionCrop max-height in Sampler.css.
const CROP_MAX_H = "6.5rem";
const CROP_TYPICAL_H = "3rem";

/**
 * The box a crop will occupy, from its natural size learned earlier this
 * session: its intrinsic width, capped by the column and by the max-height at
 * its aspect. Lets a tile remounted on Back reserve its final height before
 * the crops arrive (blind audit faxVerse-B1 / XC2). Unknown → no reservation.
 */
const cropBox = (path) => {
  const s = knownSize(path);
  // unknown yet: hold the row at a typical crop height (a 3-4 line verse at
  // column width, ~3rem) so a cold load moves little; the load re-renders
  if (!s) return { height: CROP_TYPICAL_H };
  const r = s.w / s.h;
  // via a custom property: the stylesheet's width is var(--crop-w, auto)
  return { aspectRatio: String(+r.toFixed(4)), "--crop-w": `min(100%, ${s.w}px, calc(${CROP_MAX_H} * ${+r.toFixed(4)}))` };
};

// The app's existing fax-viewer ref-slug convention, e.g. "Mosiah 2:17" -> "mosiah.2.17".
const refSlug = (ref) => (ref || "").replace(/[ :]+/g, ".").toLowerCase();

/**
 * A sampled verse: the verse text on top (its ref pill opens the scripture
 * popup), then cropped-verse facsimile images from up to 4 editions stacked
 * below. Each row is ONE link into that edition's viewer at the verse, named
 * by a compact edition label (the verse is already named once, above). The
 * CTA goes to the verse in Read ("See in context").
 *
 * Crops are offered at 1x (w800) and 2x (w1600) and render at their intrinsic
 * size (capped to the column) rather than being stretched to full width, so a
 * narrow fragment is not upscaled into mush.
 */
export default function FaxVerseTile({ data }) {
  // bumped as crops load, so cropBox swaps the placeholder for the real box
  const [, setLoaded] = React.useState(0);
  if (!data || !data.selector) return null;

  // Prefer the editions list; fall back to a single row from legacy fields.
  const editions = (
    data.editions && data.editions.length
      ? data.editions
      : data.version
      ? [{ version: data.version, title: data.title, page: data.page }]
      : []
  ).filter((ed) => ed?.version);
  if (!editions.length) return null;

  const selector = data.selector;
  const slug = refSlug(data.ref);
  const viewerPath = (ed) => (slug ? `/fax/${ed.version}/${slug}` : `/fax/${ed.version}/${ed.page}`);
  const cropUrl = (ed, w) => `${renderBaseUrl}/fax/render/${ed.version}/crop/w${w}/${selector}.jpg`;

  const hideRow = (e) => {
    const row = e.target.closest(".faxEditionRow");
    if (row) row.style.display = "none";
  };

  return (
    <div className="samplerTileInner faxVerseTile">
      {/* its own name: the Fax tile shares the 'Facsimiles' family (blind audit faxVerse-H2) */}
      <h3 className="tileHeading">
        <Link to="/fax">
          {label("facsimiles")} · {editions.length > 1
            ? labelOr("one_verse_editions", "One verse, $1 editions", [editions.length])
            : labelOr("one_verse", "One verse")}
        </Link>
      </h3>

      {/* Verse text on top */}
      {data.ref ? (
        <div className="read-content scriptureExcerptCompact">
          <ScriptureExcerpt refText={data.ref} hideStudy refAsPopup />
        </div>
      ) : null}

      {/* Facsimiles on bottom */}
      <div className="faxVerseEditions">
        {editions.map((ed) => {
          const name = shortEdition(ed.title) || ed.version;
          return (
            <Link key={ed.version} to={viewerPath(ed)} className="faxEditionRow" title={ed.title || undefined}>
              <span className="faxEditionRail">
                <span className="faxEditionRailTitle">{name}</span>
                {ed.page != null ? (
                  <span className="faxEditionRailPage">{labelOr("page_n", "p. $1", [ed.page])}</span>
                ) : null}
              </span>
              <span className="faxEditionCropWrap">
                <TileImage
                  className="faxEditionCrop"
                  path={cropUrl(ed, CROP_WIDTH)}
                  srcSet={`${cropUrl(ed, CROP_WIDTH)} 1x, ${cropUrl(ed, CROP_WIDTH * 2)} 2x`}
                  remember
                  style={cropBox(cropUrl(ed, CROP_WIDTH))}
                  onLoad={() => setLoaded((n) => n + 1)}
                  alt={data.ref || ""}
                  onError={hideRow}
                />
              </span>
            </Link>
          );
        })}
      </div>
      <TileDeepLink to={readPath(data.ref) || viewerPath(editions[0])} always verb="seeInContext" />
    </div>
  );
}
