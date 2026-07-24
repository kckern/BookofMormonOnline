import React, { useRef } from "react";
import { unionBox } from "./faxVerseData";

/**
 * Per-page interactive verse layer: transparent hotspots (one per box), an SVG
 * scrim that dims the page and cuts out the active verse, and a text tooltip
 * above the cutout. The layer is pointer-events:none EXCEPT the hotspots, so an
 * off-verse click falls through to the page image's turn handler beneath.
 *
 * Coords are in `pageScale`-wide space; scaled by k = displayedWidth / pageScale
 * (same convention as the legacy FaxHighlightOverlay).
 */
export default function FaxVerseCutout({
  verses = [],
  pageScale = 700,
  displayedWidth = 0,
  activeVerseId = null,
  idSuffix = 0,
  onHover,
  onLeave,
  onOpen,
  hoverIntentMs = 100,
}) {
  const intentRef = useRef(null);
  const k = displayedWidth > 0 ? displayedWidth / pageScale : 0;
  if (k <= 0 || !verses.length) return null;

  const px = (v) => `${Math.round(v * k)}px`;
  const active = verses.find((v) => v.verse_id === activeVerseId) || null;
  const maskId = `faxCut-${idSuffix}`;

  const enter = (v) => {
    if (intentRef.current) clearTimeout(intentRef.current);
    if (hoverIntentMs === 0) {
      onHover && onHover(v.verse_id);
    } else {
      intentRef.current = setTimeout(() => onHover && onHover(v.verse_id), hoverIntentMs);
    }
  };
  const leave = () => {
    if (intentRef.current) { clearTimeout(intentRef.current); intentRef.current = null; }
    onLeave && onLeave();
  };
  const open = (e, v) => {
    e.stopPropagation();
    if (intentRef.current) { clearTimeout(intentRef.current); intentRef.current = null; }
    onOpen && onOpen(v);
  };

  const W = displayedWidth;
  const tip = active ? unionBox(active.boxes) : null;

  return (
    <div className="faxVerseLayer" aria-hidden="false">
      {active && (
        <svg className="faxCutoutSvg" width={W} height="100%" preserveAspectRatio="none">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width={W} height="100%" fill="white" />
              {active.boxes.map((b, i) => (
                <rect key={i} className="punch" x={b.x * k} y={b.y * k}
                  width={b.w * k} height={b.h * k} rx="4" fill="black" />
              ))}
            </mask>
          </defs>
          <rect x="0" y="0" width={W} height="100%" fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
          {active.boxes.map((b, i) => (
            <rect key={i} className="faxCutoutRing" x={b.x * k} y={b.y * k}
              width={b.w * k} height={b.h * k} rx="4" />
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
              onMouseEnter={() => enter(v)}
              onMouseLeave={leave}
              onClick={(e) => open(e, v)}
            />
          ))
        )}
      </div>

      {active && active.text && tip && (
        <div
          className="faxVerseTooltip"
          style={{ left: px(tip.x + tip.w / 2), top: px(tip.y) }}
        >
          <div className="faxVerseTooltip-ref">{active.ref}</div>
          <div className="faxVerseTooltip-text">{active.text}</div>
        </div>
      )}
    </div>
  );
}
