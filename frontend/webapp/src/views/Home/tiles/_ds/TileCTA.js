import React from "react";
import { Link } from "react-router-dom";
import labelOr from "./labelOr";

/**
 * The single CTA pill for every Home tile. ONE component, ONE a11y story:
 *  - `to`      → a real <Link> (Layer-2 navigation)
 *  - `onClick` → a real <button> (Layer-1 action; native Enter/Space support)
 * Reuses the existing pill styles, so the look is unchanged — this replaces
 * ad-hoc <Link className="tileMoreLink"> sites and `role="button"` spans.
 *
 * `verb` picks the label from the one CTA vocabulary (sentence case); `name`
 * fills "Open <name>". Explicit `children` win over `verb`.
 */
const VARIANT_CLASS = {
  reveal: "readMorePill", // Layer 1 — in-place expand (down-arrow glyph)
  deeplink: "tileMoreLink", // Layer 2 — navigate into content (exit-arrow glyph)
};

// verb → [label key, sentence-case fallback]. show_less / open_x / explore get
// labels-table rows separately; until then the fallback renders.
export const CTA_VERBS = {
  readMore: ["read_more", "Read more"],
  showLess: ["show_less", "Show less"],
  seeInContext: ["view_in_context", "See in context"],
  open: ["open_x", "Open $1"],
  viewAll: ["view_all", "View all"],
  explore: ["explore", "Explore"],
};

export const verbLabel = (verb, name) => {
  const entry = CTA_VERBS[verb];
  if (!entry) return null;
  return labelOr(entry[0], entry[1], name != null ? [name] : []).trim();
};

export default function TileCTA({ variant, verb, name, to, onClick, children, className = "", ...rest }) {
  const cls = `tileCTA ${VARIANT_CLASS[variant] || ""} ${className}`.trim();
  const content = children != null && children !== false ? children : verbLabel(verb, name);
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} {...rest}>
      {content}
    </button>
  );
}
