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
