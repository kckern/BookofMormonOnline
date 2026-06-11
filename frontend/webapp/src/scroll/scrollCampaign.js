// Campaign arbiter for all programmatic scrolling (see Task 2 for the rest).

import {
  awaitScrollSettled,
  awaitHeightSettled,
  prefersReducedMotion,
  POSITION_TOLERANCE_PX,
} from "./settle";

// Tiny abort token (CRA's jest/jsdom predates AbortController; this also
// gives us abort *reasons* without polyfills).
export function createAbortToken() {
  const listeners = new Set();
  const token = {
    aborted: false,
    reason: null,
    abort(reason = "aborted") {
      if (token.aborted) return;
      token.aborted = true;
      token.reason = reason;
      try {
        listeners.forEach((fn) => fn());
      } finally {
        listeners.clear();
      }
    },
    onAbort(fn) {
      if (token.aborted) {
        fn();
        return () => {};
      }
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return token;
}

const DEFAULT_OFFSET_RATIO = 0.2;
const SCROLL_TIMEOUT_MS = 3000;
const OPEN_TIMEOUT_MS = 2500;
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

export function documentTop(el) {
  return el.getBoundingClientRect().top + window.scrollY;
}

export const step = {
  // getEl is LAZY — resolved when the step starts, so coordinates reflect the
  // DOM after the previous steps (opens shift layout).
  scrollToElement: (getEl, opts = {}) => ({
    type: "scrollToElement",
    getEl,
    offsetRatio: opts.offsetRatio ?? DEFAULT_OFFSET_RATIO,
    timeoutMs: opts.timeoutMs ?? SCROLL_TIMEOUT_MS,
  }),
  openAndAwait: (getEl, opts = {}) => ({
    type: "openAndAwait",
    getEl,
    isOpen: opts.isOpen || (() => false),
    getContainer: opts.getContainer || null,
    timeoutMs: opts.timeoutMs ?? OPEN_TIMEOUT_MS,
  }),
  // Tail actions (popups, activations) — only run while the campaign is clean.
  call: (fn) => ({ type: "call", fn }),
};

export function createScrollManager({ onEvent } = {}) {
  const emitBase = typeof onEvent === "function" ? onEvent : () => {};
  let current = null;

  function attachInputListeners(token) {
    const onInput = (e) => {
      if (e.type === "keydown" && !NAV_KEYS.has(e.key)) return;
      token.abort("interrupted");
    };
    const opts = { passive: true };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach((t) =>
      window.addEventListener(t, onInput, opts)
    );
    return () =>
      ["wheel", "touchstart", "keydown", "mousedown"].forEach((t) =>
        window.removeEventListener(t, onInput, opts)
      );
  }

  async function runSteps(steps, token, emit) {
    for (let i = 0; i < steps.length; i++) {
      if (token.aborted) return token.reason;
      const s = steps[i];
      if (s.type === "call") {
        s.fn();
        emit("call", { index: i });
        continue;
      }
      const el = typeof s.getEl === "function" ? s.getEl() : null;
      if (!el) {
        emit("missingTarget", { index: i, stepType: s.type });
        return "failed";
      }
      if (s.type === "scrollToElement") {
        const offset = Math.round(window.innerHeight * s.offsetRatio);
        const maxScroll = Math.max(
          0,
          (document.documentElement.scrollHeight || 0) - window.innerHeight
        );
        const target = Math.min(maxScroll, Math.max(0, Math.round(documentTop(el) - offset)));
        if (Math.abs(window.scrollY - target) <= POSITION_TOLERANCE_PX) {
          emit("scrollNoop", { index: i, target });
          continue;
        }
        emit("scrollStart", { index: i, target });
        window.scrollTo({
          top: target,
          behavior: prefersReducedMotion() ? "instant" : "smooth",
        });
        const result = await awaitScrollSettled(target, { token, timeoutMs: s.timeoutMs });
        emit("scrollDone", { index: i, target, result });
        if (result === "aborted") return token.reason;
      } else if (s.type === "openAndAwait") {
        if (s.isOpen(el)) {
          emit("openSkip", { index: i });
        } else {
          emit("openClick", { index: i });
          el.click();
        }
        // NOTE: container is resolved once; consumers whose DOM remounts on
        // open (keyed containers) must pass a getContainer that survives it.
        const container = (s.getContainer && s.getContainer()) || el;
        const result = await awaitHeightSettled(container, {
          token,
          timeoutMs: s.timeoutMs,
          extraCheck: () => s.isOpen(el),
        });
        emit("openDone", { index: i, result });
        if (result === "aborted") return token.reason;
      }
    }
    return token.aborted ? token.reason : "completed";
  }

  return {
    isRunning: () => !!current,
    cancel(reason = "superseded") {
      if (current) current.token.abort(reason);
    },
    // Resolves (never rejects) with {status}.
    async run(steps) {
      if (current) current.token.abort("superseded");
      const token = createAbortToken();
      const mine = { token };
      current = mine;
      const emit = (name, data = {}) => emitBase({ name, ...data });
      const detach = attachInputListeners(token);
      emit("campaignStart", { steps: steps.length });
      try {
        const status = await runSteps(steps, token, emit);
        emit("campaignEnd", { status });
        return { status };
      } finally {
        detach();
        if (current === mine) current = null;
      }
    },
  };
}
