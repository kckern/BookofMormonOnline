import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { readPath } from "src/views/_Common/ScriptureExcerpt";
import { ReadingPlan } from "../ReadingPlan";
import ReadingProgressTile from "./ReadingProgressTile";
import { readPlanPreview, loadPlanPreview } from "./planPreviewCache";
import labelOr from "./_ds/labelOr";

// Until the default program's preview lands (cold load only — it's cached
// after that), reserve the grid at its final size: the default program is 52
// weekly segments, and not-started bubbles are just numbered, so placeholders
// look identical to the real grid and nothing below the tile moves.
const PLACEHOLDER_SEGMENTS = Array.from({ length: 52 }, () => ({}));
const NBSP = "\u00a0";
// Where "Start reading" goes when the plan's first segment is unknown (the
// preview failed): the first chapter — the default program starts there.
const START_FALLBACK = "/read/1-nephi-1";

/** The first segment's opening chapter in the reader ("1 Nephi 1 - …" → /read/1-nephi-1). */
export const planStartPath = (preview) => readPath(preview?.segments?.[0]?.ref) || START_FALLBACK;

/**
 * The default program preview: cached synchronously, else fetched once.
 * `failed` = the fetch resolved without a preview (network/backend failure or
 * no program) — the caller drops the bubble grid instead of showing
 * placeholders forever.
 */
function usePlanPreview(enabled = true) {
  const [preview, setPreview] = useState(readPlanPreview);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || preview) return undefined;
    let cancelled = false;
    loadPlanPreview().then((p) => {
      if (cancelled) return;
      if (p?.segments?.length) setPreview(p);
      else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [enabled, preview]);
  return { preview, failed };
}

/**
 * Compact bubble preview — the ONLY look this tile ever shows by default:
 * a title row (name + progress), then the segment cells as bubbles.
 * Shared by the guest slot and the signed-in slot so both read identically.
 *
 * The bubbles are a status picture, not controls: no handlers, no pointer
 * cursor (tile-scoped CSS), hidden from assistive tech — the title row's meta
 * ("0% · 52 weeks") carries the same information as text. The CTAs below are
 * the tile's only interactive elements.
 */
function PlanBubbles({ title, meta, segments, ctas }) {
  return (
    <div className="samplerTileInner valuePropTile">
      <h3 className="tileHeading">{label("reading_plan")}</h3>
      <div className="guestPlanPreview">
        <div className="guestPlanTitleRow">
          <b className="guestPlanTitle">{title}</b>
          {meta ? <span className="guestPlanMeta">{meta}</span> : null}
        </div>
        {segments?.length ? (
          <div className="segmentList guestSegmentList" aria-hidden="true">
            {segments.map((s, i) => (
              <div
                key={s.guid || i}
                className={`segmentListItem ${s.timeClass || "future"} ${s.statusClass || "notStarted"}`}
                title={s.ref || undefined}
              >
                {s.pct ? `${s.pct}%` : i + 1}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {ctas ? <div className="valuePropCtas">{ctas}</div> : null}
    </div>
  );
}

/**
 * Neutral placeholder while we don't yet know WHICH variant this slot shows
 * (bookmark → progress view; otherwise the plan). It lays out an invisible
 * copy of the plan tile (heading, title row, the 52-cell grid, a CTA row), so
 * it takes the plan tile's exact footprint at every width — but shows no
 * heading, bubbles or CTA that a different variant would then replace.
 */
function PendingPlanTile() {
  return (
    <div className="samplerTileInner valuePropTile readingPlanPending" aria-busy="true">
      <div className="tileHeading" aria-hidden="true">{NBSP}</div>
      <div className="guestPlanPreview" aria-hidden="true">
        <div className="guestPlanTitleRow"><b className="guestPlanTitle">{NBSP}</b></div>
        <div className="segmentList guestSegmentList">
          {PLACEHOLDER_SEGMENTS.map((_, i) => <div key={i} className="segmentListItem future notStarted" />)}
        </div>
      </div>
      <div className="valuePropCtas" aria-hidden="true"><span className="valuePropPrimary">{NBSP}</span></div>
    </div>
  );
}

/** Week 1 is where a new reader starts: mark it as the current cell. */
const guestSegments = (preview) =>
  (preview?.segments || PLACEHOLDER_SEGMENTS).map((s, i) => (i === 0 ? { ...s, timeClass: "current" } : s));

/**
 * Guest slot: the default program as a real preview (all not-started bubbles,
 * week 1 marked) plus Start reading (→ week 1's opening chapter) / Sign in.
 * If the preview can't load, the heading + CTAs stand alone (no empty grid).
 */
function GuestPlanPreview() {
  const { preview, failed } = usePlanPreview();
  return (
    <PlanBubbles
      title={preview?.title || (failed ? label("reading_plan") : NBSP)}
      meta={preview ? `0% · ${preview.durationLabel}` : failed ? null : NBSP}
      segments={failed ? null : guestSegments(preview)}
      ctas={
        <>
          <Link className="valuePropPrimary" to={planStartPath(preview)}>{label("start_reading")}</Link>
          <Link className="valuePropSecondary" to="/home/user/signin">{label("sign_in")}</Link>
        </>
      }
    />
  );
}

/**
 * Signed-in slot. Default view is ALWAYS the compact bubbles — an active plan
 * shows its real progress; no active plan shows the default program's preview
 * bubbles with a "choose a plan" action. The full chooser/wizard (the Gallery)
 * is one click away, never the resting state, and it carries a Close that
 * returns to the bubbles (re-reading the plan, in case one was just started)
 * with focus back on the button that opened it.
 */
function SignedInPlanTile({ token }) {
  const [state, setState] = useState({ phase: "loading", plan: null });
  const [chooser, setChooser] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const openerRef = useRef(null);
  const closeRef = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // a reload after closing the chooser keeps the current view (no flash)
    if (reloadKey === 0) setState({ phase: "loading", plan: null });
    BoMOnlineAPI({ readingplan: { token } }, { useCache: false })
      .then((r) => {
        if (cancelled) return;
        const raw = r?.readingplan;
        const plan = Array.isArray(raw) ? raw[0] : (raw && typeof raw === "object" ? Object.values(raw)[0] : null);
        if (!plan || !plan.slug) setState({ phase: "none", plan: null });
        else setState({ phase: plan.status === "completed" ? "completed" : "active", plan });
      })
      .catch(() => { if (!cancelled) setState((s) => (s.phase === "loading" ? { phase: "error", plan: null } : s)); });
    return () => { cancelled = true; };
  }, [token, reloadKey]);

  // focus: into the chooser on open, back to its opener on close
  useEffect(() => {
    if (chooser) closeRef.current?.focus();
    else if (wasOpen.current) openerRef.current?.focus();
    wasOpen.current = chooser;
  }, [chooser]);

  // No active plan → the default program's preview bubbles (like guest).
  const { preview, failed } = usePlanPreview(state.phase === "none" || state.phase === "error");

  const closeChooser = () => {
    setChooser(false);
    setReloadKey((k) => k + 1);
  };

  // The chooser (Gallery/Wizard) — only when the user asks for it.
  if (chooser)
    return (
      <div className="samplerTileInner readingPlanTile">
        <div className="readingPlanChooserBar">
          <button type="button" ref={closeRef} className="readingPlanClose" onClick={closeChooser}>
            {labelOr("close", "Close")}
          </button>
        </div>
        <ReadingPlan />
      </div>
    );

  if (state.phase === "loading") return <PendingPlanTile />;

  if (state.phase === "active" || state.phase === "completed") {
    const plan = state.plan;
    const segments = (plan.segments || []).map((seg, i) => {
      const pct = parseInt(seg.progress, 10) || 0;
      return {
        guid: seg.guid,
        ref: `${seg.period ? seg.period + " • " : ""}${seg.ref}`,
        pct,
        statusClass: pct === 100 ? "complete" : pct > 0 ? "inProgress" : "notStarted",
        timeClass: i < (plan.current || 0) ? "past" : i === (plan.current || 0) ? "current" : "future",
      };
    });
    return (
      <PlanBubbles
        title={plan.title}
        meta={`${plan.progress || 0}%`}
        segments={segments}
        ctas={
          <button type="button" ref={openerRef} className="valuePropPrimary" onClick={() => setChooser(true)}>
            {label("rp_manage_plan")}
          </button>
        }
      />
    );
  }

  // phase "none" (or error): default program bubbles + choose-a-plan action.
  return (
    <PlanBubbles
      title={preview?.title || label("reading_plan")}
      meta={preview ? `0% · ${preview.durationLabel}` : null}
      segments={failed ? null : guestSegments(preview)}
      ctas={
        <button type="button" ref={openerRef} className="valuePropPrimary" onClick={() => setChooser(true)}>
          {label("start_reading")}
        </button>
      }
    />
  );
}

export default function ReadingPlanTile() {
  const appController = useAppController();
  const token = appController.states.user.token;
  const signedIn = !!appController?.states?.user?.user;
  // Progress trumps the plan: guest OR signed-in, if there's a reading bookmark
  // (a recent reading position), show the "Reading Progress" view (recent page
  // + green dots) instead of the plan/calendar.
  const [bookmark, setBookmark] = useState(undefined); // undefined=loading, null=none
  useEffect(() => {
    let cancelled = false;
    // warm the plan preview in parallel with the bookmark check, so the plan
    // variant paints as soon as we know it's the one to show
    if (!signedIn) loadPlanPreview();
    BoMOnlineAPI({ mybookmark: token }, { token, useCache: false })
      .then((r) => {
        if (cancelled) return;
        const raw = r?.mybookmark;
        const bm = raw?.pageSlug ? raw : (raw && typeof raw === "object" ? Object.values(raw)[0] : null);
        setBookmark(bm?.pageSlug ? bm : null);
      })
      .catch(() => { if (!cancelled) setBookmark(null); });
    return () => { cancelled = true; };
  }, [token, signedIn]);

  // Still checking: a neutral, same-footprint placeholder — never one variant
  // that gets swapped for another after first paint.
  if (bookmark === undefined) return <PendingPlanTile />;
  if (bookmark) return <ReadingProgressTile token={token} bookmark={bookmark} />;
  if (!signedIn) return <GuestPlanPreview />;
  return <SignedInPlanTile token={token} />;
}
