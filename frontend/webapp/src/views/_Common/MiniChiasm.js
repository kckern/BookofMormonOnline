import React from "react";
import "./MiniChiasm.css";

/** `_highlight_` markers → <mark>; the site's chiasm line convention. */
const renderLine = (text) =>
  (text || "").split(/_([^_]+)_/).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));

/**
 * Compact chiasm rendering — mirrored lines, indent tracks the letter depth
 * in, then back out. Shared by the Home sampler tile and PassageNotes.
 */
export default function MiniChiasm({ lines, className = "" }) {
  if (!lines?.length) return null;
  return (
    <div className={`miniChiasm ${className}`.trim()}>
      {lines.map((line, i) => (
        <div
          key={i}
          className="miniChiasmLine"
          style={{ paddingLeft: `${((line.line_key || "A").charCodeAt(0) - 65) * 0.9}rem` }}
        >
          <span className="miniChiasmKey">{line.line_key}</span>
          <span className="miniChiasmText">{renderLine(line.line_text)}</span>
        </div>
      ))}
    </div>
  );
}
