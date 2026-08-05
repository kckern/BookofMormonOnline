import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { detectReferences } from "scripture-guide";
import { label } from "src/models/Utils";
import { assetUrl } from "src/models/BoMOnlineAPI";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";
import { openScripture } from "./ScripturePopup";

// Parse the note HTML, turning detectReferences' <a class="scripture_link">
// tags into clickable spans that open the app-wide scripture popup.
const NOTE_PARSE_OPTS = {
  replace: (node) => {
    if (
      node.name === "a" &&
      (node.attribs?.class || "").includes("scripture_link") &&
      node.children?.[0]?.data
    ) {
      const ref = node.children[0].data;
      return (
        <span
          className="scripture_link"
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); openScripture(ref); }}
        >
          {ref}
        </span>
      );
    }
    return undefined;
  },
};

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
  // Detect scripture refs (incl. abbreviations like "Mos 1.13") in the note body.
  // NOTE: do NOT pass a lang arg here — it corrupts abbreviation matching. The
  // options object carries no language, so abbreviation matching is unaffected;
  // chainAcrossMarkers:false stops "see also"/"cf." being swallowed (>=1.0.95).
  const noteHtml = detectReferences(note.text || "", (s) => `<a class="scripture_link">${s}</a>`, { chainAcrossMarkers: false });
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
          <div className="notesBody">
            {anchor ? (
              <>
                <span className="notesAnchor">{anchor}</span>{" "}
                <span className="notesQuote">{Parser(noteHtml, NOTE_PARSE_OPTS)}</span>
              </>
            ) : (
              <span className="notesQuote">&ldquo;{Parser(noteHtml, NOTE_PARSE_OPTS)}&rdquo;</span>
            )}
            {author ? <span className="notesAttr"> &mdash; {author}</span> : null}
          </div>
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
