import React, { useState } from "react";

// How far the on-hover magnifier zooms, as a multiple of the fit width — capped
// so a very large `full` scan doesn't jump to an absurd magnification.
const MAX_ZOOM = 2.8;

/**
 * Hover magnifier for a verse crop (the "Fax Zoom Box" pattern, cf. StudyInFeed /
 * Narration): the image fits the viewport by default, and on hover it pans at a
 * higher magnification tracking the pointer. Source should be the native-res
 * render crop (`full`) so the zoom reveals real scan detail.
 */
export default function FaxVerseZoom({ src, width, height }) {
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState("center");
  const [zoom, setZoom] = useState(false);

  // Magnified image size (px), capped relative to the fit width.
  const zw = nat.w ? Math.min(nat.w, width * MAX_ZOOM) : 0;
  const zh = nat.w ? zw * (nat.h / nat.w) : 0;

  const onMove = (e) => {
    if (!zw) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const x = -(mx / r.width) * (zw - r.width);
    const y = -(my / r.height) * (zh - r.height);
    setPos(`${Math.round(x)}px ${Math.round(y)}px`);
  };

  return (
    <div
      className={`faxVerseZoom${zoom ? " zoomed" : ""}`}
      style={{
        width,
        height,
        backgroundImage: `url(${src})`,
        backgroundSize: zoom && zw ? `${Math.round(zw)}px ${Math.round(zh)}px` : "contain",
        backgroundPosition: zoom ? pos : "center",
        backgroundRepeat: "no-repeat",
      }}
      onMouseEnter={() => setZoom(true)}
      onMouseMove={onMove}
      onMouseLeave={() => { setZoom(false); setPos("center"); }}
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
