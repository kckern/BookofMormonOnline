import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { label } from "src/models/Utils";
import RefPill from "./RefPill";
import green from "src/views/User/svg/green.svg";
import yellow from "src/views/User/svg/yellow.svg";
import blue from "src/views/User/svg/blue.svg";
import blank from "src/views/User/svg/blank.svg";

/**
 * Reading-progress view of the top-left slot. When the user (guest or signed
 * in) has a reading bookmark, we replace the plan/calendar with their most
 * recently-read page shown as green/blue/gray dots — same idea as the /user
 * Progress page ("you already have some green, keep going").
 *
 * Data: the page's sections (sectionText) + progress(token) — an item is green
 * when completed, blue when active, yellow when started, else gray. Dots group
 * by section, matching the /user experience.
 */
export default function ReadingProgressTile({ token, bookmark }) {
  const [page, setPage] = useState(null);
  const pageSlug = bookmark?.pageSlug;

  useEffect(() => {
    if (!pageSlug) return undefined;
    let cancelled = false;
    BoMOnlineAPI({ pageinfoprogress: [{ slug: [pageSlug], token }] }, { token, useCache: false })
      .then((r) => {
        if (cancelled) return;
        // key:0 query types unwrap inconsistently (direct object, array, or a
        // slug-keyed map) — hunt for the object that actually has sections.
        const raw = r?.pageinfoprogress;
        const candidates = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? [raw, ...Object.values(raw)] : []);
        const pg = candidates.find((x) => x && typeof x === "object" && Array.isArray(x.sections));
        setPage(pg || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pageSlug, token]);

  if (!bookmark?.pageSlug) return null;
  const prog = page?.progress || {};
  const completed = prog.completed_items || [];
  const started = prog.started_items || [];
  const active = prog.active_items || [];
  const dotFor = (link, heading) => {
    if (!heading) return blank;
    if (completed.includes(link)) return green;
    if (active.includes(link)) return blue;
    if (started.includes(link)) return yellow;
    return blank;
  };
  const pct = Math.round(prog.completed ?? 0);
  const sections = (page?.sections || []).filter((s) => (s.sectionText || []).length);
  return (
    <div className="samplerTileInner readingProgressTile">
      <h3 className="tileHeading">
        <Link to="/user">{label("reading_progress")}</Link>
      </h3>
      <div className="rpTilePageRow">
        <Link to={`/${bookmark.slug}`} className="rpTilePageTitle">{bookmark.pagetitle}</Link>
        {pct > 0 ? <span className="rpTilePagePct">{pct}%</span> : null}
      </div>
      {bookmark.heading ? <div className="rpTileRef"><RefPill refText={bookmark.heading} /></div> : null}
      {sections.length ? (
        <div className="rpTileDots">
          {sections.map((section, si) => (
            <span key={si} className="rpTileSectionDots" title={section.title}>
              {(section.sectionText || []).map((item, i) => {
                const src = dotFor(item.link, item.heading);
                if (!item.heading) return <img key={i} src={src} alt="" className="rpTileDot blank" />;
                return (
                  <Link key={i} to={`/${pageSlug}/${item.link}`} title={`${section.title || ""} — ${item.heading}`}>
                    <img src={src} alt="" className={`rpTileDot${src === blank ? " blank" : ""}`} />
                  </Link>
                );
              })}
            </span>
          ))}
        </div>
      ) : null}
      <Link to={`/${bookmark.slug}`} className="rpTileMore tileMoreLink">{label("continue_reading")}</Link>
    </div>
  );
}
