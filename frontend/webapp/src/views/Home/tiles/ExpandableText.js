import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReveal } from "./_ds/Reveal";
import TileCTA from "./_ds/TileCTA";
import { readExpanded, writeExpanded } from "./samplerSession";

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
 *
 * Collapsed, controls (RefPill buttons, links) that sit below — or are cut by —
 * the clamp edge leave the Tab order (tabindex=-1): focusing one would scroll
 * the overflow:hidden box and scramble the visible prose (audit G2). Expanding
 * restores them; any stray scroll of the collapsed box snaps back to the top.
 *
 * `fade`: clamp by whole line boxes (max-height: N lh) and fade the tail of the
 * last line instead of -webkit-line-clamp's ellipsis, which cuts mid-word
 * ("The nex…") and can strand an ellipsis after a ref pill (audit H3).
 *
 * `persistKey`: remember the expanded state for this Home session, so a Back
 * remounts the box expanded (same height, Layer-2 still revealed) instead of
 * collapsing it under the scroll anchor.
 */
const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";
const HIDDEN = "data-clamp-hidden";

function restoreFocusables(box) {
  box.querySelectorAll(`[${HIDDEN}]`).forEach((n) => {
    const prev = n.getAttribute(HIDDEN);
    if (prev === "") n.removeAttribute("tabindex");
    else n.setAttribute("tabindex", prev);
    n.removeAttribute(HIDDEN);
  });
}

function hideClippedFocusables(box) {
  restoreFocusables(box);
  const edge = box.getBoundingClientRect().bottom;
  box.querySelectorAll(FOCUSABLE).forEach((n) => {
    if (n.getAttribute("tabindex") === "-1") return;
    if (n.getBoundingClientRect().bottom > edge + 1) {
      n.setAttribute(HIDDEN, n.getAttribute("tabindex") ?? "");
      n.setAttribute("tabindex", "-1");
    }
  });
}

/**
 * Does the collapsed box hide content? Measured off the CONTENT's own boxes (a
 * Range over the children), not scrollHeight: a ref chip's absolutely
 * positioned 44px touch hit (::after) on the last line also counts toward
 * scrollHeight and made short prose grow a needless "Read more". jsdom has no
 * Range layout, so it falls back to scrollHeight.
 */
function overflows(el) {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = range.getClientRects?.();
    if (rects && rects.length) {
      let bottom = -Infinity;
      for (const r of rects) if (r.height > 0) bottom = Math.max(bottom, r.bottom);
      if (bottom > -Infinity) return bottom > el.getBoundingClientRect().bottom + 2;
    }
  } catch {
    /* no Range layout */
  }
  return el.scrollHeight > el.clientHeight + 2;
}

/**
 * Where the clamp's last VISIBLE line ends (px from the box's left), or null
 * when it runs to the box edge or there is no layout. The fade mask ends there,
 * so a short last line still fades into "continues" instead of fading blank
 * space (blind audit r4 placeProfile-H3). A line is "the last" when its
 * vertical centre lies within the bottom line box of the clip.
 */
export function lastLineEnd(rects, box, lh) {
  let right = -Infinity;
  for (const r of rects || []) {
    if (!(r.height > 0)) continue;
    const mid = (r.top + r.bottom) / 2;
    if (mid > box.bottom - lh && mid <= box.bottom) right = Math.max(right, r.right);
  }
  if (right === -Infinity) return null;
  const end = Math.round(right - box.left);
  return end >= box.right - box.left - 8 ? null : end;
}

function markLineEnd(el) {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    const end = lh > 0 ? lastLineEnd(range.getClientRects?.(), el.getBoundingClientRect(), lh) : null;
    if (end == null) el.style.removeProperty("--line-end");
    else el.style.setProperty("--line-end", `${end}px`);
  } catch {
    /* no Range layout */
  }
}

export default function ExpandableText({ children, lines = 6, className, fade = false, persistKey }) {
  // restored open = it was truncated when the reader expanded it
  const [open, setOpen] = useState(() => readExpanded(persistKey));
  const [truncated, setTruncated] = useState(open);
  const ref = useRef(null);
  const { reveal, registerGate } = useReveal();
  // A restored expansion re-fires the gate + reveal pre-paint, so the Layer-2
  // link (and any enclosing bound) come back open with it.
  useLayoutEffect(() => {
    if (!open) return;
    registerGate();
    reveal();
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Measure PRE-paint (useLayoutEffect) so the gate registers before the browser
  // paints — otherwise the deeplink flashes visible for one frame before the
  // gate hides it. Two-way setTruncated so a re-measure can retract a stale pill.
  // Only the COLLAPSED box is measured: expanded, it never overflows, so a
  // re-measure triggered by a parent re-render (new JSX children) would drop
  // the pill and strand the reader with no Show less. Collapsing re-measures.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      restoreFocusables(el);
      return;
    }
    const over = overflows(el);
    setTruncated(over);
    if (over) registerGate(); // there IS something to expand → gate a sibling deeplink
    hideClippedFocusables(el);
    if (fade && over) markLineEnd(el);
    else ref.current.style.removeProperty("--line-end");
    // registerGate is intentionally omitted from deps (stable-enough; matches the
    // no-op default when there is no provider).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, lines, open, fade]);
  // Width changes (container resize, font load) move the clamp edge: re-run the
  // Tab-order pass while collapsed.
  useEffect(() => {
    const el = ref.current;
    if (!el || open || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      hideClippedFocusables(el);
      if (fade) markLineEnd(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, fade]);
  const onScroll = (e) => {
    if (!open && e.currentTarget.scrollTop) e.currentTarget.scrollTop = 0;
  };
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!open) reveal();
    writeExpanded(persistKey, !open);
    setOpen(!open);
  };
  return (
    <div className={className}>
      <div
        ref={ref}
        className={open ? undefined : fade ? `clampLines clampFade${truncated ? " isClipped" : ""}` : "clampLines"}
        style={open ? undefined : fade ? { "--clamp-lines": lines } : { WebkitLineClamp: lines }}
        onScroll={onScroll}
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
