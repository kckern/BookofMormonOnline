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

import { focusSegments } from "../ScriptureExcerpt";

// Art-H3: a tile excerpt is the anchor verse +-1, not the whole section range.
describe("focusSegments (tile excerpt window)", () => {
  const line = (v, text) => ({ verse_id: v, verse_num: v - 100, text });
  const seg = (vs, extra = []) => ({
    sections: [
      { heading: "A", ref: "X 1:1-6", partial: false, blocks: [{ voice: "v", lines: vs.map((v) => line(v, `verse ${v} text`)) }] },
      ...extra,
    ],
  });
  const shown = (segs) => segs.flatMap((s) => (s.sections || []).flatMap((x) => x.blocks.flatMap((b) => b.lines.map((l) => l.verse_id))));

  test("anchor in a late verse → that verse +-1, ellipses both ends", () => {
    const segs = [seg([101, 102, 103, 104, 105, 106])];
    segs[0].sections[0].blocks[0].lines[4].text = "I did find peace to my soul";
    const out = focusSegments(segs, "Peace to my soul", 3);
    expect(shown(out)).toEqual([104, 105, 106]);
    expect(out[0].sections[0].partial).toBe(true);
  });

  test("no anchor match → first N verses, trailing cut flagged", () => {
    const out = focusSegments([seg([101, 102, 103, 104, 105])], "nowhere", 3);
    expect(shown(out)).toEqual([101, 102, 103]);
    expect(out[0].sections[0].partial).toBe(false);
    expect(out[0].sections[0].tail).toBe(true);
  });

  test("a second section outside the window is dropped", () => {
    const second = { heading: "B", ref: "Y 2:8", partial: false, blocks: [{ lines: [line(900, "other")] }] };
    const out = focusSegments([seg([101, 102, 103], [second])], null, 3);
    expect(out[0].sections).toHaveLength(1);
    expect(shown(out)).toEqual([101, 102, 103]);
  });

  test("short excerpts pass through untouched; passages untouched", () => {
    const segs = [seg([101, 102]), { passages: [{ verses: [] }] }];
    expect(focusSegments(segs, null, 3)).toEqual(segs);
  });
});

// notes-A1: the notes tile leads with the annotated verse itself (lead 0) so
// the highlighted phrase sits at the top of its clipped box, never below the cut.
describe("focusSegments lead", () => {
  const line = (v, text) => ({ verse_id: v, verse_num: v - 100, text });
  const seg = (vs) => ({ sections: [{ heading: "A", ref: "X 1:1-9", partial: false, blocks: [{ lines: vs.map((v) => line(v, `verse ${v} text`)) }] }] });
  const shown = (segs) => segs.flatMap((s) => s.sections.flatMap((x) => x.blocks.flatMap((b) => b.lines.map((l) => l.verse_id))));
  test("lead 0 starts the window at the anchor verse", () => {
    const segs = [seg([101, 102, 103, 104, 105, 106, 107])];
    segs[0].sections[0].blocks[0].lines[3].text = "I did find peace to my soul";
    expect(shown(focusSegments(segs, "peace to my soul", 3, 0))).toEqual([104, 105, 106]);
    expect(shown(focusSegments(segs, "peace to my soul", 3))).toEqual([103, 104, 105]);
  });
});
