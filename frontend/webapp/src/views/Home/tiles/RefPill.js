import React from "react";
import { openScripture } from "./ScripturePopup";
import { enDash } from "./textUtils";

/**
 * THE scripture-reference affordance for the whole sampler, rendered with the
 * SITE's `.scripture_link` style (Main.css) — the same Detect Scripture UX as
 * everywhere else. One look, one behavior: click opens the scripture popup.
 * Safe inside card <Link>s (prevents default + stops propagation).
 */
export default function RefPill({ refText, className = "" }) {
  if (!refText) return null;
  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openScripture(refText);
  };
  // span, not <a>: RefPills sit inside card <Link>s and nested anchors are
  // invalid DOM (React warns, browsers split the tree). Styled to match the
  // site's a.scripture_link via .sampler .scripture_link in Sampler.css.
  return (
    <span
      className={`scripture_link ${className}`.trim()}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e)}
    >
      {enDash(refText)}
    </span>
  );
}
