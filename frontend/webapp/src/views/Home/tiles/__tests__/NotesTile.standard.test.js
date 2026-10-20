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
// Keep the real readPath (the canonical-URL contract is under test); stub the
// passage renderer so no fetch runs.
vi.mock("src/views/_Common/ScriptureExcerpt", async (importOriginal) => ({
  ...(await importOriginal()),
  __esModule: true,
  default: () => null,
}));
const openScripture = vi.fn();
vi.mock("../ScripturePopup", () => ({ openScripture: (...a) => openScripture(...a) }));

import NotesTile from "../NotesTile";

const renderTile = (data) =>
  render(
    <MemoryRouter>
      <NotesTile data={data} />
    </MemoryRouter>
  );

const hardy = { source_id: "193", source_title: "Annotated Book of Mormon", source_name: "Grant Hardy" };

describe("NotesTile — tile standard", () => {
  test("collapses on null / empty / note without reference", () => {
    expect(renderTile(null).container.firstChild).toBeNull();
    expect(renderTile([]).container.firstChild).toBeNull();
    expect(renderTile([{ id: "x", text: "no ref" }]).container.firstChild).toBeNull();
  });

  test("minimal note (no publication): no undefined, no image, no attribution", () => {
    const { container } = renderTile([{ id: "m", text: "Short gloss.", reference: "Alma 5:2" }]);
    expect(container.textContent).not.toMatch(/undefined|NaN|null/);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".notesAttr")).toBeNull();
  });

  test("'See in context' links straight to the canonical Read URL", () => {
    const { container } = renderTile([{ id: "a", text: "Gloss.", reference: "Ether 6:8", publication: hardy }]);
    const cta = container.querySelector("a.tileMoreLink");
    expect(cta.textContent).toBe("See in context");
    expect(cta.getAttribute("href")).toBe("/read/ether.6/8");
  });

  test("no doubled quotes when the note already opens with a quotation", () => {
    const { container } = renderTile([
      { id: "q", text: "<i>“Far better land of promise”</i> is a striking metaphor.", reference: "Alma 37:45", publication: hardy },
    ]);
    const body = container.querySelector(".notesQuote").textContent;
    expect(body.startsWith("““")).toBe(false);
    expect(body).not.toMatch(/^“\s*“/);
  });

  test("plain notes are still smart-quoted", () => {
    const { container } = renderTile([{ id: "p", text: "Mormon is about to quote.", reference: "Alma 5:2", publication: hardy }]);
    expect(container.querySelector(".notesQuote").textContent).toBe("“Mormon is about to quote.”");
  });

  test("inline scripture refs are RefPill buttons that open the popup", () => {
    renderTile([{ id: "r", text: "Compare Alma 36:3 for the same admonition.", reference: "Alma 37:35", publication: hardy }]);
    const pill = screen.getByRole("button", { name: "Alma 36:3" });
    expect(pill.tagName).toBe("BUTTON");
    fireEvent.click(pill);
    expect(openScripture.mock.calls.map((c) => c[0])).toContain("Alma 36:3");
  });

  test("cover is a TileImage whose alt names the publication, not the author", () => {
    const { container } = renderTile([{ id: "c", text: "Gloss.", reference: "Alma 5:2", publication: hardy }]);
    const img = container.querySelector("img.notesCover");
    expect(img.classList.contains("tileImage")).toBe(true);
    expect(img.getAttribute("alt")).toBe("Annotated Book of Mormon");
  });

  test("bubble type: comfortable leading; attribution no larger than the note", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = (sel) => {
      const m = new RegExp(sel.replace(/[.]/g, "\\.") + "\\s*\\{([^}]*)\\}").exec(css);
      return m ? m[1] : "";
    };
    const lh = parseFloat(/line-height:\s*([\d.]+)/.exec(rule(".notesTile .notesBody"))?.[1] || "0");
    expect(lh).toBeGreaterThanOrEqual(1.35);
    const body = parseFloat(/font-size:\s*([\d.]+)rem/.exec(rule(".notesTile .notesBody"))?.[1] || "0");
    const attr = parseFloat(/font-size:\s*([\d.]+)rem/.exec(rule(".notesTile .notesAttr"))?.[1] || "99");
    expect(attr).toBeLessThanOrEqual(body);
  });
});
