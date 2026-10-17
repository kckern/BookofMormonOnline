import React, { useEffect, useRef, useState } from "react";
import Parser from "html-react-parser";
import { detectReferences, lookup } from "scripture-guide";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import RefPill, { makeRefPillParserOptions } from "./RefPill";

// A note that already opens with a quotation ("<i>“Driven forth…”</i> …") must
// not be wrapped in a second pair of smart quotes.
const OPENS_WITH_QUOTE = /^[“"‘']/;
const plainText = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

// notes-A1: a margin gloss shows the annotated verse and a little after it, not
// the note's whole range (Moroni 7:20-39 rendered as a 1343px wall).
export const NOTES_EXCERPT_VERSES = 3;

// notes-B2: the excerpt box is sized from the verse count, known from the
// reference at mount, so the tile paints at its final height (the passage used
// to land after paint and grow the tile by up to ~1200px). The box clips with a
// fade; See in context carries the rest.
const verseCount = (ref) => {
  try {
    return lookup(ref)?.verse_ids?.length || 1;
  } catch {
    return 1;
  }
};

// The excerpt box clips with a bottom fade; when the highlighted anchor phrase
// lands under the fade (a long verse, or the anchor in a later verse), the box
// switches to its scrolled state (ref row pinned, section title dropped — see
// Sampler.css) and scrolls the phrase up to just under the pinned row.
// scrollTop moves no layout (no CLS). FADE_PX tracks the CSS fade (2.25rem).
const FADE_PX = 40;
const GAP_PX = 10;
export const revealMark = (box) => {
  if (!box) return;
  box.scrollTop = 0;
  box.classList.remove("isScrolled");
  const mark = box.querySelector(".scriptureAnchorMark");
  if (!mark) return;
  const below = () => mark.getBoundingClientRect().bottom - box.getBoundingClientRect().top;
  if (below() <= box.getBoundingClientRect().height - FADE_PX) return;
  box.classList.add("isScrolled"); // reflows: the section title goes
  const b = box.getBoundingClientRect();
  const m = mark.getBoundingClientRect();
  const pinned = box.querySelector(".read-section-header")?.getBoundingClientRect().height || 0;
  box.scrollTop = Math.max(0, m.top - b.top - pinned - GAP_PX);
};

// notes-H1: textual-variant notes are written in critical-apparatus shorthand
// (manuscript sigla 𝒪/𝒫, "ATV" = Skousen's Analysis of Textual Variants) that
// reads as cipher to a newcomer; the Home sample prefers a readable note.
const VARIANT_NOTE = /[\u{1D4AA}\u{1D4AB}]|\bATV\b/u;
export const isVariantNote = (html) => VARIANT_NOTE.test(plainText(html));

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
  const excerptRef = useRef(null);
  // the passage renders after its fetch: reveal the anchor once the mark appears
  useEffect(() => {
    const box = excerptRef.current;
    if (!box || typeof MutationObserver === "undefined") return undefined;
    // re-run after layout settles: the Read webfont swapping in re-wraps the
    // verse and moves the mark (seen live: a reveal computed pre-swap)
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => revealMark(box));
    };
    const mo = new MutationObserver(run);
    mo.observe(box, { childList: true, subtree: true });
    document.fonts?.addEventListener?.("loadingdone", run);
    run();
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", run);
    };
  }, []);
  const usable = (data || []).filter((n) => n?.text && n?.reference);
  const note = usable.find((n) => !isVariantNote(n.text)) || usable[0];
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
          <div ref={excerptRef} className="read-content scriptureExcerptCompact notesExcerpt" data-verses={Math.min(verseCount(note.reference), NOTES_EXCERPT_VERSES)}>
            <ScriptureExcerpt
              refText={note.reference}
              hideStudy
              refAsPopup
              highlight={anchor}
              focusVerses={NOTES_EXCERPT_VERSES}
              focusLead={anchor ? 0 : 1}
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
