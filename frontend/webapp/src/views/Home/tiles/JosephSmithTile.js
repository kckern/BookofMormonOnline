import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import ArchiveDocTile from "./ArchiveDocTile";

// Joseph-Smith-statements tile — the portrait (these docs have no thumbnail),
// links to the witnesses-format page.
export default function JosephSmithTile({ data }) {
  return (
    <ArchiveDocTile
      data={data}
      heading="Joseph Smith"
      to="/history/joseph-smith"
      image={`${assetUrl}/history/witnesses/people/joseph-smith.jpg`}
    />
  );
}
