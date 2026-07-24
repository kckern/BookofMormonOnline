import React from "react";

// Deterministic square identicon (5×5 left-right mirrored grid) from a seed
// string — no dependency. A small FNV-1a hash drives both the lit cells and the
// hue, so the same seed always renders the same badge.
function hashCode(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Muted earthtone palette — greys, browns, harvest, berry, forest, etc. Each is
// a {fg, bg} pair (cell color + its soft tinted background).
const PALETTE = [
  { fg: "#4a5d3a", bg: "#e9ece3" }, // forest green
  { fg: "#6b5335", bg: "#ece5db" }, // earth brown
  { fg: "#9c7a3c", bg: "#efe9da" }, // harvest gold
  { fg: "#7a3b4e", bg: "#ece0e3" }, // berry
  { fg: "#556066", bg: "#e7eaeb" }, // slate grey
  { fg: "#9c5a3c", bg: "#efe3dc" }, // terracotta
  { fg: "#6b6a3a", bg: "#ebeade" }, // olive
  { fg: "#3f6560", bg: "#e1e9e7" }, // muted teal
  { fg: "#5f4a63", bg: "#e8e3ea" }, // plum
  { fg: "#7c6a58", bg: "#ece7e1" }, // clay / taupe
];

export default function Identicon({ seed = "", size = 32, className = "" }) {
  const h = hashCode(String(seed) || "?");
  const { fg, bg } = PALETTE[h % PALETTE.length];
  const grid = 5;
  const cell = size / grid;
  const rects = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < 3; col++) {
      // one bit per (row, col) in the left half + center column
      if ((h >> (row * 3 + col)) & 1) {
        rects.push([col, row]);
        if (col < 2) rects.push([grid - 1 - col, row]); // mirror to the right half
      }
    }
  }
  return (
    <svg
      className={`identicon ${className}`.trim()}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill={bg} />
      {rects.map(([c, r], i) => (
        <rect key={i} x={c * cell} y={r * cell} width={cell} height={cell} fill={fg} />
      ))}
    </svg>
  );
}
