import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * The one shared guard for every clamped box on Home (blind rounds 1-6, G2 +
 * C3/A1 recurred tile by tile because each tile carried its own copy).
 *
 * 1. Keyboard (G2): while a box is clamped, focusable controls that sit below
 *    — or are cut by — its bottom edge leave the Tab order (tabindex=-1), so
 *    Tab never lands on a pill nobody can see. Un-clamping restores them. The
 *    CSS side is `overflow: clip` on every clamp (__tests__/clampOverflow), so
 *    even a programmatic focus cannot scroll the box and slice the prose; any
 *    stray scroll on an engine without `clip` snaps back to the top.
 *
 * 2. Re-measure (C3): the clamp edge moves when the web font replaces the
 *    fallback (different line breaks) or the container resizes. The guard
 *    re-runs the owner's measure (truncation, gate, line end) and the Tab-order
 *    pass on ResizeObserver, document.fonts.ready and every fonts
 *    `loadingdone` — two-way, so a stale "Read more" can also retract.
 */
export const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";
const HIDDEN = "data-clamp-hidden";

export function restoreFocusables(box) {
  if (!box) return;
  box.querySelectorAll(`[${HIDDEN}]`).forEach((n) => {
    const prev = n.getAttribute(HIDDEN);
    if (prev === "") n.removeAttribute("tabindex");
    else n.setAttribute("tabindex", prev);
    n.removeAttribute(HIDDEN);
  });
}

/** Out of the Tab order: every control whose box ends below the clamp edge. */
export function hideClippedFocusables(box) {
  if (!box) return;
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
 * Call `cb` whenever `el`'s layout may have changed under it: a resize (RO), the
 * web fonts settling (fonts.ready) and any later font load (`loadingdone`).
 * Returns an unsubscribe.
 */
export function onLayoutChange(el, cb) {
  let off = false;
  const onResize = () => {
    if (!off) cb("resize");
  };
  const run = () => {
    if (!off) cb("fonts");
  };
  const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(el);
  const fonts = typeof document !== "undefined" ? document.fonts : null;
  try {
    fonts?.ready?.then?.(run, () => {});
    fonts?.addEventListener?.("loadingdone", run);
  } catch {
    /* no Font Loading API */
  }
  return () => {
    off = true;
    ro?.disconnect();
    try {
      fonts?.removeEventListener?.("loadingdone", run);
    } catch {
      /* ignore */
    }
  };
}

/**
 * Guard `ref`'s box while `clamped`. `measure` (optional) is the owner's own
 * clamp measurement; it runs pre-paint with the deps and again on every layout
 * change, then the Tab-order pass runs on the result. Returns an onScroll
 * handler for the box (snap-back where `overflow: clip` is unsupported).
 */
export function useClampGuard(ref, clamped, measure, deps = []) {
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const clampedRef = useRef(clamped);
  clampedRef.current = clamped;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!clamped) {
      restoreFocusables(el);
      return;
    }
    measureRef.current?.(el);
    hideClippedFocusables(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, ...deps]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !clamped) return undefined;
    return onLayoutChange(el, () => {
      if (!clampedRef.current || !ref.current) return;
      measureRef.current?.(ref.current);
      hideClippedFocusables(ref.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);
  return (e) => {
    if (clampedRef.current && e.currentTarget.scrollTop) e.currentTarget.scrollTop = 0;
  };
}
