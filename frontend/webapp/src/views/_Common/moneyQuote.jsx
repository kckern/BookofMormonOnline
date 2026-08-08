import React from "react";

// Shared money-quote rendering: editorial-bracket styling + mini-quote
// highlighting. Used by the History source cards and the Home history tiles so
// both treat a money quote the same way.

// Editorial marks in a money quote — [Name] (supplied referent) / [...] (elision)
// — set apart from the quoted words (grey Roboto, not scripture).
const BRACKET_RE = /(\[[^\]]*\])/g;
export const withBrackets = (text) =>
  String(text || "")
    .split(BRACKET_RE)
    .map((part, i) =>
      part.startsWith("[") && part.endsWith("]")
        ? <span key={i} className="editorialMark">{part}</span>
        : part
    );

// A mini quote is one or more curated excerpts of the money quote. When it
// spans an elision it reads as several excerpts joined by a marker — bracketed
// ([...] / […] / [. . .]) or bare (... / …) — so split on that marker and
// highlight each excerpt separately in place within the money quote (the
// skipped words between them stay plain).
const ELISION_RE = /\[\s*(?:\.{2,}|\.(?:\s*\.)+|…)\s*\]|\.{3,}|\.(?:\s\.){2,}|…/g;

// Render the money quote with each mini-quote excerpt wrapped in a highlight
// mark (keeping editorial-bracket styling throughout). Falls back to the plain
// bracketed quote when there's no mini quote or no excerpt is found verbatim.
export const renderMoneyQuote = (money, mini) => {
  const text = String(money || "");
  const parts = String(mini || "")
    .split(ELISION_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  // Locate each excerpt in order, non-overlapping, so out-of-order or repeated
  // words don't produce tangled ranges.
  const ranges = [];
  let from = 0;
  for (const part of parts) {
    const at = text.indexOf(part, from);
    if (at < 0) continue;
    ranges.push([at, at + part.length]);
    from = at + part.length;
  }
  if (!ranges.length) return withBrackets(text);
  const out = [];
  let cursor = 0;
  ranges.forEach(([s, e], i) => {
    if (s > cursor) out.push(<React.Fragment key={`b${i}`}>{withBrackets(text.slice(cursor, s))}</React.Fragment>);
    out.push(<mark key={`m${i}`} className="miniHighlight">{withBrackets(text.slice(s, e))}</mark>);
    cursor = e;
  });
  if (cursor < text.length) out.push(<React.Fragment key="tail">{withBrackets(text.slice(cursor))}</React.Fragment>);
  return out;
};
