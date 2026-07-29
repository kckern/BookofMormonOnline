/** @format */
import React, { useEffect } from "react";
import HistoryBreadcrumb from "./HistoryBreadcrumb";
import { label } from "../../models/Utils";

export default function TranslationSources() {
  useEffect(() => {
    document.title = "Translation Sources | " + label("home_title");
  }, []);
  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page">
        <HistoryBreadcrumb sectionKey="translation" />
        <h3 className="title lg-4 text-center">Translation Sources</h3>
        <div className="historyComingSoon">Coming soon.</div>
      </div>
    </div>
  );
}
