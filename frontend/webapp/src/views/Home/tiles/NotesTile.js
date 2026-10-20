import React, { useEffect, useRef, useState } from "react";
import Parser from "html-react-parser";
import { detectReferences, lookup } from "scripture-guide";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import RefPill, { makeRefPillParserOptions } from "./RefPill";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";

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

/** Line-box tops (px from `top`) of every verse paragraph in the window. */
const verseLineTops = (box, top) => {
  const out = [];
  for (const p of box.querySelectorAll(".read-scripture")) {
    const r = p.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(p).lineHeight);
    if (!(lh > 0) || !(r.height > 0)) continue;
    const n = Math.max(1, Math.round(r.height / lh));
    for (let k = 0; k < n; k++) out.push(r.top - top + k * lh);
  }
  return out.sort((a, b) => a - b);
};

export const revealMark = (box) => {
  if (!box) return;
  box.scrollTop = 0;
  box.classList.remove("isScrolled");
  const mark = box.querySelector(".scriptureAnchorMark");
  if (!mark) return;
  const below = () => mark.getBoundingClientRect().bottom - box.getBoundingClientRect().top;
  const height = box.getBoundingClientRect().height;
  // a box fitted to its passage (fitExcerpt) shows every line, unfaded
  if (box.classList.contains("isFit") && below() <= height + 1) return;
  if (below() <= height - FADE_PX) return;
  box.classList.add("isScrolled"); // reflows: the section title goes
  const b = box.getBoundingClientRect();
  const markTop = mark.getBoundingClientRect().top - b.top;
  const pinned = box.querySelector(".read-section-header")?.getBoundingClientRect().height || 0;
  // notes-H3: the first row under the pinned header is always a WHOLE line —
  // the mark's own line, or (when the scroll range runs out first) the lowest
  // line the range can reach. The line above sits entirely behind the opaque
  // pinned row, so no half-glyphs peek out under it.
  const max = Math.max(0, (box.scrollHeight || 0) - (box.clientHeight || 0));
  const fits = verseLineTops(box, b.top).filter((t) => t <= markTop + 1 && t - pinned >= 0 && t - pinned <= max + 0.5);
  if (fits.length) {
    box.scrollTop = Math.round(fits[fits.length - 1] - pinned);
    return;
  }
  box.scrollTop = Math.max(0, markTop - pinned - GAP_PX);
};

// notes-A1 (R6): the reserve is sized from the verse COUNT before the passage
// lands, so a short verse (or a wide tablet card) left 70-240px of dead space
// above the bubble. Once the passage is in, the box shrinks to its content —
// but only while the box's bottom edge is off-screen (nothing the reader can
// see moves; above the viewport, scroll anchoring holds the view). In view, it
// waits for the reader to scroll it out. A scrolled window keeps the reserve.
const FIT_PAD = 4;
const FIT_MIN = 12; // ignore slack smaller than this
export const fitExcerpt = (box, reserve) => {
  if (!box || !(reserve > 0)) return undefined;
  const contentH = () => {
    const b = box.getBoundingClientRect();
    let max = 0;
    for (const el of box.querySelectorAll(".read-block")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) max = Math.max(max, r.bottom - b.top + (box.scrollTop || 0));
    }
    return max;
  };
  const target = () => {
    if (box.classList.contains("isScrolled")) return reserve;
    const c = contentH();
    if (!c) return null; // passage not in yet
    const h = Math.ceil(c + FIT_PAD);
    return h < reserve - FIT_MIN ? h : reserve;
  };
  const current = () => (box.classList.contains("isFit") ? parseFloat(box.style.height) || reserve : reserve);
  const unseen = () => {
    const r = box.getBoundingClientRect();
    return r.bottom > window.innerHeight || r.bottom <= 0;
  };
  const apply = (h) => {
    if (h >= reserve) {
      box.style.height = "";
      box.classList.remove("isFit");
    } else {
      box.style.height = `${h}px`;
      box.classList.add("isFit");
    }
  };
  const attempt = () => {
    const t = target();
    if (t == null || Math.abs(t - current()) < 2) return true;
    if (!unseen()) {
      // content outgrew a fitted box in view (a late re-wrap): fade the edge
      // until it can grow back unseen
      if (t > current()) box.classList.remove("isFit");
      return false;
    }
    apply(t);
    return true;
  };
  if (attempt()) return undefined;
  const onScroll = () => {
    if (attempt()) window.removeEventListener("scroll", onScroll);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
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
export default function NotesTile(props) {
  return (
    <RevealProvider>
      <NotesTileInner {...props} />
    </RevealProvider>
  );
}

// Long notes clamp to NOTE_LINES with the fade + Read more (Layer 1), like the
// sibling commentary; See in context (Layer 2) waits for that reveal (blind
// audit r4 notes C4: a 794-char note made a 616px tile).
const NOTE_LINES = 8;

function NotesTileInner({ data }) {
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
    let reserve = 0;
    let stopFit;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!box.style.height) reserve = box.getBoundingClientRect().height || reserve;
        revealMark(box);
        stopFit?.();
        stopFit = fitExcerpt(box, reserve);
      });
    };
    const mo = new MutationObserver(run);
    mo.observe(box, { childList: true, subtree: true });
    document.fonts?.addEventListener?.("loadingdone", run);
    run();
    return () => {
      cancelAnimationFrame(raf);
      stopFit?.();
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
              sizes="44px"
              className="notesCover"
              alt={pub.source_title || ""}
              width={44}
              height={66}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : null}
          <ExpandableText className="notesBody" lines={NOTE_LINES} fade persistKey={note.id ? `notes:${note.id}` : undefined}>
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
          </ExpandableText>
        </div>
        <div className="notesMeta">
          {passageOk ? <span /> : <RefPill refText={note.reference} className="notesRef" />}
          {to ? <TileDeepLink to={to} verb="seeInContext" /> : null}
        </div>
      </div>
    </div>
  );
}
