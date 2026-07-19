import React, { useEffect, useRef, useState } from "react";

/**
 * Absolute-positioned highlight boxes over a facsimile page image. Boxes are in
 * `pageScale`-wide coordinate space; each is scaled by displayedWidth/pageScale.
 * `displayedWidth` may be passed (desktop knows its page width) or measured from
 * the overlay's own container (mobile). Non-interactive (pointer-events: none).
 */
export default function FaxHighlightOverlay({ boxes, pageScale = 700, displayedWidth }) {
  const ref = useRef(null);
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    if (displayedWidth || !ref.current) return undefined;
    const el = ref.current;
    const update = () => setMeasured(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayedWidth]);

  if (!boxes || !boxes.length) return null;

  const width = displayedWidth || measured;
  const k = width > 0 ? width / pageScale : 0;

  return (
    <div ref={ref} className="faxHighlightLayer" aria-hidden="true">
      {k > 0 &&
        boxes.map((b, i) => (
          <div
            key={i}
            className="faxHighlightBox"
            style={{
              left: `${Math.round(b.x * k)}px`,
              top: `${Math.round(b.y * k)}px`,
              width: `${Math.round(b.w * k)}px`,
              height: `${Math.round(b.h * k)}px`,
            }}
          />
        ))}
    </div>
  );
}
