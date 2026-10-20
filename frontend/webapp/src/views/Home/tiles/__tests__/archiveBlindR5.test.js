/* eslint-disable testing-library/no-container, testing-library/no-node-access */
// Blind audit R5 (archive family) — regression tests for the P2 fixes on the
// fax, history, witness and josephSmith tiles.
import "@testing-library/jest-dom";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rulesFor = (sel) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(",").map((s) => s.trim()).includes(sel)).map((m) => m[2]).join(";");

describe("CSS (R5)", () => {
  test("fax-L3: dark mode dims the large page scans like the covers and crops", () => {
    expect(rulesFor('html[data-theme="dark"] .faxTilePage img.tileImage')).toMatch(/brightness\(\.7\)/);
  });
  test("fax-A1: a capped page row sits left under the left-aligned title, not centred", () => {
    expect(rulesFor(".faxTilePages")).toMatch(/margin-inline:\s*0/);
    expect(rulesFor(".faxTilePages")).not.toMatch(/margin-inline:\s*auto/);
  });
  test("history-A3: the Read more pill inside the serif quote uses the UI face", () => {
    expect(rulesFor(".historyTileQuote .readMorePill")).toMatch(/font-family:\s*"Roboto Condensed"/);
  });
  test("faxVerse-A1: wide cards lay the edition crops out two-up", () => {
    expect(rulesFor(".faxVerseTile")).toMatch(/container-type:\s*inline-size/);
    expect(css).toMatch(/@container faxVerseCard \(min-width: 600px\)\s*{\s*\.faxVerseTile \.faxVerseEditions\s*{[^}]*grid-template-columns:\s*repeat\(2/);
  });
});

import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import JosephSmithTile from "../JosephSmithTile";

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(() => new Promise(() => {})), assetUrl: "https://media.test" }));

// josephSmith-H6: a hedged or second-hand record was shown as Joseph Smith's
// own words under his portrait; the record's author line names who it is.
describe("JosephSmithTile names a non-autograph author above the quote (R5 H6)", () => {
  const js = (o) => render(<MemoryRouter><JosephSmithTile data={{ slug: "x", year: 1842, document: "Times and Seasons editorial", money_quote: "Follow the directions of the Book of Mormon.", ...o }} /></MemoryRouter>).container;
  test("editorial staff hedge", () => {
    expect(js({ author: "Joseph Smith or editorial staff" }).querySelector(".witnessSpeaker")).toHaveTextContent("Joseph Smith or editorial staff:");
  });
  test("a recollection by another person", () => {
    expect(js({ author: "Lucy Mack Smith" }).querySelector(".witnessSpeaker")).toHaveTextContent("Lucy Mack Smith:");
  });
  test("his own statement: no meta line", () => {
    expect(js({ author: "Joseph Smith" }).querySelector(".witnessSpeaker")).toBeNull();
  });
});

// XC-F3: on phone the statement drawer's only close was a 44px × at the top.
import HistoryDrawer from "src/views/_Common/HistoryDrawer";
describe("history statement drawer has a thumb-reach close (R5 XC-F3)", () => {
  test("a Close button sits in a foot row after the scrolling body and closes", () => {
    const onClose = vi.fn();
    const { container } = render(<HistoryDrawer slug={null} onClose={onClose} />);
    const foot = container.querySelector(".historyDrawerBody + .historyDrawerFoot .historyDrawerFootClose");
    expect(foot).toHaveTextContent("Close");
    foot.click();
    expect(onClose).toHaveBeenCalled();
  });
});
