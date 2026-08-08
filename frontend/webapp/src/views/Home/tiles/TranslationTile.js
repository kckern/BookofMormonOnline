import React from "react";
import ArchiveDocTile from "./ArchiveDocTile";

// Translation-archive tile — no image (per direction), links to the feed.
export default function TranslationTile({ data }) {
  return <ArchiveDocTile data={data} heading="Translation" to="/history/translation" images={[]} />;
}
