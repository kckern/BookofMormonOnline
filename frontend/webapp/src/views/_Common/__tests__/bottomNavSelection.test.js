import { resolveBottomSelection } from "../bottomNavSelection";

describe("resolveBottomSelection (messenger ON)", () => {
  const on = (p) => resolveBottomSelection(p, true);
  test("groups → 0", () => expect(on("/groups")).toBe(0));
  test("/home → 1 (Home item)", () => expect(on("/home")).toBe(1));
  test("/home/community → 1 (Home item)", () => expect(on("/home/community")).toBe(1));
  test("/home/user → 3 (User item)", () => expect(on("/home/user")).toBe(3));
  test("legacy /user → 3 (User item)", () => expect(on("/user")).toBe(3));
  test("/mobilemenu → 4", () => expect(on("/mobilemenu")).toBe(4));
  test("/study default → 2", () => expect(on("/study")).toBe(2));
  test.each(["/people", "/people/nephi1", "/places/jerusalem-1", "/matters", "/theater", "/maps", "/timeline", "/history/witnesses"])(
    "%s (More-menu section) → 4", (p) => expect(on(p)).toBe(4));
  test.each(["/read/1-nephi-1", "/search", "/study/x"])("%s stays on Study → 2", (p) => expect(on(p)).toBe(2));
});

describe("resolveBottomSelection (messenger OFF)", () => {
  const off = (p) => resolveBottomSelection(p, false);
  test("/home → 0 (Discover item, shown without messenger too)", () => expect(off("/home")).toBe(0));
  test("/home/user → 2 (User item)", () => expect(off("/home/user")).toBe(2));
  test("legacy /user → 2 (User item)", () => expect(off("/user")).toBe(2));
  test("/study default → 1", () => expect(off("/study")).toBe(1));
  test("/people (More-menu section) → 3", () => expect(off("/people")).toBe(3));
});
