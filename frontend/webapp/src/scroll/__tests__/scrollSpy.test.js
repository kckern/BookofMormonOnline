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
