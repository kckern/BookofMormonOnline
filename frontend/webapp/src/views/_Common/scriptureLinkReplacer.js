// The one scripture_link → clickable-anchor transform. The scripture-detection
// pass (detectScriptures in _Common callers; detectReferences in Utils/Narration)
// emits `<a className="scripture_link">Ref</a>`. How that non-standard attribute
// name survives parsing depends on the environment: html-react-parser delegates
// to htmlparser2 in Node (attribute case PRESERVED → `className`) but to the
// native DOM parser in the browser (attribute names LOWERCASED → `classname`).
// Matching only one spelling means links click fine in jsdom tests yet silently
// no-op in every real browser — the exact bug this file previously had. Check
// every spelling, always.
// Consumers layer active-ref behavior via the onClick/getClassName callbacks.
import React from "react";

export function makeScriptureLinkReplacer({ onClick, getClassName } = {}) {
  return (domNode) => {
    const { name, attribs, children } = domNode || {};
    const cls = attribs?.className ?? attribs?.classname ?? attribs?.class;
    if (name !== "a" || cls !== "scripture_link") return undefined;
    // Assumes a single text child (as emitted by the scripture-detection pass).
    const ref = children?.[0]?.data ?? "";
    const { className: _a, classname: _b, class: _c, ...rest } = attribs;
    const className = getClassName ? getClassName(ref) : "scripture_link";
    return (
      <a {...rest} className={className} onClick={() => onClick?.(ref)}>
        {ref}
      </a>
    );
  };
}
