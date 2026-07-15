// 3-step builder (spec D7/D8): What (tabbed checklist) → How fast → Confirm.
// Scope compiles to page slugs (site tab) or a canonical verse range (books tab).
// Preview = the SAME server generator, dry-run — never local math.
import React, { useEffect, useMemo, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import SweetAlert from "react-bootstrap-sweetalert";
import { Button } from "reactstrap";
import { toast } from "react-toastify";
import { label } from "src/models/Utils";
import { lookup } from "scripture-guide";

const BOOKS = ["1 Nephi", "2 Nephi", "Jacob", "Enos", "Jarom", "Omni", "Words of Mormon",
  "Mosiah", "Alma", "Helaman", "3 Nephi", "4 Nephi", "Mormon", "Ether", "Moroni"];

// Whole-book verse range from a book name, via its first+last chapter (bare book
// names return []). We approximate the book span using chapter 1..~60 probing:
// scripture-guide caps arrays at 1000, so union the min/max of a coarse chapter sweep.
function bookRange(names) {
  const ids = [];
  names.forEach((n) => {
    for (let ch = 1; ch <= 63; ch++) {
      const v = lookup(`${n} ${ch}`).verse_ids;
      if (v && v.length) { ids.push(v[0], v[v.length - 1]); }
    }
  });
  if (!ids.length) return { type: "range", start: 0, end: 0 };
  return { type: "range", start: Math.min(...ids), end: Math.max(...ids) };
}

export default function Wizard({ token, onClose, onStarted }) {
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState("guide");
  const [contents, setContents] = useState(null);
  const [pickedPages, setPickedPages] = useState([]);
  const [pickedBooks, setPickedBooks] = useState([]);
  const [pace, setPace] = useState(null);
  const [count, setCount] = useState(30);
  const [due, setDue] = useState("");
  const [credit, setCredit] = useState("fresh");
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let c = false;
    BoMOnlineAPI({ contents: null })
      .then((r) => { if (!c) setContents(Object.values(r?.contents || {})); })
      .catch(() => { if (!c) setContents([]); });
    return () => { c = true; };
  }, []);

  const config = useMemo(() => {
    const scope = tab === "books" && pickedBooks.length
      ? bookRange(pickedBooks)
      : { type: "pages", slugs: pickedPages };
    const pacing = pace === "daily" ? { type: "cadence", unit: "day", count: Number(count) }
      : pace === "weekly" ? { type: "cadence", unit: "week", count: Number(count) }
      : pace === "bydate" ? { type: "calendar", due }
      : { type: "selfpaced" };
    const segmentation = pace === "daily" || pace === "weekly"
      ? { type: "even", parts: Number(count) }
      : { type: "section" };
    return { scope, pacing, segmentation, credit };
  }, [tab, pickedPages, pickedBooks, pace, count, due, credit]);

  const scopeEmpty = (tab === "guide" && !pickedPages.length) || (tab === "books" && !pickedBooks.length);

  const next = async () => {
    setErr(null);
    if (step === 0 && scopeEmpty) return setErr(label("rp_empty_scope"));
    if (step === 1) {
      if (!pace) return setErr(label("rp_wizard_pace"));
      const r = await BoMOnlineAPI({ readingplanpreview: { config: JSON.stringify(config) } }, { useCache: false });
      const raw = r?.readingplanpreview;
      setPreview((Array.isArray(raw) ? raw[0] : (raw && Object.values(raw)[0])) || null);
    }
    setStep(step + 1);
  };

  const start = async () => {
    setBusy(true);
    let res;
    try {
      const r = await BoMOnlineAPI({ startReadingPlan: { token, config: JSON.stringify(config) } });
      res = r?.startReadingPlan;
    } catch { res = null; }
    setBusy(false);
    if (res?.isSuccess) { onClose(); return onStarted(); }
    toast.error(res?.msg === "ACTIVE_PLAN_EXISTS" ? label("rp_active_exists") : label("rp_error_loading"));
  };

  const togglePage = (slug) => setPickedPages((p) => p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]);
  const toggleBook = (name) => setPickedBooks((p) => p.includes(name) ? p.filter((s) => s !== name) : [...p, name]);
  const clamped = preview?.warnings?.find((w) => w.code === "PARTS_CLAMPED");

  return (
    <SweetAlert customClass="sweet-alert-modal rpWizard" show title={label("rp_start_a_plan")}
      onConfirm={() => {}} onCancel={onClose} showConfirm={false} showCancel cancelBtnText={label("cancel")} btnSize="">
      {() => (
        <div>
          <div className="stepDots">{[0, 1, 2].map((i) => (i === step ? "●" : "○")).join(" ")}</div>
          {step === 0 && (
            <div>
              <h5>{label("rp_wizard_what")}</h5>
              <div className="buttonRow">
                <Button size="sm" color={tab === "guide" ? "primary" : "secondary"} onClick={() => setTab("guide")}>{label("rp_tab_guide")}</Button>
                <Button size="sm" color={tab === "books" ? "primary" : "secondary"} onClick={() => setTab("books")}>{label("rp_tab_books")}</Button>
              </div>
              <div className="scopeList">
                {tab === "guide" && (contents || []).map((div) => (
                  <div key={div.slug}>
                    <strong>{div.title}</strong>
                    {(div.pages || []).map((pg) => (
                      <label key={pg.slug}>
                        <input type="checkbox" checked={pickedPages.includes(pg.slug)} onChange={() => togglePage(pg.slug)} />
                        {" "}{pg.title}
                        <span className="sizeBadge">({(pg.sections || []).length} {label("rp_sections")})</span>
                      </label>
                    ))}
                  </div>
                ))}
                {tab === "books" && BOOKS.map((b) => (
                  <label key={b}>
                    <input type="checkbox" checked={pickedBooks.includes(b)} onChange={() => toggleBook(b)} /> {b}
                  </label>
                ))}
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <h5>{label("rp_wizard_pace")}</h5>
              {[["daily", "rp_pace_daily"], ["weekly", "rp_pace_weekly"], ["bydate", "rp_pace_bydate"], ["selfpaced", "rp_pace_selfpaced"]].map(([k, lbl]) => (
                <div key={k} role="button" tabIndex={0} className={`paceOption ${pace === k ? "selected" : ""}`}
                  onClick={() => setPace(k)} onKeyDown={(e) => e.key === "Enter" && setPace(k)}>
                  {label(lbl)}
                  {pace === k && (k === "daily" || k === "weekly") && (
                    <input type="number" min="1" max="365" value={count}
                      onClick={(e) => e.stopPropagation()} onChange={(e) => setCount(e.target.value)} style={{ width: "5em", marginLeft: "1ex" }} />
                  )}
                  {pace === k && k === "bydate" && (
                    <input type="date" value={due} onClick={(e) => e.stopPropagation()} onChange={(e) => setDue(e.target.value)} style={{ marginLeft: "1ex" }} />
                  )}
                </div>
              ))}
              <label style={{ display: "block", marginTop: "1em" }}>
                <input type="checkbox" checked={credit === "alltime"} onChange={(e) => setCredit(e.target.checked ? "alltime" : "fresh")} />
                {" "}{label("rp_count_past_reading")}
              </label>
            </div>
          )}
          {step === 2 && (
            <div>
              <h5>{label("rp_wizard_confirm")}</h5>
              {clamped && <p className="text-warning">{label("rp_clamped", [clamped.detail])}</p>}
              <p>{preview?.parts} {label("rp_parts")}{preview?.enddate ? ` · ${label("rp_ends")} ${preview.enddate}` : ""}</p>
              <div className="scopeList">
                {(preview?.segments || []).slice(0, 12).map((s, i) => (
                  <div key={i}>{s.period ? `${s.period} — ` : ""}{s.ref}</div>
                ))}
                {preview?.segments?.length > 12 && <div>…</div>}
              </div>
            </div>
          )}
          {err && <p className="text-danger">{err}</p>}
          <div className="previewRail">
            <span>{step > 0 && <Button size="sm" color="secondary" onClick={() => setStep(step - 1)}>{label("rp_back")}</Button>}</span>
            <span>
              {step < 2 && <Button size="sm" color="primary" onClick={next}>{label("rp_next")}</Button>}
              {step === 2 && <Button size="sm" color="primary" disabled={busy} onClick={start}>{label(busy ? "rp_starting" : "rp_start_plan")}</Button>}
            </span>
          </div>
        </div>
      )}
    </SweetAlert>
  );
}
