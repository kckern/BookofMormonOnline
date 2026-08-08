import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ArchiveDocTile, { parseTeaser } from "./ArchiveDocTile";

// Backward-compat: parseTeaser used to live here.
export { parseTeaser };

// The reception-archive tile: featured document with a facsimile rail. A
// single-page doc shows its lightweight thumbnail; a multi-page doc fills the
// rail with its page facsimiles (capped so a 17-page paper doesn't load 17
// full scans).
const RAIL_MAX = 4;
const pad4 = (n) => String(n).padStart(4, "0");
const pad3 = (n) => String(n).padStart(3, "0");

export default function HistoryTile({ data }) {
  if (!data) return null;
  const to = data.slug ? `/history/${data.slug}` : "/history";
  let images = [];
  if (data.id) {
    const pages = Number(data.pages) || 1;
    images = pages > 1
      ? Array.from({ length: Math.min(pages, RAIL_MAX) }, (_, i) =>
          `${assetUrl}/history/fax/${pad4(data.id)}.${pad3(i + 1)}.jpg`)
      : [`${assetUrl}/history/thumbs/${pad4(data.id)}`];
  }
  return <ArchiveDocTile data={data} heading={label("history")} to={to} images={images} />;
}
