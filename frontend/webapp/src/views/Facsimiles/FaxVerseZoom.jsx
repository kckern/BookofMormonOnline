import React, { useState } from "react";

// How far the on-hover magnifier zooms, as a multiple of the fit width — capped
// so a very large `full` scan doesn't jump to an absurd magnification.
const MAX_ZOOM = 2.8;

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
    const x = -(mx / r.width) * (zw - r.width);
    const y = -(my / r.height) * (zh - r.height);
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
