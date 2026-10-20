// Blind audit R7 (matters family): touch eyebrow hit, name hygiene, semicolon
// clamp, cross-batch repeats, profile CTA at rest, profile header grammar,
// hero crop, dark-mode muting.
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersConceptTile from "../MattersConceptTile";
import MattersNarrativeTile from "../MattersNarrativeTile";
import MatterProfileTile from "../MatterProfileTile";
import { featuredMatterSlugs, withoutSeenMatters, matterName } from "../MattersGroupTile";
import { clampWords, tidy } from "../textUtils";

const fs = require("node:fs");
const path = require("node:path");
const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const bodiesFor = (src, selector) => {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const sels = m[1].split(",").map((s) => s.trim());
    if (sels.includes(selector)) out.push(m[2]);
  }
  return out;
};
const coarse = css
  .split("@media (pointer: coarse)")
  .slice(1)
  .map((b) => b.slice(0, b.indexOf("\n}\n")))
  .join("\n");

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const mk = (n, p = "m") =>
  Array.from({ length: n }, (_, i) => ({
    slug: `${p}${i}`,
    name: `Matter ${i}`,
    subtitle: `Deck ${i}`,
    description: `Matter ${i} is taught plainly (Alma 34:17-19).`,
    index: [{ ref: `Alma ${i + 1}:1`, text: `Gloss ${i}` }],
  }));

describe("XC1: the eyebrow's touch hit stops where the card grid starts", () => {
  test.each([".mattersTile > .tileHeading", ".matterProfileTile > .tileHeading"])(
    "%s reserves the 44px hit itself (12px up + 32px heading)",
    (sel) => {
      expect(bodiesFor(coarse, sel).join()).toMatch(/min-height:\s*calc\(44px - 12px\)/);
    }
  );
  test("the ::after ends at the heading's own box, never below it", () => {
    const after = bodiesFor(coarse, ".mattersTile .tileHeading a::after").join();
    expect(after).toMatch(/bottom:\s*calc\(100% - 32px\)/);
    expect(after).not.toMatch(/100% - 36px/);
  });
});

describe("XC2: name / gloss hygiene", () => {
  test("tidy curls apostrophes and turns a spaced hyphen into an en dash", () => {
    expect(tidy("the church's procedure - confession")).toBe("the church’s procedure – confession");
  });
  test("matterName: one Title Case rule for every group, small words kept low", () => {
    expect(matterName("Ridding the garments")).toBe("Ridding the Garments");
    expect(matterName("Kneeling in prayer")).toBe("Kneeling in Prayer");
    expect(matterName("Persecute, persecution")).toBe("Persecute, Persecution");
    expect(matterName("Lehi's Altar")).toBe("Lehi’s Altar");
    expect(matterName("Noah’s Great Tower")).toBe("Noah’s Great Tower");
    expect(matterName("Children of Ammon")).toBe("Children of Ammon");
  });
  test("the group tile renders tidied names and glosses", () => {
    const data = mk(6);
    data[0].name = "Gesture and token";
    data[0].index = [{ ref: "Alma 1:1", text: "the church's procedure - confession" }];
    const { container } = renderIn(<MattersConceptTile data={data} payload={{}} />);
    expect(container.querySelector(".mattersNameText")).toHaveTextContent("Gesture and Token");
    expect(container.textContent).toMatch(/church’s procedure – confession/);
  });
  test("the narrative subtitle is tidied too", () => {
    const data = mk(6);
    data[0].subtitle = "Limhi's men - outnumbered";
    const { container } = renderIn(<MattersNarrativeTile data={data} payload={{}} />);
    expect(container.querySelector(".mattersSubtitle")).toHaveTextContent("Limhi’s men – outnumbered");
  });
});

describe("concept-H3: a clamp that lands on a semicolon reads as cut", () => {
  test("drops the semicolon and adds an ellipsis", () => {
    const t = "Alma establishes churches in Zarahemla; elders are ordained over every one of them";
    expect(clampWords(t, 8)).toBe("Alma establishes churches in Zarahemla…");
  });
  test("a full stop still ends without an ellipsis", () => {
    expect(clampWords("Gamma delta epsilon zeta. Eta theta iota", 6)).toBe("Gamma delta epsilon zeta.");
  });
});

describe("concept-H4: matters featured up the feed don't come back as cards or the profile", () => {
  const payload = { mattersConcept: mk(18, "c"), mattersNarrative: mk(18, "n"), mattersMaterial: mk(18, "x") };
  test("featured = the 5 cards of each group + the profiled concept", () => {
    const f = featuredMatterSlugs(payload);
    expect(f.size).toBe(16);
    expect(f.has("c17")).toBe(true);
    expect(f.has("c5")).toBe(false);
  });
  test("a later batch moves seen matters out of the card and profile slots", () => {
    const seen = new Set(["c0", "c1", "c17", "n2"]);
    const out = withoutSeenMatters(payload, seen);
    expect(out.mattersConcept).toHaveLength(18);
    const f = featuredMatterSlugs(out);
    seen.forEach((s) => expect(f.has(s)).toBe(false));
    expect(out.mattersMaterial).toBe(payload.mattersMaterial);
  });
  test("nothing seen: the payload is unchanged", () => {
    expect(withoutSeenMatters(payload, new Set())).toBe(payload);
  });
});

describe("matterProfile: CTA at rest, header grammar, crop", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
  });
  afterAll(() => {
    delete HTMLElement.prototype.scrollHeight;
    delete HTMLElement.prototype.clientHeight;
  });
  beforeEach(() => sessionStorage.clear());
  test("C1: 'Open <matter>' shows at rest beside Read more (as the Person profile)", () => {
    renderIn(<MatterProfileTile payload={{ mattersConcept: mk(18, "c") }} group="concept" />);
    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Open Matter/ })).toHaveAttribute("href", "/matters/c17");
  });
  test("A5: the deck is a plain meta line — no rules, no italic, not centred", () => {
    const sub = bodiesFor(css, ".matterProfileSub").join();
    expect(sub).not.toMatch(/border-(top|bottom)/);
    expect(sub).not.toMatch(/font-style:\s*italic/);
    expect(sub).not.toMatch(/text-align:\s*center/);
    expect(sub).toMatch(/color:\s*var\(--tile-meta\)/);
  });
  test("A2: the stacked hero is 3:2 (square art), not the Places' 16:9", () => {
    expect(bodiesFor(css, ".matterProfileTile .placeProfileImgLink > img.tileImage").join()).toMatch(/aspect-ratio:\s*3\s*\/\s*2/);
  });
});

describe("XC4: watercolour paper grounds are muted in dark mode", () => {
  test.each([
    'html[data-theme="dark"] .mattersCardLink .placesImgWrap > img.tileImage',
    'html[data-theme="dark"] .mattersViewAll .viewAllMosaic img',
    'html[data-theme="dark"] .matterProfileTile .placeProfileImgLink > img.tileImage',
  ])("%s", (sel) => {
    expect(bodiesFor(css, sel).join()).toMatch(/filter:\s*brightness\(0?\.85\)/);
  });
});
