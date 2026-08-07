import fs from "fs";
import path from "path";

const TILES_DIR = path.resolve(__dirname, "..");

// Tiles whose Layer 2 is intentionally NOT a TileDeepLink:
//  - People/Places: the "view all" mosaic card is their always-on Layer 2.
//  - ReadingPlan: stateful; its Layer 1 is the in-place chooser (setChooser) and
//    its Layer 2 is start_reading→/contents. A dedicated plan-detail deeplink is
//    tracked as a follow-up, out of scope for this plan.
//  - ReadingProgress: a sub-tile rendered by ReadingPlanTile, not registered
//    standalone; it inherits ReadingPlan's CTAs.
//  - Inner/Card fragments render inside a parent tile that carries the deeplink.
//  - Shared/helper modules and re-export shims carry no CTA of their own.
const EXEMPT = new Set([
  "PeopleTile.js",
  "PlacesTile.js",
  "ReadingPlanTile.js",
  "ReadingProgressTile.js",
  "ExpandableText.js",
  "RefPill.js",
  "ScripturePopup.js",
  "textUtils.js",
  "mapStoryPath.js",
  "mapStoryLayout.js",
  "homeSamplerCache.js",
  "registry.js",
  "MapTileInner.js",
  "MapStoryTileInner.js",
  "MapStoryCard.js",
]);

const tileFiles = fs
  .readdirSync(TILES_DIR)
  .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));

describe("two-layer CTA compliance", () => {
  test.each(tileFiles.filter((f) => !EXEMPT.has(f)))(
    "%s imports TileDeepLink (has a discrete Layer-2 control)",
    (file) => {
      const src = fs.readFileSync(path.join(TILES_DIR, file), "utf8");
      expect(src).toMatch(/TileDeepLink/);
    }
  );
});
