import { navPath } from "../navPath";

// Prod 2026-10-20: a place popup over Discover rewrites the URL to /places/<slug>,
// and both navs highlighted Places / Study — "now I'm in places".
describe("navPath", () => {
  const loc = (p) => ({ pathname: p });
  test("no popup: the browser path", () => {
    expect(navPath({ popUp: { open: false } }, loc("/places"))).toBe("/places");
  });
  test("popup open over Home: the page underneath, not the popup's URL", () => {
    expect(navPath({ popUp: { open: true, underSlug: "home" } }, loc("/places/angola"))).toBe("/home");
    expect(navPath({ popUp: { open: true, underSlug: "home/discover" } }, loc("/people/alma2"))).toBe("/home/discover");
  });
  test("popup over a deep page keeps that page's section", () => {
    expect(navPath({ popUp: { open: true, underSlug: "read/alma.32" } }, loc("/commentary/123"))).toBe("/read/alma.32");
  });
  test("leading slashes in underSlug are tolerated; empty underSlug means the site root", () => {
    expect(navPath({ popUp: { open: true, underSlug: "/home" } }, loc("/places/x"))).toBe("/home");
    expect(navPath({ popUp: { open: true, underSlug: "" } }, loc("/places/x"))).toBe("/places/x");
  });
  test("missing state is the browser path", () => {
    expect(navPath(undefined, loc("/map"))).toBe("/map");
    expect(navPath({}, loc("/map"))).toBe("/map");
  });
});
