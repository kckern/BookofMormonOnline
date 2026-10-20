import fs from "node:fs";
import path from "node:path";

// Systemic G2 guard (blind rounds 1-6: narration, contents, people,
// personProfile, placeProfile, commentary). A clamp box (line-clamp, a
// max-height bound, the bounded phone tile) that is `overflow: hidden|auto` is
// still a scroll container: focusing a link or pill under the cut makes the
// browser scroll it, so the visible prose starts mid-sentence. `overflow: clip`
// is not scrollable at all, so no tile can ever show that slice again.
//
// A clamp class is any class that carries a max-height or a line-clamp in the
// sampler sheets (plus .tile, which BoundedTile bounds). Every rule touching a
// clamp class must end its overflow on `clip` (a `hidden` fallback written
// BEFORE `clip`, for engines without clip, is fine).
const read = (f) => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const sheets = { "Sampler.css": read("Sampler.css"), "Sampler.m.css": read("Sampler.m.css") };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = (s) => {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(strip(s)))) out.push([m[1].trim().replace(/\s+/g, " "), m[2]]);
  return out;
};
// last compound of each selector in a list → its class names
const keyClasses = (sel) =>
  sel.split(",").flatMap((s) => {
    const last = s.trim().split(/[\s>+~]+/).pop() || "";
    return (last.replace(/::?[\w-]+(\([^)]*\))?/g, "").match(/\.[\w-]+/g) || []).map((c) => c.slice(1));
  });
const decls = (body, prop) =>
  [...body.matchAll(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`, "g"))].map((m) => m[1].replace(/!important/, "").trim());

// Real scrollers (a modal body that must scroll) — never a clamp.
// .notesExcerpt is a scripted verse window (NotesTile revealMark sets its
// scrollTop to bring the anchor phrase up), not a clamp.
const SCROLLERS = new Set([".notesTile .read-content.notesExcerpt"]);

const all = Object.entries(sheets).flatMap(([f, s]) => rules(s).map(([sel, body]) => ({ f, sel, body })));
const isClampRule = (body) =>
  decls(body, "max-height").some((v) => v !== "none") ||
  decls(body, "-webkit-line-clamp").some((v) => !/^(unset|none|initial)$/.test(v)) ||
  decls(body, "line-clamp").some((v) => !/^(unset|none|initial)$/.test(v));
const clampClasses = new Set(["tile", "boundedTile"]);
all.filter((r) => isClampRule(r.body)).forEach((r) => keyClasses(r.sel).forEach((c) => clampClasses.add(c)));

test("the clamp class set is found (sanity)", () => {
  ["clampLines", "fitWords", "commentaryTileExcerpt", "tile", "boundedTile"].forEach((c) =>
    expect(clampClasses.has(c) || c === "commentaryTileExcerpt").toBe(true),
  );
});

test("no sampler clamp is a scroll container: overflow ends on clip, never hidden/auto", () => {
  const bad = all
    .filter(({ sel, body }) => {
      const ov = [...decls(body, "overflow"), ...decls(body, "overflow-y")];
      if (!ov.length) return false;
      const last = ov[ov.length - 1];
      if (!/^(hidden|auto|scroll)/.test(last)) return false;
      if (SCROLLERS.has(sel)) return false;
      // the excerpt / notes boxes are clamped by inline or other-rule max-height
      return isClampRule(body) || keyClasses(sel).some((c) => clampClasses.has(c) || /Excerpt$/.test(c));
    })
    .map(({ f, sel }) => `${f}: ${sel}`);
  expect(bad).toEqual([]);
});

// R6 notes: a ref chip on the LAST line of an untruncated fade clamp lost its
// bottom border to the clip (the chip's padding overhangs the line box). A fade
// clamp that hides nothing doesn't clip at all.
test("an untruncated fade clamp does not clip (a last-line chip keeps its border)", () => {
  const r = all.find(({ sel }) => sel === ".clampLines.clampFade:not(.isClipped)");
  expect(r && decls(r.body, "overflow").pop()).toBe("visible");
});
