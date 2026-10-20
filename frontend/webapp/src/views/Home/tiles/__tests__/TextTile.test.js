import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
const openScripture = vi.fn();
vi.mock("../ScripturePopup", () => ({ openScripture: (...a) => openScripture(...a) }));

import TextTile from "../TextTile";

const full = {
  slug: "reign-of-judges/ammonihah/38",
  heading: "[Alma 10:1–11] Amulek’s family",
  content:
    "<p>I am Amulek; [c]1275602301[/c] I am the son of Giddonah,</p><blockquote><p>“Who art thou? <br />_art thou that Great Spirit,”</p></blockquote>",
  imgIds: ["2901", "1517"],
  parent_page: { title: "Alma’s Ministry in Ammonihah" },
  parent_section: { title: "Continued Preaching" },
  narration: { description: "{The king|lamoni}, again impressed by {Ammon|ammon2}, asks." },
};

const renderTile = (data) =>
  render(
    <MemoryRouter>
      <TextTile data={data} />
    </MemoryRouter>
  );

describe("TextTile", () => {
  test("collapses with no data or no slug", () => {
    expect(renderTile(null).container.firstChild).toBeNull();
    expect(renderTile({ heading: "x" }).container.firstChild).toBeNull();
  });

  test("minimal payload renders without undefined, dangling colon, breadcrumb arrow or image", () => {
    const { container } = renderTile({ slug: "ammon/37", heading: "Alma 18:18", content: "<p>Now when the king</p>" });
    const txt = container.textContent;
    expect(txt).not.toMatch(/undefined|NaN|null/);
    expect(txt).not.toContain("▸");
    expect(txt).not.toMatch(/:\s*$/);
    expect(container.querySelector("img")).toBeNull();
    expect(txt).toContain("Now when the king");
  });

  test("single chrome: no nested legacy feed card", () => {
    const { container } = renderTile(full);
    expect(container.querySelector(".itemInFeed, .itemInFeedContainer, .notch")).toBeNull();
  });

  test("one tab stop to the destination; eyebrow is plain text", () => {
    const { container } = renderTile(full);
    const href = `/${full.slug}`;
    const tabbable = [...container.querySelectorAll(`a[href="${href}"]`)].filter((a) => a.getAttribute("tabindex") !== "-1");
    expect(tabbable).toHaveLength(1);
    expect(container.querySelector(".tileHeading a")).toBeNull();
  });

  test("the deeplink uses the CTA vocabulary (See in context)", () => {
    const { container } = renderTile({ ...full, content: "<p>short</p>" });
    const cta = container.querySelector("a.tileMoreLink");
    expect(cta).not.toBeNull();
    expect(cta.textContent).toBe("See in context");
  });

  test("bracketed heading splits into a title and a RefPill button that opens the popup", () => {
    renderTile(full);
    expect(screen.getByText("Amulek’s family")).toBeTruthy();
    const pill = screen.getByRole("button", { name: "Alma 10:1–11" });
    expect(pill.closest("a")).toBeNull();
    fireEvent.click(pill);
    expect(openScripture.mock.calls.map((c) => c[0])).toContain("Alma 10:1–11");
  });

  test("bare-reference heading becomes the pill; the section title is the headline", () => {
    renderTile({ ...full, heading: "Alma 18:18" });
    expect(screen.getByRole("button", { name: "Alma 18:18" })).toBeTruthy();
    expect(screen.getByText("Continued Preaching")).toBeTruthy();
  });

  test("context meta line has no dangling colon or ▸", () => {
    const { container } = renderTile(full);
    const meta = container.querySelector(".textTileMeta").textContent;
    expect(meta).toContain("Alma’s Ministry in Ammonihah");
    expect(meta).toContain("Continued Preaching");
    expect(meta).not.toMatch(/[:▸]/);
  });

  test("narration is flattened (no {x|slug} markup) and shows at most one static image", () => {
    const { container } = renderTile(full);
    expect(container.querySelector(".textTileNarration").textContent).toContain("The king, again impressed by Ammon");
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector(".imgBox")).toBeNull();
  });

  test("passage strips [c] tags and renders in the Read serif block", () => {
    const { container } = renderTile(full);
    const p = container.querySelector(".textTilePassage");
    expect(p).not.toBeNull();
    expect(p.textContent).not.toContain("[c]");
    const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
    expect(css).toMatch(/\.textTilePassage\s*\{[^}]*font-family:\s*"Scripture"/);
  });
});

// Audit 2026-10-15 text-H3 / text-E2: the passage clamps on whole lines (fade,
// never a mid-word ellipsis) and its expansion survives Back.
import { writeExpanded } from "../samplerSession";
describe("TextTile clamp", () => {
  afterEach(() => sessionStorage.clear());
  test("collapsed passage uses the whole-line fade clamp", () => {
    const { container } = renderTile(full);
    expect(container.querySelector(".textTileBody .clampFade")).not.toBeNull();
  });
  test("a restored expansion remounts open", () => {
    writeExpanded(`text:${full.slug}`, true);
    const { container } = renderTile(full);
    expect(container.querySelector(".textTileBody .clampLines")).toBeNull();
  });
});
