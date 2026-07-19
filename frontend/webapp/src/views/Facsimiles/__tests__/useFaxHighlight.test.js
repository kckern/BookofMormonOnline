import { buildHighlightState } from "../useFaxHighlight";

describe("buildHighlightState", () => {
  test("groups boxes by imagePage and sorts allPages", () => {
    const data = {
      pageScale: 700,
      clamped: false,
      boxes: [
        { verseId: 1, imagePage: 156, x: 357, y: 291, w: 288, h: 152 },
        { verseId: 2, imagePage: 156, x: 357, y: 450, w: 288, h: 60 },
        { verseId: 3, imagePage: 155, x: 54, y: 100, w: 287, h: 90 },
      ],
    };
    const s = buildHighlightState(data);
    expect(s.pageScale).toBe(700);
    expect(s.allPages).toEqual([155, 156]);
    expect(s.boxesByPage.get(156)).toHaveLength(2);
    expect(s.boxesByPage.get(155)).toHaveLength(1);
  });

  test("empty / missing data yields an empty state", () => {
    const s = buildHighlightState(null);
    expect(s.allPages).toEqual([]);
    expect(s.boxesByPage.size).toBe(0);
    expect(s.pageScale).toBe(700);
  });
});
