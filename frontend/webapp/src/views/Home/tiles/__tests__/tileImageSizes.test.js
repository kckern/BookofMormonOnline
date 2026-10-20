import fs from "node:fs";
import path from "node:path";

// With w-descriptor srcsets and no `sizes`, the browser assumes the image is as wide
// as the viewport and fetches the 640px variant for a 104px thumbnail. Every
// TileImage in the small-image archive tiles states its real size.
const dir = path.resolve(__dirname, "..");
describe.each(["ArchiveDocTile.jsx", "FaxTile.js", "JosephSmithTile.js", "WitnessTile.js"])("%s", (f) => {
  test("every <TileImage> passes sizes", () => {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const blocks = src.split("<TileImage").slice(1).map((b) => b.slice(0, b.indexOf("/>")));
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((b) => expect(b).toMatch(/\bsizes=/));
  });
});
