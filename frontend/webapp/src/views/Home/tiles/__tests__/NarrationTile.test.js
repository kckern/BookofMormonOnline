import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../ScripturePopup", () => ({ __esModule: true, openScripture: vi.fn() }));

import NarrationTile from "../NarrationTile";

const beat = (guid, slug, heading, text, extra = {}) => ({
  narration: { guid, description: text, text: { slug, heading, imgIds: [], ...extra } },
});

const data = {
  slug: "zarahemla/age-of-war",
  title: "Zarahemla’s Age of War",
  page: { slug: "zarahemla", title: "Zarahemla" },
  rows: [
    beat("b1", "alma/43", "Alma 43:1-4", "Moroni prepares the Nephites.", { imgIds: [11, 12] }),
    beat("b2", "alma/44", "Alma 44:1", "Zerahemnah surrenders."),
  ],
};
const next = {
  slug: "zarahemla/next",
  title: "Pahoran’s Assassination",
  rows: [beat("n1", "hel/1", "Helaman 1:1", "Pahoran dies.")],
};

const renderTile = (props) => render(<MemoryRouter><NarrationTile {...props} /></MemoryRouter>);

describe("NarrationTile", () => {
  test("empty / beat-less payloads collapse fully", () => {
    expect(renderTile({ data: null }).container.firstChild).toBeNull();
    expect(renderTile({ data: { slug: "x", rows: [{ narration: { guid: "g", description: "" } }] } }).container.firstChild).toBeNull();
  });

  test("minimal payload (one beat, no page, no art, no next) renders with no undefined/NaN", () => {
    const { container } = renderTile({ data: { slug: "s", title: "S", rows: [beat("b", null, null, "Only beat.")] } });
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector(".narrationArtRow")).toBeNull();
    expect(container.querySelector('a[href="/s"]')).toBeTruthy();
  });

  test("RefPills are buttons beside the beat link, never inside it", () => {
    renderTile({ data, next });
    const pills = screen.getAllByRole("button", { name: /Alma|Helaman/ });
    expect(pills.length).toBe(3);
    pills.forEach((p) => expect(p.closest("a")).toBeNull());
    expect(screen.getByRole("link", { name: "Moroni prepares the Nephites." }).getAttribute("href")).toBe("/alma/43");
  });

  test("Layer 2 is 'See in context' to the section, from the CTA vocabulary", () => {
    const { container } = renderTile({ data, next });
    const cta = container.querySelector(".tileMoreLink");
    expect(cta.textContent).toBe("See in context");
    expect(cta.getAttribute("href")).toBe("/zarahemla/age-of-war");
    // one link per destination: the section title is a heading, not a 2nd link to the CTA href
    expect(container.querySelectorAll('a[href="/zarahemla/age-of-war"]')).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Zarahemla’s Age of War" })).toBeTruthy();
  });

  test("the continuation is a labeled 'Next' divider, not a competing title", () => {
    const { container } = renderTile({ data, next });
    const nextRow = container.querySelector(".narrationNext");
    expect(nextRow.textContent).toContain("Next");
    expect(nextRow.querySelector("a").getAttribute("href")).toBe("/zarahemla/next");
  });

  test("art thumbs are named links (not empty-alt link-only images)", () => {
    const prev = process.env.REACT_APP_MEDIA_VARIANTS;
    process.env.REACT_APP_MEDIA_VARIANTS = "1"; // variants on: art must still skip them
    const { container } = renderTile({ data, next });
    if (prev === undefined) delete process.env.REACT_APP_MEDIA_VARIANTS;
    else process.env.REACT_APP_MEDIA_VARIANTS = prev;
    const imgs = [...container.querySelectorAll(".narrationArtLink img")];
    expect(imgs).toHaveLength(2);
    imgs.forEach((img) => expect(img.getAttribute("alt")).toMatch(/Zarahemla/));
    // art has no media variants: plain src, no srcset
    imgs.forEach((img) => expect(img.getAttribute("srcset")).toBeNull());
  });

  test("status dots appear only when some beat has progress", () => {
    const { container, unmount } = renderTile({ data, next });
    expect(container.querySelector(".narrationDot")).toBeNull();
    unmount();
    const withStatus = { ...data, rows: [beat("b1", "alma/43", null, "Read.", { status: "completed" }), ...data.rows.slice(1)] };
    const r2 = renderTile({ data: withStatus });
    expect(r2.container.querySelectorAll(".narrationDot")).toHaveLength(2);
  });
});
