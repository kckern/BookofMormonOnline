/**
 * Content-anchored scroll restore for Home.
 *
 * The shell restores Back by scrollY (scroll/routeScrollReset), once the page is
 * tall enough. On Home that lands on the wrong content: tiles above the reader
 * (the map story, self-fetching tiles, images) are still taking their final
 * height when the restore fires. So Home also remembers WHICH tile the reader
 * was looking at and where, and on Back keeps that tile pinned at that offset
 * while the layout settles, until the reader scrolls or the timeout passes.
 */

const tileClass = (el) => [...el.classList].find((c) => c.startsWith("tile-")) || "";

/** The first tile still visible below the top third of the viewport. */
export function captureAnchor(nodes, viewportHeight) {
  const line = viewportHeight / 3;
  for (let i = 0; i < nodes.length; i++) {
    const r = nodes[i].getBoundingClientRect();
    if (r.bottom > line) return { index: i, cls: tileClass(nodes[i]), offset: Math.round(r.top) };
  }
  return null;
}

const INPUTS = ["wheel", "touchstart", "keydown", "mousedown"];

/**
 * The anchored tile in the current node list: the same-class tile nearest the
 * saved index, within NEAR slots. Right after Back a tile above may not have
 * mounted yet (a reserve or self-fetching tile), so the anchor sits one or two
 * slots early until it does (audit E1: the old exact-index check gave up on the
 * first frame and the phone landed ~800px low). Null when no such tile is near.
 */
const NEAR = 3;
export function findAnchor(nodes, anchor) {
  for (let d = 0; d <= NEAR; d++) {
    for (const i of d ? [anchor.index - d, anchor.index + d] : [anchor.index]) {
      if (nodes[i] && tileClass(nodes[i]) === anchor.cls) return nodes[i];
    }
  }
  return null;
}

/**
 * Re-pin `anchor` every frame until the reader acts or `timeoutMs` passes.
 * While no same-class tile is near the saved index (layout still restoring, or
 * a different layout) it waits without scrolling rather than pin somewhere
 * arbitrary. Returns a stop() function.
 */
export function pinAnchor(getNodes, anchor, { win = window, now = () => Date.now(), timeoutMs = 3000 } = {}) {
  let stopped = false;
  let raf = null;
  const deadline = now() + timeoutMs;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (raf) win.cancelAnimationFrame(raf);
    INPUTS.forEach((t) => win.removeEventListener(t, stop));
  };
  INPUTS.forEach((t) => win.addEventListener(t, stop, { passive: true, once: true }));
  const tick = () => {
    if (stopped) return;
    if (now() > deadline) return stop();
    const el = findAnchor(getNodes(), anchor);
    if (el) {
      const delta = Math.round(el.getBoundingClientRect().top - anchor.offset);
      if (Math.abs(delta) > 1) win.scrollBy({ top: delta, left: 0, behavior: "instant" });
    }
    raf = win.requestAnimationFrame(tick);
  };
  raf = win.requestAnimationFrame(tick);
  return stop;
}

/**
 * Record the anchor (via `onCapture`) as the reader scrolls, but only while the
 * URL is still the page this started on. Opening a link pushes history first;
 * the shell's reset-to-top scroll then fires while Home is still mounted, and
 * capturing it overwrote the reader's real place with "top of the page" so
 * Back pinned the first tile (audit people E1). Returns a stop() function.
 */
export function trackAnchor(getNodes, onCapture, { win = window } = {}) {
  const path = win.location.pathname;
  const here = () => win.location.pathname === path;
  let raf = null;
  const onScroll = () => {
    if (raf || !here()) return;
    raf = win.requestAnimationFrame(() => {
      raf = null;
      if (here()) onCapture(captureAnchor(getNodes(), win.innerHeight));
    });
  };
  win.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    win.removeEventListener("scroll", onScroll);
    if (raf) win.cancelAnimationFrame(raf);
  };
}
