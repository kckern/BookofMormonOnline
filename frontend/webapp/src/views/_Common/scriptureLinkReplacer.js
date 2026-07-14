// The one scripture_link → clickable-anchor transform. The scripture-detection
// pass (detectScriptures in _Common callers; detectReferences in Utils/Narration)
// emits `<a className="scripture_link">Ref</a>`. html-react-parser v1.x preserves
// the case of non-standard attribute names, so `className` (not a standard HTML
// attribute) arrives in attribs verbatim as `className` (capital N) — NOT
// lowercased to `classname`. (The pre-existing `attribs.classname` checks in
// PersonPlace.js / Utils.js / ViewUtils.js never matched, so scripture links were
// silently non-clickable; this replacer, keyed on `className`, fixes that.)
// Consumers layer active-ref behavior via the onClick/getClassName callbacks.
import React from "react";

export function makeScriptureLinkReplacer({ onClick, getClassName } = {}) {
  return (domNode) => {
    const { name, attribs, children } = domNode || {};
    // Non-standard attribute names keep their case in html-react-parser v1.x, so
    // `className="scripture_link"` is stored in attribs as `className` (capital N).
    if (name !== "a" || attribs?.className !== "scripture_link") return undefined;
    // Assumes a single text child (as emitted by the scripture-detection pass).
    const ref = children?.[0]?.data ?? "";
    const { className: _omit, ...rest } = attribs;
    const className = getClassName ? getClassName(ref) : "scripture_link";
    return (
      <a {...rest} className={className} onClick={() => onClick?.(ref)}>
        {ref}
      </a>
    );
  };
}
