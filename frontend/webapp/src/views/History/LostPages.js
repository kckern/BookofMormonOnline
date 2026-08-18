/** @format */
import React from "react";
import HistoryArchiveFeed from "./HistoryArchiveFeed";

// Live view for the 'lost-116-pages' history archive — the lost Book of Lehi
// manuscript and the documents that describe it. Thin wrapper over the
// archive-generic feed, exactly like TranslationSources.jsx.
export default function LostPages() {
  return <HistoryArchiveFeed archive="lost-116-pages" sectionKey="lostPages" />;
}
