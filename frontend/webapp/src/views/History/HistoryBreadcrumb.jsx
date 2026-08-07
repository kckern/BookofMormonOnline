/** @format */
import React from "react";
import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";
import { getSection } from "./sections";

/** History › [section]. "History" links back to the hub at /history. */
export default function HistoryBreadcrumb({ sectionKey }) {
  const section = getSection(sectionKey);
  return (
    <Breadcrumb
      items={[
        { label: "History", to: "/history" },
        { label: section ? section.title : "", current: true },
      ]}
    />
  );
}
