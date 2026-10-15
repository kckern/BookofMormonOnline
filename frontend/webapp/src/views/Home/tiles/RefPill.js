import React from "react";
import { openScripture } from "./ScripturePopup";
import { enDash } from "./textUtils";

/**
 * THE scripture-reference affordance for the whole sampler, rendered with the
 * SITE's `.scripture_link` style (Main.css) — the same Detect Scripture UX as
 * everywhere else. One look, one behavior: click opens the scripture popup.
 *
 * A native <button type="button">: keyboard (Enter/Space), focus and the
 * accessible role come for free. It must NOT be placed inside a card <Link>/<a>
 * (nested interactive content) — put it beside the link instead; the static
 * guard in __tests__/refPillPlacement.test.js enforces this. preventDefault +
 * stopPropagation stay as a belt-and-braces for any remaining legacy nesting.
 */
export default function RefPill({ refText, className = "" }) {
  if (!refText) return null;
  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openScripture(refText);
  };
  return (
    <button type="button" className={`scripture_link ${className}`.trim()} onClick={open}>
      {enDash(refText)}
    </button>
  );
}
