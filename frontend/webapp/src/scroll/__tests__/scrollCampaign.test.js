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
