import { resolvePgOffset, buildLeafIndex, normalizeStackWidths, getRefFromIndex } from "../faxGeometry";
import { generateReference } from "scripture-guide";

describe("resolvePgOffset", () => {
  test("prefers numeric pgOffset (camelCase)", () => {
    expect(resolvePgOffset({ pgOffset: 4, pgoffset: 9 })).toBe(4);
  });
  test("falls back to lowercase pgoffset", () => {
    expect(resolvePgOffset({ pgoffset: 7 })).toBe(7);
  });
  test("coerces numeric strings", () => {
    expect(resolvePgOffset({ pgoffset: "5" })).toBe(5);
  });
  test("defaults to 0 when neither present or non-numeric", () => {
    expect(resolvePgOffset({})).toBe(0);
    expect(resolvePgOffset(null)).toBe(0);
    expect(resolvePgOffset({ pgOffset: "x" })).toBe(0);
  });
});


const ITEM = { slug: "1830", pages: 3, format: "jpg" };
const REF = () => null; // stub getRefFromIndex

describe("buildLeafIndex", () => {
  test("produces pgoffset+1 front-matter leaves plus `pages` numbered leaves", () => {
    const leaves = buildLeafIndex(ITEM, 2, [], REF, "https://cdn");
    // totalLeaves = (pages+1) + pgoffset = 4 + 2 = 6
    expect(leaves).toHaveLength(6);
    expect(leaves[0].pageNumInt).toBeNull();       // front matter (i = -2)
    expect(leaves[1].pageNumRoman).toBeTruthy();   // roman "i" (i = -1)
    expect(leaves[3].pageNumInt).toBe(1);          // first numbered page (i = 1)
    expect(leaves[3].pageSlugLeaf).toBe(1);
    expect(leaves[5].pageNumInt).toBe(3);          // last page == pages, NOT pages+1
  });
  test("numbered page asset url is zero-padded to 3 digits", () => {
    const leaves = buildLeafIndex(ITEM, 2, [], REF, "https://cdn");
    expect(leaves[3].pageAssetUrl).toBe("https://cdn/fax/pages/1830/001.jpg");
    expect(leaves[3].thumbAssetUrl).toBe("https://cdn/fax/thumb/1830/001.jpg");
  });
  test("isLeftSide is true for even page index i", () => {
    const leaves = buildLeafIndex(ITEM, 2, [], REF, "https://cdn");
    expect(leaves[3].isLeftSide).toBe(false); // i=1 (odd) -> right
    expect(leaves[4].isLeftSide).toBe(true);  // i=2 (even) -> left
  });
});

describe("normalizeStackWidths", () => {
  test("splits a fixed total footprint by before/after ratio", () => {
    const { left, right } = normalizeStackWidths(50, 100, 160);
    expect(left + right).toBeLessThanOrEqual(160);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(4); // roughly balanced mid-book
  });
  test("near the start: left thin, right fat, still sums to <= total", () => {
    const { left, right } = normalizeStackWidths(2, 100, 160);
    expect(left).toBeLessThan(right);
    expect(left + right).toBeLessThanOrEqual(160);
  });
  test("never exceeds total regardless of book length (no cap-stick)", () => {
    const { left, right } = normalizeStackWidths(400, 2000, 160);
    expect(left + right).toBeLessThanOrEqual(160);
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
  });
  test("zero pages before -> zero left width", () => {
    const { left } = normalizeStackWidths(0, 100, 160);
    expect(left).toBe(0);
  });
});

describe("buildLeafIndex page numbering (image-file canonical)", () => {
  const ITEM = { slug: "1837", pages: 3, format: "jpg" };
  const REF = () => null;

  test("the folio scheme is reverted: number == image-file, offset ignored", () => {
    const leaves = buildLeafIndex(ITEM, 2, [], REF, "https://cdn", -4); // offset is now inert
    expect(leaves[3].pageNumInt).toBe(1);                 // image-file number (routing/asset/display)
    expect(leaves[3].pageAssetUrl).toContain("001.jpg");
    expect(leaves[3].faxPageNum).toBe(1);                 // == image-file (no offset applied)
    expect(leaves[3].faxPageSlug).toBe(1);
    expect(leaves[3].pageSlugLeaf).toBe(1);               // route slug == image-file
    expect(leaves[5].faxPageNum).toBe(3);
  });
});

describe("getRefFromIndex (dense, image-page-keyed array)", () => {
  // Dense array: index i == image page i+1. Page 3 is an interior gap.
  //   page 1 -> verse 1, page 2 -> verse 2, page 3 -> gap, page 4 -> verse 5
  const dense = [[1, 1, 1], [2, 1], [0, 0], [5, 1, 1]];

  test("page 1 resolves index 0 (no leading-placeholder drift)", () => {
    expect(getRefFromIndex(dense, 1)).toBe(generateReference([1])); // "Genesis 1:1"
  });

  test("an interior gap page resolves to null", () => {
    expect(getRefFromIndex(dense, 3)).toBeNull();
  });

  test("a page AFTER an interior gap is not drifted", () => {
    // The bug: page 4 used to read the tuple at index 2 (the gap's neighbor).
    // It must read index 3 -> verse 5.
    expect(getRefFromIndex(dense, 4)).toBe(generateReference([5])); // "Genesis 1:5"
    expect(getRefFromIndex(dense, 4)).not.toBe(getRefFromIndex(dense, 1));
  });

  test("out-of-range page returns null", () => {
    expect(getRefFromIndex(dense, 99)).toBeNull();
  });
});
