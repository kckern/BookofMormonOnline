/* eslint-disable testing-library/no-container, testing-library/no-node-access */
// Blind audit r4 (archive family) — regression tests for the fixes:
// fax-D4 (fax page link/label vs scan), fax-C1/A1 (touch CSS), faxVerse-B4
// (heading count vs rendered rows), history-A7/H3/H4/D5, josephSmith-C4,
// witness-H3.
import "@testing-library/jest-dom";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaxVerseTile from "../FaxVerseTile";
import ArchiveDocTile, { displayAuthor } from "../ArchiveDocTile";
import JosephSmithTile from "../JosephSmithTile";
import WitnessTile from "../WitnessTile";
import { arrangeArchives, featuredArchiveKeys } from "../archiveFeed";
import HistoryBody from "src/views/_Common/entity/HistoryBody";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
  renderBaseUrl: "http://localhost:5006",
}));
vi.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
  readPath: () => "/read/x",
}));

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");

describe("faxVerse-B4: the eyebrow counts the rows that rendered", () => {
  const data = {
    ref: "Mosiah 2:17",
    selector: "mosiah-2.17",
    editions: [
      { version: "1830", title: "1830 Palmyra Edition", page: 117 },
      { version: "1837", title: "1837 Kirtland Edition", page: 120 },
      { version: "rebom", title: "Reader's Edition", page: 5 },
      { version: "poetic", title: "Poetic Edition", page: 9 },
    ],
  };
  test("a crop that fails drops its row AND the count", () => {
    const { container } = wrap(<FaxVerseTile data={data} />);
    expect(container.querySelector(".tileHeading")).toHaveTextContent("4 editions");
    const imgs = container.querySelectorAll("img.faxEditionCrop");
    fireEvent.error(imgs[2]);
    fireEvent.error(imgs[3]);
    expect(container.querySelectorAll(".faxEditionRow")).toHaveLength(2);
    expect(container.querySelector(".tileHeading")).toHaveTextContent("2 editions");
  });
  test("down to one row, the eyebrow drops the count", () => {
    const { container } = wrap(<FaxVerseTile data={{ ...data, editions: data.editions.slice(0, 2) }} />);
    fireEvent.error(container.querySelectorAll("img.faxEditionCrop")[1]);
    expect(container.querySelector(".tileHeading")).not.toHaveTextContent(/editions/);
  });
  test("the row's p. N label is the scan number the viewer shows (fax-D4 sibling)", () => {
    const { container } = wrap(
      <FaxVerseTile data={{ ...data, editions: [{ version: "1981", title: "1981 Salt Lake City Edition", page: 154, imageFile: 145 }] }} />
    );
    expect(container.querySelector(".faxEditionRailPage")).toHaveTextContent("p. 145");
  });
});

describe("history-A7: catalog author strings", () => {
  test.each([
    ["Parsons, Tyler, 1875 or 6-1853", "Tyler Parsons"],
    ["Raumer, Fredrich von (1781-1873)", "Fredrich von Raumer"],
    ["Raumer, Fredrich von, 1781-1873", "Fredrich von Raumer"],
    ["Howe, Eber D., b. 1798", "Eber D. Howe"],
  ])("%s → %s", (raw, out) => expect(displayAuthor(raw)).toBe(out));
  test("datedOnly leaves a publication alone", () => {
    expect(displayAuthor("Wayne Sentinel, Palmyra", { datedOnly: true })).toBe("Wayne Sentinel, Palmyra");
  });
  test("datedOnly still flips a parenthesised-date catalog name", () => {
    expect(displayAuthor("Raumer, Fredrich von (1781-1873)", { datedOnly: true })).toBe("Fredrich von Raumer");
  });
  test("never leaves digits inside a flipped name", () => {
    expect(displayAuthor("Smith, J., 18th cent.")).not.toMatch(/18th cent\. J/);
  });
});

describe("history-H3: the money quote clamps like its siblings", () => {
  test("the quote sits in a fading ExpandableText", () => {
    const { container } = wrap(
      <ArchiveDocTile heading="H" to="/x" data={{ slug: "d1", document: "Doc", money_quote: "word ".repeat(90) }} />
    );
    // inside the quote frame, so the clamp's line unit is the quote's own line
    const q = container.querySelector("blockquote.historyTileQuote");
    expect(q.querySelector(".clampFade")).not.toBeNull();
  });
});

describe("history-D5: the destination prints the citation once", () => {
  test("a transcript lead that differs only by whitespace/entities is dropped", () => {
    const doc = {
      slug: "x",
      document: "Mormonism",
      citation: "Sunderland, La Roy. “Mormonism.” <i>Zion’s Watchman</i> (New York) 3, no. 6 (10 February 1838): 22.",
      transcript:
        "<p><strong>Sunderland, La Roy. &ldquo;Mormonism.&rdquo; <em>Zion&rsquo;s Watchman</em> (New York) 3, no. 6 (10 February1838): 22.</strong></p><p>Mormonites seem to think.</p>",
    };
    const { container } = wrap(<HistoryBody data={doc} />);
    expect(container.textContent.match(/Sunderland/g)).toHaveLength(1);
    expect(container.textContent).toMatch(/Mormonites seem to think/);
  });
});

describe("history-H4 / fax-H4: infinite batches don't repeat an archive item", () => {
  test("a history doc or fax edition already featured is dropped from a new batch", () => {
    const prev = [{ history: { slug: "1834-11-letter-ii" }, fax: { slug: "1842" }, faxMore: [{ slug: "1854" }] }];
    const keys = featuredArchiveKeys(prev);
    const out = arrangeArchives({ history: { slug: "1834-11-letter-ii" }, fax: { slug: "1842" } }, keys);
    expect(out.history).toBeNull();
    expect(out.fax).toBeNull();
    const fresh = arrangeArchives({ history: { slug: "other" }, fax: { slug: "1904" } }, keys);
    expect(fresh.history.slug).toBe("other");
    expect(fresh.fax.slug).toBe("1904");
  });
  test("the other-editions rail skips editions the feed already showed, when enough remain", () => {
    const keys = featuredArchiveKeys([{ fax: { slug: "1842" }, faxMore: [{ slug: "1854" }, { slug: "1837" }] }]);
    const out = arrangeArchives(
      { fax: { slug: "1904" }, faxMore: [{ slug: "1854" }, { slug: "1842" }, { slug: "1830" }, { slug: "1849" }, { slug: "1879" }] },
      keys
    );
    expect(out.faxMore.map((e) => e.slug)).toEqual(["1830", "1849", "1879"]);
  });
});

describe("josephSmith-C4: the CTA opens the statement on the Joseph Smith page", () => {
  test("CTA → /history/joseph-smith/<slug>", () => {
    const { container } = wrap(<JosephSmithTile data={{ slug: "d1", document: "A Doc", mini_quote: "q" }} />);
    expect(container.querySelector("a.tileMoreLink")).toHaveAttribute("href", "/history/joseph-smith/d1");
  });
});

describe("witness-H3: the quote clamp ends on a whole line", () => {
  let sh, ch;
  beforeAll(() => {
    sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
  });
  afterAll(() => {
    if (sh) Object.defineProperty(HTMLElement.prototype, "scrollHeight", sh); else delete HTMLElement.prototype.scrollHeight;
    if (ch) Object.defineProperty(HTMLElement.prototype, "clientHeight", ch); else delete HTMLElement.prototype.clientHeight;
  });
  test("witness and Joseph Smith quotes use the fade clamp", () => {
    sessionStorage.clear();
    const w = wrap(<WitnessTile data={[{ slug: "s", principal: "Martin Harris", witnessSlug: "martin-harris", moneyQuote: "long ".repeat(80) }]} />);
    expect(w.container.querySelector(".witnessStatementWrap .clampFade, .witnessStatementWrap.clampFade, .clampFade")).not.toBeNull();
    const j = wrap(<JosephSmithTile data={{ slug: "d2", document: "A Doc", money_quote: "long ".repeat(80) }} />);
    expect(j.container.querySelector(".clampFade")).not.toBeNull();
  });
});

describe("touch CSS (fax-A1, fax-C1/history-C1)", () => {
  const coarseBlocks = [...css.matchAll(/@media \(pointer: coarse\)\s*{([\s\S]*?)\n}/g)].map((m) => m[1]).join("\n");
  test("the fax ref rail keeps block layout (so its ellipsis works) on touch", () => {
    const rule = /\.faxPageBarRef\s*{([^}]*)}/.exec(coarseBlocks);
    expect(rule).not.toBeNull();
    expect(rule[1]).not.toMatch(/display:\s*flex/);
  });
  test("the fax / history eyebrow reserves its hit extension so the title below stays tappable", () => {
    expect(coarseBlocks).toMatch(/\.faxTile > \.tileHeading,\s*\.historyTile > \.tileHeading\s*{[^}]*min-height:/);
  });
});
