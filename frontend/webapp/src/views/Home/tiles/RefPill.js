import React from "react";
import { openScripture } from "./ScripturePopup";
import { lookup } from "scripture-guide";
import { enDash } from "./textUtils";

const resolves = (ref) => {
  try {
    return !!lookup(ref)?.verse_ids?.length;
  } catch {
    return false;
  }
};

// "v. 25" / "vv. 3-4" / "verse 7" — a verse number with no book or chapter.
const RELATIVE = /^(?:vv?\.?|verses?)\s*(\d+(?:\s*[-–]\s*\d+)?)$/i;

/**
 * Decide what a detected reference should open. Returns the ref to open, or
 * null when it does not resolve to any verse (then it must stay plain text —
 * a pill that opens an empty popup is a dead end, audit popup-B4). A relative
 * verse ref resolves against `contextRef` (the tile's own passage).
 */
export function resolveDetectedRef(text, contextRef) {
  const t = (text || "").trim();
  if (!t) return null;
  const rel = RELATIVE.exec(t);
  if (rel) {
    const ch = /^(.+?\s+\d+)(?::|\s*$)/.exec(contextRef || "")?.[1];
    const ref = ch ? `${ch}:${rel[1].replace(/\s*[-–]\s*/, "-")}` : null;
    return ref && resolves(ref) ? ref : null;
  }
  return resolves(t) ? t : null;
}

// Source prose sometimes writes chapter.verse ("Alma 5.51"); show it the way
// every other ref on the page reads ("Alma 5:51") — audit notes-A7. A spaced
// range ("12:1 – 13:24") closes up like the popup title (audit text-A3).
const displayRef = (s) => enDash(s).replace(/(\d)\.(\d)/g, "$1:$2").replace(/(\d)\s+–\s+(\d)/g, "$1–$2");

/**
 * THE scripture-reference affordance for the whole sampler, rendered with the
 * SITE's `.scripture_link` style (Main.css) — the same Detect Scripture UX as
 * everywhere else. One look, one behavior: click opens the scripture popup.
 *
 * A native <button type="button">: keyboard (Enter/Space), focus and the
 * accessible role come for free. It must NOT be placed inside a card Link or anchor
 * (nested interactive content) — put it beside the link instead; the static
 * guard in __tests__/refPillPlacement.test.js enforces this. preventDefault +
 * stopPropagation stay as a belt-and-braces for any remaining legacy nesting.
 */
export default function RefPill({ refText, openRef, className = "" }) {
  if (!refText) return null;
  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openScripture(openRef || refText, { opener: e.currentTarget });
  };
  return (
    <button type="button" className={`scripture_link ${className}`.trim()} onClick={open}>
      {displayRef(refText)}
    </button>
  );
}

// The book a piece names ("1 Nephi 15:25" → "1 Nephi", "Moroni 4–5" → "Moroni"),
// or null when the piece continues the previous book ("19:15–16").
const BOOK = /^((?:\d\s+)?[^\d\s;,][^\d;]*?)\s+\d/;

/**
 * Split a detected citation list ("1 Nephi 15:25; 19:15–16; Jacob 3:9–11") into
 * its references, each with the full ref it opens (the book carried forward).
 * Blind r8 commentary-A1: as one nowrap chip such a list ran 465px wide.
 * Returns null for a single reference.
 */
export function splitRefList(text) {
  const parts = (text || "").split(/\s*;\s*/).filter(Boolean);
  if (parts.length < 2) return null;
  let book = null;
  return parts.map((part) => {
    const own = BOOK.exec(part)?.[1];
    if (own) book = own;
    return { text: part, full: own || !book ? part : `${book} ${part}` };
  });
}

const DetectedPill = ({ text, full, contextRef }) => {
  const target = resolveDetectedRef(full, contextRef);
  if (!target) return <>{text}</>;
  return <RefPill refText={text} openRef={target === text ? undefined : target} />;
};

/**
 * html-react-parser options that turn the scripture-detection pass's
 * anchor (a.scripture_link, wrapping the ref text) (any attribute spelling — the browser
 * lowercases it, htmlparser2 keeps it) into a RefPill button, so refs detected
 * in tile prose are focusable and keyboard-operable like every other pill.
 */
export const makeRefPillParserOptions = ({ contextRef } = {}) => ({
  replace: (node) => {
    const { name, attribs, children } = node || {};
    const cls = attribs?.className ?? attribs?.classname ?? attribs?.class ?? "";
    if (name !== "a" || !/\bscripture_link\b/.test(cls)) return undefined;
    const ref = children?.[0]?.data;
    if (!ref) return undefined;
    const list = splitRefList(ref);
    if (list) {
      // a run that may wrap between the pills even inside a .refNoBreak span;
      // each separator stays on its pill's line (never a ";" opening a line)
      return (
        <span className="refList">
          {list.map((p, i) => (
            <React.Fragment key={i}>
              {i ? " " : null}
              {i < list.length - 1 ? (
                <span className="refNoBreak">
                  <DetectedPill text={p.text} full={p.full} contextRef={contextRef} />;
                </span>
              ) : (
                <DetectedPill text={p.text} full={p.full} contextRef={contextRef} />
              )}
            </React.Fragment>
          ))}
        </span>
      );
    }
    return <DetectedPill text={ref} full={ref} contextRef={contextRef} />;
  },
});

export const refPillParserOptions = makeRefPillParserOptions();
