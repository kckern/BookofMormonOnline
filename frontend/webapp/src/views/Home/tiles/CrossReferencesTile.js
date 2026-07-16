import React from "react";
import { label } from "src/models/Utils";
import ScriptureExcerpt from "src/views/_Common/ScriptureExcerpt";
import { openScripture } from "./ScripturePopup";

/**
 * A passage and its footnote cross-references. The source verse renders in full
 * (Read typography); each cross-reference is a chip labeled by its reference
 * (the data has no topical titles) that opens the scripture popup.
 */
export default function CrossReferencesTile({ data }) {
  const refs = (data?.refs || []).filter((r) => r?.ref);
  if (!data?.srcRef || !refs.length) return null;
  return (
    <div className="samplerTileInner crossRefsTile">
      <h3 className="tileHeading">{label("cross_references")}</h3>
      <div className="read-content scriptureExcerptCompact">
        <ScriptureExcerpt refText={data.srcRef} hideStudy />
      </div>
      <div className="crossRefsList">
        {refs.map((r) => (
          <button
            key={r.verseId}
            type="button"
            className="crossRefItem"
            onClick={() => openScripture(r.ref)}
          >
            {r.ref}
          </button>
        ))}
      </div>
    </div>
  );
}
