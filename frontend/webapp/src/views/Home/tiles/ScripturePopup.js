import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { label } from "src/models/Utils";

/** Any sampler tile opens a ref via this — one popup instance lives in Sampler. */
export const openScripture = (ref) =>
  window.dispatchEvent(new CustomEvent("samplerScripture", { detail: ref }));

/** /read deep link: "Alma 17:7" → /read/alma-17/7 (first verse for ranges). */
const readPath = (ref) => {
  const m = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(ref || "");
  if (!m) return null;
  const bookCh = `${m[1].toLowerCase().replace(/\s+/g, "-")}-${m[2]}`;
  return `/read/${bookCh}${m[3] ? `/${m[3]}` : ""}`;
};

/**
 * Mini scripture reader: click-away/Esc dismissable, BoM text via the
 * `scripture` query, with a deep link into the full Read view.
 */
export default function ScripturePopup() {
  const [ref, setRef] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const open = (e) => { setRef(e.detail); setData(null); };
    window.addEventListener("samplerScripture", open);
    return () => window.removeEventListener("samplerScripture", open);
  }, []);

  useEffect(() => {
    if (!ref) return undefined;
    let c = false;
    BoMOnlineAPI({ scripture: [ref] }, { useCache: false })
      .then((r) => {
        if (c) return;
        const raw = r?.scripture;
        const val = raw?.[ref] || (raw && Object.values(raw)[0]) || null;
        setData(val || { passages: [] });
      })
      .catch(() => { if (!c) setData({ passages: [] }); });
    const onKey = (e) => e.key === "Escape" && setRef(null);
    window.addEventListener("keydown", onKey);
    return () => { c = true; window.removeEventListener("keydown", onKey); };
  }, [ref]);

  if (!ref) return null;
  const to = readPath(ref);
  return (
    <div className="samplerScripturePopup" role="dialog" aria-modal="true" onClick={() => setRef(null)}>
      <div className="samplerScriptureCard" onClick={(e) => e.stopPropagation()}>
        <div className="samplerScriptureHead">
          <b>{ref}</b>
          <button aria-label="Close" onClick={() => setRef(null)}>×</button>
        </div>
        <div className="samplerScriptureBody">
          {!data ? (
            <div className="samplerScriptureLoading">…</div>
          ) : data.passages?.length ? (
            data.passages.map((p, i) => (
              <div key={i} className="samplerScripturePassage">
                {p.heading ? <div className="samplerScriptureHeading">{p.heading}</div> : null}
                <p>
                  {(p.verses || []).map((v) => (
                    <span key={v.verse_id}>
                      <sup>{v.verse}</sup> {v.text}{" "}
                    </span>
                  ))}
                </p>
              </div>
            ))
          ) : (
            <div className="samplerScriptureLoading">{label("rp_error_loading")}</div>
          )}
        </div>
        {to ? (
          <Link className="samplerScriptureReadLink" to={to} onClick={() => setRef(null)}>
            {label("read")} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
