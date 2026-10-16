vi.mock("src/models/BoMOnlineAPI.js", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
}));

import { readPath } from "../ScriptureExcerpt";

// readPath must emit the slug Read canonicalizes to (useCanonicalReadSlug),
// so a tile deeplink costs one history entry and never re-navigates.
describe("readPath (canonical Read URL)", () => {
  test.each([
    ["Ether 6:8", "/read/ether.6/8"],
    ["1 Nephi 2:11-12", "/read/1.nephi.2/11"],
    ["Alma 17:7", "/read/alma.17/7"],
    ["Alma 17", "/read/alma.17"],
  ])("%s → %s", (ref, path) => {
    expect(readPath(ref)).toBe(path);
  });

  test("unparseable input → null", () => {
    expect(readPath("")).toBeNull();
    expect(readPath(null)).toBeNull();
    expect(readPath("nonsense")).toBeNull();
  });
});

import { highlightPhrase } from "../ScriptureExcerpt";

const marks = (parts) => (Array.isArray(parts) ? parts.filter((p) => p && p.type === "mark").map((p) => p.props.children) : []);

describe("highlightPhrase (notes anchor mark)", () => {
  test("matches across punctuation and case differences", () => {
    expect(marks(highlightPhrase("Ask the Father in my name, in faith", "ask the Father in my name"))).toEqual(["Ask the Father in my name"]);
    expect(marks(highlightPhrase("they will not hearken; they shall be cut off", "Inasmuch as they will not hearken")).length).toBe(0);
  });

  test("an elided anchor marks each fragment", () => {
    const t = "My soul was rent with anguish because of the slain of my people";
    expect(marks(highlightPhrase(t, "My soul was rent with anguish…the slain"))).toEqual(["My soul was rent with anguish", "the slain"]);
  });

  test("no match → the raw string", () => {
    expect(highlightPhrase("plain text", "absent phrase")).toBe("plain text");
  });
});
