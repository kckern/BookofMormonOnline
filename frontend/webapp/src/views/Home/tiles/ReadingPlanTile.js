import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { ReadingPlan } from "../ReadingPlan";

/**
 * Guest slot: a real reading-plan preview, not a bare sign-in box — the first
 * seeded program with a 0% progress bar (their journey, not yet started), the
 * one-line value prop, and Start Reading / Sign In entry points.
 */
function GuestPlanPreview() {
  const [program, setProgram] = useState(null);
  useEffect(() => {
    let c = false;
    BoMOnlineAPI({ readingplanprograms: null })
      .then((r) => { if (!c) setProgram(Object.values(r?.readingplanprograms || {})[0] || null); })
      .catch(() => {});
    return () => { c = true; };
  }, []);
  return (
    <div className="samplerTileInner valuePropTile">
      {program ? (
        <div className="guestPlanPreview">
          <div className="guestPlanTitle">{label("reading_plan")}: <b>{program.title}</b></div>
          <div className="guestPlanBar"><div style={{ width: "0%" }} /></div>
          <div className="guestPlanMeta">0% · {program.durationLabel}</div>
        </div>
      ) : null}
      <div className="valuePropText">{label("sampler_value_prop")}</div>
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
