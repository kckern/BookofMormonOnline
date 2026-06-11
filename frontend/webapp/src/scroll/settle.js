// Scroll/layout settling detection for the scroll manager. Pure DOM + timers,
// no React. All waiters RESOLVE (never reject) with:
//   "settled" | "aborted" | "timeout"

export const STABLE_FRAMES = 3;
export const POSITION_TOLERANCE_PX = 2;
// A smooth scroll can take a frame or two to begin moving; until then,
// "no movement" must not count as settled unless we're already at target.
const GRACE_FRAMES = 8;

export function prefersReducedMotion() {
  return !!(
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)")?.matches
  );
}

// Primary completion: window.scrollY stable for STABLE_FRAMES rAF frames and
// near the target (Safari has no scrollend). Fast path: scrollend. Last
// resort: timeoutMs.
export function awaitScrollSettled(targetY, { token, timeoutMs = 3000 } = {}) {
  return new Promise((resolve) => {
    let stable = 0;
    let frames = 0;
    let moved = false;
    let lastY = window.scrollY;
    let rafId = null;
    let timer = null;
    let offAbort = () => {};
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timer) clearTimeout(timer);
      window.removeEventListener("scrollend", onScrollEnd);
      offAbort();
      resolve(result);
    };
    const onScrollEnd = () => finish("settled");

    const tick = () => {
      frames += 1;
      const y = window.scrollY;
      if (Math.abs(y - lastY) > POSITION_TOLERANCE_PX) {
        moved = true;
        stable = 0;
      } else {
        stable += 1;
      }
      lastY = y;
      const nearTarget = Math.abs(y - targetY) <= POSITION_TOLERANCE_PX;
      if (stable >= STABLE_FRAMES && (nearTarget || moved || frames > GRACE_FRAMES)) {
        return finish("settled");
      }
      rafId = window.requestAnimationFrame(tick);
    };

    if (token?.aborted) return finish("aborted");
    if (token) offAbort = token.onAbort(() => finish("aborted"));
    timer = setTimeout(() => finish("timeout"), timeoutMs);
    window.addEventListener("scrollend", onScrollEnd, { once: true });
    rafId = window.requestAnimationFrame(tick);
  });
}

// Height stability for expanding boxes: the `open` class lands ~300ms before
// the Collapse animation finishes, so class-presence alone measures short.
// extraCheck (e.g. "is the open class present") must also hold.
export function awaitHeightSettled(el, { token, timeoutMs = 2500, extraCheck } = {}) {
  return new Promise((resolve) => {
    let stable = 0;
    let lastH = el.getBoundingClientRect().height;
    let rafId = null;
    let timer = null;
    let offAbort = () => {};
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timer) clearTimeout(timer);
      offAbort();
      resolve(result);
    };

    const tick = () => {
      const h = el.getBoundingClientRect().height;
      stable = Math.abs(h - lastH) <= 1 ? stable + 1 : 0;
      lastH = h;
      if ((!extraCheck || extraCheck()) && stable >= STABLE_FRAMES) return finish("settled");
      rafId = window.requestAnimationFrame(tick);
    };

    if (token?.aborted) return finish("aborted");
    if (token) offAbort = token.onAbort(() => finish("aborted"));
    timer = setTimeout(() => finish("timeout"), timeoutMs);
    rafId = window.requestAnimationFrame(tick);
  });
}
