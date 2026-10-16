// Back closes an app popup/drawer (blind audit archive witness-E1). A popup
// pushes its own URL (/history/<source>) with the native History API, so the
// Router never hears it; Back to /home left appController.states.popUp open and
// the phone drawer covered the feed (and on desktop the stale source modal
// re-opened on a later visit to the witness page).
import { appFunctions, popUpOwnsPath } from "src/models/appController";

const ctl = (popUp, slug = "/history/1899-src") => ({
  states: { slug, popUp: { open: true, type: "history", ids: ["1899-src"], activeId: "1899-src", underSlug: "history/witnesses/dw", ...popUp } },
});

describe("popUpOwnsPath", () => {
  it("matches the popup's own URL", () => {
    expect(popUpOwnsPath({ open: true, type: "history", activeId: "1899-src" }, "/history/1899-src")).toBe(true);
    expect(popUpOwnsPath({ open: true, type: "people", activeId: "nephi" }, "/people/nephi/")).toBe(true);
    expect(popUpOwnsPath({ open: true, type: "people", activeId: "naomi é" }, "/people/naomi%20%C3%A9")).toBe(true);
  });
  it("does not match another route", () => {
    expect(popUpOwnsPath({ open: true, type: "history", activeId: "1899-src" }, "/home")).toBe(false);
    expect(popUpOwnsPath({ open: true, type: "history", activeId: "1899-src" }, "/history/witnesses/dw")).toBe(false);
  });
});

describe("syncPopUpToLocation (popstate)", () => {
  let pushSpy;
  beforeEach(() => { pushSpy = vi.spyOn(window.history, "pushState"); });
  afterEach(() => pushSpy.mockRestore());

  it("Back off the popup URL closes it without writing a URL", () => {
    const c = ctl();
    appFunctions.syncPopUpToLocation(c, { val: "/home" });
    expect(c.states.popUp.open).toBe(false);
    expect(c.states.slug).toBe("/home");
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("keeps a popup whose URL is the current one (Forward back onto it)", () => {
    const c = ctl();
    appFunctions.syncPopUpToLocation(c, { val: "/history/1899-src" });
    expect(c.states.popUp.open).toBe(true);
  });

  it("is a no-op when nothing is open", () => {
    const c = ctl({ open: false });
    appFunctions.syncPopUpToLocation(c, { val: "/home" });
    expect(c.states.popUp.open).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
