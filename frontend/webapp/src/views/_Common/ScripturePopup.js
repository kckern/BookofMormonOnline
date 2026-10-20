import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { label, isMobile } from "src/models/Utils";
import ScriptureExcerpt, { canonical, readPath } from "./ScriptureExcerpt";
import useModalA11y from "./AppModal/useModalA11y";
import "./ScripturePopup.css";

// Same typographic range as the RefPill that opened us ("3:25–26", not "3:25-26").
const enDash = (s) => (s || "").replace(/(\d)\s*-\s*(\d)/g, "$1–$2");

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
      detail: { ref: canonical(ref), anchorX: opts.anchorX || 0, opener: opts.opener || null },
    })
  );

/** Where the reader was at the moment of the click: scrollY plus the opener's
 * viewport offset (when known). Taken synchronously in the open event, BEFORE
 * the modal mounts and the root overflow flips — capturing it in the mount
 * effect recorded the post-jump position, so a jump on open was permanent
 * (audit xc-popup-E3). */
export const capturePlace = (opener) => {
  const el = opener && typeof opener.getBoundingClientRect === "function" ? opener : null;
  return { y: window.scrollY, el, top: el ? el.getBoundingClientRect().top : 0 };
};

/** Put the reader back: keep the opener where it was on screen when it is still
 * mounted (layout above may have settled meanwhile), else the scrollY. */
export const restorePlace = (place) => {
  if (!place) return;
  if (place.el && place.el.isConnected) {
    const delta = Math.round(place.el.getBoundingClientRect().top - place.top);
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, left: 0, behavior: "instant" });
    return;
  }
  if (window.scrollY !== place.y) window.scrollTo(0, place.y);
};

/**
 * App-wide scripture reader popup. Renders the ScriptureExcerpt in the exact
 * Read experience — speaker attribution, typography, Study action — inside a
 * click-away / Esc-dismissable modal.
 *
 * One dialog at every width: a centered card on desktop, a bottom sheet at
 * phone widths (≤ 900px, CSS) with the close button in its header. Focus moves
 * in on open, is trapped while open and returns to the opener on close
 * (useModalA11y); page scroll is locked while open.
 */
export default function ScripturePopup() {
  const [ref, setRef] = useState(null);
  const [anchorX, setAnchorX] = useState(0);
  // A verse id inside `ref` to open at (a tile's section chip names the whole
  // section; the reader wants the tile's verse — blind audit R5 faxVerse-H2).
  const [focus, setFocus] = useState(null);
  const bodyRef = useRef(null);
  // Whether the current ref resolved to actual Book of Mormon content. The
  // "Read" CTA links into the Read experience, which only serves BoM — so it
  // stays hidden for Bible-only refs (and while loading). ScriptureExcerpt
  // reports this once its fetch resolves.
  const [hasBoM, setHasBoM] = useState(false);
  const cardRef = useRef(null);
  const closeRef = useRef(null);
  const [tx, setTx] = useState(0);
  const titleId = useId();
  const close = useCallback(() => setRef(null), []);
  const placeRef = useRef(null);

  // Focus in + Tab trap + focus restore. Esc is handled below (capture phase,
  // consumed so views behind don't react), so no onClose here.
  useModalA11y(!!ref, { dialogRef: cardRef, initialFocusRef: closeRef });

  useEffect(() => {
    const open = (e) => {
      // Back-compat: earlier callers dispatched the ref string directly.
      const d = e.detail;
      const nextRef = typeof d === "string" ? d : d?.ref;
      const nextAnchor = typeof d === "object" && d ? d.anchorX || 0 : 0;
      const opener = (typeof d === "object" && d && d.opener) || document.activeElement;
      // only the first open of a stack records the place (popup → popup keeps it)
      if (!placeRef.current) placeRef.current = capturePlace(opener === document.body ? null : opener);
      setRef(nextRef || null);
      setAnchorX(nextAnchor);
      setFocus((typeof d === "object" && d && d.focus) || null);
      // Hide the Read CTA until the new ref's fetch confirms BoM content.
      setHasBoM(false);
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

  // Open at the focus verse: once it renders, scroll the card's own body (never
  // scrollIntoView, which would also move the locked page behind) so the verse
  // sits just under the head, and mark it.
  useEffect(() => {
    const body = bodyRef.current;
    if (!ref || !focus || !body) return undefined;
    const land = () => {
      const el = body.querySelector(`.verse_${focus}`);
      if (!el) return false;
      el.classList.add("samplerScriptureFocus");
      body.scrollTop += Math.round(el.getBoundingClientRect().top - body.getBoundingClientRect().top) - 12;
      return true;
    };
    if (land()) return undefined;
    const mo = new MutationObserver(() => { if (land()) mo.disconnect(); });
    mo.observe(body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [ref, focus]);

  // Freeze the main site behind the shaded overlay while the modal is open by
  // locking the ROOT scroller only (html overflow:hidden; scrollbar-gutter:stable
  // so nothing shifts). Not body.noscroll: body is height:100%, so once html
  // stops propagating overflow, an overflow-hidden body clips the page to one
  // viewport and throws the reader to scrollY 0 for good (audit E3). The scroll
  // position is also put back on an in-place close in case anything moved it meanwhile.
  const isOpen = !!ref;
  useEffect(() => {
    if (!isOpen) return undefined;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const place = placeRef.current || capturePlace(null);
    const path = window.location.pathname;
    html.style.overflow = "hidden";
    // The reader cannot scroll the locked root, so any root scroll while open is
    // a layout-driven jump (batches landing, the column balancer reflowing):
    // undo it so the page behind the shade stays where the reader left it.
    const onScroll = () => {
      if (window.scrollY !== place.y) window.scrollTo(0, place.y);
    };
    if (window.scrollY !== place.y) window.scrollTo(0, place.y);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      html.style.overflow = prevOverflow;
      placeRef.current = null;
      // only when closed in place — the Read link navigates (its own scroll)
      if (window.location.pathname === path) restorePlace(place);
    };
  }, [isOpen]);

  if (!ref) return null;
  const to = readPath(ref);

  const cardInner = (
    <>
      <div className="samplerScriptureHead">
        <b id={titleId}>{enDash(ref)}</b>
        <button type="button" ref={closeRef} aria-label="Close" onClick={close}>×</button>
      </div>
      {/* .read-content scope makes the Read.scss styles apply */}
      <div className="samplerScriptureBody read-content scriptureExcerptCompact" ref={bodyRef}>
        <ScriptureExcerpt refText={ref} onNavigate={() => setRef(null)} onBoMSections={setHasBoM} />
      </div>
      {to && hasBoM ? (
        <div className="samplerScriptureFoot">
          <Link className="samplerScriptureReadLink tileMoreLink" to={to} onClick={() => setRef(null)}>
            {label("read")}
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="samplerScripturePopup" onClick={close}>
      <div
        className="samplerScriptureCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={cardRef}
        // the anchor offset is a desktop nicety; the phone sheet is full-width
        style={tx && !isMobile() ? { transform: `translateX(${tx}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {cardInner}
      </div>
    </div>
  );
}
