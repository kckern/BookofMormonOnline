import { snapToLines } from "../lineClamp";
import { bindRefPunctuation } from "../refProse";

// Commentary excerpt H3 (blind audit r4): the clamp height was the aside-matched
// pixel target, so it sliced through a line and -webkit-line-clamp added a
// mid-word "…" under the fade. The clamp now ends on a whole line box.
describe("snapToLines", () => {
  const line = (top, h = 20) => ({ top, bottom: top + h, height: h, left: 0, right: 100 });
  // two paragraphs: lines at 0/20/40, a 6px paragraph gap, then 66/86/106
  const rects = [line(0), line(20), line(40), line(66), line(86), line(106)];
  it("ends on the last line bottom that fits the target", () => {
    expect(snapToLines(rects, 0, 95)).toBe(86);
    expect(snapToLines(rects, 0, 70)).toBe(60);
    expect(snapToLines(rects, 0, 106)).toBe(106);
  });
  it("is relative to the box top", () => {
    expect(snapToLines(rects.map((r) => ({ ...r, top: r.top + 300, bottom: r.bottom + 300 })), 300, 70)).toBe(60);
  });
  it("falls back to the target with no layout (jsdom) or when nothing fits", () => {
    expect(snapToLines([], 0, 77)).toBe(77);
    expect(snapToLines([line(0, 90)], 0, 50)).toBe(50);
  });
  it("ignores zero-height rects", () => {
    expect(snapToLines([line(0), { top: 0, bottom: 55, height: 0 }], 0, 60)).toBe(20);
  });
});

// Commentary A3: "…immortality (" at a line end, "[3 Ne. 28:8])”" on the next.
describe("bindRefPunctuation", () => {
  const pill = '<a className="scripture_link">3 Ne. 28:8</a>';
  it("binds an opening bracket and closing punctuation to the pill", () => {
    expect(bindRefPunctuation(`immortality (${pill})” (Ludlow)`)).toBe(
      `immortality <span class="refNoBreak">(${pill})”</span> (Ludlow)`,
    );
  });
  it("binds trailing punctuation alone", () => {
    expect(bindRefPunctuation(`see ${pill}.`)).toBe(`see <span class="refNoBreak">${pill}.</span>`);
  });
  it("leaves a free-standing pill alone", () => {
    expect(bindRefPunctuation(`see ${pill} and more`)).toBe(`see ${pill} and more`);
  });
});
