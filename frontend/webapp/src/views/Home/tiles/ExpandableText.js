import React, { useLayoutEffect, useRef, useState } from "react";
import { useReveal } from "./_ds/Reveal";
import TileCTA from "./_ds/TileCTA";

/**
 * Width-aware clamp: collapsed state is a CSS line-clamp (so the cut point
 * tracks the ACTUAL rendered width, not a word budget), with an inline
 * "read more" that expands in place. Truncation is detected by measuring
 * overflow. Safe inside card <Link>s. Expanding also fires the tile's Reveal
 * gate (no-op when there is no <RevealProvider>) so a sibling Layer-2 deeplink
 * can appear only after the reader has expanded.
 *
 * Reversible: ONE toggle button whose label flips Read more ⇄ Show less (never
 * unmount/remount), so keyboard focus stays put; aria-expanded mirrors state.
 * Collapsing does not re-hide an already-revealed Layer-2 deeplink.
 */
export default function ExpandableText({ children, lines = 6, className }) {
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef(null);
  const { reveal, registerGate } = useReveal();
  // Measure PRE-paint (useLayoutEffect) so the gate registers before the browser
  // paints — otherwise the deeplink flashes visible for one frame before the
  // gate hides it. Two-way setTruncated so a re-measure can retract a stale pill.
  // Only the COLLAPSED box is measured: expanded, it never overflows, so a
  // re-measure triggered by a parent re-render (new JSX children) would drop
  // the pill and strand the reader with no Show less. Collapsing re-measures.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const over = el.scrollHeight > el.clientHeight + 2;
    setTruncated(over);
    if (over) registerGate(); // there IS something to expand → gate a sibling deeplink
    // registerGate is intentionally omitted from deps (stable-enough; matches the
    // no-op default when there is no provider).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, lines, open]);
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!open) reveal();
    setOpen(!open);
  };
  return (
    <div className={className}>
      <div
        ref={ref}
        className={open ? undefined : "clampLines"}
        style={open ? undefined : { WebkitLineClamp: lines }}
      >
        {children}
      </div>
      {truncated ? (
        <TileCTA
          variant="reveal"
          verb={open ? "showLess" : "readMore"}
          onClick={toggle}
          aria-expanded={open}
          className={open ? "isOpen" : ""}
        />
      ) : null}
    </div>
  );
}
