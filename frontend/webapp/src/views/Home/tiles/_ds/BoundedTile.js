import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { TileBoundContext } from "./Reveal";
import TileCTA from "./TileCTA";

/**
 * A tile wrapper with a visible height bound (phone single column). Instead of
 * a silent `max-height` clip, overflowing content gets a fade (gradient mask)
 * and a "Read more" toggle that lifts the bound — reversible: the same button
 * flips to "Show less". Any <RevealProvider> inside (the tile's own Layer-1
 * control) also lifts the bound via TileBoundContext, so an expanded teaser or
 * a revealed Layer-2 deeplink is never left below the cut.
 *
 * The bound itself lives in CSS (`.boundedTile:not(.revealed)`); this only
 * measures overflow and owns the revealed flag.
 */
export default function BoundedTile({ className = "", children }) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || revealed) return undefined;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 2);
    measure();
    // images and lazy content change the height after first paint
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [revealed, children]);

  const cls = [className, "boundedTile", overflowing ? "isOverflowing" : "", revealed ? "revealed" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} className={cls}>
      <TileBoundContext.Provider value={reveal}>{children}</TileBoundContext.Provider>
      {overflowing || revealed ? (
        <div className="boundedTileMore">
          <TileCTA
            variant="reveal"
            verb={revealed ? "showLess" : "readMore"}
            aria-expanded={revealed}
            className={revealed ? "isOpen" : ""}
            onClick={() => setRevealed((r) => !r)}
          />
        </div>
      ) : null}
    </div>
  );
}
