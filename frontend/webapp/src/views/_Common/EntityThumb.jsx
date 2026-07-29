/** @format */
import React, { useState } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import "./EntityThumb.css";

/** djb2-ish hash → stable seed for slug-based gradients. */
const hashSlug = (slug) => {
  let h = 0;
  const s = slug || "";
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export const slugGradient = (slug) => {
  const h = hashSlug(slug);
  const hue1 = h % 360;
  const hue2 = (hue1 + 30 + ((h >> 8) % 50)) % 360;
  const sat = 45 + ((h >> 16) % 25);
  return `linear-gradient(135deg, hsl(${hue1}, ${sat}%, 48%) 0%, hsl(${hue2}, ${sat}%, 26%) 100%)`;
};

export const entityInitials = (name) => {
  const cleaned = (name || "").replace(/[^\p{L}\s]/gu, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
};

/**
 * Entity image with a designed fallback.
 *
 * Most Matters have no rendered artwork yet (314 of 487 are placeholders), so a
 * 404 here is the common case rather than the exception. On error we swap to a
 * slug-seeded gradient carrying the entity's initials instead of leaving the
 * browser to draw its broken-image chip.
 *
 * `size` is any CSS length and drives a square box, so a failed load still
 * occupies its space — the markup this replaces set no dimensions at all.
 */
export default function EntityThumb({ type, slug, name, size, className, rounded }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  const cls = "entityThumb" + (rounded ? " rounded" : "") + (className ? " " + className : "");

  if (failed || !slug) {
    return (
      <div
        className={cls + " fallback"}
        style={{ ...style, background: slugGradient(slug) }}
        title={name}
      >
        <span aria-hidden="true">{entityInitials(name)}</span>
      </div>
    );
  }
  return (
    <div className={cls} style={style}>
      <img alt={name} src={`${assetUrl}/${type}/${slug}`} onError={() => setFailed(true)} />
    </div>
  );
}
