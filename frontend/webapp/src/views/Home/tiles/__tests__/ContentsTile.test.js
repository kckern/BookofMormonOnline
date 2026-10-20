import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ContentsTile, { MAX_PAGES } from "../ContentsTile";
import BoundedTile from "../_ds/BoundedTile";

// Force ExpandableText to see overflow so its Read more renders.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const data = {
  slug: "land-of-nephi",
  title: "The Land of Nephi",
  description: "A long description that overflows the clamp and truncates.",
  pages: [
    // the division's own intro page: same slug/title as the division
    { slug: "land-of-nephi", title: "The Land of Nephi", sections: [{ slug: "a", title: "A" }] },
    { slug: "isaiah", title: "Nephi’s Quotations of Isaiah", sections: [{ slug: "i1", title: "I1" }, { slug: "i2", title: "I2" }] },
    { slug: "olive-tree", title: "The Olive Tree Allegory", sections: [{ slug: "o1", title: "O1" }] },
  ],
};

const renderTile = (d = data) => render(<MemoryRouter><ContentsTile data={d} /></MemoryRouter>);
const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });

describe("ContentsTile", () => {
  test("empty / missing slug collapses fully", () => {
    expect(renderTile(null).container.firstChild).toBeNull();
    expect(renderTile({ title: "No slug" }).container.firstChild).toBeNull();
  });

  test("minimal payload (no description, no pages) renders with no undefined/NaN", () => {
    const { container } = renderTile({ slug: "war", title: "War" });
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector(".contentsOutline")).toBeNull();
    expect(deep().getAttribute("href")).toBe("/war");
  });

  test("Layer 2 'See in context' is always visible (no gate) and uses the CTA verb", () => {
    renderTile();
    const cta = deep();
    expect(cta.getAttribute("href")).toBe("/land-of-nephi");
    expect(cta.textContent).toBe("See in context");
  });

  test("Read more is not nested inside a link and toggles to Show less", () => {
    renderTile();
    const btn = screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") });
    expect(btn.closest("a")).toBeNull();
    fireEvent.click(btn);
    expect(btn.textContent).toBe("Show less");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  test("one tab stop per destination: the banner link to the division is out of the tab order", () => {
    const { container } = renderTile();
    const toDivision = [...container.querySelectorAll('a[href="/land-of-nephi"]')];
    const focusable = toDivision.filter((a) => a.getAttribute("tabindex") !== "-1");
    expect(focusable).toHaveLength(1);
    expect(focusable[0].classList.contains("tileMoreLink")).toBe(true);
  });

  test("outline lists the division's pages (not every section), minus its intro page", () => {
    const { container } = renderTile();
    const rows = [...container.querySelectorAll(".contentsOutline a")];
    expect(rows.map((a) => a.getAttribute("href"))).toEqual(["/isaiah", "/olive-tree"]);
    expect(rows[0].textContent).toContain("2 sections");
    expect(rows[1].textContent).toContain("1 section");
    // sections themselves are not linked from the tile
    expect(container.querySelector('a[href="/i1"]')).toBeNull();
  });

  test("long divisions list the first pages, then a quiet '+ N more' (no link)", () => {
    const many = Array.from({ length: MAX_PAGES + 4 }, (_, i) => ({ slug: `p${i}`, title: `Page ${i}`, sections: [] }));
    const { container } = renderTile({ ...data, pages: many });
    expect(container.querySelectorAll(".contentsOutline a")).toHaveLength(MAX_PAGES);
    const more = container.querySelector(".contentsOutlineMore");
    expect(more.textContent).toBe("+ 4 more");
    expect(more.querySelector("a")).toBeNull();
  });

  test("inside a phone-bounded shell: ONE reveal (the bound's), no stacked description Read more", () => {
    const { container } = render(
      <MemoryRouter>
        <BoundedTile className="tile tile-contents"><ContentsTile data={data} /></BoundedTile>
      </MemoryRouter>
    );
    const reveals = container.querySelectorAll(".readMorePill");
    expect(reveals).toHaveLength(1);
    expect(reveals[0].closest(".boundedTileMore")).toBeTruthy();
    expect(container.querySelector(".contentsTileDesc").textContent).toBe(data.description);
  });

  test("the division's size survives dropping its intro page: a quiet 'N pages · M sections' summary under the title (contents-H1)", () => {
    const { container } = renderTile();
    const meta = container.querySelector(".contentsTileMeta");
    // intro (1 section) + isaiah (2) + olive tree (1): 3 pages, 4 sections
    expect(meta.textContent).toBe("3 pages · 4 sections");
    expect(meta.querySelector("a")).toBeNull();
    expect(meta.previousElementSibling.classList.contains("contentsTileTitle")).toBe(true);
  });

  test("no summary when the division has no page data", () => {
    const { container } = renderTile({ slug: "war", title: "War" });
    expect(container.querySelector(".contentsTileMeta")).toBeNull();
  });
});
