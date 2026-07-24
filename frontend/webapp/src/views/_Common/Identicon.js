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

export default function Identicon({ seed = "", size = 32, className = "" }) {
  const h = hashCode(String(seed) || "?");
  const hue = h % 360;
  const fg = `hsl(${hue}, 52%, 45%)`;
  const bg = `hsl(${hue}, 28%, 93%)`;
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
