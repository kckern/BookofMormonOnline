import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { TileBoundContext } from "./Reveal";
import TileCTA from "./TileCTA";
import { onLayoutChange } from "./clampGuard";
import { usePersistedOpen } from "./tileIdentity";

/**
 * A tile wrapper with a visible height bound (phone single column). Instead of
 * a silent `max-height` clip, overflowing content gets a fade (gradient mask)
 * and a "Read more" toggle that lifts the bound — reversible: the same button
 * flips to "Show less". Any <RevealProvider> inside (the tile's own Layer-1
 * control) also lifts the bound via TileBoundContext, so an expanded teaser or
 * a revealed Layer-2 deeplink is never left below the cut.
 *
 * The bound itself lives in CSS (`.boundedTile:not(.revealed)`); this only
 * measures overflow and owns the revealed flag. On Show less, if the
 * re-bounded tile's top has scrolled above the viewport, it is brought back
 * into view so the reader is not stranded far below the collapsed tile — top
 * aligned, clearing the fixed mobile heading-bar via the tile's CSS
 * `scroll-margin-top` (a top hidden under the 60px bar counts as scrolled off).
 *
 * Keyboard: links under the fade stay reachable — focusing one lifts the bound
 * (instead of the browser silently scrolling the overflow:hidden card and
 * leaving its heading off the top with a blank foot).
 */
// the fixed mobile heading-bar (Header.css .heading-bar.mobile) + breathing room
const HEADER_CLEAR = 64;

export default function BoundedTile({ className = "", tileId, children }) {
  const ref = useRef(null);
  // remembered per tile identity for the Home session: Back remounts the tile
  // with its bound still lifted (systemic E2), not collapsed under the anchor
  const [revealed, setRevealed] = usePersistedOpen("bound");
  const [overflowing, setOverflowing] = useState(false);
  const reveal = useCallback(() => setRevealed(true), [setRevealed]);
  const collapsing = useRef(false);
  const toggle = useCallback(() => {
    setRevealed((r) => {
      collapsing.current = r;
      return !r;
    });
  }, [setRevealed]);

  useLayoutEffect(() => {
    if (revealed || !collapsing.current) return;
    collapsing.current = false;
    const el = ref.current;
    if (!el || typeof el.scrollIntoView !== "function") return;
    if (el.getBoundingClientRect().top >= HEADER_CLEAR) return;
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [revealed]);

  const onFocus = useCallback(
    (e) => {
      if (revealed || !overflowing) return;
      if (e.target.closest && e.target.closest(".boundedTileMore")) return;
      const el = ref.current;
      if (el) el.scrollTop = 0; // undo the browser's focus-scroll of the clipped box
      setRevealed(true);
    },
    [revealed, overflowing],
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || revealed) return undefined;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 2);
    measure();
    // images, lazy content and the web font swapping in change the height
    // after first paint — re-measure two-way (tiles/_ds/clampGuard, C3)
    const offs = [el, ...Array.from(el.children)].map((c) => onLayoutChange(c, measure));
    return () => offs.forEach((off) => off());
  }, [revealed, children]);

  const cls = [className, "boundedTile", overflowing ? "isOverflowing" : "", revealed ? "revealed" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} className={cls} onFocus={onFocus} data-tile-id={tileId}>
      <TileBoundContext.Provider value={reveal}>{children}</TileBoundContext.Provider>
      {overflowing || revealed ? (
        <div className="boundedTileMore">
          <TileCTA
            variant="reveal"
            verb={revealed ? "showLess" : "readMore"}
            aria-expanded={revealed}
            className={revealed ? "isOpen" : ""}
            onClick={toggle}
          />
        </div>
      ) : null}
    </div>
  );
}
