import { scrollTo } from "../../models/Utils";
import { resetDeepLinkEvents } from "../../utils/deepLinkInstrument";

beforeEach(() => {
  window.__deepLinkInstrument = false;
  resetDeepLinkEvents();
  // mock window.scrollTo
  window.scrollTo = jest.fn();
  // Reset matchMedia so prior tests that set { matches: true } do not bleed into
  // tests that expect default (no reduced motion) behavior.
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
});

describe("scrollTo (refactored)", () => {
  test("skips and fires callback immediately when distance is null", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const cb = jest.fn();
    scrollTo(null, cb);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test("skips and fires callback immediately when distance is negative", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const cb = jest.fn();
    scrollTo(-10, cb);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test("emits scrollTo:failed and console.warn when distance is non-number", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const cb = jest.fn();
    // Force the instrument flag on so we can read window.__deepLinkEvents
    window.__deepLinkInstrument = true;
    window.__deepLinkEvents = [];
    scrollTo("not a number", cb);
    expect(cb).toHaveBeenCalledTimes(1);
    const names = window.__deepLinkEvents.map(e => e.name);
    expect(names).toContain("scrollTo:failed");
    expect(names).not.toContain("scrollTo:noop");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("emits scrollTo:failed for NaN distance", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const cb = jest.fn();
    window.__deepLinkInstrument = true;
    window.__deepLinkEvents = [];
    scrollTo(NaN, cb);
    expect(cb).toHaveBeenCalledTimes(1);
    const names = window.__deepLinkEvents.map(e => e.name);
    expect(names).toContain("scrollTo:failed");
    warn.mockRestore();
  });

  test("emits scrollTo:noop (no warn) when distance is zero", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const cb = jest.fn();
    window.__deepLinkInstrument = true;
    window.__deepLinkEvents = [];
    scrollTo(0, cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).not.toHaveBeenCalled();
    const names = window.__deepLinkEvents.map(e => e.name);
    expect(names).toContain("scrollTo:noop");
    expect(names).not.toContain("scrollTo:failed");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("emits scrollTo:failed (with warn) when distance is negative", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const cb = jest.fn();
    window.__deepLinkInstrument = true;
    window.__deepLinkEvents = [];
    scrollTo(-10, cb);
    expect(cb).toHaveBeenCalledTimes(1);
    const names = window.__deepLinkEvents.map(e => e.name);
    expect(names).toContain("scrollTo:failed");
    warn.mockRestore();
  });

  test("fires window.scrollTo with smooth behavior", () => {
    scrollTo(500, () => {});
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 500, behavior: "smooth" }),
    );
  });

  test("uses instant behavior when prefers-reduced-motion", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    scrollTo(500, () => {});
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 500, behavior: "instant" }),
    );
  });

  test("uses instant behavior when callback === 0 (legacy sentinel)", () => {
    scrollTo(500, 0);
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "instant" }),
    );
  });

  test("callback fires on scrollend event when smooth", () => {
    const cb = jest.fn();
    scrollTo(500, cb);
    expect(cb).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("scrollend"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("callback fires once even if scrollend fires twice", () => {
    const cb = jest.fn();
    scrollTo(500, cb);
    window.dispatchEvent(new Event("scrollend"));
    window.dispatchEvent(new Event("scrollend"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("callback fires via fallback timer if scrollend never arrives at 2000ms exactly", () => {
    jest.useFakeTimers();
    try {
      const cb = jest.fn();
      scrollTo(500, cb);
      jest.advanceTimersByTime(1999);
      expect(cb).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("instant scroll fires callback synchronously", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const cb = jest.fn();
    scrollTo(500, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
