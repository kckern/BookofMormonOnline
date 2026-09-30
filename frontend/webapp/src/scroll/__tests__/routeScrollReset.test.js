import { sectionKey, scrollAction, resetScroll, restoreScroll } from "../routeScrollReset";

describe("sectionKey", () => {
  it("uses the first segment", () => {
    expect(sectionKey("/read/1.nephi.1")).toBe("read");
    expect(sectionKey("/fax/printers/12")).toBe("fax");
    expect(sectionKey("/lehites/3")).toBe("lehites");
  });
  it("includes the tab and sub-page under /home", () => {
    expect(sectionKey("/home/user/preferences")).toBe("home/user/preferences");
    expect(sectionKey("/home/user")).toBe("home/user");
    expect(sectionKey("/home/feed/abc/msg1")).toBe("home/feed/abc");
    expect(sectionKey("/home")).toBe("home");
  });
  it("handles root and empty", () => {
    expect(sectionKey("/")).toBe("");
    expect(sectionKey("")).toBe("");
  });
});

describe("scrollAction", () => {
  const nav = (over) => ({
    prevPathname: "/read/alma.32",
    pathname: "/home/user/preferences",
    hash: "",
    navigationType: "PUSH",
    ...over,
  });

  it("goes to the top on a link to a different page", () => {
    expect(scrollAction(nav())).toBe("top");
  });
  it("goes to the top between /home tabs", () => {
    expect(scrollAction(nav({ prevPathname: "/home/feed", pathname: "/home/user" }))).toBe("top");
  });
  it("goes to the top between sub-pages of a /home tab (progress -> preferences)", () => {
    expect(scrollAction(nav({ prevPathname: "/home/user", pathname: "/home/user/preferences" }))).toBe("top");
  });
  it("restores on back/forward to a different page", () => {
    expect(scrollAction(nav({ navigationType: "POP" }))).toBe("restore");
  });
  it("ignores replace navigations", () => {
    expect(scrollAction(nav({ navigationType: "REPLACE" }))).toBe(null);
  });
  it("leaves in-section pushes to the view (Read syncing its slug while scrolling)", () => {
    expect(scrollAction(nav({ prevPathname: "/read/alma.32", pathname: "/read/alma.32.21" }))).toBe(null);
    expect(scrollAction(nav({ prevPathname: "/read/alma.32.21", pathname: "/read/alma.32", navigationType: "POP" }))).toBe(null);
  });
  it("leaves a message link inside one feed channel alone", () => {
    expect(scrollAction(nav({ prevPathname: "/home/feed/abc", pathname: "/home/feed/abc/msg1" }))).toBe(null);
  });
  it("defers to a #hash target", () => {
    expect(scrollAction(nav({ hash: "#verse-21" }))).toBe(null);
  });
  it("does nothing on first render", () => {
    expect(scrollAction(nav({ prevPathname: null }))).toBe(null);
  });
});

describe("resetScroll", () => {
  it("resets the window and the main panel", () => {
    const panel = { scrollTop: 900 };
    const win = { scrollTo: vi.fn() };
    const doc = { getElementById: (id) => (id === "main-panel" ? panel : null) };
    resetScroll(doc, win);
    expect(win.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(panel.scrollTop).toBe(0);
  });
});

describe("restoreScroll", () => {
  let height, scrollTo, frames;
  beforeEach(() => {
    height = 500;
    frames = [];
    scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, get: () => height });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
  });
  const runFrame = () => frames.shift()?.();

  it("waits for the page to be tall enough, then scrolls there", () => {
    restoreScroll(2000);
    runFrame();
    expect(scrollTo).not.toHaveBeenCalled();
    height = 3000;
    runFrame();
    expect(scrollTo).toHaveBeenCalledWith(0, 2000);
  });
  it("gives up without moving if the user scrolls first", () => {
    restoreScroll(2000);
    window.dispatchEvent(new Event("wheel"));
    height = 3000;
    runFrame();
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it("gives up when the next navigation aborts it", () => {
    const token = restoreScroll(2000);
    token.abort("navigated");
    height = 3000;
    runFrame();
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it("goes as far as the page allows on timeout", () => {
    restoreScroll(2000, { timeoutMs: 0 });
    height = 1000;
    runFrame();
    expect(scrollTo).toHaveBeenCalledWith(0, 600);
  });
  it("does nothing for a missing or zero position", () => {
    restoreScroll(undefined);
    restoreScroll(0);
    expect(frames).toHaveLength(0);
  });
});
