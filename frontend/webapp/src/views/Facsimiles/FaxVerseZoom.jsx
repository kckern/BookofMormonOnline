import React, { useState } from "react";

// How far the on-hover magnifier zooms, as a multiple of the fit width — capped
// so a very large `full` scan doesn't jump to an absurd magnification.
const MAX_ZOOM = 2.8;
// The pointer's active pan zone is inset from the box edges by this fraction on
// each side: mapping the inner region to the FULL pan range means the image edges
// come into view before the pointer reaches the very edge of the box (margin), so
// the user never has to hunt the last pixel to see an edge.
const PAN_INSET = 0.12;

/**
 * Hover magnifier for a verse crop (the "Fax Zoom Box" pattern, cf. StudyInFeed /
 * Narration): the image fits the viewport by default, and on hover it pans at a
 * higher magnification tracking the pointer. Fills its parent (which sets the
 * landscape box + reserves height); source should be the native-res render crop
 * (`wfull`) so the zoom reveals real scan detail.
 */
export default function FaxVerseZoom({ src }) {
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(false);
  const [bg, setBg] = useState({ size: "contain", pos: "center" });

  const onMove = (e) => {
    if (!nat.w) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    const zw = Math.min(nat.w, r.width * MAX_ZOOM);
    const zh = zw * (nat.h / nat.w);
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    // Map the inset active zone -> full [0,1] pan, clamped so the outer margin band
    // pins the image to its edge instead of overscrolling past it.
    const clamp01 = (t) => Math.max(0, Math.min(1, t));
    const span = 1 - 2 * PAN_INSET;
    const fx = clamp01((mx / r.width - PAN_INSET) / span);
    const fy = clamp01((my / r.height - PAN_INSET) / span);
    const x = -fx * (zw - r.width);
    const y = -fy * (zh - r.height);
    setBg({ size: `${Math.round(zw)}px ${Math.round(zh)}px`, pos: `${Math.round(x)}px ${Math.round(y)}px` });
  };

  // Only magnify when the native image is bigger than its fit display — if the
  // crop already renders at >=100% there's no extra detail to reveal, so leave
  // zoom off.
  const onEnter = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (nat.w && r.width && nat.w > r.width) setZoom(true);
  };
  const reset = () => { setZoom(false); setBg({ size: "contain", pos: "center" }); };

  return (
    <div
      className={`faxVerseZoom${zoom ? " zoomed" : ""}`}
      style={{
        backgroundImage: `url(${src})`,
        backgroundSize: zoom ? bg.size : "contain",
        backgroundPosition: zoom ? bg.pos : "center",
        backgroundRepeat: "no-repeat",
      }}
      onMouseEnter={onEnter}
      onMouseMove={(e) => zoom && onMove(e)}
      onMouseLeave={reset}
    >
      {/* hidden loader to capture the source's natural dimensions */}
      <img
        src={src}
        alt=""
        style={{ display: "none" }}
        onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
      />
    </div>
  );
}
