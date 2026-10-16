import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MatterProfileTile, { PROFILE_MATTER_INDEX } from "../MatterProfileTile";
import { reservePool, batchTiles } from "../registry";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const mk = (n) =>
  Array.from({ length: n }, (_, i) => ({
    slug: `c${i}`,
    name: `Concept ${String.fromCharCode(65 + i)}`,
    subtitle: `Deck ${i}`,
    description: `Concept ${i} is taught plainly (Alma 34:17-19). See also Mosiah 3:2.`,
  }));

describe("MatterProfileTile — empty and minimal payload", () => {
  test.each([
    ["no payload", undefined],
    ["empty group", { mattersConcept: [] }],
    ["only the 17 matters the Concept tile already shows", { mattersConcept: mk(17) }],
  ])("collapses with %s", (_, payload) => {
    const { container } = renderIn(<MatterProfileTile payload={payload} group="concept" />);
    expect(container.firstChild).toBeNull();
  });

  test("a matter with only a slug renders no undefined, no subtitle rail, no prose", () => {
    const { container } = renderIn(
      <MatterProfileTile payload={{ mattersConcept: [{ slug: "oaths" }] }} group="concept" matterIndex={0} />
    );
    expect(container.textContent).not.toMatch(/undefined|NaN|null/);
    expect(container.querySelector(".matterProfileSub")).toBeNull();
    expect(container.querySelector(".placeProfileDesc")).toBeNull();
    expect(container.querySelector('a.tileMoreLink[href="/matters/oaths"]')).not.toBeNull();
  });
});

describe("MatterProfileTile — de-duplication against the Concept tile (H4)", () => {
  test("by default it profiles a matter outside the Concept tile's 5 cards + 12-cell mosaic", () => {
    const list = mk(18);
    const { container } = renderIn(<MatterProfileTile payload={{ mattersConcept: list }} group="concept" />);
    expect(PROFILE_MATTER_INDEX).toBeGreaterThanOrEqual(17);
    const shown = new Set(list.slice(0, 17).map((m) => m.slug));
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/matters/c17");
    hrefs.forEach((h) => expect(shown.has(String(h).replace("/matters/", ""))).toBe(false));
  });

  test("the registry only offers the profile when the payload has a matter beyond the Concept tile", () => {
    const entries = [...reservePool, ...batchTiles].filter((t) => t.key === "matterProfile");
    expect(entries.length).toBe(2);
    entries.forEach((t) => {
      expect(t.isReady({ mattersConcept: mk(17) })).toBe(false);
      expect(t.isReady({ mattersConcept: mk(18) })).toBe(true);
    });
  });
});

describe("MatterProfileTile — CTA, links, prose refs", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
  });
  afterAll(() => {
    delete HTMLElement.prototype.scrollHeight;
    delete HTMLElement.prototype.clientHeight;
  });

  test("Layer 2 reads 'Open <name>' (entity verb), revealed by a reversible Read more", () => {
    renderIn(<MatterProfileTile payload={{ mattersConcept: mk(18) }} group="concept" />);
    const pill = screen.getByRole("button", { name: "Read more" });
    fireEvent.click(pill);
    expect(screen.getByRole("button", { name: "Show less" })).toBe(pill);
    const cta = screen.getByRole("link", { name: "Open Concept R" });
    expect(cta).toHaveAttribute("href", "/matters/c17");
    expect(cta).toHaveClass("tileMoreLink");
  });

  test("the hero image link is not a second tab stop to the same page", () => {
    const { container } = renderIn(<MatterProfileTile payload={{ mattersConcept: mk(18) }} group="concept" />);
    const hero = container.querySelector(".placeProfileImgLink");
    expect(hero).toHaveAttribute("href", "/matters/c17");
    expect(hero).toHaveAttribute("tabindex", "-1");
  });

  test("prose scripture refs are focusable buttons, and parentheses around a lone ref are dropped", () => {
    const { container } = renderIn(<MatterProfileTile payload={{ mattersConcept: mk(18) }} group="concept" />);
    const refs = container.querySelectorAll(".placeProfileDesc .scripture_link");
    expect(refs.length).toBe(2);
    refs.forEach((r) => expect(r.tagName).toBe("BUTTON"));
    const prose = container.querySelector(".placeProfileDesc").textContent;
    expect(prose).not.toMatch(/\(\s*Alma/);
    expect(prose).toMatch(/taught plainly Alma 34:17/);
  });
});

describe("MatterProfileTile — hero image failure (review round 2)", () => {
  test("a hero that fails to load hides itself instead of showing a broken glyph", () => {
    const prev = process.env.REACT_APP_MEDIA_VARIANTS;
    process.env.REACT_APP_MEDIA_VARIANTS = "0";
    const { container } = renderIn(
      <MatterProfileTile payload={{ mattersConcept: [{ slug: "nope", name: "Nope" }] }} group="concept" matterIndex={0} />
    );
    const img = container.querySelector("img.tileImage");
    fireEvent.error(img);
    // no broken glyph and no empty 15rem box: the hero collapses, name stays
    expect(container.querySelector("img.tileImage")).toBeNull();
    expect(container.querySelector(".placeProfileImgLink")).toHaveClass("isNoImage");
    expect(container.querySelector(".mattersNameText")).toHaveTextContent("Nope");
    process.env.REACT_APP_MEDIA_VARIANTS = prev;
  });
});

describe("MatterProfileTile — parity with Place Profile (blind audit matters-11/12)", () => {
  beforeEach(() => sessionStorage.clear());
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
  });
  afterAll(() => {
    delete HTMLElement.prototype.scrollHeight;
    delete HTMLElement.prototype.clientHeight;
  });
  test("eyebrow reads 'Matters · Profile', as the place and person profiles", () => {
    renderIn(<MatterProfileTile payload={{ mattersConcept: mk(18) }} group="concept" />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(/^Matters · Profile$/);
  });
  test("the prose clamp is the word-safe fade clamp and remembers an expansion across a Back remount", () => {
    const payload = { mattersConcept: mk(18) };
    const { container, unmount } = renderIn(<MatterProfileTile payload={payload} group="concept" />);
    expect(container.querySelector(".placeProfileDesc .clampLines.clampFade")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    unmount();
    const { container: c2 } = renderIn(<MatterProfileTile payload={payload} group="concept" />);
    expect(c2.querySelector(".placeProfileDesc .clampLines")).toBeNull();
    expect(screen.getByRole("link", { name: "Open Concept R" })).toBeInTheDocument();
  });
});
