import fs from "node:fs";
import path from "node:path";

// vite.config.mjs `define` substitutes only the exact member expression
// `process.env.REACT_APP_*`; the browser has no `process` global. A
// `typeof process` guard therefore makes the flag permanently false in a real
// build (Node, where these tests run, always has `process`, hiding it).
const src = fs.readFileSync(path.resolve(__dirname, "../mediaVariants.js"), "utf8");
const body = src.slice(src.indexOf("export function variantsEnabled"));

describe("variantsEnabled (build-time substitution)", () => {
  test("reads the exact define-substituted expression, with no typeof-process guard", () => {
    expect(body).toContain("process.env.REACT_APP_MEDIA_VARIANTS");
    expect(body).not.toMatch(/typeof\s+process/);
  });

  test("after Vite-style substitution it is true with no `process` global", () => {
    const fnSrc = body
      .replace(/^export\s+/, "")
      .replace(/process\.env\.REACT_APP_MEDIA_VARIANTS/g, JSON.stringify("1"));
    // shadow `process` so the evaluated code behaves as in a browser
    const run = new Function("process", `${fnSrc}; return variantsEnabled();`);
    expect(run(undefined)).toBe(true);
  });

  test("unsubstituted and no `process` global: false, not a throw", () => {
    const fnSrc = body.replace(/^export\s+/, "");
    const run = new Function("process", `${fnSrc}; return variantsEnabled();`);
    expect(run(undefined)).toBe(false);
  });
});

import { hasVariants, variantUrl, variantWidthsFor } from "../mediaVariants";

// Mirrors backend/scripts/lib/mediaVariantKeys.mjs FAMILIES (people/places/matters
// came from the slug path; the rest from the archive enumeration).
describe("variant families mirror the generator", () => {
  test.each([
    "people/nephi1", "places/zarahemla", "matters/swords",
    "art/1039", "history/thumbs/0120", "history/fax/0120.001.jpg",
    "fax/thumb/1830/010.jpg", "fax/covers/1830", "source/cover/012",
  ])("%s has variants", (p) => expect(hasVariants(p)).toBe(true));

  test.each(["fax/pages/1830/010.jpg", "home/lehites-1", "profiles/grp_x.jpg", "map/z/1/2", "https://x/y.jpg", "history/other/1"])(
    "%s does not", (p) => expect(hasVariants(p)).toBe(false));

  test("variant URLs keep the original extension and append .webp", () => {
    expect(variantUrl("fax/thumb/1830/010.jpg", 256)).toMatch(/\/variants\/256\/fax\/thumb\/1830\/010\.jpg\.webp$/);
    expect(variantUrl("art/1039", 640)).toMatch(/\/variants\/640\/art\/1039\.webp$/);
  });

  test("fax thumbs and source covers only have the 256px variant; the rest 256 and 640", () => {
    expect(variantWidthsFor("fax/thumb/1830/010.jpg")).toEqual([256]);
    expect(variantWidthsFor("source/cover/012")).toEqual([256]);
    expect(variantWidthsFor("art/1039")).toEqual([256, 640]);
    expect(variantWidthsFor("people/nephi1")).toEqual([256, 640]);
  });
});
