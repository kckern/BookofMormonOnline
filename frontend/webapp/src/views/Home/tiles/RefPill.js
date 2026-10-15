import React from "react";
import { openScripture } from "./ScripturePopup";
import { enDash } from "./textUtils";

/**
 * THE scripture-reference affordance for the whole sampler, rendered with the
 * SITE's `.scripture_link` style (Main.css) — the same Detect Scripture UX as
 * everywhere else. One look, one behavior: click opens the scripture popup.
 *
 * A native <button type="button">: keyboard (Enter/Space), focus and the
 * accessible role come for free. It must NOT be placed inside a card Link or anchor
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

/**
 * html-react-parser options that turn the scripture-detection pass's
 * anchor (a.scripture_link, wrapping the ref text) (any attribute spelling — the browser
 * lowercases it, htmlparser2 keeps it) into a RefPill button, so refs detected
 * in tile prose are focusable and keyboard-operable like every other pill.
 */
export const refPillParserOptions = {
  replace: (node) => {
    const { name, attribs, children } = node || {};
    const cls = attribs?.className ?? attribs?.classname ?? attribs?.class ?? "";
    if (name !== "a" || !/\bscripture_link\b/.test(cls)) return undefined;
    const ref = children?.[0]?.data;
    if (!ref) return undefined;
    return <RefPill refText={ref} />;
  },
};
