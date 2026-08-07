import React, { useLayoutEffect, useRef, useState } from "react";
import { label } from "src/models/Utils";
import { useReveal } from "./_ds/Reveal";
import TileCTA from "./_ds/TileCTA";

/**
 * Width-aware clamp: collapsed state is a CSS line-clamp (so the cut point
 * tracks the ACTUAL rendered width, not a word budget), with an inline
 * "read more" that expands in place. Truncation is detected by measuring
 * overflow. Safe inside card <Link>s. Expanding also fires the tile's Reveal
 * gate (no-op when there is no <RevealProvider>) so a sibling Layer-2 deeplink
 * can appear only after the reader has expanded.
 */
export default function ExpandableText({ children, lines = 6, className }) {
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef(null);
  const { reveal, registerGate } = useReveal();
  // Measure PRE-paint (useLayoutEffect) so the gate registers before the browser
  // paints — otherwise the deeplink flashes visible for one frame before the
  // gate hides it. Two-way setTruncated so a re-measure can retract a stale pill.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const over = el.scrollHeight > el.clientHeight + 2;
    setTruncated(over);
    if (over) registerGate(); // there IS something to expand → gate a sibling deeplink
    // registerGate is intentionally omitted from deps (stable-enough; matches the
    // no-op default when there is no provider).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, lines]);
  const expand = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    reveal();
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
      {truncated && !open ? (
        <TileCTA variant="reveal" onClick={expand}>
          {label("read_more")}
        </TileCTA>
      ) : null}
    </div>
  );
}
