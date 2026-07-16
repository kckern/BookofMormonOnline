import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { label } from "src/models/Utils";
import green from "src/views/User/svg/green.svg";
import yellow from "src/views/User/svg/yellow.svg";
import blue from "src/views/User/svg/blue.svg";
import blank from "src/views/User/svg/blank.svg";

/**
 * Reading-progress view of the top-left slot. When the user (guest or signed
 * in) has ANY reading progress, we replace the plan/calendar with their most
 * recently-touched page rendered as green/yellow/blank dots — the same idea as
 * the /user Progress page — to show "you already have some green, keep going".
 *
 * Data: divisionProgress (all divisions, with per-token progress) picks the
 * in-progress division; divisionProgressDetails fills in the page section dots.
 */
export default function ReadingProgressTile({ token, divisions }) {
  const [page, setPage] = useState(null);
  const [division, setDivision] = useState(null);

  useEffect(() => {
    // The "current" division = the one with progress underway (started > 0 and
    // not yet complete), most-started first; fall back to the most-completed.
    const withProgress = (divisions || []).filter((d) => d?.progress);
    const inProgress = withProgress
      .filter((d) => (d.progress.started || 0) > 0 && (d.progress.completed || 0) < 100)
      .sort((a, b) => (b.progress.started || 0) - (a.progress.started || 0));
    const target = inProgress[0]
      || withProgress.filter((d) => (d.progress.completed || 0) > 0).sort((a, b) => (b.progress.completed || 0) - (a.progress.completed || 0))[0];
    if (!target) return undefined;
    setDivision(target);
    let cancelled = false;
    BoMOnlineAPI({ divisionProgressDetails: target.slug }, { token, useCache: false })
      .then((r) => {
        if (cancelled) return;
        const det = r?.divisionProgressDetails?.[target.slug] || (r?.divisionProgressDetails && Object.values(r.divisionProgressDetails)[0]);
        const pages = (det?.pages || []).filter((p) => p?.progress);
        // most recent page = the one with active items, else the last page
        // carrying any started/completed items.
        const active = pages.find((p) => (p.progress.active_items || []).length);
        const touched = [...pages].reverse().find(
          (p) => (p.progress.completed_items || []).length || (p.progress.started_items || []).length,
        );
        if (!cancelled) setPage(active || touched || pages[0] || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [divisions, token]);

  if (!page) return null;
  const { completed_items = [], started_items = [], active_items = [] } = page.progress || {};
  const dotFor = (link, heading) => {
    if (!heading) return blank;
    if (completed_items.includes(link)) return green;
    if (active_items.includes(link)) return blue;
    if (started_items.includes(link)) return yellow;
    return blank;
  };
  const pct = page.progress?.completed ?? 0;
  return (
    <div className="samplerTileInner readingProgressTile">
      <h3 className="tileHeading">
        <Link to="/user">{label("reading_progress")}</Link>
      </h3>
      <div className="rpTilePageRow">
        <Link to={`/${page.slug}`} className="rpTilePageTitle">{page.title}</Link>
        {pct > 0 ? <span className="rpTilePagePct">{pct}%</span> : null}
      </div>
      {division?.title ? <div className="rpTileDivision">{division.title}</div> : null}
      <div className="rpTileDots">
        {(page.sections || []).map((section, si) => (
          <span key={section.slug || si} className="rpTileSectionDots">
            {(section.sectionText || []).map((item, i) => {
              const dot = dotFor(item.link, item.heading);
              if (!item.heading) return <img key={i} src={dot} alt="" className="rpTileDot blank" />;
              return (
                <Link key={i} to={`/${page.slug}/${item.link}`} title={`${section.title} — ${item.heading}`}>
                  <img src={dot} alt="" className="rpTileDot" />
                </Link>
              );
            })}
          </span>
        ))}
      </div>
      <Link to="/user" className="rpTileMore tileMoreLink">{label("view_more")}</Link>
    </div>
  );
}
