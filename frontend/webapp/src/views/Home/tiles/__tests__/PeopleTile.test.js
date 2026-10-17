import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PeopleTile, { peopleLayout, faceHook, faceTitle } from "../PeopleTile";
import { personName } from "../PersonFeature";
import { clampWords, supDigits, tidy } from "../textUtils";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
}));

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const long = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const person = (i, extra = {}) => ({
  slug: `p${i}`,
  name: `Person ${String.fromCharCode(65 + (i % 26))}`,
  title: `Title ${i}`,
  unit: "I",
  identification: "N",
  description: long(120),
  index: [{ ref: `Alma ${i + 1}:1`, text: `Index text for person ${i}` }],
  ...extra,
});
const sample = (n = 24) => Array.from({ length: n }, (_, i) => person(i));

describe("PeopleTile: empty and minimal payloads", () => {
  test("empty data collapses (no shell)", () => {
    const { container } = renderIn(<PeopleTile data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test("missing data collapses", () => {
    const { container } = renderIn(<PeopleTile />);
    expect(container.firstChild).toBeNull();
  });

  test("people without a slug are dropped; all-slugless collapses", () => {
    const { container } = renderIn(<PeopleTile data={[{ name: "Nobody" }]} />);
    expect(container.firstChild).toBeNull();
  });

  test("one minimal person (no title, bio, index) renders with no undefined/NaN or broken src", () => {
    const { container } = renderIn(<PeopleTile data={[{ slug: "nephi", name: "Nephi" }]} />);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    container.querySelectorAll("img").forEach((img) => {
      expect(img.getAttribute("src")).not.toMatch(/undefined|null/);
    });
    expect(screen.getByText("Nephi")).toBeTruthy();
    expect(container.querySelector(".scripture_link")).toBeNull();
  });
});

describe("PeopleTile: CTA vocabulary", () => {
  test("the featured person gets one 'Open <name>' deeplink", () => {
    renderIn(<PeopleTile data={sample()} payload={{ peopleCount: 435 }} />);
    const open = screen.getByRole("link", { name: /^Open Person A/ });
    expect(open.classList.contains("tileMoreLink")).toBe(true);
    expect(open.getAttribute("href")).toBe("/people/p0");
  });

  test("view-all card falls back to 'View all' when there is no count", () => {
    renderIn(<PeopleTile data={sample()} />);
    const viewAll = document.querySelector(".peopleTile .viewAllCard");
    expect(viewAll.textContent).toBe("View all");
  });

  test("view-all card counts the people not shown as faces", () => {
    renderIn(<PeopleTile data={sample()} payload={{ peopleCount: 435 }} />);
    const shown = 1 + document.querySelectorAll(".peopleTile .peopleFaceCard:not(.viewAllCard)").length;
    expect(shown).toBe(10);
    expect(document.querySelector(".peopleTile .viewAllCard").textContent).toMatch(/^\+425\b/);
  });
});

describe("PeopleTile: R2.5 regressions", () => {
  test("G1: no RefPill is nested inside a link; face pills are buttons", () => {
    const { container } = renderIn(<PeopleTile data={sample()} />);
    const pills = container.querySelectorAll(".peopleFaceCard .scripture_link");
    expect(pills.length).toBeGreaterThan(0);
    pills.forEach((p) => {
      expect(p.tagName).toBe("BUTTON");
      expect(p.closest("a")).toBeNull();
    });
  });

  test("one tab stop per destination in the featured block", () => {
    const { container } = renderIn(<PeopleTile data={sample()} />);
    const feature = container.querySelector(".peopleFeature");
    const stops = [...feature.querySelectorAll('a[href="/people/p0"]')].filter((a) => a.getAttribute("tabindex") !== "-1");
    expect(stops.length).toBe(1);
  });

  test("one tab stop per face card (link + sibling pill, not link-in-link)", () => {
    const { container } = renderIn(<PeopleTile data={sample()} />);
    const card = container.querySelector(".peopleFaceCard:not(.viewAllCard)");
    const links = card.querySelectorAll("a[href]");
    expect(links.length).toBe(1);
  });

  test("H3/A7: disambiguators render as superscripts everywhere; inverted names read naturally", () => {
    const data = sample();
    data[0] = person(0, { name: "Mosiah2", title: "People Converted by Alma₁" });
    data[3] = person(3, { name: "Gideon, Chief Judge of", title: "Assisted Giddonah2" });
    const { container } = renderIn(<PeopleTile data={data} />);
    expect(container.textContent).toMatch("Mosiah²");
    expect(container.textContent).toMatch("Alma¹");
    expect(container.textContent).toMatch("Chief Judge of Gideon");
    expect(container.textContent).toMatch("Giddonah²");
    expect(container.textContent).not.toMatch(/[A-Za-z][1-4]\b|[₀-₉]/);
    // no raw-digit tooltips
    container.querySelectorAll("[title]").forEach((el) => expect(el.getAttribute("title")).not.toMatch(/[A-Za-z][1-4]\b/));
  });

  test("A3: detected refs in the bio drop their wrapping parentheses and are buttons", () => {
    const data = sample();
    data[0] = person(0, { description: `${long(60)} answered for (Mosiah 29:25) and ruled well. ${long(60)}` });
    const { container } = renderIn(<PeopleTile data={data} />);
    const bio = container.querySelector(".peopleFeatureDesc");
    expect(bio.textContent).not.toMatch(/\(\s*Mosiah/);
    const pill = bio.querySelector(".scripture_link");
    expect(pill.tagName).toBe("BUTTON");
  });

  test("H1: the featured slot prefers a named individual with a substantial bio", () => {
    const data = sample();
    data[0] = person(0, { name: "Jerusalem Prophets", unit: "G", description: long(30) });
    data[1] = person(1, { name: "Uzziah", identification: "B" });
    data[2] = person(2, { name: "Moroni2" });
    const { featured } = peopleLayout(data);
    expect(featured.slug).toBe("p2");
  });

  test("H1: falls back to the first person when nobody qualifies", () => {
    const data = [person(0, { unit: "G", description: "short" }), person(1, { unit: "G", description: "short" })];
    expect(peopleLayout(data).featured.slug).toBe("p0");
  });

  test("layout: no person appears twice; the profile reserve is someone not shown", () => {
    const { featured, faces, mosaic, profile } = peopleLayout(sample());
    const slugs = [featured, ...faces, ...mosaic, profile].map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(faces.length).toBe(9);
    expect(mosaic.length).toBe(12);
  });

  test("J1: featured portrait is eager + high priority; faces are lazy TileImages", () => {
    const { container } = renderIn(<PeopleTile data={sample()} />);
    const featured = container.querySelector(".peopleFeature img");
    expect(featured.getAttribute("loading")).toBe("eager");
    expect(featured.getAttribute("fetchpriority")).toBe("high");
    const face = container.querySelector(".peopleFaceCard:not(.viewAllCard) img");
    expect(face.getAttribute("loading")).toBe("lazy");
    expect(face.classList.contains("tileImage")).toBe(true);
  });

  test("M2: a failed portrait swaps to a monogram instead of a blank hole", () => {
    const { container } = renderIn(<PeopleTile data={sample()} />);
    const img = container.querySelector(".peopleFeature img");
    fireEvent.error(img);
    expect(container.querySelector(".peopleFeature img")).toBeNull();
    expect(container.querySelector(".peopleFeature .personMonogram").textContent).toBe("P");
  });
});

describe("textUtils hygiene used by the people tiles", () => {
  test("clampWords never ends on a dangling function word", () => {
    expect(clampWords("Son of Joseph¹, father of Ephraim and Manasseh", 5)).toBe("Son of Joseph¹, father…");
    expect(clampWords("Namesake of the valley of Nimrod in the north", 5)).toBe("Namesake of the valley…");
  });
  test("supDigits normalizes subscript disambiguators", () => {
    expect(supDigits("Attendees at Nephi₂'s Trial")).toBe("Attendees at Nephi²'s Trial");
  });
});

describe("PeopleTile: blind-audit fixes (2026-10-16)", () => {
  test("A2: portrait sizes cover the cover-scaled box (picks the 640w variant at 2x)", () => {
    const prev = process.env.REACT_APP_MEDIA_VARIANTS;
    process.env.REACT_APP_MEDIA_VARIANTS = "1";
    try {
      const { container } = renderIn(<PeopleTile data={sample()} />);
      const face = container.querySelector(".peopleFaceCard:not(.viewAllCard) img");
      expect(face.getAttribute("srcset")).toMatch(/640w/);
      // 3:4 card 132px wide → a square source cover-scales to 176px: ask for ≥176
      const px = Number(face.getAttribute("sizes").match(/(\d+)px\s*$/)[1]);
      expect(px).toBeGreaterThanOrEqual(176);
      const feat = container.querySelector(".peopleFeature img");
      expect(Number(feat.getAttribute("sizes").match(/(\d+)px\s*$/)[1])).toBeGreaterThanOrEqual(171);
    } finally {
      process.env.REACT_APP_MEDIA_VARIANTS = prev;
    }
  });

  test("H2: a face card's hook prefers a real sentence over a 2-word concordance stub", () => {
    const p = person(1, {
      index: [
        { ref: "Alma 1:1", text: "Is pacified" },
        { ref: "Alma 2:2", text: "Leads the armies of the Nephites against Zerahemnah" },
      ],
    });
    for (let seed = 0; seed < 4; seed++) {
      const hook = faceHook(p, seed, 0);
      expect(hook.ref).toBe("Alma 2:2");
      expect(hook.text).toMatch(/^Leads the armies/);
    }
  });

  test("H2: with only stubs, the card keeps the ref but drops the stub text", () => {
    const p = person(1, { index: [{ ref: "Alma 1:1", text: "Is pacified" }] });
    expect(faceHook(p, 0, 0)).toEqual({ ref: "Alma 1:1", text: "" });
  });

  test("H2: faces prefer people with a real hook line (stub-only people move to the mosaic)", () => {
    const data = sample(15); // 13 after featured + profile: 9 faces, 4 mosaic
    data[3] = person(3, { index: [{ ref: "Alma 1:1", text: "Is pacified" }] });
    const { faces, mosaic } = peopleLayout(data);
    expect(faces.map((p) => p.slug)).not.toContain("p3");
    expect(mosaic.map((p) => p.slug)).toContain("p3");
  });

  test("H3: face titles cut at a phrase boundary, never on 'in dealing…' / 'to the Land…'", () => {
    expect(clampWords("Chief Judge who assisted Giddonah² in dealing with Korihor", 8, { phrase: true })).toBe(
      "Chief Judge who assisted Giddonah²…"
    );
    expect(clampWords("Colonist who accompanied Zeniff to the Land of Nephi", 8, { phrase: true })).toBe(
      "Colonist who accompanied Zeniff…"
    );
    // short titles untouched
    expect(clampWords("Wife of Abraham", 8, { phrase: true })).toBe("Wife of Abraham");
  });

  test("A7: straight apostrophes become typographic and titles are trimmed", () => {
    expect(tidy("One of Ammon's Brethren ")).toBe("One of Ammon’s Brethren");
    const data = sample();
    data[2] = person(2, { title: "Attacker of Limhi's People " });
    const { container } = renderIn(<PeopleTile data={data} />);
    expect(container.textContent).toMatch("Attacker of Limhi’s People");
    expect(container.textContent).not.toMatch("Limhi's");
  });

  test("A7: person names are typographic too, so names, CTA and titles agree", () => {
    expect(personName("Ishmael's Daughter")).toBe("Ishmael’s Daughter");
    const data = sample();
    data[0] = person(0, { name: "Gilead's Priest", description: long(200) });
    const { container } = renderIn(<PeopleTile data={data} />);
    expect(container.textContent).toMatch("Gilead’s Priest");
    expect(container.textContent).not.toMatch("Gilead's");
  });

  test("H3: a face title fits its two-line band, so the JS phrase cut (not CSS) ends it", () => {
    const t = faceTitle("Nephite prophet, king in Zarahemla, father of Benjamin");
    expect(t.length).toBeLessThanOrEqual(38);
    expect(t).toMatch(/…$/);
    expect(t).not.toMatch(/\b(of|in|the|and|to)…$/);
    expect(faceTitle("Wife of Abraham")).toBe("Wife of Abraham");
    expect(faceTitle("Attacker of Limhi's People")).toBe("Attacker of Limhi’s People");
  });
});

describe("PeopleTile: one figure, one card (audit H4)", () => {
  test("an alias entry ('Wife of Nephi — Daughter of Ishmael') never sits beside the featured 'Ishmael's Daughter'", () => {
    const data = sample();
    data[0] = person(0, { slug: "ishmaels-daughter", name: "Ishmael's Daughter", title: "Pleader with Laman and Lemuel on behalf of Nephi", description: long(200) });
    data[3] = person(3, { slug: "wife-of-nephi", name: "Wife of Nephi", title: "Daughter of Ishmael" });
    data[4] = person(4, { slug: "ishmaels-wife", name: "Ishmael's Wife", title: "Mother of Ishmaelites" });
    const { featured, profile, faces, mosaic } = peopleLayout(data);
    const shown = [featured, profile, ...faces, ...mosaic].map((p) => p.slug);
    expect(featured.slug).toBe("ishmaels-daughter");
    expect(shown).not.toContain("wife-of-nephi");
    expect(shown).toContain("ishmaels-wife"); // a different person in the same family stays
  });

  test("shared generic titles alone do not merge people", () => {
    const data = sample();
    data[1] = person(1, { slug: "k1", name: "Laman2", title: "King of the Lamanites" });
    data[2] = person(2, { slug: "k2", name: "Lamoni's Father", title: "King of the Lamanites" });
    const { featured, profile, faces, mosaic } = peopleLayout(data);
    const shown = [featured, profile, ...faces, ...mosaic].map((p) => p.slug);
    expect(shown).toEqual(expect.arrayContaining(["k1", "k2"]));
  });
});

describe("Sampler.css: people touch targets", () => {
  const fs = require("fs");
  const path = require("path");
  const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
  test("F2: People and People · Profile eyebrows get the 44px coarse-pointer hit", () => {
    const coarse = css.split("@media (pointer: coarse)").slice(1).join("\n");
    expect(coarse).toMatch(/\.peopleTile \.tileHeading a::after/);
    expect(coarse).toMatch(/\.personProfileTile \.tileHeading a::after/);
  });
});

describe("PeopleTile skeleton (audit B1)", () => {
  test("phone skeleton reserves the measured 851–884px footprint, not 775px", async () => {
    const { skeletonHeight } = await import("../_ds/skeletonHeights");
    const px = parseInt(skeletonHeight("tile-people", true), 10);
    expect(px).toBeGreaterThanOrEqual(850);
    expect(px).toBeLessThanOrEqual(890);
  });
});
