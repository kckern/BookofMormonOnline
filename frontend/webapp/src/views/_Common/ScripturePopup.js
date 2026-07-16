import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import ScriptureExcerpt, { canonical, readPath } from "./ScriptureExcerpt";
import "./ScripturePopup.css";

/** Any scripture_link / RefPill opens a ref via this — one popup instance lives
 * in Main, app-wide. */
export const openScripture = (ref) =>
  window.dispatchEvent(new CustomEvent("samplerScripture", { detail: canonical(ref) }));

/**
 * App-wide scripture reader popup. Renders the ScriptureExcerpt in the exact
 * Read experience — speaker attribution, typography, Study action — inside a
 * click-away / Esc-dismissable modal.
 */
export default function ScripturePopup() {
  const [ref, setRef] = useState(null);

  useEffect(() => {
    const open = (e) => setRef(e.detail);
    window.addEventListener("samplerScripture", open);
    return () => window.removeEventListener("samplerScripture", open);
  }, []);

  useEffect(() => {
    if (!ref) return undefined;
    const onKey = (e) => e.key === "Escape" && setRef(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        {/* .read-content scope makes the Read.scss styles apply */}
        <div className="samplerScriptureBody read-content scriptureExcerptCompact">
          <ScriptureExcerpt refText={ref} onNavigate={() => setRef(null)} />
        </div>
        {to ? (
          <div className="samplerScriptureFoot">
            <Link className="samplerScriptureReadLink tileMoreLink" to={to} onClick={() => setRef(null)}>
              {label("read")}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
