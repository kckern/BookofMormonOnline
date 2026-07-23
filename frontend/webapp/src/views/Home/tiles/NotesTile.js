import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { label } from "src/models/Utils";
import { assetUrl } from "src/models/BoMOnlineAPI";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";

/**
 * ONE scholarly annotation (is_note=1 commentary row) rendered as a margin gloss
 * on the ACTUAL passage: scripture first (Read-experience typography via
 * ScriptureExcerpt), then the note as a speech bubble pointing up at the verse —
 * publication cover floated right, the note itself in smart quotes, author
 * attributed inline with an em-dash.
 */
export default function NotesTile({ data }) {
  const note = (data || []).find((n) => n?.text && n?.reference);
  if (!note) return null;
  const to = readPath(note.reference);
  const author = note.publication?.source_name || null;
  const sourceId = note.publication?.source_id;
  const cover = sourceId ? `${assetUrl}/source/cover/${String(sourceId).padStart(3, "0")}` : null;
  // ~61% of notes annotate a specific phrase (stored curly-quoted in `title`):
  // lead the bubble with it and highlight it in the passage above.
  const anchor = note.title || null;
  return (
    <div className="samplerTileInner notesTile">
      <h3 className="tileHeading">{label("notes")}</h3>
      <div className="notesEntry">
        <div className="read-content scriptureExcerptCompact">
          <ScriptureExcerpt refText={note.reference} hideStudy refAsPopup highlight={anchor} />
        </div>
        <div className="notesText notesBubble">
          {cover ? (
            <img
              className="notesCover"
              src={cover}
              alt={author || ""}
              loading="lazy"
              onError={(e) => (e.target.style.display = "none")}
            />
          ) : null}
          {anchor ? (
            <>
              <span className="notesAnchor">{anchor}</span>{" "}
              <span className="notesQuote">{Parser(note.text)}</span>
            </>
          ) : (
            <span className="notesQuote">&ldquo;{Parser(note.text)}&rdquo;</span>
          )}
          {author ? <span className="notesAttr"> &mdash; {author}</span> : null}
        </div>
        {to ? (
          <div className="notesMeta">
            <Link to={to} className="tileMoreLink">{label("view_in_context")}</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
