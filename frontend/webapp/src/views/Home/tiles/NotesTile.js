import React, { useState } from "react";
import Parser from "html-react-parser";
import { detectReferences } from "scripture-guide";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import RefPill, { makeRefPillParserOptions } from "./RefPill";

// A note that already opens with a quotation ("<i>“Driven forth…”</i> …") must
// not be wrapped in a second pair of smart quotes.
const OPENS_WITH_QUOTE = /^[“"‘']/;
const plainText = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

/**
 * ONE scholarly annotation (is_note=1 commentary row) rendered as a margin gloss
 * on the ACTUAL passage: scripture first (Read-experience typography via
 * ScriptureExcerpt, the annotated phrase marked), then the note as a speech
 * bubble pointing up at the verse — publication cover on the right, the note in
 * smart quotes, author attributed with an em dash. Refs are RefPill buttons
 * (popup); "See in context" goes straight to the canonical Read URL.
 */
export default function NotesTile({ data }) {
  // false = the passage could not be loaded (or is not Book of Mormon text):
  // drop the passage block and surface the reference as a pill instead.
  const [passageOk, setPassageOk] = useState(true);
  const note = (data || []).find((n) => n?.text && n?.reference);
  if (!note) return null;
  const to = readPath(note.reference);
  const pub = note.publication || {};
  const author = pub.source_name || null;
  const coverPath = pub.source_id ? `source/cover/${String(pub.source_id).padStart(3, "0")}` : null;
  // ~61% of notes annotate a specific phrase (stored curly-quoted in `title`):
  // lead the bubble with it and highlight it in the passage above.
  const anchor = note.title || null;
  // Detect scripture refs (incl. abbreviations like "Mos 1.13") in the note body.
  // NOTE: do NOT pass a lang arg here — it corrupts abbreviation matching. The
  // options object carries no language, so abbreviation matching is unaffected;
  // chainAcrossMarkers:false stops "see also"/"cf." being swallowed (>=1.0.95).
  const noteHtml = detectReferences(note.text || "", (s) => `<a class="scripture_link">${s}</a>`, { chainAcrossMarkers: false });
  const body = Parser(noteHtml, makeRefPillParserOptions({ contextRef: note.reference }));
  const quoted = !anchor && !OPENS_WITH_QUOTE.test(plainText(note.text));
  return (
    <div className="samplerTileInner notesTile">
      <h3 className="tileHeading">{labelOr("notes", "Passage notes")}</h3>
      <div className="notesEntry">
        {passageOk ? (
          <div className="read-content scriptureExcerptCompact">
            <ScriptureExcerpt
              refText={note.reference}
              hideStudy
              refAsPopup
              highlight={anchor}
              onBoMSections={(ok) => setPassageOk(ok)}
            />
          </div>
        ) : null}
        <div className={`notesText notesBubble${passageOk ? "" : " noPassage"}`}>
          {coverPath ? (
            <TileImage
              path={coverPath}
              widths={[]}
              className="notesCover"
              alt={pub.source_title || ""}
              width={44}
              height={66}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : null}
          <div className="notesBody">
            {anchor ? (
              <>
                <span className="notesAnchor">{anchor}</span>{" "}
                <span className="notesQuote">{body}</span>
              </>
            ) : quoted ? (
              <span className="notesQuote">&ldquo;{body}&rdquo;</span>
            ) : (
              <span className="notesQuote">{body}</span>
            )}
            {author ? <span className="notesAttr"> &mdash; {author}</span> : null}
          </div>
        </div>
        <div className="notesMeta">
          {passageOk ? <span /> : <RefPill refText={note.reference} className="notesRef" />}
          {to ? <TileDeepLink to={to} always verb="seeInContext" /> : null}
        </div>
      </div>
    </div>
  );
}
