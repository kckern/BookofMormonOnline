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
// The tile's identity (Sampler's data-tile-id: the registry key for the first
// batch, "b<batch>:<key>:<slot>" for infinite batches). Class + index alone
// matched a different tile of the same family once batches or reserves shifted
// the indexes (audit R4 analysis E1: 150-6,500px drifts on chained Backs).
const tileId = (el) => el?.dataset?.tileId || undefined;

const anchorOf = (nodes, i) => {
  const id = tileId(nodes[i]);
  return { index: i, cls: tileClass(nodes[i]), ...(id ? { id } : {}), offset: Math.round(nodes[i].getBoundingClientRect().top) };
};

/** The first tile still visible below the top third of the viewport. */
export function captureAnchor(nodes, viewportHeight) {
  const line = viewportHeight / 3;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].getBoundingClientRect().bottom > line) return anchorOf(nodes, i);
  }
  return null;
}

/**
 * The tile holding `target` (a clicked link): the one the reader is actually
 * reading. The scroll capture's "first tile in DOM order" is often a tall rail
 * tile beside it, which pins the rail while the reader's column drifts.
 */
export function captureTile(nodes, target) {
  const tile = target?.closest?.(".tile");
  const i = tile ? nodes.indexOf(tile) : -1;
  return i < 0 ? null : anchorOf(nodes, i);
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
  // An identified tile is that tile or nothing (wait for it to mount).
  if (anchor.id) return nodes.find((n) => tileId(n) === anchor.id) || null;
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
export function pinAnchor(getNodes, anchor, { win = window, now = () => Date.now(), timeoutMs = 3000, onStop } = {}) {
  let stopped = false;
  let raf = null;
  const deadline = now() + timeoutMs;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (raf) win.cancelAnimationFrame(raf);
    INPUTS.forEach((t) => win.removeEventListener(t, stop));
    onStop?.();
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
 * Back pinned the first tile (audit people E1).
 *
 * A click inside a tile (capture phase, before the router pushes) records THAT
 * tile, so Back returns to the card the reader opened. While `paused()` (the
 * Back pin is still scrolling the page into place) scroll captures are
 * skipped: they recorded mid-settle positions, and the next Back pinned those
 * (audit R4 analysis E1). Returns a stop() function.
 */
export function trackAnchor(getNodes, onCapture, { win = window, paused = () => false } = {}) {
  const path = win.location.pathname;
  const here = () => win.location.pathname === path;
  let raf = null;
  const onScroll = () => {
    if (raf || !here() || paused()) return;
    raf = win.requestAnimationFrame(() => {
      raf = null;
      if (here() && !paused()) onCapture(captureAnchor(getNodes(), win.innerHeight));
    });
  };
  const onClick = (e) => {
    if (!here()) return;
    const a = captureTile(getNodes(), e?.target);
    if (a) onCapture(a);
  };
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("click", onClick, true);
  return () => {
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("click", onClick, true);
    if (raf) win.cancelAnimationFrame(raf);
  };
}
