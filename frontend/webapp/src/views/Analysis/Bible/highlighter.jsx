import React from "react";

// Highlight shared phrases inside verse text. Highlight strings come from the
// API and may not match the local text (translation/punctuation drift); an
// unmatched string degrades to unhighlighted text, never to missing text.

// Reduce a highlight string to its letter tokens; join with a tolerant gap so
// punctuation drift (apostrophes, hyphens, commas) on EITHER side can't break
// the match. Matching runs against the original text — no destructive stripping
// — so the rendered verse keeps its punctuation.
const tokenize = (s) => String(s || "").match(/[a-z]+/gi) || [];

export const generateHighlightedText = (text, arrayOfStrings) => {
  text = text || "";

  const ranges = [];
  for (const str of arrayOfStrings || []) {
    const tokens = tokenize(str);
    if (!tokens.length) continue;
    // tokens separated by any run of non-letters, including none — "[^a-z]*"
    // under the /i flag excludes A–Z too, so it only spans separators.
    const pattern = tokens.join("[^a-z]*");
    let match = null;
    try {
      match = new RegExp(pattern, "i").exec(text);
    } catch (e) {
      // pattern still unbuildable somehow: skip it
    }
    if (match) ranges.push([match.index, match.index + match[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  const jsx = [];
  let pos = 0;
  merged.forEach(([start, end], i) => {
    if (start > pos) jsx.push(<span key={`t${i}`}>{text.slice(pos, start)}</span>);
    jsx.push(
      <span key={`h${i}`} className="highlight">
        {text.slice(start, end)}
      </span>
    );
    pos = end;
  });
  if (pos < text.length) jsx.push(<span key="tail">{text.slice(pos)}</span>);

  return { jsx };
};

export const highlightTextJSX = (text, arrayOfStrings, verse_id) => {
  const { jsx } = generateHighlightedText(text, arrayOfStrings);
  return <span data-verse-id={verse_id}>{jsx}</span>;
};
