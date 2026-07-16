import { layoutSpine, layoutRibbons, ribbonPath } from "../ribbonLayout";

const left = [
  { key: "A", weight: 100 },
  { key: "B", weight: 300 },
];
const right = [
  { key: "X", weight: 200 },
  { key: "Y", weight: 200 },
];
const links = [
  { left: "A", right: "X", value: 10 },
  { left: "B", right: "X", value: 30 },
  { left: "B", right: "Y", value: 10 },
];

describe("ribbonLayout", () => {
  test("layoutSpine is proportional, gapped, ordered, and fills the height", () => {
    const spine = layoutSpine(left, 402, 2); // 400 usable + one 2px gap
    expect(spine.get("A").y0).toBe(0);
    expect(spine.get("A").y1).toBeCloseTo(100, 5);
    expect(spine.get("B").y0).toBeCloseTo(102, 5);
    expect(spine.get("B").y1).toBeCloseTo(402, 5);
  });

  test("ribbons partition each node's span pro-rata and respect minPx", () => {
    const { ribbons } = layoutRibbons({ left, right, links, height: 402, gap: 2, minPx: 1.5 });
    expect(ribbons).toHaveLength(3);
    const bX = ribbons.find((r) => r.left === "B" && r.right === "X");
    const bY = ribbons.find((r) => r.left === "B" && r.right === "Y");
    // B's two ribbons tile B's left-side span without overlap
    expect(bX.lY1).toBeLessThanOrEqual(bY.lY0 + 0.001);
    // every ribbon at least minPx thick on both ends
    for (const r of ribbons) {
      expect(r.lY1 - r.lY0).toBeGreaterThanOrEqual(1.5);
      expect(r.rY1 - r.rY0).toBeGreaterThanOrEqual(1.5);
    }
  });

  test("ribbonPath emits a closed cubic path", () => {
    const d = ribbonPath({ lY0: 0, lY1: 10, rY0: 50, rY1: 80 }, 0, 300);
    expect(d).toMatch(/^M 0,0 C /);
    expect(d).toMatch(/Z$/);
  });
});
