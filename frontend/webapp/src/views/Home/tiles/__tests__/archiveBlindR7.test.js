/* eslint-disable testing-library/no-container, testing-library/no-node-access */
// Blind audit R7 (archive family) — regressions for the history tile's
// catalogue-text leaks and its facsimile layout.
import "@testing-library/jest-dom";
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArchiveDocTile, { displayAuthor, tidyText } from "../ArchiveDocTile";

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(), assetUrl: "https://media.test" }));

describe("history-A7: catalogue author strings", () => {
  test.each([
    // a bracketed catalogue name flips whole, brackets and all
    ["[Pratt, Parley P.]", "Parley P. Pratt"],
    // initials + the bracketed full name: the full name wins
    ["O., W. [Owen, William]", "William Owen"],
    ["O., R. D. [Owen, Robert Dale, 1801- 1877]", "Robert Dale Owen"],
    // multi-author: only the lead's catalogue inversion is undone
    ["Kimball, Heber C., Orson Hyde, and Willard Richards", "Heber C. Kimball, Orson Hyde, and Willard Richards"],
  ])("%s → %s", (raw, out) => expect(displayAuthor(raw)).toBe(out));

  test("a multi-part publication place is never treated as a name", () => {
    expect(displayAuthor("Wayne Sentinel, Palmyra, New York, and Rochester")).toBe("Wayne Sentinel, Palmyra, New York, and Rochester");
  });
});

describe("history-A7: flattened catalogue text", () => {
  test.each([
    ["The Ohio Star . (Portage County, Ohio)", "The Ohio Star. (Portage County, Ohio)"],
    ["Rigdon , dipt in the loafers ;", "Rigdon, dipt in the loafers;"],
    ["(Independence,Missouri) 1, no. 7", "(Independence, Missouri) 1, no. 7"],
    ["the scriptures of theOld and New Testaments", "the scriptures of the Old and New Testaments"],
    ["Gone toOhio. Printed inPittsburgh for theFirst time", "Gone to Ohio. Printed in Pittsburgh for the First time"],
    ["Boston:Shattuck & Company", "Boston: Shattuck & Company"],
  ])("%s → %s", (raw, out) => expect(tidyText(raw)).toBe(out));

  test("leaves real names with an inner capital alone", () => {
    expect(tidyText("McKay and LeGrand and MacDonald")).toBe("McKay and LeGrand and MacDonald");
  });

  test("the meta and citation lines show the tidied text", () => {
    const { container } = render(
      <MemoryRouter>
        <ArchiveDocTile
          data={{ document: "Mormonism", year: 1831, author: "[Pratt, Parley P.]", citation: "Booth, Ezra. <i>The Ohio Star</i> . (Portage County,Ohio)" }}
          to="/history/x"
        />
      </MemoryRouter>
    );
    expect(container.querySelector(".historyTileMeta")).toHaveTextContent("1831 · Parley P. Pratt");
    expect(container.querySelector(".historyTileCitation")).toHaveTextContent("Booth, Ezra. The Ohio Star. (Portage County, Ohio)");
  });
});

describe("history-A1: a single facsimile floats inside the text, a filmstrip keeps its rail", () => {
  const doc = { document: "Mormonism", year: 1831, money_quote: "A quote." };
  const css = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../../Sampler.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rulesFor = (sel) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(",").map((x) => x.trim()).includes(sel)).map((m) => m[2]).join(";");

  test("one thumbnail sits in the text column (text wraps under it)", () => {
    const { container } = render(<MemoryRouter><ArchiveDocTile data={doc} to="/history/x" images={["history/thumbs/0001"]} /></MemoryRouter>);
    const rail = container.querySelector(".historyTileRail");
    expect(rail).toHaveClass("single");
    expect(rail.parentElement).toHaveClass("historyTileMain");
    expect(rail.parentElement.firstElementChild).toBe(rail);
    expect(rulesFor(".historyTileRail.single")).toMatch(/float:\s*right/);
    expect(rulesFor(".historyTileMain.hasFloat")).toMatch(/display:\s*(block|flow-root)/);
  });

  test("a multi-page filmstrip stays a full-height sibling rail", () => {
    const { container } = render(<MemoryRouter><ArchiveDocTile data={doc} to="/history/x" images={["a.jpg", "b.jpg"]} /></MemoryRouter>);
    const rail = container.querySelector(".historyTileRail");
    expect(rail).toHaveClass("multi");
    expect(rail.parentElement).toHaveClass("historyTileBody");
  });
});

describe("fax-A2 follow-through: a wide card sets the editions beside the (now 200px) pages", () => {
  const css = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../../Sampler.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  test("pages and editions share one body; a wide fax card lays them side by side", async () => {
    const FaxTile = (await import("../FaxTile")).default;
    const { container } = render(
      <MemoryRouter>
        <FaxTile
          data={{ slug: "1830", title: "1830 Palmyra Edition" }}
          payload={{ faxPages: [{ page: 1, imageFile: 1 }, { page: 2, imageFile: 2 }], faxMore: [{ slug: "1837", title: "1837 Kirtland Edition" }] }}
        />
      </MemoryRouter>
    );
    const body = container.querySelector(".faxTileBody");
    expect(body.querySelector(".faxTilePages")).not.toBeNull();
    expect(body.querySelector(".faxTileEditions")).not.toBeNull();
    expect(body.style.getPropertyValue("--fax-pages-w")).toMatch(/rem/);
    expect(css).toMatch(/\.tile-fax\s*{[^}]*container-type:\s*inline-size/);
    expect(css).toMatch(/@container faxCard \(min-width: 600px\)\s*{\s*\.faxTileBody\s*{[^}]*grid-template-columns/);
  });
});
