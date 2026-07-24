import React, { useRef, useState, useEffect } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { unionBox, hasNotch, notchPolygonPoints } from "./faxVerseData";

// Grace window after the pointer leaves a verse before the spread un-dims. If the
// pointer lands on another verse within it, that enter switches the active verse
// (and the grace-delayed LEAVE no-ops, guarded by verse id in the reducer), so the
// dimming never flashes off between adjacent verses.
const LEAVE_GRACE_MS = 140;

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
  // Anchor on the hovered box (falls back to the union box).
  const anchor = active
    ? (hover && hover.verseId === active.verse_id ? hover.box : unionBox(active.boxes))
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

  return (
    <div className="faxVerseLayer" aria-hidden="false">
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

      {showTip && (
        <div
          className={`faxVerseTooltip${placeBelow ? " below" : ""}`}
          style={{
            left: px(anchor.x + anchor.w / 2),
            top: placeBelow ? px(anchor.y + anchor.h) : px(anchor.y),
            minWidth: px(anchor.w),
            "--fax-caret-x": `${Math.round(caretOffset)}px`,
          }}
        >
          <div className="faxVerseTooltip-head">
            {active.person_slug && (
              <img
                className="faxVerseTooltip-avatar"
                src={`${assetUrl}/people/${active.person_slug}`}
                alt=""
                onError={(e) => { e.target.style.display = "none"; }}
              />
            )}
            <span className="faxVerseTooltip-ref">{active.ref}</span>
            {active.voice && <span className="faxVerseTooltip-voice">{label(active.voice)}</span>}
          </div>
          {active.text && <div className="faxVerseTooltip-text">{active.text}</div>}
        </div>
      )}
    </div>
  );
}
