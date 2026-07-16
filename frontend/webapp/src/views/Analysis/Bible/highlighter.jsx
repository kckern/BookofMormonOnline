import React from "react";

// Highlight shared phrases inside verse text. Highlight strings come from the
// API and may not match the local text (translation/punctuation drift); an
// unmatched string degrades to unhighlighted text, never to missing text.

const prepareText = (text) => (text || "").replace(/[-']/g, "");

export const generateHighlightedText = (text, arrayOfStrings) => {
  text = prepareText(text);

  const ranges = [];
  for (const str of arrayOfStrings || []) {
    const pattern = String(str).replace(/ /g, "[^a-z]+");
    let match = null;
    try {
      match = new RegExp(pattern, "gi").exec(text);
    } catch (e) {
      // un-regexable highlight string: skip it
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
