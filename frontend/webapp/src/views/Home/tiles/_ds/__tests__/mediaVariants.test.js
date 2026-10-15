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
