import React, { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { Card, CardBody, CardHeader, Button } from "reactstrap";
import { toast } from "react-toastify";
import { label } from "src/models/Utils";
import Wizard from "./Wizard";

export default function Gallery({ token, onStarted }) {
  const [programs, setPrograms] = useState(null);
  const [picked, setPicked] = useState(null);
  const [credit, setCredit] = useState("fresh");
  const [startdate, setStartdate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    let c = false;
    BoMOnlineAPI({ readingplanprograms: null }, { useCache: false })
      .then((r) => { if (!c) setPrograms(Object.values(r?.readingplanprograms || {})); })
      .catch(() => { if (!c) setPrograms([]); });
    return () => { c = true; };
  }, []);

  const start = async () => {
    setBusy(true);
    let res;
    try {
      const r = await BoMOnlineAPI({ startReadingPlan: { token, programSlug: picked.slug, startdate, credit } });
      res = r?.startReadingPlan;
    } catch { res = null; }
    setBusy(false);
    if (res?.isSuccess) return onStarted();
    toast.error(res?.msg === "ACTIVE_PLAN_EXISTS" ? label("rp_active_exists") : label("rp_error_loading"));
  };

  return (
    <Card className="noselect">
      <CardHeader><h3>{label("rp_start_a_plan")}</h3></CardHeader>
      <CardBody>
        {!picked && (
          <>
            <div className="programGallery">
              {(programs || []).map((p) => (
                <div className="programCard" key={p.slug} role="button" tabIndex={0}
                  onClick={() => setPicked(p)} onKeyDown={(e) => e.key === "Enter" && setPicked(p)}>
                  <h5>{p.title}</h5><p>{p.description}</p><div className="duration">{p.durationLabel}</div>
                </div>
              ))}
            </div>
            <div className="buttonRow" style={{ marginTop: "1em" }}>
              <Button color="secondary" size="sm" onClick={() => setWizardOpen(true)}>{label("rp_build_your_own")}</Button>
            </div>
          </>
        )}
        {picked && (
          <div className="programConfirm">
            <h5>{picked.title}</h5>
            <div><label>{label("rp_start_date")}{" "}
              <input type="date" value={startdate} onChange={(e) => setStartdate(e.target.value)} /></label></div>
            <div><label><input type="checkbox" checked={credit === "alltime"}
              onChange={(e) => setCredit(e.target.checked ? "alltime" : "fresh")} />{" "}
              {label("rp_count_past_reading")}</label></div>
            <div className="buttonRow" style={{ marginTop: "1em" }}>
              <Button color="secondary" size="sm" onClick={() => setPicked(null)}>{label("rp_back")}</Button>
              <Button color="primary" size="sm" disabled={busy} onClick={start}>
                {label(busy ? "rp_starting" : "rp_start_plan")}</Button>
            </div>
          </div>
        )}
        {wizardOpen && <Wizard token={token} onClose={() => setWizardOpen(false)} onStarted={onStarted} />}
      </CardBody>
    </Card>
  );
}
