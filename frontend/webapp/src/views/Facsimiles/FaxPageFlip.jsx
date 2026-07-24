import React, { useEffect } from "react";
import { createPortal } from "react-dom";

// Single source of truth for the curl duration. Must stay in sync with the
// `faxLeaf*` @keyframes in FacsimilePageViewer.scss (0.55s). The parent's
// safety timers are derived from this so there are no unlinked magic numbers.
export const FAX_FLIP_MS = 550;

// Cross-fade duration for the post-landing handoff. Once the leaf lands flat on
// the newly-committed spread, the overlay fades out over this window instead of
// being hard-cut, so tearing down the fixed/z-4000 compositing layer doesn't
// flash or snap ("settle into its sink"). Must match the `.settling` opacity
// transition in FacsimilePageViewer.scss.
export const FAX_SETTLE_MS = 160;

/**
 * FaxPageFlip — transient overlay that animates one physical leaf turning, then
 * calls onDone(). It does NOT own navigation: FacsimilePageViewer commits the
 * real page change when the animation lands (see the plan doc
 * docs/plans/2026-07-24-fax-page-turn-animation.md).
 *
 * The overlay draws:
 *  - a static "behind" layer (the two pages visible once the leaf clears), and
 *  - a single flipping leaf pivoting on the seam.
 *
 * Geometry mirrors the live spread exactly (same stack/page widths + height),
 * so the overlay lines up pixel-for-pixel with the pages underneath.
 *
 * Props:
 *  - dir: 'next' | 'prev'
 *  - geom: { leftStackWidth, leftPageWidth, rightPageWidth, height }
 *  - behindLeftUrl, behindRightUrl: static under-layer images (may be null → blank)
 *  - leafFrontUrl, leafBackUrl: the two faces of the turning leaf
 *  - onDone: () => void  (fired on animationend)
 */
export default function FaxPageFlip({
  dir,
  geom,
  behindLeftUrl,
  behindRightUrl,
  leafFrontUrl,
  leafBackUrl,
  settling,
  onDone,
}) {
  const { leftStackWidth = 0, leftPageWidth = 0, rightPageWidth = 0, height = 0 } = geom || {};
  const seamX = leftStackWidth + leftPageWidth;

  // Commit backup: if `animationend` never fires (e.g. the animation is
  // interrupted or the element is detached before it completes), commit anyway.
  // Generous margin (2x duration) so main-thread JPEG decode jank that delays
  // the animation start can never let this beat the real `animationend`.
  useEffect(() => {
    const t = setTimeout(() => onDone && onDone(), FAX_FLIP_MS * 2);
    return () => clearTimeout(t);
  }, [onDone]);

  const isNext = dir === "next";
  // The leaf sits in the right slot (next) or left slot (prev) and pivots on the
  // shared spine edge.
  const leafLeft = isNext ? seamX : leftStackWidth;
  const leafWidth = isNext ? rightPageWidth : leftPageWidth;
  const transformOrigin = isNext ? "left center" : "right center";

  const faceImg = (src) =>
    src ? (
      <img src={src} alt="" aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    ) : (
      <div className="flip-blank" style={{ position: "absolute", inset: 0 }} />
    );

  // When the caller supplies the spread's viewport rect, portal the overlay to
  // <body> and position it `fixed` so the 3D curl floats ABOVE all chrome
  // (toolbar, refs rail, nav) instead of being clipped inside the page area.
  const vp = geom?.viewport;
  const layerStyle = vp
    ? { left: vp.left, top: vp.top, width: vp.width, height: vp.height }
    : undefined;

  const layer = (
    <div className={`faxFlipLayer${vp ? " floating" : ""}${settling ? " settling" : ""}`} style={layerStyle} aria-hidden="true">
      {/* Static behind layer — what the turning leaf uncovers. */}
      <div className="flip-behind" style={{ left: leftStackWidth, width: leftPageWidth, height }}>
        {faceImg(behindLeftUrl)}
      </div>
      <div className="flip-behind" style={{ left: seamX, width: rightPageWidth, height }}>
        {faceImg(behindRightUrl)}
      </div>

      {/* The turning leaf. */}
      <div
        className={`flip-leaf ${isNext ? "next" : "prev"}`}
        style={{ left: leafLeft, width: leafWidth, height, transformOrigin }}
        onAnimationEnd={(e) => {
          // Only the leaf's OWN rotation ends the turn. The `.leaf-shade` child
          // also animates and its animationend bubbles up here — ignore it, else
          // onDone double-fires (and would mis-fire if the shade is ever retimed).
          if (e.target !== e.currentTarget) return;
          if (onDone) onDone();
        }}
      >
        <div className="face front">{faceImg(leafFrontUrl)}</div>
        <div className="face back">{faceImg(leafBackUrl)}</div>
        <div className="leaf-shade" />
      </div>
    </div>
  );

  return vp ? createPortal(layer, document.body) : layer;
}
