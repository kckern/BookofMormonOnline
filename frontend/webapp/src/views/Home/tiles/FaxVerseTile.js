import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ScriptureExcerpt from "src/views/_Common/ScriptureExcerpt";
import { openScripture } from "./ScripturePopup";

/**
 * A facsimile page anchored to the verse it depicts — "here is this passage in
 * the 1830 edition". Page image at natural aspect (deep-links into the viewer),
 * the FaxTile ref-bar pattern (ref opens the scripture popup), and the verse
 * itself rendered below via ScriptureExcerpt.
 */
export default function FaxVerseTile({ data }) {
  if (!data?.version || !data?.page) return null;
  const nnn = String(data.page).padStart(3, "0");
  const format = data.format || "jpg";
  return (
    <div className="samplerTileInner faxVerseTile">
      <h3 className="tileHeading">
        <Link to={`/fax/${data.version}`}>{label("facsimiles")}</Link>
      </h3>
      <Link to={`/fax/${data.version}/${data.page}`} className="faxTilePage faxVersePage">
        <img
          src={`${assetUrl}/fax/thumb/${data.version}/${nnn}.${format}`}
          alt={`${data.title || data.version} p.${data.page}`}
          loading="lazy"
          onError={(e) => (e.target.style.display = "none")}
        />
        <span className="faxPageBar">
          {data.ref ? (
            <span
              className="faxPageBarRef"
              role="button"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openScripture(data.ref); }}
            >
              {data.ref}
            </span>
          ) : <span />}
          <span className="faxPageBarNum">p. {data.page}</span>
        </span>
      </Link>
      {data.title ? <div className="faxVerseTitle">{data.title}</div> : null}
      {data.ref ? (
        <div className="read-content scriptureExcerptCompact">
          <ScriptureExcerpt refText={data.ref} hideStudy />
        </div>
      ) : null}
    </div>
  );
}
