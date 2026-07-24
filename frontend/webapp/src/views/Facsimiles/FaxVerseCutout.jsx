import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { unionBox, hasNotch, notchPolygonPoints } from "./faxVerseData";
import StudyBreadcrumb from "../_Common/StudyBreadcrumb";

// Grace window after the pointer leaves a verse before the spread un-dims. If the
// pointer lands on another verse within it, that enter switches the active verse
// (and the grace-delayed LEAVE no-ops, guarded by verse id in the reducer), so the
// dimming never flashes off between adjacent verses.
const LEAVE_GRACE_MS = 140;
const TIP_MARGIN = 8; // keep the tooltip this far from the viewport edge

/** A cutout shape: a rounded rect for a plain box, a polygon for a notched one. */
function CutShape({ b, k, fill, className }) {
  if (hasNotch(b)) {
    return <polygon className={className} points={notchPolygonPoints(b, k)} fill={fill} />;
  }
  return (
    <rect className={className} x={b.x * k} y={b.y * k} width={b.w * k} height={b.h * k} rx="4" fill={fill} />
  );
}

/**
 * The hover tooltip, PORTALED to <body> in viewport (fixed) coordinates so it's
 * never clipped or cramped by the page's containing block / overflow. It measures
 * its own width and x-clamps to the viewport, shifting the caret the opposite way
 * so it keeps pointing at the box.
 */
function FaxVerseTooltip({ verse, vx, top, bottom, placeBelow, caretOffset, minWidth }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bw = el.getBoundingClientRect().width;
    if (Math.abs(bw - w) > 0.5) setW(bw); // guarded -> no loop when width is stable
  });

  const half = w / 2;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  // clamp the tooltip CENTER so its edges stay in view (only once width is known)
  const cx = w > 0 ? Math.max(TIP_MARGIN + half, Math.min(vx, vw - TIP_MARGIN - half)) : vx;
  const caretX = (vx - cx) + caretOffset; // caret tracks the box despite the shift

  const node = (
    <div
      ref={ref}
      className={`faxVerseTooltip floating${placeBelow ? " below" : ""}`}
      style={{ left: cx, top: placeBelow ? bottom : top, minWidth, "--fax-caret-x": `${Math.round(caretX)}px` }}
    >
      <div className="faxVerseTooltip-head">
        {verse.person_slug && (
          <img
            className="faxVerseTooltip-avatar"
            src={`${assetUrl}/people/${verse.person_slug}`}
            alt=""
            onError={(e) => { e.target.style.display = "none"; }}
          />
        )}
        <div className="faxVerseTooltip-meta">
          <div className="faxVerseTooltip-refrow">
            <span className="faxVerseTooltip-ref">{verse.ref}</span>
            {verse.voice && <span className="faxVerseTooltip-voice">{label(verse.voice)}</span>}
          </div>
          {(verse.page || verse.section) && (
            <div className="faxVerseTooltip-loc">
              <StudyBreadcrumb page={verse.page} section={verse.section} />
            </div>
          )}
        </div>
      </div>
      {verse.text && <div className="faxVerseTooltip-text">{verse.text}</div>}
    </div>
  );
  return createPortal(node, document.body);
}

/**
 * Per-page interactive verse layer. When any verse on the spread is active, THIS
 * page darkens too (the opposite page goes solid dark, the active page cuts the
 * verse out) so the whole spread dims except the cutout. Hotspots are the only
 * pointer-interactive elements; off-verse clicks fall through to the page-turn
 * handler beneath.
 *
 * Coords are in `pageScale`-wide space; scaled by k = displayedWidth / pageScale.
 */
export default function FaxVerseCutout({
  verses = [],
  pageScale = 700,
  displayedWidth = 0,
  displayedHeight = 0,
  activeVerseId = null,
  idSuffix = 0,
  onHover,
  onLeave,
  onOpen,
  hoverIntentMs = 100,
}) {
  const timerRef = useRef(null);
  const layerRef = useRef(null); // for converting box-local px -> viewport px
  // { verseId, box } under the pointer — anchors the tooltip on the box nearest
  // the cursor (matters for verses split across columns/pages).
  const [hover, setHover] = useState(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const k = displayedWidth > 0 ? displayedWidth / pageScale : 0;
  if (k <= 0) return null;

  const px = (v) => `${Math.round(v * k)}px`;
  const active = verses.find((v) => v.verse_id === activeVerseId) || null;
  const dim = activeVerseId != null; // something active on the spread → darken this page
  const maskId = `faxCut-${idSuffix}`;

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const enter = (v, box) => {
    clearTimer();
    setHover({ verseId: v.verse_id, box });
    // Already dimmed → switch instantly (no flash); otherwise wait out the
    // hover-intent so an incidental pass-through doesn't dim the spread.
    if (dim || hoverIntentMs === 0) onHover && onHover(v.verse_id);
    else timerRef.current = setTimeout(() => onHover && onHover(v.verse_id), hoverIntentMs);
  };
  const move = (v, box) =>
    setHover((h) => (h && h.verseId === v.verse_id && h.box === box ? h : { verseId: v.verse_id, box }));
  const leave = (v) => {
    clearTimer();
    timerRef.current = setTimeout(() => { setHover(null); onLeave && onLeave(v.verse_id); }, LEAVE_GRACE_MS);
  };
  const open = (e, v) => { e.stopPropagation(); clearTimer(); onOpen && onOpen(v); };

  const W = displayedWidth;
  // Anchor (position/caret) follows the hovered box; but the tooltip's min-width is
  // the verse's FULL span (union of all its boxes) so a multi-column verse's tooltip
  // breathes across the columns instead of clamping to one narrow column.
  const span = active ? unionBox(active.boxes) : null;
  const anchor = active
    ? (hover && hover.verseId === active.verse_id ? hover.box : span)
    : null;
  // Show the tooltip only on the page the pointer is over (the reference is always
  // present; text/avatar/voice are added when available).
  const showTip = !!(active && hover && hover.verseId === active.verse_id && anchor);
  // Place below when the verse sits in the upper part of the page, above otherwise,
  // so the card is never clipped at the top/bottom edge.
  const placeBelow = !!(anchor && displayedHeight > 0 && (anchor.y + anchor.h / 2) * k < displayedHeight * 0.5);
  // Nudge the caret toward the SOLID part of the relevant edge so it never points
  // at a notch gap: above → the top-left notch removes the left of the top edge
  // (shift right); below → the bottom-right notch removes the right of the bottom
  // edge (shift left). 0 for plain boxes / the union-box fallback.
  const caretOffset = anchor
    ? (placeBelow ? -((anchor.brw || 0) / 2) * k : ((anchor.tlw || 0) / 2) * k)
    : 0;

  // Box position in VIEWPORT px (the tooltip is portaled to <body>, fixed).
  let tip = null;
  if (showTip) {
    const lr = layerRef.current && layerRef.current.getBoundingClientRect();
    if (lr) {
      tip = {
        vx: lr.left + (anchor.x + anchor.w / 2) * k,
        top: lr.top + anchor.y * k,
        bottom: lr.top + (anchor.y + anchor.h) * k,
      };
    }
  }

  return (
    <div className="faxVerseLayer" aria-hidden="false" ref={layerRef}>
      {dim && (
        <svg className="faxCutoutSvg" width={W} height="100%" preserveAspectRatio="none">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width={W} height="100%" fill="white" />
              {active && active.boxes.map((b, i) => (
                <CutShape key={i} b={b} k={k} fill="black" className="punch" />
              ))}
            </mask>
          </defs>
          <rect x="0" y="0" width={W} height="100%" fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
          {active && active.boxes.map((b, i) => (
            <CutShape key={i} b={b} k={k} fill="none" className="faxCutoutRing" />
          ))}
        </svg>
      )}

      <div className="faxVerseHotspots">
        {verses.flatMap((v) =>
          v.boxes.map((b, i) => (
            <button
              key={`${v.verse_id}-${i}`}
              type="button"
              className="faxHotspot"
              aria-label={v.ref}
              style={{ left: px(b.x), top: px(b.y), width: px(b.w), height: px(b.h) }}
              onMouseEnter={() => enter(v, b)}
              onMouseMove={() => move(v, b)}
              onMouseLeave={() => leave(v)}
              onClick={(e) => open(e, v)}
            />
          ))
        )}
      </div>

      {showTip && tip && (
        <FaxVerseTooltip
          verse={active}
          vx={tip.vx}
          top={tip.top}
          bottom={tip.bottom}
          placeBelow={placeBelow}
          caretOffset={caretOffset}
          minWidth={px((span || anchor).w)}
        />
      )}
    </div>
  );
}
