/**
 * Scroll a deeplink target into view and KEEP it there while the page settles
 * (systemic D4). A single scrollIntoView on arrival lands short whenever the
 * page is still growing — the chapter is shorter than the target's scroll
 * position (the scroll clamps at the document end) or content above it loads
 * later — and the target ends up under the phone bottom nav or below the fold
 * (R6 notes-D4). This re-lands on every document resize until the reader
 * scrolls/taps/types or `settleMs` passes. The fixed chrome itself is cleared
 * by the root's scroll-padding (Main.css), so targets need no offsets.
 * Returns stop().
 */
const INPUTS = ["wheel", "touchstart", "keydown", "mousedown"];

const padOf = (win, side) => {
  try {
    const v = parseFloat(win.getComputedStyle(win.document.documentElement)[`scrollPadding${side}`]);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
};

/** Is the target's top inside the usable viewport (between the fixed bars)? */
function inView(el, win) {
  const r = el.getBoundingClientRect();
  const top = padOf(win, "Top");
  const bottom = win.innerHeight - padOf(win, "Bottom");
  return r.top >= top - 4 && r.top <= bottom - Math.min(r.height || 0, (bottom - top) * 0.3) - 8;
}

export function landTarget(getEl, { block = "start", behavior = "auto", settleMs = 4000, win = window } = {}) {
  let stopped = false;
  let ro = null;
  let timer = null;
  let poll = null;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    ro?.disconnect();
    if (timer) win.clearTimeout(timer);
    if (poll) win.clearInterval(poll);
    INPUTS.forEach((t) => win.removeEventListener(t, stop));
  };
  const first = getEl();
  if (first && typeof first.scrollIntoView === "function") first.scrollIntoView({ block, behavior });
  INPUTS.forEach((t) => win.addEventListener(t, stop, { passive: true, once: true }));
  const recheck = () => {
    if (stopped) return;
    const el = getEl();
    // re-land instantly: a smooth scroll restarted per resize never arrives
    if (el && typeof el.scrollIntoView === "function" && !inView(el, win)) el.scrollIntoView({ block, behavior: "auto" });
  };
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(recheck);
    ro.observe(win.document.body);
    const host = first?.parentElement?.closest?.("main, .read-content, #root > *");
    if (host) ro.observe(host);
  }
  // the growth is not always a body resize (inner containers, min-heights):
  // also re-check on a slow beat once the opening smooth scroll has had time
  poll = win.setInterval(recheck, 700);
  timer = win.setTimeout(stop, settleMs);
  return stop;
}
