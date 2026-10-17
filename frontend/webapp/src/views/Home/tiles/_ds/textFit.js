/**
 * textFit — cheap, pure height estimates for self-fetching tiles that must
 * resolve INTO their reserved box (audit R3 B2: a tile that changes height
 * after paint shoves every tile below it in the column).
 *
 * The tile reserves a fixed footprint (skeletonHeights) and keeps it after
 * resolving (min-height); these estimates let it choose content that fits the
 * box, so the resolved tile neither shrinks nor grows on screen.
 *
 * Calibrated live on dev (2026-10-16, tileharness, 1440px + 390px): the Read
 * serif at 0.95rem averages ~6px per character, and estimating whole wrapped
 * rows from that lands within one row of the measured height for all 118
 * displayable chiasms and 195 sampled intertext pairs.
 */
export const CHAR_PX = 6;

/** Wrapped rows for `chars` characters in `availPx` of measure (>= 1). */
export const rows = (chars, availPx, charPx = CHAR_PX) =>
  Math.max(1, Math.ceil((Number(chars) || 0) * charPx / Math.max(availPx, 60)));

// MiniChiasm in the tile: 0.95rem text at line-height 1.38 (≈21px), 0.3rem
// line gap, the key letter + gap ≈13px, and 0.9rem indent per letter depth.
const CHIASM_ROW = 20.98;
const CHIASM_GAP = 4.8;
const CHIASM_KEY = 13;
const CHIASM_INDENT = 14.4;

/** Estimated px height of a chiasm's mirrored lines at `widthPx` of measure. */
export function estimateChiasmLinesPx(scheme, lineLengths, widthPx) {
  const keys = String(scheme || "");
  const lens = Array.isArray(lineLengths) ? lineLengths : [];
  let h = 0;
  for (let i = 0; i < keys.length; i++) {
    const avail = widthPx - (keys.charCodeAt(i) - 65) * CHIASM_INDENT - CHIASM_KEY;
    h += rows(lens[i], avail) * CHIASM_ROW + CHIASM_GAP;
  }
  return h;
}

// Biblical-language passages: 0.95rem serif at line-height 1.45 (≈22px).
const PAIR_ROW = 22.04;

// The pair sits side by side only in a tile wider than 26rem (Sampler.css
// @container); below that it stacks. ~390px of content ≈ a 26rem tile.
const PAIR_SIDE_BY_SIDE = 390;
const PAIR_GUTTER = 30; // 0.9rem gap + 0.9rem rule padding + 1px rule

/** Estimated px height of the pair's two passages at `widthPx` of measure. */
export function estimatePairTextPx(bomChars, kjvChars, widthPx) {
  if (widthPx > PAIR_SIDE_BY_SIDE) {
    const half = (widthPx - PAIR_GUTTER) / 2;
    return Math.max(rows(bomChars, half), rows(kjvChars, half)) * PAIR_ROW;
  }
  return (rows(bomChars, widthPx) + rows(kjvChars, widthPx)) * PAIR_ROW;
}
