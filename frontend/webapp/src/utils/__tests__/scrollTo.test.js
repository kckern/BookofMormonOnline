import { scrollTo } from "../../models/Utils";

beforeEach(() => {
  window.__deepLinkInstrument = false;
  // mock window.scrollTo
  window.scrollTo = jest.fn();
});

describe("scrollTo (refactored)", () => {
  test("skips and fires callback immediately when distance is null", () => {
    const cb = jest.fn();
    scrollTo(null, cb);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("skips and fires callback immediately when distance is negative", () => {
    const cb = jest.fn();
    scrollTo(-10, cb);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
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

  test("callback fires via fallback timer if scrollend never arrives", () => {
    jest.useFakeTimers();
    const cb = jest.fn();
    scrollTo(500, cb);
    jest.advanceTimersByTime(2000);
    expect(cb).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test("instant scroll fires callback synchronously", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const cb = jest.fn();
    scrollTo(500, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
