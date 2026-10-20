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
 * The box a crop will occupy: its intrinsic width, capped by the column and by
 * the max-height at its aspect. The aspect comes from the size learned earlier
 * this session or, cold, from the payload's cropAspect (the render's own box
 * geometry), so a tile reserves its final rows before the crops arrive and a
 * remount on Back neither shrinks nor grows (blind audit R5 faxVerse-B1).
 * Neither known → hold the row at a typical crop height.
 */
const cropBox = (path, aspect) => {
  const s = knownSize(path);
  const r = s ? s.w / s.h : aspect > 0 ? aspect : null;
  if (!r) return { height: CROP_TYPICAL_H };
  const a = +r.toFixed(4);
  // via a custom property: the stylesheet's width is var(--crop-w, auto)
  return { aspectRatio: String(a), "--crop-w": `min(100%, ${s ? s.w : CROP_WIDTH}px, calc(${CROP_MAX_H} * ${a}))` };
};

// Crops that failed this session (render 502/404), by URL: a tile remounted on
// Back leaves those rows out from the first paint instead of showing them and
// dropping them again in view (blind audit R5 faxVerse-B1).
const failedCrops = new Set();
/** Test-only: forget this session's failed crops. */
export const __resetFailedCrops = () => failedCrops.clear();

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
  // bumped when a crop fails (render 502 etc.): its row drops out and the
  // eyebrow counts only what rendered (blind audit faxVerse-B4)
  const [, setFailed] = React.useState(0);
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
  const viewerPath = (ed) => (slug ? `/fax/${ed.version}/${slug}` : `/fax/${ed.version}/${ed.imageFile ?? ed.page}`);
  const cropUrl = (ed, w) => `${renderBaseUrl}/fax/render/${ed.version}/crop/w${w}/${selector}.jpg`;
  const shown = editions.filter((ed) => !failedCrops.has(cropUrl(ed, CROP_WIDTH)));

  const hideRow = (ed) => () => {
    failedCrops.add(cropUrl(ed, CROP_WIDTH));
    setFailed((n) => n + 1);
  };

  return (
    <div className="samplerTileInner faxVerseTile">
      {/* its own name: the Fax tile shares the 'Facsimiles' family (blind audit faxVerse-H2) */}
      <h3 className="tileHeading">
        <Link to="/fax">
          {label("facsimiles")} · {shown.length > 1
            ? labelOr("one_verse_editions", "One verse, $1 editions", [shown.length])
            : labelOr("one_verse", "One verse")}
        </Link>
      </h3>

      {/* Verse text on top */}
      {data.ref ? (
        <div className="read-content scriptureExcerptCompact faxVerseExcerpt">
          <ScriptureExcerpt refText={data.ref} hideStudy refAsPopup />
        </div>
      ) : null}

      {/* Facsimiles on bottom */}
      <div className="faxVerseEditions">
        {shown.map((ed) => {
          const name = shortEdition(ed.title) || ed.version;
          const folio = ed.imageFile ?? ed.page;
          // the scan number — what the viewer labels "Page N" (fax-D4)
          const folioText = folio != null ? labelOr("page_n", "p. $1", [folio]) : null;
          return (
            <Link
              key={ed.version}
              to={viewerPath(ed)}
              className="faxEditionRow"
              title={ed.title || undefined}
              // the rail's two spans are flex siblings with no text between
              // them: name the row explicitly (blind R7 faxVerse-G3)
              aria-label={folioText ? `${name}, ${folioText}` : name}
            >
              <span className="faxEditionRail">
                <span className="faxEditionRailTitle">{name}</span>
                {folioText ? <span className="faxEditionRailPage">{folioText}</span> : null}
              </span>
              <span className="faxEditionCropWrap">
                <TileImage
                  className="faxEditionCrop"
                  uncapped /* bounded by CROP_MAX_H (cropBox) */
                  path={cropUrl(ed, CROP_WIDTH)}
                  srcSet={`${cropUrl(ed, CROP_WIDTH)} 1x, ${cropUrl(ed, CROP_WIDTH * 2)} 2x`}
                  remember
                  style={cropBox(cropUrl(ed, CROP_WIDTH), ed.cropAspect)}
                  onLoad={() => setLoaded((n) => n + 1)}
                  alt={data.ref || ""}
                  onError={hideRow(ed)}
                />
              </span>
            </Link>
          );
        })}
      </div>
      <TileDeepLink to={readPath(data.ref) || viewerPath(shown[0] || editions[0])} always verb="seeInContext" />
    </div>
  );
}
