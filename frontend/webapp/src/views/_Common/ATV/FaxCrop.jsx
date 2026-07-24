import React from "react";
import { renderBaseUrl } from "src/models/BoMOnlineAPI";

/** One cropped verse scan. Collapses (no broken-image glyph) on load error —
 *  the caller decides what, if anything, to show instead. */
export function FaxCrop({ version, selector, width = 400, alt = "" }) {
  if (!version || !selector) return null;
  const src = `${renderBaseUrl}/fax/render/${version}/crop/w${width}/${selector}.jpg`;
  return (
    <img
      className="atv-fax-crop"
      src={src}
      alt={alt}
      loading="lazy"
      onError={(e) => { e.target.style.display = "none"; }}
    />
  );
}
