import { recordDeepLinkEvent, resetDeepLinkEvents, getDeepLinkEvents } from "../deepLinkInstrument";

beforeEach(() => {
  delete window.__deepLinkInstrument;
  resetDeepLinkEvents();
});

describe("deepLinkInstrument", () => {
  test("is a no-op unless window.__deepLinkInstrument is true", () => {
    recordDeepLinkEvent("scrollStart", { distance: 100 });
    expect(getDeepLinkEvents()).toEqual([]);
  });

  test("records events when flag is on", () => {
    window.__deepLinkInstrument = true;
    recordDeepLinkEvent("scrollStart", { distance: 100 });
    recordDeepLinkEvent("scrollEnd");
    const events = getDeepLinkEvents();
    expect(events.map(e => e.name)).toEqual(["scrollStart", "scrollEnd"]);
    expect(events[0].payload).toEqual({ distance: 100 });
  });

  test("reset clears events", () => {
    window.__deepLinkInstrument = true;
    recordDeepLinkEvent("a");
    resetDeepLinkEvents();
    expect(getDeepLinkEvents()).toEqual([]);
  });

  test("events have monotonic timestamps", () => {
    window.__deepLinkInstrument = true;
    recordDeepLinkEvent("a");
    recordDeepLinkEvent("b");
    const events = getDeepLinkEvents();
    expect(events[1].t).toBeGreaterThanOrEqual(events[0].t);
  });
});
