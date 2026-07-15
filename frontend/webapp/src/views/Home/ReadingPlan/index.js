// Widget state machine: loading → none|active|completed|error (spec §Home widget).
// The server is authoritative for progress/current/status — this component does
// ZERO date math and ZERO progress arithmetic (fixes audit P0 #2/#3, P1 #6).
import React, { useCallback, useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { Card, CardBody, CardHeader, Button } from "reactstrap";
import loading from "../../_Common/svg/loadbar.svg";
import ActivePlan from "./ActivePlan";
import Gallery from "./Gallery";
import "./ReadingPlan.css";

export function ReadingPlan() {
  const appController = useAppController();
  const token = appController.states.user.token;
  const [state, setState] = useState({ phase: "loading", plan: null });

  const load = useCallback(() => {
    let cancelled = false;
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
  }, [token]);
  useEffect(() => load(), [load]);

  if (state.phase === "loading")
    return (
      <Card><CardHeader><h3>{label("reading_plan")}</h3></CardHeader>
        <CardBody className="spinnerBox"><img src={loading} alt="" style={{ height: "4rem" }} /></CardBody></Card>
    );
  if (state.phase === "error")
    return (
      <Card><CardBody className="rpError">
        <p>{label("rp_error_loading")}</p>
        <Button size="sm" onClick={load}>{label("rp_retry")}</Button>
      </CardBody></Card>
    );
  if (state.phase === "none") return <Gallery token={token} onStarted={load} />;
  if (state.phase === "completed")
    return (
      <Card><CardHeader><h3>{label("reading_plan")}: <span className="planName">{state.plan.title}</span></h3></CardHeader>
        <CardBody className="rpComplete">
          <p>🏆 {label("rp_plan_complete")}</p>
          <Button color="primary" size="sm" onClick={async () => {
            await BoMOnlineAPI({ endReadingPlan: { token, action: "COMPLETE" } });
            load();
          }}>{label("rp_start_another")}</Button>
        </CardBody></Card>
    );
  return <ActivePlan plan={state.plan} token={token} onChanged={load} />;
}
export default ReadingPlan;
