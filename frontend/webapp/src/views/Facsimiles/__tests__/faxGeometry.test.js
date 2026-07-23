import { resolvePgOffset, buildLeafIndex } from "../faxGeometry";

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
