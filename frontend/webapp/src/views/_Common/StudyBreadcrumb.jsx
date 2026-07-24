import React from "react";
import { Link } from "react-router-dom";

/**
 * "Page ▸ Section" study-location breadcrumb — the pattern used in the feed's
 * scripture panel (StudyInFeed: `parent_page.title ▸ parent_section.title`),
 * abstracted so the fax verse tooltip/modal can reuse it.
 *
 * Props:
 *  - page/section: { title, slug } (either may be null)
 *  - linked: render each part as a Link to `/{slug}` in the study view
 */
export default function StudyBreadcrumb({ page, section, linked = false, className = "" }) {
  if (!page?.title && !section?.title) return null;

  const part = (ref, cls) => {
    if (!ref?.title) return null;
    if (linked && ref.slug) return <Link className={cls} to={`/${ref.slug}`}>{ref.title}</Link>;
    return <span className={cls}>{ref.title}</span>;
  };

  const p = part(page, "sb-page");
  const s = part(section, "sb-section");
  return (
    <span className={`studyBreadcrumb ${className}`.trim()}>
      {p}
      {p && s ? <span className="sb-sep"> ▸ </span> : null}
      {s}
    </span>
  );
}
