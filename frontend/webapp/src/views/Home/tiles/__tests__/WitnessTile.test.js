/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import "@testing-library/jest-dom";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WitnessTile, { inlineMarkdown } from "../WitnessTile";

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(), assetUrl: "https://media.test" }));

const data = [
  { slug: "1884-harris-herald", principal: "Martin Harris", witnessSlug: "martin-harris", moneyQuote: "I saw the plates and the engravings thereon.", source: "Interview" },
];

const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
const setup = (d) => render(<MemoryRouter><WitnessTile data={d} /></MemoryRouter>);

describe("WitnessTile", () => {
  test("outer element is a div; short quote: deeplink present immediately, no read-more pill", () => {
    const { container } = setup(data);
    expect(container.querySelector(".witnessTile").tagName).toBe("DIV");
    expect(screen.getByText("Martin Harris")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Read more" })).toBeNull();
    expect(deep()).toHaveTextContent("See in context");
  });

  test("the deeplink lands on the quoted statement, not just the witness page", () => {
    setup(data);
    expect(deep().getAttribute("href")).toBe("/history/witnesses/martin-harris/1884-harris-herald");
  });

  test("empty / unquotable payloads collapse", () => {
    expect(setup([]).container.firstChild).toBeNull();
    expect(setup(null).container.firstChild).toBeNull();
    expect(setup([{ principal: "X", moneyQuote: null }]).container.firstChild).toBeNull();
  });

  test("minimal row (no slug, no source, no portrait): no undefined, no broken image", () => {
    const { container } = setup([{ principal: "Hyrum Smith", moneyQuote: "A quote." }]);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".witnessMono")).toHaveTextContent("HS");
    expect(deep().getAttribute("href")).toBe("/history/witnesses");
  });

  test("source Markdown italics render as <em>, not literal underscores", () => {
    const { container } = setup([{ ...data[0], source: "_St. Joseph Weekly Herald_, 1884" }]);
    const src = container.querySelector(".witnessSource");
    expect(src.textContent).toBe("St. Joseph Weekly Herald, 1884");
    expect(src.querySelector("em")).toHaveTextContent("St. Joseph Weekly Herald");
  });

  test("a third-party speaker is a meta line OUTSIDE the clamped quote", () => {
    const { container } = setup([{ ...data[0], isWitnessVoice: false, speaker: "St. Joseph Weekly Herald" }]);
    const sp = container.querySelector(".witnessSpeaker");
    expect(sp).toHaveTextContent("St. Joseph Weekly Herald");
    expect(sp.closest(".witnessStatementWrap")).toBeNull();
  });

  test("portrait goes through TileImage and is decorative (the name is the link text)", () => {
    const { container } = setup(data);
    const img = container.querySelector(".witnessHero img");
    expect(img).toHaveClass("tileImage");
    expect(img.getAttribute("src")).toBe("https://media.test/history/witnesses/people/martin-harris.jpg");
    expect(img.getAttribute("alt")).toBe("");
    fireEvent.error(img);
    expect(container.querySelector(".witnessHero")).toHaveClass("mono");
  });
});

describe("WitnessTile long quotes (Layer-1 reveal)", () => {
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

  test("a clamped quote offers a reversible Read more / Show less", () => {
    setup(data);
    const btn = screen.getByRole("button", { name: "Read more" });
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Show less" })).toBe(btn);
    expect(deep()).not.toBeNull();
  });
});

describe("inlineMarkdown", () => {
  test("handles _x_ and *x*, leaves snake_case alone", () => {
    const { container } = render(<span>{inlineMarkdown("_A_ and *B* in some_file_name")}</span>);
    expect(container.querySelectorAll("em")).toHaveLength(2);
    expect(container.textContent).toBe("A and B in some_file_name");
  });
});

describe("witness styling (Sampler.css)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
  test("mini-quote highlight has no slab background inside the witness statement (light + dark)", () => {
    expect(css).toMatch(/\.witnessStatement \.miniHighlight\s*{[^}]*background:\s*none/);
  });
  test("speaker prefix is meta-tier, not statement-sized", () => {
    expect(css).toMatch(/\.witnessSpeaker\s*{[^}]*font-size:\s*0\.72rem/);
  });
});
