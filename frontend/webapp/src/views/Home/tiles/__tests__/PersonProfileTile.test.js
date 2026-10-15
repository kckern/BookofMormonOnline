import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PersonProfileTile from "../PersonProfileTile";
import { peopleLayout } from "../PeopleTile";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
}));

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const long = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const person = (i, extra = {}) => ({
  slug: `p${i}`, name: `Person${i}`, title: `Title ${i}`, unit: "I", identification: "N",
  description: long(120), ...extra,
});

describe("PersonProfileTile: empty and minimal payloads", () => {
  test("no people collapses", () => {
    const { container } = renderIn(<PersonProfileTile payload={{}} />);
    expect(container.firstChild).toBeNull();
  });
  test("a person without a bio collapses", () => {
    const { container } = renderIn(<PersonProfileTile payload={{ people: [{ slug: "x", name: "X" }] }} />);
    expect(container.firstChild).toBeNull();
  });
  test("minimal person (no title) renders without undefined/NaN", () => {
    const { container } = renderIn(<PersonProfileTile payload={{ people: [{ slug: "x", name: "X", description: "Short bio." }] }} />);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });
});

describe("PersonProfileTile: CTA + regressions", () => {
  test("Layer 2 reads 'Open <name>' (not 'See in context') and is the single tab stop", () => {
    const { container } = renderIn(<PersonProfileTile payload={{ people: [person(0, { name: "Coriantor2" })] }} />);
    const open = screen.getByRole("link", { name: "Open Coriantor²" });
    expect(open.getAttribute("href")).toBe("/people/p0");
    const stops = [...container.querySelectorAll('a[href="/people/p0"]')].filter((a) => a.getAttribute("tabindex") !== "-1");
    expect(stops).toEqual([open]);
    expect(container.textContent).not.toMatch(/See in context/);
  });

  test("H2: the eyebrow is distinct from the People tile's", () => {
    const { container } = renderIn(<PersonProfileTile payload={{ people: [person(0)] }} />);
    expect(container.querySelector(".tileHeading").textContent).toMatch(/Profile/);
  });

  test("M2: a failed portrait shows a monogram, not a hidden hole", () => {
    const { container } = renderIn(<PersonProfileTile payload={{ people: [person(0, { name: "Abinadom" })] }} />);
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".personMonogram").textContent).toBe("A");
  });

  test("profiles someone the People tile does not show", () => {
    const people = Array.from({ length: 24 }, (_, i) => person(i));
    const { featured, faces } = peopleLayout(people);
    renderIn(<PersonProfileTile payload={{ people }} />);
    const shown = new Set([featured, ...faces].map((p) => `/people/${p.slug}`));
    const href = screen.getByRole("link", { name: /^Open / }).getAttribute("href");
    expect(shown.has(href)).toBe(false);
  });

  test("bio refs are buttons with no wrapping parentheses", () => {
    const { container } = renderIn(
      <PersonProfileTile payload={{ people: [person(0, { description: `He was drunk (Ether 14:5) and fell. ${long(60)}` })] }} />
    );
    const pill = container.querySelector(".scripture_link");
    expect(pill.tagName).toBe("BUTTON");
    expect(container.textContent).not.toMatch(/\(\s*Ether/);
  });
});
