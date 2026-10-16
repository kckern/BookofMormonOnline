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
 * Re-pin `anchor` every frame until the reader acts or `timeoutMs` passes.
 * Gives up quietly if the node at `anchor.index` isn't the same tile class
 * (the restored layout differs, so pinning would land somewhere arbitrary).
 * Returns a stop() function.
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
    const el = getNodes()[anchor.index];
    if (el && tileClass(el) !== anchor.cls) return stop();
    if (el) {
      const delta = Math.round(el.getBoundingClientRect().top - anchor.offset);
      if (Math.abs(delta) > 1) win.scrollBy({ top: delta, left: 0, behavior: "instant" });
    }
    raf = win.requestAnimationFrame(tick);
  };
  raf = win.requestAnimationFrame(tick);
  return stop;
}
