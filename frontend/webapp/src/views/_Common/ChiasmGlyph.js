import React from "react";
import "./ChiasmGlyph.css";

/**
 * Bar model for a chiasm scheme string. Pure; exported for tests and future
 * server-side reuse.
 * - indent: major letter A=0, B=1, …; sub-letters (a-z or αβγδ) sit +0.5
 *   under their major.
 * - widthFactor: 0.4 / 0.7 / 1.0 — per-chiasm length tertile (1 when
 *   lengths are unknown or mismatched).
 * - isPivot: bar(s) whose MAJOR depth equals the maximum major depth — the
 *   chiasm's turning point. Sub-letters share their major's depth, matching
 *   the detail panel's pivot definition (max-major lines, not max-indent).
 */
export function glyphBars(scheme, lineLengths) {
  const chars = (scheme || "").split("");
  if (!chars.length) return [];
  let currentMajor = 0;
  const bars = chars.map((ch) => {
    const isMajor = /[A-Z]/.test(ch);
    if (isMajor) currentMajor = ch.charCodeAt(0) - 65;
    return { indent: isMajor ? currentMajor : currentMajor + 0.5, widthFactor: 1, isPivot: false };
  });
  const maxMajor = Math.max(...bars.map((b) => Math.floor(b.indent)));
  bars.forEach((b) => { b.isPivot = Math.floor(b.indent) === maxMajor; });
  if (Array.isArray(lineLengths) && lineLengths.length === bars.length) {
    const sorted = [...lineLengths].sort((a, b) => a - b);
    const t1 = sorted[Math.floor((sorted.length - 1) / 3)];
    const t2 = sorted[Math.floor(((sorted.length - 1) * 2) / 3)];
    // uniform lengths: every value <= t1 would shrink ALL bars to 0.4 —
    // there are no tertiles to show, so leave every factor at 1
    if (t1 !== sorted[sorted.length - 1]) {
      bars.forEach((b, i) => {
        b.widthFactor = lineLengths[i] <= t1 ? 0.4 : lineLengths[i] <= t2 ? 0.7 : 1.0;
      });
    }
  }
  return bars;
}

/**
 * SVG fingerprint of a chiasm's structure: one bar per scheme entry,
 * indent = letter depth, width = length tertile, accent on the pivot.
 * Shared across cards, detail header, PassageNotes, and the Home tile.
 */
export default function ChiasmGlyph({ scheme, lineLengths, size = 40, title }) {
  const bars = glyphBars(scheme, lineLengths);
  if (!bars.length) return null;
  const rowH = size / bars.length;
  const barH = Math.max(1.5, rowH * 0.55);
  const maxIndent = Math.max(...bars.map((b) => b.indent));
  const indentUnit = maxIndent ? (size * 0.45) / maxIndent : 0;
  return (
    <svg
      className="chiasmGlyph" role="img" width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={title || `Chiastic structure ${scheme}`}
    >
      {title ? <title>{title}</title> : null}
      {bars.map((b, i) => {
        const x = b.indent * indentUnit;
        const w = Math.max(2, (size - x) * b.widthFactor);
        return (
          <rect
            key={i} x={x} y={i * rowH + (rowH - barH) / 2}
            width={w} height={barH} rx={Math.min(barH / 2, 2)}
            className={b.isPivot ? "glyphBar pivot" : "glyphBar"}
          />
        );
      })}
    </svg>
  );
}
