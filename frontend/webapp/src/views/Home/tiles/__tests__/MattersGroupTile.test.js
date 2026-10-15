import React from "react";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersNarrativeTile from "../MattersNarrativeTile";
import MattersMaterialTile from "../MattersMaterialTile";
import MattersConceptTile from "../MattersConceptTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const mk = (n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    slug: `m${i}`,
    name: `Matter ${i}`,
    subtitle: `Subtitle of matter ${i}`,
    index: [{ ref: `Alma ${i + 1}:1`, slug: `alma/${i + 1}`, text: `Gloss for matter ${i}` }],
    ...extra,
  }));

const prevVariants = process.env.REACT_APP_MEDIA_VARIANTS;
beforeAll(() => { process.env.REACT_APP_MEDIA_VARIANTS = "1"; });
afterAll(() => { process.env.REACT_APP_MEDIA_VARIANTS = prevVariants; });

describe("MattersGroupTile — empty and minimal payload", () => {
  test.each([
    ["no data", undefined],
    ["empty array", []],
    ["items without slug", [{ name: "Orphan" }, null]],
  ])("collapses fully with %s (no heading-only shell)", (_, data) => {
    const { container } = renderIn(<MattersNarrativeTile data={data} payload={{}} />);
    expect(container.firstChild).toBeNull();
  });

  test("a slug-only matter renders without undefined/NaN and without an info body", () => {
    const { container } = renderIn(<MattersMaterialTile data={[{ slug: "rust" }]} payload={{}} />);
    expect(container.textContent).not.toMatch(/undefined|NaN|null/);
    expect(container.querySelector('a[href="/matters/rust"]')).not.toBeNull();
    expect(container.querySelector(".placesTileInfo")).toBeNull();
    expect(container.querySelector(".scripture_link")).toBeNull();
  });

  test("with fewer than 6 matters there is no empty mosaic; the view-all card still offers View all", () => {
    const { container } = renderIn(<MattersConceptTile data={mk(3)} payload={{}} />);
    const viewAll = container.querySelector(".viewAllCard");
    expect(viewAll).toHaveTextContent("View all");
    expect(viewAll.textContent).not.toMatch(/\+|undefined|NaN/);
  });
});

describe("MattersGroupTile — structure", () => {
  test("RefPill is a sibling of the card link, never inside it (G1)", () => {
    const { container } = renderIn(<MattersNarrativeTile data={mk(17)} seed={0} payload={{ mattersNarrativeCount: 161 }} />);
    const pills = container.querySelectorAll(".scripture_link");
    expect(pills.length).toBe(5);
    pills.forEach((p) => {
      expect(p.tagName).toBe("BUTTON");
      expect(p.closest("a")).toBeNull();
    });
  });

  test("each card has exactly one link to its matter (one tab stop)", () => {
    const { container } = renderIn(<MattersNarrativeTile data={mk(17)} payload={{ mattersNarrativeCount: 161 }} />);
    for (let i = 0; i < 5; i++) {
      expect(container.querySelectorAll(`a[href="/matters/m${i}"]`)).toHaveLength(1);
    }
    // the link's accessible name is the matter name (image alt is decorative, no double read)
    expect(screen.getByRole("link", { name: /Matter 0/ })).toHaveAttribute("href", "/matters/m0");
  });

  test("images go through TileImage with a srcset of the uploaded variants", () => {
    const { container } = renderIn(<MattersMaterialTile data={mk(17)} payload={{}} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(17);
    imgs.forEach((img) => {
      expect(img).toHaveClass("tileImage");
      expect(img.getAttribute("srcset")).toMatch(/variants\/256\/matters\/m\d+\.webp 256w/);
      expect(img.getAttribute("loading")).toBe("lazy");
    });
  });

  test("view-all card uses the View all verb and a localized +N count of matters not shown", () => {
    const { container } = renderIn(<MattersNarrativeTile data={mk(18)} payload={{ mattersNarrativeCount: 161 }} />);
    const viewAll = container.querySelector(".viewAllCard");
    expect(viewAll).toHaveAttribute("href", "/matters/narrative");
    expect(viewAll).toHaveTextContent("View all");
    // 5 cards + 12 mosaic cells are shown, whatever the payload length
    expect(viewAll).toHaveTextContent("+144");
    expect(viewAll.querySelectorAll("img")).toHaveLength(12);
  });

  test("name overlay clamps an inner span (padding can't leak a third line) and has no map-pin reservation", () => {
    const { container } = renderIn(<MattersConceptTile data={mk(6)} payload={{}} />);
    const overlay = container.querySelector(".placesNameOverlay");
    expect(overlay).toHaveClass("mattersNameOverlay");
    expect(overlay.querySelector(".mattersNameText")).toHaveTextContent("Matter 0");
  });

  test("heading reads 'Matters · <group>' with a real separator for assistive tech", () => {
    renderIn(<MattersConceptTile data={mk(6)} payload={{}} />);
    const h = screen.getByRole("heading");
    expect(h.textContent).toMatch(/Matters\s+Concepts/);
    expect(within(h).getByRole("link")).toHaveAttribute("href", "/matters/concepts");
  });

  test("narrative subtitle lives inside the card link (secondary layer), other groups have none", () => {
    const { container, unmount } = renderIn(<MattersNarrativeTile data={mk(6)} payload={{}} />);
    const sub = container.querySelector(".mattersSubtitle");
    expect(sub).not.toBeNull();
    expect(sub.closest("a")).toHaveAttribute("href", "/matters/m0");
    unmount();
    const { container: c2 } = renderIn(<MattersMaterialTile data={mk(6)} payload={{}} />);
    expect(c2.querySelector(".mattersSubtitle")).toBeNull();
  });
});

describe("MattersGroupTile — touch hit area + count (review round 2)", () => {
  test("the ref chip sits outside the line-clamped gloss so the clamp can't clip its hit area", () => {
    const { container } = renderIn(<MattersNarrativeTile data={mk(6)} seed={0} payload={{}} />);
    const pill = container.querySelector(".scripture_link");
    expect(pill.closest(".placesTileIndexRow")).toBeNull();
    expect(pill.classList.contains("mattersCardRef")).toBe(true);
    expect(container.querySelector(".placesTileIndexRow")).toHaveTextContent("Gloss for matter 0");
  });

  test("the '+N more' count is the plain number (not browser-locale grouped)", () => {
    const spy = vi.spyOn(Number.prototype, "toLocaleString");
    const { container } = renderIn(<MattersNarrativeTile data={mk(17)} seed={0} payload={{ mattersNarrativeCount: 1161 }} />);
    expect(container.querySelector(".mattersViewAllCount")).toHaveTextContent("+1144 more");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
