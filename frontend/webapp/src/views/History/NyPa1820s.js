/** @format */
import React from "react";
import HistoryArchiveFeed from "./HistoryArchiveFeed";

// The 1820s-ny-pa archive: primary sources on Joseph Smith's
// activities and whereabouts in New York and Pennsylvania, to April 1830.
// Grouped by place rather than by date — the sources run 1829 to the 1930s
// while the period they describe is 1820–1830.
// Spec: docs/specs/2026-08-18-1820s-ny-pa-archive.md
export default function NyPa1820s() {
  return (
    <HistoryArchiveFeed archive="1820s-ny-pa" sectionKey="nyPa1820s" groupBy="place" />
  );
}
