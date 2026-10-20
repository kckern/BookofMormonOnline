import fs from "node:fs";
import path from "node:path";

// Blind fix (rail): narration beat rows, single art, reveal alignment.
const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// every rule body whose selector list is exactly `selector`
const bodies = (selector) => {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (m[1].split(",").map((s) => s.trim()).includes(selector)) out.push(m[2]);
  }
  return out.join("\n");
};

test("beat rows hang in ONE shared pill column, so wrapped text never returns under a pill and every beat starts on the same line (narration-C1/A5)", () => {
  const list = bodies(".narrationTileList");
  expect(list).toMatch(/display:\s*grid/);
  expect(list).toMatch(/grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
  expect(bodies(".narrationTileList.hasStatus")).toMatch(/grid-template-columns:\s*auto auto minmax\(0,\s*1fr\)/);
  const item = bodies(".narrationItem");
  expect(item).toMatch(/grid-template-columns:\s*subgrid/);
  expect(item).toMatch(/align-items:\s*first baseline/);
  expect(bodies(".narrationText")).toMatch(/display:\s*contents/);
  expect(bodies(".narrationText .scripture_link")).toMatch(/grid-column:\s*-3 \/ -2/);
  expect(bodies("a.narrationBeatLink")).toMatch(/grid-column:\s*-2 \/ -1/);
});

test("a lone artwork keeps its own aspect, centred, with no letterbox band (narration-A2)", () => {
  expect(bodies(".narrationArtRow.single")).toMatch(/max-width:\s*none/);
  const img = bodies(".narrationArtRow.single img");
  expect(img).toMatch(/aspect-ratio:\s*auto/);
  expect(img).toMatch(/background:\s*none/);
});

test("the narration reveal pill is centred like every other tile's Read more (narration-A5)", () => {
  const more = bodies(".narrationMore");
  expect(more).toMatch(/justify-content:\s*center/);
  expect(bodies(".narrationMore .readMorePill")).not.toMatch(/margin:\s*0;/);
});

test("touch: the beat link owns its row padding as hit area, starting right of the pill (narration-C1)", () => {
  const coarse = css.slice(css.indexOf(".narrationItem { padding-block: 0.6rem; }"));
  const after = coarse.match(/a\.narrationBeatLink::after\s*\{([^}]*)\}/)[1];
  expect(after).toMatch(/inset:\s*-0\.6rem -0\.25rem -0\.6rem 0/);
});
