// The one scripture_link → clickable-anchor transform. detectReferences emits
// `<a className="scripture_link">Ref</a>`; html-react-parser lowercases the
// attribute to `classname`. Previously duplicated in renderPersonPlaceHTML
// (PersonPlace.js) and ParseMessage (models/Utils.js) — the ParseMessage
// variant's active-ref behavior is expressed through the two callbacks.
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
