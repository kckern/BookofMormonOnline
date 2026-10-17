import React from "react";
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

import CommentaryTile from "../CommentaryTile";

const renderTile = (data) =>
  render(
    <MemoryRouter>
      <CommentaryTile data={data} />
    </MemoryRouter>
  );

const long = {
  id: 12,
  title: "Moroni’s Greatness",
  reference: "Alma 48:11-25",
  text:
    "<p>The contrast between Moroni and men like Zerahemnah is dramatic (see Alma 43:23).</p>" +
    "<p>" + "He was firm for the right, yet quick to forgive. ".repeat(60) + "</p>",
  publication: { source_id: "11", source_title: "Student Manual", source_name: "CES" },
};

describe("CommentaryTile — tile standard", () => {
  // expansion persists for the Home session (commentary-E2); isolate tests
  beforeEach(() => sessionStorage.clear());
  let sh;
  beforeAll(() => {
    sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  });
  afterAll(() => {
    if (sh) Object.defineProperty(HTMLElement.prototype, "scrollHeight", sh);
    else delete HTMLElement.prototype.scrollHeight;
  });

  test("collapses on an empty payload", () => {
    expect(renderTile(null).container.firstChild).toBeNull();
    expect(renderTile({}).container.firstChild).toBeNull();
  });

  test("minimal payload: no undefined, no cover, no author line", () => {
    const { container } = renderTile({ id: 3, title: "T", preview: "Short." });
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".commentaryTileSource")).toBeNull();
  });

  test("the aside reference is a native RefPill button (keyboard operable) outside any link", () => {
    renderTile(long);
    const pill = screen.getByRole("button", { name: "Alma 48:11–25" });
    expect(pill.tagName).toBe("BUTTON");
    expect(pill.closest("a")).toBeNull();
    fireEvent.click(pill);
    expect(openScripture).toHaveBeenCalledWith("Alma 48:11-25");
  });

  test("inline refs in the excerpt are focusable buttons, not href-less anchors", () => {
    const { container } = renderTile(long);
    const excerpt = container.querySelector(".commentaryTileExcerpt");
    expect(excerpt.querySelector("a:not([href])")).toBeNull();
    const inline = excerpt.querySelector("button.scripture_link");
    expect(inline).not.toBeNull();
    expect(inline.textContent).toContain("Alma 43:23");
  });

  test("one tab stop to /commentary/:id", () => {
    const { container } = renderTile(long);
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    const tabbable = [...container.querySelectorAll('a[href="/commentary/12"]')].filter((a) => a.getAttribute("tabindex") !== "-1");
    expect(tabbable).toHaveLength(1);
  });

  test("reveal is reversible, keeps paragraphs, and stays bounded", () => {
    const { container } = renderTile(long);
    const btn = screen.getByRole("button", { name: "Read more" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.focus();
    fireEvent.click(btn);
    const same = screen.getByRole("button", { name: "Show less" });
    expect(same).toBe(btn);
    expect(document.activeElement).toBe(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    const paras = container.querySelectorAll(".commentaryTileExcerpt p");
    expect(paras.length).toBeGreaterThanOrEqual(2);
    // bounded: the full ~3000-char body is not dumped into the feed
    expect(container.querySelector(".commentaryTileExcerpt").textContent.length).toBeLessThan(1400);
    expect(container.querySelector(".commentaryTileExcerpt").textContent).toMatch(/…$/);
    fireEvent.click(btn);
    expect(btn.textContent).toBe("Read more");
  });

  test("CTA verbs come from the vocabulary", () => {
    const { container } = renderTile(long);
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(container.querySelector("a.tileMoreLink").textContent).toBe("See in context");
  });

  test("a reference-only title leads with the prose and the title ref drives the pill", () => {
    renderTile({
      id: 5,
      title: "Alma 37:16–20",
      reference: "Alma 37:17-21",
      text: "<p>Verse 19 promises preservation of the records. Verse 20 continues.</p>",
      publication: { source_name: "Book of Mormon Central" },
    });
    expect(screen.getByRole("button", { name: "Alma 37:16–20" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Alma 37:17–21" })).toBeNull();
    expect(screen.getByText("Verse 19 promises preservation of the records.", { selector: ".commentaryTileTitle" })).toBeTruthy();
    // the lifted sentence is not repeated as the excerpt's opening
    expect(document.querySelector(".commentaryTileExcerpt").textContent.trim()).toBe("Verse 20 continues.");
  });

  test("cover image uses TileImage with the publication alt", () => {
    const { container } = renderTile(long);
    const img = container.querySelector("img.commentaryTileCover");
    expect(img.classList.contains("tileImage")).toBe(true);
    expect(img.getAttribute("alt")).toBe("Student Manual");
    expect(img.getAttribute("srcset")).toBeNull();
  });
});

test("toParagraphs tidies dash/hyphen and verse-list junk", async () => {
  const { toParagraphs } = await import("../CommentaryTile");
  expect(toParagraphs("<p>a spiritual blessing-a constant reminder (see verses 6. 11) in a week-not so far, north countries ?</p><p>self-investigation</p>")).toEqual([
    "a spiritual blessing—a constant reminder (see verses 6, 11) in a week—not so far, north countries?",
    "self-investigation",
  ]);
});
