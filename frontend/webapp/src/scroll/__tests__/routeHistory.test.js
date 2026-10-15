// One Back = one entry (docs/plans/2026-10-15-home-tiles-production-readiness.md
// Task 8, audit R2.2 E1). A tile deeplink must add exactly one history entry:
// URL-sync / canonicalizing navigations replace, and re-asserting the URL the
// browser is already on must never push a duplicate.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate, useNavigationType, useLocation } from "react-router-dom";
import { appFunctions } from "src/models/appController";
import { useCanonicalReadSlug } from "src/views/Read/useCanonicalReadSlug";
import { placeUrlSyncTarget } from "src/views/Map/mapUrlSync";

const freshController = (slug) => ({ states: { slug } });

describe("setSlug never pushes the URL the browser is already on", () => {
  let pushSpy;
  let replaceSpy;
  beforeEach(() => {
    window.history.replaceState(null, "", "/home");
    pushSpy = vi.spyOn(window.history, "pushState");
    replaceSpy = vi.spyOn(window.history, "replaceState");
  });
  afterEach(() => {
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it("map pin: landing on /map/internal/place/:slug does not push it again", () => {
    // The Router already pushed the deeplink; Main's slug state is stale.
    window.history.pushState(null, "", "/map/internal/place/moroni");
    pushSpy.mockClear();
    const ctl = freshController("/home");
    appFunctions.setSlug(ctl, { val: "/map/internal/place/moroni" });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(ctl.states.slug).toBe("/map/internal/place/moroni");
  });

  it("Study block: re-asserting /<page>/<section>/<block> on mount does not push", () => {
    window.history.pushState(null, "", "/reign-of-judges/zarahemla-sermon/39");
    pushSpy.mockClear();
    const ctl = freshController("/home");
    appFunctions.setSlug(ctl, { val: "reign-of-judges/zarahemla-sermon/39" });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("still pushes a genuinely new URL (user navigation)", () => {
    const ctl = freshController("/home");
    appFunctions.setSlug(ctl, { val: "/map/internal/place/zarahemla" });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/map/internal/place/zarahemla");
  });

  it("still honours an explicit replace", () => {
    const ctl = freshController("/home");
    appFunctions.setSlug(ctl, { val: "/war/judgment-seat-dispute", replace: true });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });
});

describe("Read slug canonicalization replaces", () => {
  // Non-data MemoryRouter: createMemoryRouter's fetch-Request path trips on
  // jsdom's AbortSignal. useNavigationType gives the same PUSH/REPLACE answer.
  const seen = {};
  const Spy = () => {
    seen.navigate = useNavigate();
    seen.type = useNavigationType();
    seen.path = useLocation().pathname;
    return null;
  };
  const Probe = ({ ideal }) => {
    useCanonicalReadSlug(ideal);
    return null;
  };
  const tree = (initial) => (
    <MemoryRouter initialEntries={initial}>
      <Spy />
      <Routes>
        <Route path="/home" element={null} />
        <Route path="/read/*" element={<Probe ideal="ether.6/8" />} />
      </Routes>
    </MemoryRouter>
  );

  it("non-canonical /read/ether-6/8 -> /read/ether.6/8 is a REPLACE, not a PUSH", async () => {
    render(tree(["/home"]));
    await act(async () => {
      seen.navigate("/read/ether-6/8");
    });
    expect(seen.path).toBe("/read/ether.6/8");
    expect(seen.type).toBe("REPLACE");
    // One Back from the canonical URL lands on Home.
    await act(async () => {
      seen.navigate(-1);
    });
    expect(seen.path).toBe("/home");
  });

  it("does nothing when the URL is already canonical", async () => {
    render(tree(["/read/ether.6/8"]));
    await act(async () => {});
    expect(seen.type).toBe("POP");
    expect(seen.path).toBe("/read/ether.6/8");
  });
});

describe("narration page does not leak an overflow lock onto html/body", () => {
  it("Page.css sets no overflow on html or body", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../../views/Page/Page.css"),
      "utf8",
    );
    // Any rule whose selector list targets bare html/body and sets overflow.
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const leaks = rules.filter(([, sel, body]) =>
      sel.split(",").some((s) => /^\s*(html|body)\s*$/.test(s)) && /overflow/.test(body),
    );
    expect(leaks.map(([, sel]) => sel.trim())).toEqual([]);
  });
});

describe("map pin: the panel's URL sync never pushes a wrong-map URL mid-redirect", () => {
  // /map/internal/place/judah: Judah is a Near East (location "W") place, so the
  // panel redirects to /map/neareast/place/judah. While the internal map is
  // still current the sync must stand down, or it pushes the internal URL back
  // between the redirect and the Near East load (history +2, audit places E1).
  it("stands down while the place is out of the current map's scope", () => {
    expect(placeUrlSyncTarget({ mapSlug: "internal", slug: "judah", placeLocation: "W" })).toBeNull();
    expect(placeUrlSyncTarget({ mapSlug: "neareast", slug: "moroni", placeLocation: "N" })).toBeNull();
  });
  it("syncs the place URL once the right map is current", () => {
    expect(placeUrlSyncTarget({ mapSlug: "neareast", slug: "judah", placeLocation: "W" })).toBe("/map/neareast/place/judah");
    expect(placeUrlSyncTarget({ mapSlug: "internal", slug: "moroni", placeLocation: "N" })).toBe("/map/internal/place/moroni");
    // Place not preloaded yet: no scope information, keep the old behaviour.
    expect(placeUrlSyncTarget({ mapSlug: "internal", slug: "moroni" })).toBe("/map/internal/place/moroni");
  });
  it("leaves story URLs alone and needs a loaded map", () => {
    expect(placeUrlSyncTarget({ mapSlug: "internal", slug: "moroni", onStoryUrl: true })).toBeNull();
    expect(placeUrlSyncTarget({ mapSlug: undefined, slug: "moroni" })).toBeNull();
    expect(placeUrlSyncTarget({ mapSlug: "internal", slug: null })).toBe("/map/internal");
  });
});

describe("map pin on phone: the auto-opened place sheet replaces the map URL", () => {
  // On phone /map/<type>/place/<slug> opens the place as a popup on mount,
  // which writes /places/<slug>. That open is part of landing on the deeplink,
  // not a second navigation, so it must replace (else Back -> the map URL).
  const ctl = () => ({
    states: { slug: "/map/internal/place/moroni", popUp: { open: false } },
    functions: { setSlug: vi.fn() },
  });

  it("replaces when the opener asks (deeplink auto-open)", () => {
    const c = ctl();
    appFunctions.setPopUp(c, { val: { type: "places", ids: ["moroni"], replaceSlug: true } });
    expect(c.functions.setSlug).toHaveBeenCalledWith("places/moroni", { replace: true });
  });

  it("still pushes for a reader-opened popup (Back closes it)", () => {
    const c = ctl();
    appFunctions.setPopUp(c, { val: { type: "places", ids: ["moroni"] } });
    expect(c.functions.setSlug).toHaveBeenCalledWith("places/moroni", { replace: false });
  });
});
