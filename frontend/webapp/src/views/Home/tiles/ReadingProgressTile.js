import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { label } from "src/models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import UserAvatar from "src/components/UserAvatar";
import { ProgressDetailsCircles, ProgressBar } from "src/views/User/ProgressBox";
import "src/views/User/ProgressBox.css";

/**
 * Reading-progress view of the top-left slot. When the user (guest or signed
 * in) has a reading bookmark, we replace the plan/calendar with their most
 * recently-read page — rendered with the EXACT same design as the /user
 * Progress page so it reads identically: avatar + name header, then the page
 * in a gray section box with its % badge, section-grouped 1.2rem circles
 * (green/blue/yellow/blank), and section dividers.
 *
 * We reuse `ProgressDetailsCircles` verbatim (fed a single page) and import
 * ProgressBox.css so the circle size, spacing, and layout match pixel-for-
 * pixel — no divergent markup to drift.
 */
export default function ReadingProgressTile({ token, bookmark }) {
  const appController = useAppController();
  const social = appController?.states?.user?.social;
  const name = social?.nickname || label("guest");
  const userId = appController?.states?.user?.user;
  const profileUrl = social?.profile_url;

  // Overall study progress (whole Book of Mormon), same source the sidebar and
  // /user Progress header read from — distinct from this one page's %.
  const overall = appController?.states?.user?.progress || {};
  const overallCompleted = overall.completed > 0 ? overall.completed : 0;
  const overallStarted = overall.started > 0 ? overall.started : 0;

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

  // Shape the single fetched page into what ProgressDetailsCircles expects
  // (pages[] each with slug/title/progress/sections). Same component the /user
  // page renders, so the output is identical.
  const pages = page?.progress
    ? [{ slug: pageSlug, title: bookmark.pagetitle, progress: page.progress, sections: page.sections || [] }]
    : [];

  return (
    <div className="samplerTileInner readingProgressTile">
      <h3 className="tileHeading">
        <Link to="/user">{label("reading_progress")}</Link>
      </h3>
      <div className="rpUserRow">
        <UserAvatar userId={userId} profileUrl={profileUrl} size={30} className="rpUserAvatar" />
        <span className="rpUserName">{name}</span>
        <div className="rpUserProgress" title={`${overallCompleted.toFixed(1)}% ${label("completed")} • ${overallStarted.toFixed(1)}% ${label("started")}`}>
          <ProgressBar complete={overallCompleted} started={overallStarted} />
        </div>
      </div>
      <div className="ProgressBoxPane rpBoxPane">
        {pages.length ? <ProgressDetailsCircles progressPages={{ pages }} /> : null}
      </div>
    </div>
  );
}
