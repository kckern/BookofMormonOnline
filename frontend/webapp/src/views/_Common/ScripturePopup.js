import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Drawer from "react-modern-drawer";
import "react-modern-drawer/dist/index.css";
import { label, isMobile } from "src/models/Utils";
import ScriptureExcerpt, { canonical, readPath } from "./ScriptureExcerpt";
import "./ScripturePopup.css";

/** Any scripture_link / RefPill opens a ref via this — one popup instance lives
 * in Main, app-wide.
 *
 * opts.anchorX (optional): horizontal offset in px from the viewport center to
 * anchor the card on. Defaults to 0 (dead-center). The facsimile viewer passes
 * the live spread seam offset so the popup opens over the visual center (the
 * gutter between the two pages) rather than the geometric center. */
export const openScripture = (ref, opts = {}) =>
  window.dispatchEvent(
    new CustomEvent("samplerScripture", {
      detail: { ref: canonical(ref), anchorX: opts.anchorX || 0 },
    })
  );

/**
 * App-wide scripture reader popup. Renders the ScriptureExcerpt in the exact
 * Read experience — speaker attribution, typography, Study action — inside a
 * click-away / Esc-dismissable modal.
 */
export default function ScripturePopup() {
  const [ref, setRef] = useState(null);
  const [anchorX, setAnchorX] = useState(0);
  const cardRef = useRef(null);
  const [tx, setTx] = useState(0);

  useEffect(() => {
    const open = (e) => {
      // Back-compat: earlier callers dispatched the ref string directly.
      const d = e.detail;
      const nextRef = typeof d === "string" ? d : d?.ref;
      const nextAnchor = typeof d === "object" && d ? d.anchorX || 0 : 0;
      setRef(nextRef || null);
      setAnchorX(nextAnchor);
    };
    window.addEventListener("samplerScripture", open);
    return () => window.removeEventListener("samplerScripture", open);
  }, []);

  // Clamp the requested anchor so the card never runs off-screen. Measured off
  // the real card width once it mounts (min(34rem, 94vw)).
  useLayoutEffect(() => {
    if (!ref || !anchorX) { setTx(0); return; }
    const el = cardRef.current;
    if (!el) { setTx(anchorX); return; }
    const w = el.getBoundingClientRect().width;
    const pad = 16;
    const maxTx = Math.max(0, (window.innerWidth - w) / 2 - pad);
    setTx(Math.max(-maxTx, Math.min(maxTx, anchorX)));
  }, [ref, anchorX]);

  useEffect(() => {
    if (!ref) return undefined;
    // Capture phase + legacy key values so Esc closes the popup even if a child
    // (an editor, a focused control) would otherwise swallow the keydown.
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        // Consume the Escape so views behind the modal (e.g. the facsimile
        // viewer, which exits to the grid on Escape) don't also react.
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        e.preventDefault();
        setRef(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ref]);

  // Freeze the main site behind the shaded overlay while the modal is open —
  // reuse the app's existing body scroll lock (html has scrollbar-gutter:stable
  // so nothing shifts). Same mechanism StudyGroupBar uses.
  useEffect(() => {
    if (!ref) return undefined;
    document.body.classList.add("noscroll");
    return () => document.body.classList.remove("noscroll");
  }, [ref]);

  // Mobile presents the excerpt as a right side-drawer (no popup on mobile). Flip
  // `drawerOpen` on after ref lands so react-modern-drawer plays its slide-in.
  const mobile = isMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!mobile) return undefined;
    if (!ref) { setDrawerOpen(false); return undefined; }
    const t = setTimeout(() => setDrawerOpen(true), 10);
    return () => clearTimeout(t);
  }, [mobile, ref]);

  if (!ref) return null;
  const to = readPath(ref);

  const cardInner = (
    <>
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
    </>
  );

  if (mobile) {
    return (
      <Drawer
        open={drawerOpen}
        direction="right"
        size="90vw"
        className="scripturePopupDrawer"
        onClose={() => setRef(null)}
      >
        <div className="samplerScriptureCard scripturePopupDrawer-inner">{cardInner}</div>
      </Drawer>
    );
  }

  return (
    <div className="samplerScripturePopup" role="dialog" aria-modal="true" onClick={() => setRef(null)}>
      <div
        className="samplerScriptureCard"
        ref={cardRef}
        style={tx ? { transform: `translateX(${tx}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {cardInner}
      </div>
    </div>
  );
}
