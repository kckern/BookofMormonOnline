import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { ReadingPlan } from "../ReadingPlan";

/**
 * Guest slot: the default program rendered as a REAL plan preview — its actual
 * segment cells (all not-started) via the server-side preview generator, plus
 * Start Reading / Sign In entry points. Structure over slogans.
 */
function GuestPlanPreview() {
  const [program, setProgram] = useState(null);
  const [segments, setSegments] = useState([]);
  useEffect(() => {
    let c = false;
    BoMOnlineAPI({ readingplanprograms: null })
      .then(async (r) => {
        const prog = Object.values(r?.readingplanprograms || {})[0] || null;
        if (c || !prog) return;
        setProgram(prog);
        const pv = await BoMOnlineAPI({ readingplanpreview: { config: prog.config } }, { useCache: false });
        const raw = pv?.readingplanpreview;
        // key:0 queries resolve to the object itself; array/keyed shapes are fallbacks.
        const p = raw?.segments || raw?.parts !== undefined ? raw
          : Array.isArray(raw) ? raw[0] : Object.values(raw || {})[0];
        if (!c) setSegments(p?.segments || []);
      })
      .catch((e) => console.warn("guestPlanPreview:", e?.message || e));
    return () => { c = true; };
  }, []);
  return (
    <div className="samplerTileInner valuePropTile">
      <h3 className="tileHeading">{label("reading_plan")}</h3>
      {program ? (
        <div className="guestPlanPreview">
          <div className="guestPlanTitle"><b>{program.title}</b></div>
          <div className="guestPlanMeta">0% · {program.durationLabel}</div>
          {segments.length ? (
            <div className="segmentList guestSegmentList">
              {segments.map((s, i) => (
                <div key={i} className="segmentListItem future notStarted" title={s.ref}>
                  {i + 1}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="valuePropCtas">
        <Link className="valuePropPrimary" to="/contents">{label("start_reading")}</Link>
        <Link className="valuePropSecondary" to="/user/signin">{label("sign_in")}</Link>
      </div>
    </div>
  );
}

export default function ReadingPlanTile() {
  const appController = useAppController();
  if (!appController?.states?.user?.user) return <GuestPlanPreview />;
  return (
    <div className="samplerTileInner readingPlanTile">
      <ReadingPlan />
    </div>
  );
}
