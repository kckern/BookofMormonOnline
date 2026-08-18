import React from "react";
import Breadcrumb from "./Breadcrumb/Breadcrumb";

/**
 * "Page › Section" study-location breadcrumb — the pattern used in the feed's
 * scripture panel, reused by the fax verse tooltip/modal. Thin adapter over the
 * shared <Breadcrumb> component (size="sm").
 *
 * Props:
 *  - page/section: { title, slug } (either may be null)
 *  - linked: render each part as a Link to `/{slug}` in the study view
 */
export default function StudyBreadcrumb({ page, section, linked = false, className = "" }) {
  if (!page?.title && !section?.title) return null;

  const items = [];
  const push = (ref) => {
    if (!ref?.title) return;
    items.push({ label: ref.title, to: linked && ref.slug ? `/${ref.slug}` : undefined });
  };
  push(page);
  push(section);

  return <Breadcrumb size="sm" items={items} className={`studyBreadcrumb ${className}`.trim()} />;
}
