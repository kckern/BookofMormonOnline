import React from "react";
import { Link } from "react-router-dom";
import { renderBaseUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";
import labelOr from "./_ds/labelOr";
import TileImage from "./_ds/TileImage";
import TileDeepLink from "./_ds/TileDeepLink";
import { shortEdition } from "./faxLabels";

const CROP_WIDTH = 800;

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
      <h3 className="tileHeading">
        <Link to="/fax">{label("facsimiles")}</Link>
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
