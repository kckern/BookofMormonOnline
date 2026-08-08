import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ArchiveDocTile, { parseTeaser } from "./ArchiveDocTile";

// Backward-compat: parseTeaser used to live here.
export { parseTeaser };

// The reception-archive tile: featured document with its facsimile thumbnail.
export default function HistoryTile({ data }) {
  if (!data) return null;
  const to = data.slug ? `/history/${data.slug}` : "/history";
  const image = data.id ? `${assetUrl}/history/thumbs/${String(data.id).padStart(4, "0")}` : null;
  return <ArchiveDocTile data={data} heading={label("history")} to={to} image={image} />;
}
