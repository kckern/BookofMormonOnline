import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PeopleTile, { peopleLayout } from "../PeopleTile";
import { clampWords, supDigits } from "../textUtils";

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
