// Active-plan renderer. Ported from the legacy ReadingPlan.js markup/classes,
// on the new server contract: plan.current picks the segment, plan.progress is
// authoritative (no local date math), resume matches "completed" (fixes P0 #4).
import React, { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { Link } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import { Card, CardHeader, CardBody, CardFooter, Button, Badge } from "reactstrap";
import SweetAlert from "react-bootstrap-sweetalert";
import { label } from "src/models/Utils";
import green from "../../User/svg/green.svg";
import yellow from "../../User/svg/yellow.svg";
import blank from "../../User/svg/blank.svg";
import theater from "../../_Common/svg/theater.svg";
import study from "../../_Common/svg/study.svg";
import loading from "../../_Common/svg/loadbar.svg";

function statusOf(plan) {
  const p = parseInt(plan.progress, 10) || 0;
  const selfPaced = !plan.segments.some((s) => !!s.duedate);
  if (selfPaced) return { label: `${p}%`, labelClass: p > 0 ? "green" : "gray" };
  if (p > 95) return { label: label("status_ontrack"), labelClass: "green" };
  if (p === 0) return { label: label("status_notstarted"), labelClass: "gray" };
  if (p > 50) return { label: label("status_catchingup"), labelClass: "yellow" };
  return { label: label("status_fallenbehind"), labelClass: "red" };
}

export default function ActivePlan({ plan, token, onChanged }) {
  const [activeSegment, setActiveSegment] = useState(plan.current || 0);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  useEffect(() => setActiveSegment(plan.current || 0), [plan.slug, plan.current]);
  const { label: statusLabel, labelClass } = statusOf(plan);
  const segment = plan.segments[activeSegment] || null;

  const abandon = async () => {
    setConfirmAbandon(false);
    await BoMOnlineAPI({ endReadingPlan: { token, action: "ABANDON" } });
    onChanged();
  };

  return (
    <Card className="noselect">
      <CardHeader>
        <h3>{label("reading_plan")}: <span className="planName">{plan.title}</span>
          <span className="rpAbandon" role="button" tabIndex={0} title={label("rp_abandon_plan")}
            onClick={() => setConfirmAbandon(true)}
            onKeyDown={(e) => e.key === "Enter" && setConfirmAbandon(true)}>×</span></h3>
        <div className="readingplan progressContainer">
          <div><Badge className={labelClass}>{statusLabel}</Badge></div>
          <div className="readingplan progress">
            <div style={{ width: `${plan.progress || 0}%` }} className={`progress-bar ${labelClass}`}> </div>
            <span>{plan.progress || 0}%</span>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <ReactTooltip place="top" effect="solid" id="segmentTips" />
        <div className="segmentList">
          {plan.segments.map((seg, i) => {
            const p = parseInt(seg.progress, 10) || 0;
            const statusClass = p === 100 ? "complete" : p > 0 ? "inProgress" : "notStarted";
            const timeClass = i < (plan.current || 0) ? "past" : i === (plan.current || 0) ? "current" : "future";
            return (
              <div key={seg.guid} role="button" tabIndex={0}
                data-for="segmentTips" data-tip={`${seg.period || ""} • ${seg.ref}`}
                className={`segmentListItem ${timeClass} ${statusClass} ${activeSegment === i ? "active" : ""}`}
                onClick={() => setActiveSegment(i)}
                onKeyDown={(e) => e.key === "Enter" && setActiveSegment(i)}>
                {p ? `${p}%` : i + 1}
              </div>
            );
          })}
        </div>
      </CardBody>
      <CardFooter>
        {segment && <SegmentDetail segment={segment} token={token} />}
      </CardFooter>
      <SweetAlert customClass="custom-alert" show={confirmAbandon} title={label("rp_abandon_plan")}
        onConfirm={abandon} onCancel={() => setConfirmAbandon(false)}
        confirmBtnBsStyle="danger" confirmBtnText={label("rp_abandon_plan")} cancelBtnText={label("cancel")} showCancel btnSize="">
        {label("rp_abandon_confirm")}
      </SweetAlert>
    </Card>
  );
}

function SegmentDetail({ segment, token }) {
  const [sectionData, setSectionData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setSectionData(null);
    BoMOnlineAPI({ readingplansegment: { token, guid: segment.guid } }, { useCache: false })
      .then((d) => {
        if (cancelled) return;
        const raw = d?.readingplansegment;
        setSectionData((Array.isArray(raw) ? raw[0] : (raw && Object.values(raw)[0])) || { sections: [] });
      })
      .catch(() => { if (!cancelled) setSectionData({ sections: [] }); });
    return () => { cancelled = true; };
  }, [segment.guid, token]);
  if (!sectionData) return <div className="spinnerBox"><img src={loading} alt="" /></div>;

  const flat = (sectionData.sections || []).flatMap((s) => s.sectionText || []);
  const studySlug = (flat.find((i) => i.status !== "completed") || flat[0])?.slug;
  const title = segment.title ? `${segment.ref} • ${segment.title}` : segment.ref;

  return (
    <div className="segment">
      <h4>{segment.period ? <span className="period">{segment.period}</span> : null}{title}</h4>
      <div className="buttonRow">
        {studySlug && <Link to={`/${studySlug}`}><Button color="primary" size="sm">
          <img src={study} alt="" /> {label("menu_study")}</Button></Link>}
        <Link to={`/theater/plan/${segment.guid}`}><Button color="secondary" size="sm">
          <img src={theater} alt="" /> {label("menu_theater")}</Button></Link>
      </div>
      <div className="segmentSections">
        {(sectionData.sections || []).map((section) => <SectionCard section={section} key={section.guid || section.slug} />)}
      </div>
    </div>
  );
}

function SectionCard({ section }) {
  const { title, slug, sectionText = [] } = section;
  const done = sectionText.filter((i) => i.status === "completed").length;
  const pct = sectionText.length ? ((done / sectionText.length) * 100).toFixed(1) : 0;
  return (
    <>
      <ReactTooltip place="bottom" effect="solid" id={`sectionDotTips-${slug}`} />
      <Link to={`/${slug}`}>
        <div className="segmentSection">
          <div className="miniprogress"><div style={{ width: `${pct}%` }} className="progressBar" /></div>
          <h6>{title}</h6>
          <div className="sectionDots">
            {sectionText.map((item, i) => (
              <img key={i} data-for={`sectionDotTips-${slug}`} data-tip={item.heading} alt=""
                src={item.status === "completed" ? green : item.status === "started" ? yellow : blank} />
            ))}
          </div>
        </div>
      </Link>
    </>
  );
}
