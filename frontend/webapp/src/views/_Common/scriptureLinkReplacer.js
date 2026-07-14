// The one scripture_link → clickable-anchor transform. detectReferences emits
// `<a className="scripture_link">Ref</a>`; html-react-parser runs with
// lowerCaseAttributeNames:false, so the attribute is stored verbatim as
// `className` (capital N) — NOT lowercased to `classname`. (The pre-existing
// `attribs.classname` checks in PersonPlace.js / Utils.js / ViewUtils.js never
// matched, so scripture links were silently non-clickable; this replacer,
// keyed on `className`, fixes that.) Consumers layer active-ref behavior via
// the onClick/getClassName callbacks.
import React from "react";

export function makeScriptureLinkReplacer({ onClick, getClassName } = {}) {
  return (domNode) => {
    const { name, attribs, children } = domNode || {};
    // html-react-parser uses lowerCaseAttributeNames:false, so the HTML attribute
    // `className="scripture_link"` is stored in attribs as `className` (capital N).
    if (name !== "a" || attribs?.className !== "scripture_link") return undefined;
    const ref = children?.[0]?.data ?? "";
    const { className: _removed, ...rest } = attribs;
    const className = getClassName ? getClassName(ref) : "scripture_link";
    return (
      <a {...rest} className={className} onClick={() => onClick?.(ref)}>
        {ref}
      </a>
    );
  };
}
