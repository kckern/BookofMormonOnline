import { entityTarget, openEntityPopupOnClick } from "../entityPopup";

const click = (href, over = {}) => {
  const a = document.createElement("a");
  a.setAttribute("href", href);
  const child = document.createElement("span");
  a.appendChild(child);
  document.body.appendChild(a);
  return { a, e: { button: 0, defaultPrevented: false, target: child, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...over } };
};

describe("entityTarget", () => {
  test.each([
    ["/people/noah1", { type: "people", slug: "noah1" }],
    ["/places/angola", { type: "places", slug: "angola" }],
    ["/matters/contention", { type: "matters", slug: "contention" }],
    ["/places/angola/", { type: "places", slug: "angola" }],
  ])("%s", (href, want) => expect(entityTarget(href)).toEqual(want));
  test.each(["/people", "/places", "/map/internal/place/angola", "/read/alma-32", "/history/x", "https://x.org/people/a", "/people/a/b", "/matters/narrative", "/matters/material", "/matters/concepts", "#x", ""])(
    "%s is not an entity popup", (href) => expect(entityTarget(href)).toBeNull());
});

// Prod 2026-10-20: Home → place tile opened the full page; its back control then
// dropped the reader out of Discover. Entity clicks inside Home open the popup.
describe("openEntityPopupOnClick", () => {
  const setPopUp = vi.fn();
  const ctl = { functions: { setPopUp } };
  beforeEach(() => { setPopUp.mockClear(); window.history.replaceState(null, "", "/home/discover"); });

  test("plain click: opens the popup under the current page and swallows the navigation", () => {
    const { e } = click("/places/angola");
    expect(openEntityPopupOnClick(e, ctl)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(setPopUp).toHaveBeenCalledWith({ type: "places", ids: ["angola"], underSlug: "home/discover" });
  });
  test.each([["metaKey"], ["ctrlKey"], ["shiftKey"], ["altKey"]])("%s-click keeps the browser's own behavior", (mod) => {
    const { e } = click("/people/noah1", { [mod]: true });
    expect(openEntityPopupOnClick(e, ctl)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(setPopUp).not.toHaveBeenCalled();
  });
  test("middle button, already-handled clicks, target=_blank and download links are left alone", () => {
    expect(openEntityPopupOnClick(click("/people/a1", { button: 1 }).e, ctl)).toBe(false);
    expect(openEntityPopupOnClick(click("/people/a1", { defaultPrevented: true }).e, ctl)).toBe(false);
    const blank = click("/people/a1"); blank.a.setAttribute("target", "_blank");
    expect(openEntityPopupOnClick(blank.e, ctl)).toBe(false);
    expect(setPopUp).not.toHaveBeenCalled();
  });
  test("non-entity links (map, read, indexes) navigate normally", () => {
    expect(openEntityPopupOnClick(click("/map/internal/place/angola").e, ctl)).toBe(false);
    expect(openEntityPopupOnClick(click("/places").e, ctl)).toBe(false);
    expect(setPopUp).not.toHaveBeenCalled();
  });
  test("no appController yet: do nothing (the link navigates)", () => {
    expect(openEntityPopupOnClick(click("/places/angola").e, null)).toBe(false);
  });
});
