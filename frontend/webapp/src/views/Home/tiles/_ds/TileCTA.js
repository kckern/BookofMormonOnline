import React from "react";
import { Link } from "react-router-dom";

/**
 * The single CTA pill for every Home tile. ONE component, ONE a11y story:
 *  - `to`      → a real <Link> (Layer-2 navigation)
 *  - `onClick` → a real <button> (Layer-1 action; native Enter/Space support)
 * Reuses the existing pill styles, so the look is unchanged — this replaces
 * ad-hoc <Link className="tileMoreLink"> sites and `role="button"` spans.
 */
const VARIANT_CLASS = {
  reveal: "readMorePill", // Layer 1 — in-place expand (down-arrow glyph)
  deeplink: "tileMoreLink", // Layer 2 — navigate into content (exit-arrow glyph)
};

export default function TileCTA({ variant, to, onClick, children, className = "", ...rest }) {
  const cls = `tileCTA ${VARIANT_CLASS[variant] || ""} ${className}`.trim();
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
