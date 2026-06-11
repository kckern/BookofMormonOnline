import { buildInitSteps, buildOpenList, awaitTargetPresent } from "../usePageInit";
jest.mock("src/utils/deepLinkInstrument", () => ({
  recordDeepLinkEvent: jest.fn(),
}));
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";

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

// ── awaitTargetPresent tests ──────────────────────────────────────────────────

let rafQueue;
const flushFrames = async (n) => {
  for (let i = 0; i < n; i++) {
    const q = [...rafQueue];
    rafQueue = [];
    q.forEach((cb) => cb());
    await Promise.resolve();
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  rafQueue = [];
  window.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
  window.cancelAnimationFrame = jest.fn();
});
afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

test("awaitTargetPresent resolves true immediately when selector already in DOM", async () => {
  dom(`<div id="lehites/3"></div>`);
  const result = await awaitTargetPresent(`[id="lehites/3"]`);
  expect(result).toBe(true);
  // No rAF scheduled when the element is already present
  expect(rafQueue).toHaveLength(0);
});

test("awaitTargetPresent resolves false after timeout when element never appears", async () => {
  // Nothing in DOM for this selector
  const p = awaitTargetPresent(`[textid="lehites/missing"]`, { timeoutMs: 1000 });
  // Advance fake timers past the timeout
  jest.advanceTimersByTime(1001);
  // Drain any pending microtasks/rAF frames
  await flushFrames(2);
  await expect(p).resolves.toBe(false);
});

test("buildInitSteps: call step (itemOpened) comes before its paired openAndAwait for nested textId", () => {
  dom(`
    <div class="content"><div class="row">
      <div textid="lehites/3"><span class="reference"><a href="#">3</a></span>
        <div textid="lehites/5"><span class="reference"><a href="#">5</a></span></div>
      </div>
    </div></div>`);
  const autoClicked = new Set();
  const { steps } = buildInitSteps({
    states: { initOpen: { textId: "5" }, pageSlug: "lehites", autoClicked },
  });
  // Find the first call+openAndAwait pair for the parent slug
  const types = steps.map((s) => s.type);
  // call must immediately precede openAndAwait
  const callIdx = types.indexOf("call");
  expect(callIdx).toBeGreaterThan(-1);
  expect(types[callIdx + 1]).toBe("openAndAwait");
  // Invoke the call step fn; it should emit itemOpened for the parent slug
  steps[callIdx].fn();
  expect(recordDeepLinkEvent).toHaveBeenCalledWith("initPageItem:itemOpened", { slug: "lehites/3" });
  // autoClicked must also have been populated
  expect(autoClicked.has("lehites/3")).toBe(true);
});
