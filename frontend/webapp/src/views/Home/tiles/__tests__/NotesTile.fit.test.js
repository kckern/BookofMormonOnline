// R6 notes-H3: the scrolled verse window sliced a line under the pinned ref
// row (scrollTop = mark - header - 10px, clamped by the scroll range, never on
// a line box). R6 notes-A1: the fixed verse-count reserve left ~70px (desktop)
// to ~240px (tablet) of dead space above the bubble for a short passage.
import { revealMark, fitExcerpt } from "../NotesTile";

const rect = (top, bottom, left = 0, right = 300) => ({ top, bottom, left, right, height: bottom - top, width: right - left });
const setScroll = (el, scrollHeight, clientHeight) => {
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => clientHeight });
};

/** box 0..224, pinned header 0..30, one paragraph of 10 lines x 18px from y=40. */
const makeWindow = ({ markTop, scrollHeight = 400 }) => {
  const box = document.createElement("div");
  box.className = "notesExcerpt";
  const header = document.createElement("div");
  header.className = "read-section-header";
  const p = document.createElement("p");
  p.className = "read-scripture";
  p.style.lineHeight = "18px";
  const mark = document.createElement("mark");
  mark.className = "scriptureAnchorMark";
  p.appendChild(mark);
  box.append(header, p);
  box.getBoundingClientRect = () => rect(0, 224);
  header.getBoundingClientRect = () => rect(0, 30);
  p.getBoundingClientRect = () => rect(40, 220);
  mark.getBoundingClientRect = () => rect(markTop, markTop + 18);
  setScroll(box, scrollHeight, 224);
  return box;
};

describe("revealMark snaps the window to a whole line under the pinned row (notes-H3)", () => {
  test("the mark's own line sits flush under the header", () => {
    const box = makeWindow({ markTop: 202 }); // line 9: 40 + 9*18
    revealMark(box);
    expect(box.classList.contains("isScrolled")).toBe(true);
    expect(box.scrollTop).toBe(202 - 30);
  });
  test("when the scroll range runs out, it stops on a line boundary, not mid-line", () => {
    const box = makeWindow({ markTop: 202, scrollHeight: 224 + 100 }); // max scroll 100
    revealMark(box);
    // first visible content row = scrollTop + 30 must be a line top (40 + k*18)
    const firstRow = box.scrollTop + 30;
    expect((firstRow - 40) % 18).toBe(0);
    expect(box.scrollTop).toBeLessThanOrEqual(100);
    expect(box.scrollTop).toBe(40 + 5 * 18 - 30); // 100 → line 5 (130-30=100)
  });
});

/** a fitted box: reserve 152px, content (one read-block) ends at y=102. */
const makeFit = ({ top = 1000, contentBottom = 102, scrolled = false } = {}) => {
  const box = document.createElement("div");
  box.className = "notesExcerpt" + (scrolled ? " isScrolled" : "");
  box.style.setProperty("--notes-excerpt-h", "9.5rem");
  const block = document.createElement("div");
  block.className = "read-block";
  box.appendChild(block);
  let t = top;
  box.getBoundingClientRect = () => rect(t, t + (parseFloat(box.style.height) || 152));
  block.getBoundingClientRect = () => rect(t + 10, t + contentBottom);
  document.body.appendChild(box);
  return { box, move: (nt) => { t = nt; } };
};

describe("fitExcerpt drops the reserve's dead space without a visible shift (notes-A1)", () => {
  beforeEach(() => { window.innerHeight = 900; document.body.innerHTML = ""; });
  test("off-screen below: the box shrinks to its content at once", () => {
    const { box } = makeFit({ top: 1000 });
    fitExcerpt(box, 152);
    expect(box.classList.contains("isFit")).toBe(true);
    expect(parseFloat(box.style.height)).toBeGreaterThanOrEqual(102);
    expect(parseFloat(box.style.height)).toBeLessThan(115);
  });
  test("in view: it waits until the reader scrolls it out of view, then fits", () => {
    const { box, move } = makeFit({ top: 300 });
    const stop = fitExcerpt(box, 152);
    expect(box.classList.contains("isFit")).toBe(false);
    move(1200);
    window.dispatchEvent(new Event("scroll"));
    expect(box.classList.contains("isFit")).toBe(true);
    stop?.();
  });
  test("a passage that fills the reserve (or the scrolled window) is left alone", () => {
    const a = makeFit({ top: 1000, contentBottom: 200 });
    fitExcerpt(a.box, 152);
    expect(a.box.classList.contains("isFit")).toBe(false);
    const b = makeFit({ top: 1000, scrolled: true });
    fitExcerpt(b.box, 152);
    expect(b.box.classList.contains("isFit")).toBe(false);
  });
});
