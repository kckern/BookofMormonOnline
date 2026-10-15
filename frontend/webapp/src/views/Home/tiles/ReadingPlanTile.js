import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { ReadingPlan } from "../ReadingPlan";
import ReadingProgressTile from "./ReadingProgressTile";
import { readPlanPreview, loadPlanPreview } from "./planPreviewCache";

// Until the default program's preview lands (cold load only — it's cached
// after that), reserve the grid at its final size: the default program is 52
// weekly segments, and not-started bubbles are just numbered, so placeholders
// look identical to the real grid and nothing below the tile moves.
const PLACEHOLDER_SEGMENTS = Array.from({ length: 52 }, () => ({}));
const NBSP = "\u00a0";

/** The default program preview: cached synchronously, else fetched once. */
function usePlanPreview(enabled = true) {
  const [preview, setPreview] = useState(readPlanPreview);
  useEffect(() => {
    if (!enabled || preview) return undefined;
    let cancelled = false;
    loadPlanPreview().then((p) => { if (!cancelled && p) setPreview(p); });
    return () => { cancelled = true; };
  }, [enabled, preview]);
  return preview;
}

/**
 * Compact bubble preview — the ONLY look this tile ever shows by default:
 * a title row (name + progress), then the segment cells as gray bubbles.
 * Shared by the guest slot and the signed-in slot so both read identically.
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
        {segments.length ? (
          <div className="segmentList guestSegmentList">
            {segments.map((s, i) => (
              <div
                key={s.guid || i}
                className={`segmentListItem ${s.timeClass || "future"} ${s.statusClass || "notStarted"}`}
                title={s.ref}
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
 * Guest slot: the default program as a real preview (all not-started bubbles)
 * plus Start Reading / Sign In. Structure over slogans.
 */
function GuestPlanPreview() {
  const preview = usePlanPreview();
  return (
    <PlanBubbles
      title={preview?.title || NBSP}
      meta={preview ? `0% · ${preview.durationLabel}` : NBSP}
      segments={preview?.segments || PLACEHOLDER_SEGMENTS}
      ctas={
        <>
          <Link className="valuePropPrimary" to="/contents">{label("start_reading")}</Link>
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
 * is one click away, never the resting state — the home tile is a glanceable
 * status widget, not a menu.
 */
function SignedInPlanTile({ token }) {
  const [state, setState] = useState({ phase: "loading", plan: null });
  const [chooser, setChooser] = useState(false);

  const load = () => {
    let cancelled = false;
    setChooser(false);
    setState({ phase: "loading", plan: null });
    BoMOnlineAPI({ readingplan: { token } }, { useCache: false })
      .then((r) => {
        if (cancelled) return;
        const raw = r?.readingplan;
        const plan = Array.isArray(raw) ? raw[0] : (raw && typeof raw === "object" ? Object.values(raw)[0] : null);
        if (!plan || !plan.slug) setState({ phase: "none", plan: null });
        else setState({ phase: plan.status === "completed" ? "completed" : "active", plan });
      })
      .catch(() => { if (!cancelled) setState({ phase: "error", plan: null }); });
    return () => { cancelled = true; };
  };
  useEffect(load, [token]);

  // No active plan → the default program's preview bubbles (like guest).
  const preview = usePlanPreview(state.phase === "none" || state.phase === "error");

  // The chooser (Gallery/Wizard) — only when the user asks for it.
  if (chooser)
    return (
      <div className="samplerTileInner readingPlanTile">
        <ReadingPlan />
      </div>
    );

  if (state.phase === "loading") return <div className="samplerTileInner valuePropTile" />;

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
          <button className="valuePropPrimary" onClick={() => setChooser(true)}>
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
      segments={preview?.segments || PLACEHOLDER_SEGMENTS}
      ctas={
        <button className="valuePropPrimary" onClick={() => setChooser(true)}>
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
    BoMOnlineAPI({ mybookmark: token }, { token, useCache: false })
      .then((r) => {
        if (cancelled) return;
        const raw = r?.mybookmark;
        const bm = raw?.pageSlug ? raw : (raw && typeof raw === "object" ? Object.values(raw)[0] : null);
        setBookmark(bm?.pageSlug ? bm : null);
      })
      .catch(() => { if (!cancelled) setBookmark(null); });
    return () => { cancelled = true; };
  }, [token]);

  if (bookmark) return <ReadingProgressTile token={token} bookmark={bookmark} />;
  // still checking or none → the plan/guest variant
  if (!signedIn) return <GuestPlanPreview />;
  return <SignedInPlanTile token={token} />;
}
