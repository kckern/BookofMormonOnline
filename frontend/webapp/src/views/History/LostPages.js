/** @format */
import React from "react";
import HistoryArchiveFeed from "./HistoryArchiveFeed";

// The lost-116-pages archive: primary sources on what the lost manuscript
// contained. Grouped by narrative in manuscript order rather than by date —
// the sources span 1829–1924 but all describe events around 600 BC.
// Spec: docs/specs/2026-08-18-lost-116-pages-archive.md
export default function LostPages() {
  return (
    <HistoryArchiveFeed archive="lost-116-pages" sectionKey="lostPages" groupBy="narrative" />
  );
}
