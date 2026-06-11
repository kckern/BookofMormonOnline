# Page Scroll Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rip-and-replace the Page view's scroll choreography with the approved scroll-manager design (`docs/specs/2026-06-11-page-scroll-manager.md` — the authoritative spec; read it before starting).

**Architecture:** Pure-JS core in `src/scroll/` (abort token + campaign arbiter + settle detection + IntersectionObserver spy), a React adapter (`usePageInit`) that turns `initOpen` into campaigns, and surgical Page.js rewiring. One invariant: at most one campaign runs; new campaigns and user input cancel it. All campaign promises resolve (never reject) with `completed | interrupted | superseded | failed`.

**Tech Stack:** React 17 / CRA (jest 27 + jsdom — note: NO `AbortController` reliance in the core; we ship our own tiny abort token because CRA's jsdom predates it), Playwright e2e (existing `e2e/deeplink-*.spec.js` assert the instrument events `initPageItem:enter` / `initPageItem:callback` — the adapter must keep emitting those names).

**Working directory:** repo root `/home/bom/BookofMormonOnline`; npm/npx from `frontend/webapp/`. Dev server: systemd `bom-dev`, frontend `localhost:8200` (HMR; do NOT restart the unit; never verify against the CDN-cached public domain).

**Verified facts the plan relies on** (re-verify only if an edit fails): `Utils.scrollTo` has no callers outside `initPipeline.js` and its own tests; `appController.functions.setSlug(val, opts)` already supports `{replace: true}` (appController.js:215-218); the DOM "open" condition is `[textid='<slug>'] .reference` gaining class `open` (utils/awaitDomOpen.js); `TextContent.js:39,57` reads `states.autoClicked.has(slug)` to tag auto-opens; `states.touched` is written (Page.js onMouseDown + scroll-spy) but never read.

---

### Task 1: `settle.js` — settled-scroll and settled-height detection

**Files:**
- Create: `frontend/webapp/src/scroll/settle.js`
- Test: `frontend/webapp/src/scroll/__tests__/settle.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/webapp/src/scroll/__tests__/settle.test.js`:

```js
import { awaitScrollSettled, awaitHeightSettled } from "../settle";
import { createAbortToken } from "../scrollCampaign";

// Deterministic rAF: frames advance only when we say so.
let rafQueue;
const flushFrames = async (n) => {
  for (let i = 0; i < n; i++) {
    const q = [...rafQueue];
    rafQueue = [];
    q.forEach((cb) => cb());
    await Promise.resolve();
  }
};
const setScrollY = (y) =>
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });

beforeEach(() => {
  jest.useFakeTimers();
  rafQueue = [];
  window.requestAnimationFrame = (cb) => rafQueue.push(cb) && rafQueue.length;
  window.cancelAnimationFrame = () => {};
  setScrollY(0);
});
afterEach(() => jest.useRealTimers());

test("resolves settled when position is stable near the target", async () => {
  setScrollY(500);
  const p = awaitScrollSettled(500, { timeoutMs: 3000 });
  await flushFrames(4); // 3 stable frames + dispatch
  await expect(p).resolves.toBe("settled");
});

test("does not settle while still moving, settles once stable at target", async () => {
  const p = awaitScrollSettled(300, {});
  setScrollY(100); await flushFrames(1);
  setScrollY(200); await flushFrames(1);
  setScrollY(300); await flushFrames(4);
  await expect(p).resolves.toBe("settled");
});

test("aborts via token", async () => {
  const token = createAbortToken();
  const p = awaitScrollSettled(900, { token });
  setScrollY(50); await flushFrames(1);
  token.abort("interrupted");
  await expect(p).resolves.toBe("aborted");
});

test("times out when never stable", async () => {
  let y = 0;
  const p = awaitScrollSettled(10_000, { timeoutMs: 1000 });
  const drift = setInterval(() => setScrollY((y += 50)), 10);
  jest.advanceTimersByTime(1001);
  clearInterval(drift);
  await expect(p).resolves.toBe("timeout");
});

test("scrollend resolves immediately (fast path)", async () => {
  const p = awaitScrollSettled(800, {});
  window.dispatchEvent(new Event("scrollend"));
  await expect(p).resolves.toBe("settled");
});

test("awaitHeightSettled waits for height stability and the open check", async () => {
  const el = document.createElement("div");
  let height = 10;
  let open = false;
  el.getBoundingClientRect = () => ({ height });
  const p = awaitHeightSettled(el, { extraCheck: () => open });
  height = 60; await flushFrames(1);
  height = 120; open = true; await flushFrames(1);
  await flushFrames(3); // stable now
  await expect(p).resolves.toBe("settled");
});
```

- [ ] **Step 2: Run — must fail (module not found)**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/scroll/__tests__/settle.test.js
```

Expected: FAIL — `Cannot find module '../settle'` (and `'../scrollCampaign'`).

- [ ] **Step 3: Create `frontend/webapp/src/scroll/settle.js`**

```js
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
```

- [ ] **Step 4: Create a minimal `scrollCampaign.js` with ONLY `createAbortToken`** (Task 2 fills the rest; the settle tests import it):

Create `frontend/webapp/src/scroll/scrollCampaign.js`:

```js
// Campaign arbiter for all programmatic scrolling (see Task 2 for the rest).

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
      listeners.forEach((fn) => fn());
      listeners.clear();
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
```

- [ ] **Step 5: Run the settle tests — all pass.** Same command as Step 2; expected 6 passed.

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/scroll
git commit -m "feat(scroll): settle detection + abort token (scroll manager core, 1/3)

Position-settled rAF polling (Safari has no scrollend) with scrollend
fast path and timeout last resort; height-settled detection for
expanding boxes (open class lands before the Collapse animation ends).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `scrollCampaign.js` — the arbiter and step runner

**Files:**
- Modify: `frontend/webapp/src/scroll/scrollCampaign.js`
- Test: `frontend/webapp/src/scroll/__tests__/scrollCampaign.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/webapp/src/scroll/__tests__/scrollCampaign.test.js`:

```js
import { createScrollManager, step, documentTop } from "../scrollCampaign";

let rafQueue;
const flushFrames = async (n) => {
  for (let i = 0; i < n; i++) {
    const q = [...rafQueue];
    rafQueue = [];
    q.forEach((cb) => cb());
    await Promise.resolve();
  }
};
const setScrollY = (y) =>
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });

const fakeEl = (top, height = 100) => ({
  getBoundingClientRect: () => ({ top: top - window.scrollY, height }),
  click: jest.fn(),
});

beforeEach(() => {
  rafQueue = [];
  window.requestAnimationFrame = (cb) => rafQueue.push(cb) && rafQueue.length;
  window.cancelAnimationFrame = () => {};
  window.innerHeight = 1000;
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 10_000,
    configurable: true,
  });
  setScrollY(0);
  window.scrollTo = jest.fn(({ top }) => setScrollY(top)); // instant fake browser
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
});

test("scrollToElement scrolls to documentTop minus the offset and completes", async () => {
  const el = fakeEl(2000);
  const events = [];
  const mgr = createScrollManager({ onEvent: (e) => events.push(e.name) });
  const p = mgr.run([step.scrollToElement(() => el, { offsetRatio: 0.2 })]);
  await flushFrames(5);
  const { status } = await p;
  expect(status).toBe("completed");
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 1800, behavior: "smooth" });
  expect(events).toContain("campaignEnd");
});

test("negative targets clamp to 0 instead of being skipped", async () => {
  setScrollY(500);
  const el = fakeEl(50); // 50 - 200 offset → -150 → clamp 0
  const mgr = createScrollManager();
  const p = mgr.run([step.scrollToElement(() => el, { offsetRatio: 0.2 })]);
  await flushFrames(5);
  expect((await p).status).toBe("completed");
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
});

test("already-at-target is a noop step", async () => {
  setScrollY(1800);
  const el = fakeEl(2000);
  const mgr = createScrollManager();
  const { status } = await mgr.run([step.scrollToElement(() => el, { offsetRatio: 0.2 })]);
  expect(status).toBe("completed");
  expect(window.scrollTo).not.toHaveBeenCalled();
});

test("a new run supersedes the in-flight one", async () => {
  // First scroll never settles on its own: browser fake that doesn't move.
  window.scrollTo = jest.fn();
  const mgr = createScrollManager();
  const p1 = mgr.run([step.scrollToElement(() => fakeEl(3000))]);
  await flushFrames(1);
  const p2 = mgr.run([]);
  expect((await p1).status).toBe("superseded");
  expect((await p2).status).toBe("completed");
});

test("user input interrupts and tail call-steps are skipped", async () => {
  window.scrollTo = jest.fn(); // never settles
  const tail = jest.fn();
  const mgr = createScrollManager();
  const p = mgr.run([step.scrollToElement(() => fakeEl(3000)), step.call(tail)]);
  await flushFrames(1);
  window.dispatchEvent(new Event("wheel"));
  expect((await p).status).toBe("interrupted");
  expect(tail).not.toHaveBeenCalled();
});

test("non-nav keydown does not interrupt", async () => {
  const el = fakeEl(2000);
  const mgr = createScrollManager();
  const p = mgr.run([step.scrollToElement(() => el)]);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
  await flushFrames(5);
  expect((await p).status).toBe("completed");
});

test("missing target fails the campaign", async () => {
  const mgr = createScrollManager();
  const { status } = await mgr.run([step.scrollToElement(() => null)]);
  expect(status).toBe("failed");
});

test("openAndAwait clicks only when closed and waits for height stability", async () => {
  const trigger = fakeEl(100);
  let open = false;
  let height = 40;
  const box = { getBoundingClientRect: () => ({ height }) };
  trigger.click = jest.fn(() => {
    open = true;
    height = 400;
  });
  const mgr = createScrollManager();
  const p = mgr.run([
    step.openAndAwait(() => trigger, { isOpen: () => open, getContainer: () => box }),
  ]);
  await flushFrames(6);
  expect((await p).status).toBe("completed");
  expect(trigger.click).toHaveBeenCalledTimes(1);

  // already open → no click
  const p2 = mgr.run([
    step.openAndAwait(() => trigger, { isOpen: () => open, getContainer: () => box }),
  ]);
  await flushFrames(6);
  expect((await p2).status).toBe("completed");
  expect(trigger.click).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run — must fail** (`createScrollManager is not a function` / not exported). Command:

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/scroll/__tests__/scrollCampaign.test.js
```

- [ ] **Step 3: Complete `frontend/webapp/src/scroll/scrollCampaign.js`** — append below `createAbortToken` (keep it):

```js
import {
  awaitScrollSettled,
  awaitHeightSettled,
  prefersReducedMotion,
  POSITION_TOLERANCE_PX,
} from "./settle";

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
```

- [ ] **Step 4: Run scrollCampaign + settle tests — all pass.**
- [ ] **Step 5: Commit** — `feat(scroll): campaign arbiter + step runner (scroll manager core, 2/3)` (same Co-Authored-By trailer as Task 1).

---

### Task 3: `scrollSpy.js` + `index.js`

**Files:**
- Create: `frontend/webapp/src/scroll/scrollSpy.js`, `frontend/webapp/src/scroll/index.js`
- Test: `frontend/webapp/src/scroll/__tests__/scrollSpy.test.js`

- [ ] **Step 1: Failing test** — create `frontend/webapp/src/scroll/__tests__/scrollSpy.test.js`:

```js
import { createScrollSpy } from "../scrollSpy";

let observed, ioCallback, disconnected;
beforeEach(() => {
  observed = [];
  disconnected = false;
  global.IntersectionObserver = class {
    constructor(cb) { ioCallback = cb; }
    observe(el) { observed.push(el); }
    disconnect() { disconnected = true; }
  };
});

const section = (id) => {
  const el = document.createElement("div");
  el.id = id;
  return el;
};

test("observes sections on start, emits the topmost intersecting one, detaches on stop", () => {
  const a = section("page/one");
  const b = section("page/two");
  const active = [];
  const spy = createScrollSpy({ getSections: () => [a, b], onActive: (el) => active.push(el.id) });
  spy.start();
  expect(observed).toEqual([a, b]);
  ioCallback([
    { isIntersecting: true, target: b, boundingClientRect: { top: 300 } },
    { isIntersecting: true, target: a, boundingClientRect: { top: 10 } },
  ]);
  expect(active).toEqual(["page/one"]);
  spy.stop();
  expect(disconnected).toBe(true);
});

test("start is idempotent and tolerates zero sections", () => {
  const spy = createScrollSpy({ getSections: () => [], onActive: () => {} });
  spy.start();
  spy.start();
  expect(observed).toEqual([]);
  spy.stop();
});
```

- [ ] **Step 2: Run — fails (module not found).**
- [ ] **Step 3: Create `frontend/webapp/src/scroll/scrollSpy.js`:**

```js
// Active-section watcher: which section occupies the top band of the
// viewport. IntersectionObserver — zero per-scroll-event layout reads
// (replaces the old window.onscroll offsetTop loop).
export function createScrollSpy({ getSections, topBandRatio = 0.2, onActive }) {
  let observer = null;
  return {
    start() {
      if (observer || typeof IntersectionObserver === "undefined") return;
      observer = new IntersectionObserver(
        (entries) => {
          const inBand = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (inBand.length) onActive(inBand[0].target);
        },
        {
          root: null,
          // Shrink the observation area to the top topBandRatio of the viewport.
          rootMargin: `0px 0px -${Math.round((1 - topBandRatio) * 100)}% 0px`,
          threshold: 0,
        }
      );
      Array.from(getSections() || []).forEach((s) => observer.observe(s));
    },
    stop() {
      if (observer) observer.disconnect();
      observer = null;
    },
  };
}
```

And `frontend/webapp/src/scroll/index.js`:

```js
export { createScrollManager, createAbortToken, step, documentTop } from "./scrollCampaign";
export { awaitScrollSettled, awaitHeightSettled, prefersReducedMotion } from "./settle";
export { createScrollSpy } from "./scrollSpy";
```

- [ ] **Step 4: Run all three scroll suites — pass.** **Step 5: Commit** — `feat(scroll): IntersectionObserver scroll spy (scroll manager core, 3/3)`.

---

### Task 4: `usePageInit` adapter — campaigns from `initOpen`

**Files:**
- Create: `frontend/webapp/src/views/Page/usePageInit.js`
- Test: `frontend/webapp/src/views/Page/__tests__/usePageInit.test.js`

- [ ] **Step 1: Failing test for the pure builders** (the hook itself is exercised in Task 5's e2e/manual pass — Page.js can't run under jsdom):

Create `frontend/webapp/src/views/Page/__tests__/usePageInit.test.js`:

```js
import { buildInitSteps, buildOpenList } from "../usePageInit";

const dom = (html) => { document.body.innerHTML = html; };

const controller = (initOpen, pageSlug = "lehites") => ({
  states: { initOpen, pageSlug, autoClicked: new Set() },
});

afterEach(() => { document.body.innerHTML = ""; });

test("textId: scroll → open parent → open target → final scroll, in DOM order", () => {
  dom(`
    <div class="content"><div class="row">
      <div textid="lehites/3"><span class="reference"><a href="#">3</a></span>
        <div textid="lehites/5"><span class="reference"><a href="#">5</a></span></div>
      </div>
    </div></div>`);
  const { steps } = buildInitSteps(controller({ textId: "5" }));
  expect(steps.map((s) => s.type)).toEqual([
    "scrollToElement",
    "call", "openAndAwait",   // parent lehites/3 (autoClicked tag + open)
    "call", "openAndAwait",   // target lehites/5
    "scrollToElement",        // final corrective scroll
  ]);
});

test("textId with no parent nesting opens only the target", () => {
  dom(`<div class="row"><div textid="lehites/7"><span class="reference"><a>7</a></span></div></div>`);
  const { steps } = buildInitSteps(controller({ textId: "7" }));
  expect(steps.filter((s) => s.type === "openAndAwait")).toHaveLength(1);
});

test("missing textId element reports verseNotFound", () => {
  dom(`<div class="row"></div>`);
  const out = buildInitSteps(controller({ textId: "99" }));
  expect(out.steps).toBeNull();
  expect(out.reason).toBe("verseNotFound");
});

test("goToSection scrolls to the section element", () => {
  dom(`<div id="lehites/some-section" class="pagesection"></div>`);
  const { steps } = buildInitSteps(controller({ goToSection: "some-section" }));
  expect(steps.map((s) => s.type)).toEqual(["scrollToElement"]);
});

test("no target yields empty steps", () => {
  expect(buildInitSteps(controller({})).steps).toEqual([]);
});

test("buildOpenList filters non-string parent slugs", () => {
  dom(`<div class="row"><div textid="lehites/2"><span class="reference"><a>2</a></span></div></div>`);
  const { openSlugs } = buildOpenList("lehites", "2");
  expect(openSlugs).toEqual(["lehites/2"]);
});
```

- [ ] **Step 2: Run — fails (module not found).**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/views/Page/__tests__/usePageInit.test.js
```

- [ ] **Step 3: Create `frontend/webapp/src/views/Page/usePageInit.js`:**

```js
import { useEffect, useRef, useState } from "react";
import { createScrollManager, step } from "src/scroll";
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
import { orderByDomAncestry } from "src/utils/orderByDomAncestry";

// ONE arbiter for the window: any new campaign — or any user scroll input —
// cancels the campaign in flight. autoAdvance and deep-link init share it.
export const pageScrollManager = createScrollManager({
  onEvent: (e) => recordDeepLinkEvent(`scrollManager:${e.name}`, e),
});

export const isRefOpen = (slug) =>
  !!document
    .querySelector(`[textid="${slug}"] .reference`)
    ?.classList.contains("open");

export function buildOpenList(pageSlug, textId) {
  const textSlug = `${pageSlug}/${textId}`;
  const el = document.querySelector(`[textid="${textSlug}"]`);
  if (!el) return { targetRow: null, openSlugs: [] };
  const targetRow = el.closest(".row");
  const parentSlug = el.closest(".row > [textid]")?.getAttribute("textid");
  const slugs = [];
  if (typeof parentSlug === "string" && parentSlug && parentSlug !== textSlug) {
    slugs.push(parentSlug);
  }
  slugs.push(textSlug);
  return { targetRow, openSlugs: orderByDomAncestry(slugs) };
}

// Pure-ish builder (reads the DOM, mutates nothing): initOpen → campaign steps.
export function buildInitSteps(pageController) {
  const { initOpen, pageSlug, autoClicked } = pageController.states;

  if (initOpen.goToSection) {
    const id = `${pageSlug}/${initOpen.goToSection}`;
    if (!document.getElementById(id)) return { steps: null, reason: "sectionMissing" };
    return { steps: [step.scrollToElement(() => document.getElementById(id))] };
  }

  // Legacy lastLeaf section scroll (old initPage path).
  if (!initOpen.textId && initOpen.lastLeaf && initOpen.lastLeaf !== initOpen.pageSlug) {
    const id = `${initOpen.pageSlug}/${initOpen.lastLeaf}`;
    if (!document.getElementById(id)) return { steps: [] };
    return { steps: [step.scrollToElement(() => document.getElementById(id))] };
  }

  if (!initOpen.textId) return { steps: [] };

  const { targetRow, openSlugs } = buildOpenList(pageSlug, initOpen.textId);
  if (!targetRow || !openSlugs.length) return { steps: null, reason: "verseNotFound" };

  const steps = [step.scrollToElement(() => targetRow)];
  for (const slug of openSlugs) {
    steps.push(
      // Parity: TextContent tags opens as auto when the slug is in autoClicked.
      step.call(() => autoClicked.add(slug)),
      step.openAndAwait(
        () => document.querySelector(`[textid="${slug}"] .reference a`),
        {
          isOpen: () => isRefOpen(slug),
          getContainer: () =>
            document.querySelector(`[textid="${slug}"]`)?.closest(".row"),
        }
      )
    );
  }
  const targetSlug = openSlugs[openSlugs.length - 1];
  steps.push(
    step.scrollToElement(
      () =>
        document.querySelector(`[textid="${targetSlug}"]`)?.closest(".row") ||
        targetRow
    )
  );
  return { steps };
}

// phase: idle → waiting (comments gate) → positioning → ready
export function usePageInit(pageController, { gateOpen, identityKey, onTail }) {
  const [phase, setPhase] = useState("idle");
  const lastRunKey = useRef(null);
  const sawInputWhileWaiting = useRef(false);

  // UC-11: a user already reading during the comments gate must not be yanked.
  useEffect(() => {
    if (phase !== "waiting") return;
    const mark = () => { sawInputWhileWaiting.current = true; };
    const opts = { passive: true, once: true };
    window.addEventListener("wheel", mark, opts);
    window.addEventListener("touchstart", mark, opts);
    return () => {
      window.removeEventListener("wheel", mark, opts);
      window.removeEventListener("touchstart", mark, opts);
    };
  }, [phase]);

  useEffect(() => {
    let disposed = false;
    if (pageController.states.loading !== false) {
      setPhase("idle");
      return undefined;
    }
    if (!gateOpen) {
      setPhase("waiting");
      return undefined;
    }
    // E-13: the same resolved target re-arriving via a URL rewrite (e.g.
    // /image/N → /art/N) must not re-run the pipeline.
    if (lastRunKey.current === identityKey) return undefined;
    lastRunKey.current = identityKey;
    setPhase("positioning");
    recordDeepLinkEvent("initPageItem:enter");

    const finish = () => {
      if (disposed) return;
      recordDeepLinkEvent("initPageItem:markAsInitiated");
      pageController.functions.markAsInitiated();
      setPhase("ready");
    };

    const built = buildInitSteps(pageController);
    if (built.steps === null) {
      if (built.reason === "verseNotFound" && pageController.states.initOpen.textId) {
        pageController.functions.setInitWarning({
          type: "verseNotFound",
          slug: `${pageController.states.pageSlug}/${pageController.states.initOpen.textId}`,
        });
      }
      finish();
      return undefined;
    }
    if (!built.steps.length || sawInputWhileWaiting.current) {
      sawInputWhileWaiting.current = false;
      finish();
      return undefined;
    }
    pageScrollManager.run(built.steps).then(({ status }) => {
      if (!disposed && status === "completed" && onTail) {
        recordDeepLinkEvent("initPageItem:callback");
        onTail();
      }
      finish();
    });
    return () => { disposed = true; };
  }, [gateOpen, identityKey, pageController.states.loading]);

  // Leaving the page (or switching identity) supersedes any in-flight campaign.
  useEffect(() => () => pageScrollManager.cancel("superseded"), [identityKey]);

  return phase;
}
```

- [ ] **Step 4: Run — builder tests pass.** **Step 5: Run the FULL suite** (`CI=true npx react-scripts test --watchAll=false`) — everything green. **Step 6: Commit** — `feat(page): usePageInit adapter — initOpen → scroll campaigns`.

---

### Task 5: Wire Page.js — init, gates, tails; retire `initPipeline`

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`

- [ ] **Step 1: Replace imports.** Remove the `initPipeline` import block (`initPage, initPageItem, initPageImage, initPageCommentary, initPageFax` from `"./initPipeline"`). Add:

```js
import { usePageInit, pageScrollManager, isRefOpen } from "./usePageInit";
import { createScrollSpy, step } from "src/scroll";
```

- [ ] **Step 2: Mount scroll (FR-9).** In the `[pageIdentityKey]` effect, replace `window.scrollTo({ top: 0, behavior: "smooth" });` with:

```js
    // Deep links position the viewport themselves; everything else resets
    // instantly (a smooth scroll here raced the pipeline's scroll — whiplash).
    const i = prepareInitOpen(match.params);
    const hasScrollTarget = !!(i.textId || i.goToSection || i.commentaryId || i.imageId || i.faxVersion);
    if (!hasScrollTarget) window.scrollTo({ top: 0, behavior: "auto" });
```

- [ ] **Step 3: Replace the init machinery.** Delete: the `[routeKey]` effect's `startInit(false)` and trailing `handlePageInit();` lines (keep all its other resets); the whole `handlePageInit` function; the `useEffect(handlePageInit, [...])` with the `document.querySelector(".content")` dep; the `const [initStarted, startInit] = useState(false);` line. Keep `readyToScroll` and its two effects (the comments gate). Add in their place:

```js
  const gateOpen = !needToLoadComments || readyToScroll;
  const initIdentityKey = [
    pageController.states.initOpen.pageSlug || "",
    pageController.states.initOpen.textId || "",
    pageController.states.initOpen.goToSection || "",
    pageController.states.initOpen.lastLeaf || "",
    pageController.states.initOpen.commentaryId || "",
    pageController.states.initOpen.imageId || "",
    pageController.states.initOpen.faxVersion || "",
  ].join("|");
  const onTail = pageController.states.initOpen.commentaryId
    ? () =>
        pageController.appController.functions.setPopUp({
          type: "commentary",
          ids: [pageController.states.initOpen.commentaryId],
        })
    : pageController.states.initOpen.imageId
    ? () =>
        pageController.appController.functions.requestImageActivation({
          imageId: pageController.states.initOpen.imageId,
        })
    : null;
  const initPhase = usePageInit(pageController, { gateOpen, identityKey: initIdentityKey, onTail });
```

(The `[routeKey]` effect must run BEFORE this in source order so `setInitOpen` lands first — it already does; verify the effect still compiles after removing the two lines.)

- [ ] **Step 4: `markAsInitiated` no longer attaches the spy.** In the controller `functions` block, change:

```js
        markAsInitiated: (val) => {
          dispatch({ fn: "markAsInitiated", val: val });
          onScrollPage(pageController);
        },
```

to:

```js
        markAsInitiated: (val) => {
          dispatch({ fn: "markAsInitiated", val: val });
        },
```

- [ ] **Step 5: Run full jest suite (green), then the e2e deep-link specs** against the dev server:

```bash
cd /home/bom/BookofMormonOnline
npx playwright test --config e2e/playwright.config.js deeplink- 2>&1 | tail -5
```

Expected: the deeplink specs pass (they assert `initPageItem:enter` / `initPageItem:callback`, which `usePageInit` still emits). If a spec times out, debug the adapter — do not edit the spec to pass.

- [ ] **Step 6: Commit** — `feat(page): drive deep-link init through the scroll manager`.

---

### Task 6: Scroll-spy wiring — replace `onScrollPage`

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`

- [ ] **Step 1: Add the spy effect** (place near the other effects, after `initPhase` exists):

```js
  // Active-section tracking — enabled only once init has settled (the old
  // window.onscroll spy attached mid-animation and leaked across views).
  useEffect(() => {
    if (initPhase !== "ready") return undefined;
    const spy = createScrollSpy({
      getSections: () => document.getElementsByClassName("pagesection"),
      onActive: (el) => {
        const slug = el.id;
        const title = el.attributes?.titletext?.nodeValue || null;
        if (slug && slug !== pageController.states.activeSection) {
          pageController.functions.setActiveSection({ slug, title });
        }
      },
    });
    spy.start();
    return () => spy.stop();
  }, [initPhase, pageController.states.pageSlug]);
```

- [ ] **Step 2: Delete the whole `onScrollPage` function** (the `window.onscroll = ...` assignment block).

- [ ] **Step 3: Fix the reducer case** — replace the `setActiveSection` case body:

```js
    case "setActiveSection":
      let { slug: sectionSlug, title: sectionTitle } = input.val;
      pageController.states.activeSection = sectionSlug;
      document.title =
        sectionTitle || pageController.pageData.title || label("home_title");
      // replace, not push: scrolling is not navigation — Back should leave
      // the page in one press. (The old `|| true` made the init guard dead.)
      pageController.appController.functions.setSlug(sectionSlug, { replace: true });
      break;
```

- [ ] **Step 4: Delete the dead `touched` flag.** Remove the `onMouseDown={() => pageController.functions.setTouched(true)}` prop from the content div, the `setTouched` function entry, the `touched: false` state init, and the reducer's `setTouched` case. Pre-check it really is write-only:

```bash
grep -rn "states.touched\|setTouched" frontend/webapp/src | grep -v "Page.js"
```

Expected: no output (if anything else reads it, STOP and report instead of deleting).

- [ ] **Step 5: Verify + commit.** Jest suite green; manual: scroll through a page on `localhost:8200/lehites` → URL updates per section, Back exits in one press. Commit — `feat(page): IntersectionObserver scroll spy; replace-not-push URL sync`.

---

### Task 7: Auto-play advance through the manager

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js` (`autoAdvance` in the controller functions)

- [ ] **Step 1: Replace `autoAdvance`:**

```js
        autoAdvance: () => {
          if (!pageController.appController.states.preferences.autoplay)
            return false;
          let parts = pageController.states.activeRow.split("/").reverse();
          let nextNum = parseInt(parts[0]) + 1;
          parts[0] = nextNum;
          let newSlug = parts.reverse().join("/");
          const getTrigger = () =>
            document.querySelectorAll(`a[href='/${newSlug}']`)[0];
          if (!getTrigger()) return false;
          // Open first, then scroll to the opened content (the old order
          // centered the link, then the expansion pushed the content
          // off-screen). The shared manager means a user-initiated scroll
          // or the next deep-link campaign cancels this cleanly.
          pageScrollManager.run([
            step.openAndAwait(getTrigger, {
              isOpen: () => isRefOpen(newSlug),
              getContainer: () =>
                document.querySelector(`[textid="${newSlug}"]`)?.closest(".row") ||
                getTrigger(),
            }),
            step.scrollToElement(
              () =>
                document.querySelector(`[textid="${newSlug}"]`)?.closest(".row") ||
                getTrigger()
            ),
          ]);
        },
```

Note: the trigger is a react-router `<a>` — clicking it also updates the URL (parity with the old behavior). The route change re-fires `usePageInit` with a new identity; its campaign supersedes this one and produces the same end state (row open, scrolled to offset) — both paths converge, no double-driving.

- [ ] **Step 2: Verify + commit.** Jest green. Manual: enable autoplay, play a verse to its end on `localhost:8200/lehites/1` → next box opens, then the view settles on the opened content; grabbing the scrollbar mid-advance stops the auto-scroll while audio continues. Commit — `feat(page): auto-play advance opens then scrolls via the manager`.

---

### Task 8: Rip-out, acceptance checks, e2e alignment

**Files:**
- Delete: `frontend/webapp/src/views/Page/initPipeline.js`, `frontend/webapp/src/utils/awaitDomOpen.js`, `frontend/webapp/src/utils/__tests__/awaitDomOpen.test.js`, `e2e/scrollto-callback.spec.js`
- Modify: `frontend/webapp/src/models/Utils.js` (delete `scrollTo` + `SCROLL_FALLBACK_MS`), `frontend/webapp/src/utils/__tests__/scrollTo.test.js` (delete)

- [ ] **Step 1: Delete the superseded modules.** `initPipeline.js` (fully replaced by `usePageInit`), `awaitDomOpen.js` + its test (absorbed by `awaitHeightSettled` + `isOpen` checks), `Utils.scrollTo` + `SCROLL_FALLBACK_MS` + `src/utils/__tests__/scrollTo.test.js` (no callers remain), and `e2e/scrollto-callback.spec.js` (it asserted the deleted `scrollTo:*` instrument events; campaign behavior is covered by the core unit tests and the deeplink specs).

- [ ] **Step 2: Acceptance greps (spec §9.5):**

```bash
cd /home/bom/BookofMormonOnline
grep -rn "window.onscroll\|initPipeline\|states.touched\|awaitDomOpen\|SCROLL_FALLBACK_MS" frontend/webapp/src && echo "FAIL: leftovers" || echo "clean"
grep -rn "scrollTo(" frontend/webapp/src --include="*.js" | grep -v "window.scrollTo\|scrollIntoView" | grep -v "__tests__" || echo "no Utils.scrollTo callers"
```

- [ ] **Step 3: Full verification.** Jest suite green (`CI=true npx react-scripts test --watchAll=false`); all deeplink e2e specs green; then the manual checklist from spec §8 on `localhost:8200` (Chrome; Safari pass when available): UC-1 verse deep link `/lehites/5`, UC-3 section link, UC-4 commentary, UC-5 image (incl. the `/art/` rewrite not re-running init), UC-6 fax, UC-9/10 autoplay + interrupt, UC-12 spy/Back, reduced-motion instant.

- [ ] **Step 4: Commit** — `chore(page): remove superseded scroll pipeline (initPipeline, awaitDomOpen, Utils.scrollTo)` — and update `docs/specs/2026-06-11-page-scroll-manager.md` status line to `Implemented` in the same commit.

---

## Out of scope (unchanged, per spec §2/§7)

Read/Theater adoption of `src/scroll/`; per-row `new Audio` + `ended`-listener accumulation in the Page reducer; `clicky.goal` timing/auto-open analytics; the `match.params` re-parser (load-bearing, documented in spec E-12 — spy slug format is kept byte-identical).
