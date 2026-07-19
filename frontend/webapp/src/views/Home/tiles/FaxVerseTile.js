import React from "react";
import { Link } from "react-router-dom";
import { renderBaseUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ScriptureExcerpt from "src/views/_Common/ScriptureExcerpt";

const CROP_WIDTH = 800;

// The app's existing fax-viewer ref-slug convention, e.g. "Mosiah 2:17" -> "mosiah.2.17".
const refSlug = (ref) => (ref || "").replace(/[ :]+/g, ".").toLowerCase();

/**
 * A sampled verse: the verse text on top, then cropped-verse facsimile images
 * from up to 4 editions stacked below, each edition-labeled and deep-linking to
 * that edition's fax viewer at the verse.
 */
export default function FaxVerseTile({ data }) {
  if (!data || !data.selector) return null;

  // Prefer the editions list; fall back to a single row from legacy fields.
  const editions =
    data.editions && data.editions.length
      ? data.editions
      : data.version
      ? [{ version: data.version, title: data.title, page: data.page }]
      : [];
  if (!editions.length) return null;

  const selector = data.selector || null;
  const slug = refSlug(data.ref);

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
          <ScriptureExcerpt refText={data.ref} hideStudy />
        </div>
      ) : null}

      {/* Facsimiles on bottom */}
      <div className="faxVerseEditions">
        {editions.map((ed) => {
          const to = slug ? `/fax/${ed.version}/${slug}` : `/fax/${ed.version}/${ed.page}`;
          const src = selector
            ? `${renderBaseUrl}/fax/render/${ed.version}/crop/w${CROP_WIDTH}/${selector}.jpg`
            : null;
          return (
            <Link key={ed.version} to={to} className="faxEditionRow">
              <span className="faxEditionLabel">{ed.title || ed.version}</span>
              {src ? (
                <img
                  className="faxEditionCrop"
                  src={src}
                  alt={`${ed.title || ed.version} ${data.ref || ""}`.trim()}
                  loading="lazy"
                  onError={hideRow}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
