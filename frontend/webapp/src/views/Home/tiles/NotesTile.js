import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { label } from "src/models/Utils";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";

/**
 * Short scholarly annotations (is_note=1 commentary rows) rendered as margin
 * glosses on the ACTUAL passage: scripture first (Read-experience typography
 * via ScriptureExcerpt), the note beneath, source attribution under that.
 */
export default function NotesTile({ data }) {
  const notes = (data || []).filter((n) => n?.text && n?.reference);
  if (!notes.length) return null;
  return (
    <div className="samplerTileInner notesTile">
      <h3 className="tileHeading">{label("notes")}</h3>
      {notes.map((n) => {
        const to = readPath(n.reference);
        return (
          <div key={n.id} className="notesEntry">
            <div className="read-content scriptureExcerptCompact">
              <ScriptureExcerpt refText={n.reference} hideStudy />
            </div>
            <div className="notesText">{Parser(n.text)}</div>
            <div className="notesMeta">
              {n.publication?.source_name ? (
                <span className="notesSource">{n.publication.source_name}</span>
              ) : null}
              {to ? (
                <Link to={to} className="tileMoreLink">{label("view_in_context")}</Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
