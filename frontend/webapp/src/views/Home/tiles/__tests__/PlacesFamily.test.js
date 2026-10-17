import React from "react";
import fs from "node:fs";
import path from "node:path";
import "@testing-library/jest-dom";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PlacesTile, { featuredPlaceSlugs, withoutSeenPlaces } from "../PlacesTile";
import PlaceProfileTile from "../PlaceProfileTile";
import { reservePool, batchTiles } from "../registry";

// Places family (plan Task 10c): PlacesTile + PlaceProfileTile, and the
// removed MapTile. Covers the empty/minimal payload, the CTA vocabulary and
// the R2.5 regressions (one link per destination, no double truncation,
// profiled place never duplicated in the mosaic, keyboard-reachable refs,
// disambiguators never read as scripture).

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const mkPlace = (i, extra = {}) => ({
  slug: `place-${i}`,
  name: `Place ${String.fromCharCode(65 + i)}`,
  info: `Info line ${i}`,
  description: `A description of place ${i}.`,
  index: [{ ref: "Alma 50:13", slug: "alma/50/13", text: "The Nephites laid its foundation." }],
  ...extra,
});
const PAYLOAD_17 = Array.from({ length: 17 }, (_, i) => mkPlace(i));

describe("PlacesTile", () => {
  test("collapses on empty or missing data (no shell)", () => {
    expect(renderIn(<PlacesTile data={[]} payload={{}} />).container.firstChild).toBeNull();
    expect(renderIn(<PlacesTile data={undefined} payload={{}} />).container.firstChild).toBeNull();
  });

  test("minimal place (no info, no index) renders without undefined/NaN", () => {
    const { container } = renderIn(<PlacesTile data={[{ slug: "zeezrom", name: "Zeezrom" }]} payload={{}} />);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector(".placesInfoOverlay")).toBeNull();
    expect(container.querySelector(".placesTileInfo")).toBeNull();
  });

  test("each card has exactly one link to its place page; the pin is the only other link", () => {
    const { container } = renderIn(<PlacesTile data={PAYLOAD_17} payload={{ placesCount: 188 }} />);
    const cards = container.querySelectorAll(".placesTileCard:not(.viewAllCard)");
    expect(cards).toHaveLength(5);
    cards.forEach((card, i) => {
      const toPlace = card.querySelectorAll(`a[href="/places/place-${i}"]`);
      expect(toPlace).toHaveLength(1);
      const pin = card.querySelector("a.placesMapBtn");
      expect(pin.getAttribute("href")).toBe(`/map/internal/place/place-${i}`);
      expect(pin.getAttribute("aria-label")).toBeTruthy();
      // the scripture ref is a sibling button, never inside a link
      expect(card.querySelector("a button, a .scripture_link")).toBeNull();
      expect(card.querySelector("button.scripture_link")).not.toBeNull();
    });
  });

  test("images go through TileImage (srcset seam), card art carries the place name as alt", () => {
    const { container } = renderIn(<PlacesTile data={PAYLOAD_17} payload={{ placesCount: 188 }} />);
    const imgs = [...container.querySelectorAll("img:not([src^='data:'])")].filter((i) => !i.closest(".placesMapBtn"));
    expect(imgs.length).toBeGreaterThan(5);
    imgs.forEach((img) => expect(img).toHaveClass("tileImage"));
    const cardImg = container.querySelector(".placesTileCard:not(.viewAllCard) img.tileImage");
    expect(cardImg.getAttribute("alt")).toBe("Place A");
  });

  test("info band carries the full info text (one truncation: CSS clamp, no word-budget ellipsis)", () => {
    const long = "Jaredite population hub near the narrow neck of land by the sea";
    const { container } = renderIn(<PlacesTile data={[mkPlace(0, { info: long })]} payload={{}} />);
    expect(container.querySelector(".placesInfoOverlay").textContent).toBe(long);
  });

  test("names keep disambiguators as superscripts, not stray digits", () => {
    renderIn(<PlacesTile data={[mkPlace(0, { name: "Land of Bountiful1" })]} payload={{}} />);
    expect(screen.getByText("Land of Bountiful¹")).toBeInTheDocument();
  });

  test("view-all card: 'View all' + '+N more' like its Matters twin, 'View all' alone without a count (audit places-C3)", () => {
    const a = renderIn(<PlacesTile data={PAYLOAD_17} payload={{ placesCount: 188 }} />);
    const card = a.container.querySelector(".viewAllCard");
    expect(card.querySelector(".viewAllVerb").textContent).toBe("View all");
    expect(card.querySelector(".viewAllCount").textContent).toBe("+171 more");
    a.unmount();
    const b = renderIn(<PlacesTile data={PAYLOAD_17} payload={{}} />);
    expect(b.container.querySelector(".viewAllCard").textContent).toMatch(/^View all$/);
  });

  test("mosaic never shows the place the PlaceProfile tile profiles (same payload)", () => {
    const payload = { places: PAYLOAD_17, placesCount: 188 };
    const p = renderIn(<PlaceProfileTile payload={payload} />);
    const profiled = p.container.querySelector(".placeProfileImgLink").getAttribute("href").split("/").pop();
    p.unmount();
    const t = renderIn(<PlacesTile data={PAYLOAD_17} payload={payload} />);
    const mosaicSrcs = [...t.container.querySelectorAll(".placesMosaic img")].map((i) => i.getAttribute("src"));
    expect(mosaicSrcs.length % 3).toBe(0); // full rows only
    expect(mosaicSrcs.length).toBeGreaterThanOrEqual(9);
    expect(mosaicSrcs.some((s) => s.endsWith(`/places/${profiled}`))).toBe(false);
    // nor any of the five carded places
    const carded = [...t.container.querySelectorAll(".placesTileCard:not(.viewAllCard) a.placesCardLink")].map((a) => a.getAttribute("href").split("/").pop());
    expect(carded).not.toContain(profiled);
  });

  test("a slugless payload entry does not drift the two tiles' profiled index", () => {
    const places = [...PAYLOAD_17, { name: "No slug", info: "x" }];
    const payload = { places, placesCount: 188 };
    const p = renderIn(<PlaceProfileTile payload={payload} />);
    const profiled = p.container.querySelector(".placeProfileImgLink").getAttribute("href").split("/").pop();
    p.unmount();
    expect(profiled).toBe("place-16");
    const t = renderIn(<PlacesTile data={places} payload={payload} />);
    const shown = [
      ...[...t.container.querySelectorAll(".placesMosaic img")].map((i) => i.getAttribute("src").split("/").pop()),
      ...[...t.container.querySelectorAll("a.placesCardLink")].map((a) => a.getAttribute("href").split("/").pop()),
    ];
    expect(shown).not.toContain(profiled);
  });
});

describe("PlaceProfileTile", () => {
  test("collapses on an empty payload", () => {
    expect(renderIn(<PlaceProfileTile payload={{}} />).container.firstChild).toBeNull();
    expect(renderIn(<PlaceProfileTile payload={{ places: [{ name: "No slug" }] }} />).container.firstChild).toBeNull();
  });

  test("minimal place (no description) shows the 'Open <name>' deeplink at once", () => {
    const { container } = renderIn(<PlaceProfileTile payload={{ places: [{ slug: "gid", name: "City of Gid" }] }} placeIndex={0} />);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    const cta = screen.getByRole("link", { name: "Open City of Gid" });
    expect(cta.getAttribute("href")).toBe("/places/gid");
    expect(cta).toHaveClass("tileCTA");
  });

  test("detected scripture in the description is a keyboard-reachable button, paren kept attached", () => {
    const payload = { places: [{ slug: "onidah", name: "Hill Onidah", description: "Zoramites gathered (Alma 31:1-3) here." }] };
    const { container } = renderIn(<PlaceProfileTile payload={payload} placeIndex={0} />);
    const btn = within(container.querySelector(".placeProfileDesc")).getByRole("button", { name: /Alma 31:1.3/ });
    expect(btn).toHaveClass("scripture_link");
    expect(btn.closest("a")).toBeNull();
    expect(btn.closest(".refParen")?.textContent).toMatch(/^\(Alma 31:1.3\)$/);
  });

  test("a <sup> disambiguator in the prose is never detected as a chapter ('Alma 2')", () => {
    const payload = { places: [{ slug: "onidah", name: "Hill Onidah", description: "{Alma<sup>2</sup>|alma2} was teaching." }] };
    const { container } = renderIn(<PlaceProfileTile payload={payload} placeIndex={0} />);
    expect(container.querySelector(".placeProfileDesc").textContent).toMatch(/Alma² was teaching/);
    expect(container.querySelector(".placeProfileDesc .scripture_link")).toBeNull();
  });

  test("hero uses TileImage and the name overlay superscripts disambiguators", () => {
    const { container } = renderIn(<PlaceProfileTile payload={{ places: [{ slug: "jerusalem-1", name: "Jerusalem1" }] }} placeIndex={0} />);
    expect(container.querySelector(".placeProfileImgLink img")).toHaveClass("tileImage");
    expect(screen.getByText("Jerusalem¹")).toBeInTheDocument();
  });
});

describe("MapTile decision: removed (unreachable dud)", () => {
  test("no map reserve or batch tile, and the module is gone", () => {
    expect(reservePool.find((t) => t.key === "map")).toBeUndefined();
    expect(batchTiles.find((t) => t.key === "map")).toBeUndefined();
    const dir = path.resolve(__dirname, "..");
    expect(fs.existsSync(path.join(dir, "MapTile.js"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "MapTileInner.js"))).toBe(false);
  });
});

describe("PlacesTile blind-audit fixes", () => {
  test("C1: the place link is stretched over the whole card, not just the image", () => {
    const { container } = renderIn(<PlacesTile data={PAYLOAD_17} payload={{}} />);
    const card = container.querySelector(".placesTileCard:not(.viewAllCard)");
    const link = card.querySelector("a.placesCardLink");
    expect(link.parentElement).toBe(card); // card-level, not inside the image wrap
    expect(link).toHaveAttribute("aria-label", "Place A");
    expect(card.querySelector("a.placesCardLink img")).toBeNull();
  });

  test("H3: both bands fit by whole words (FitWords), no CSS line-clamp text", () => {
    const { container } = renderIn(<PlacesTile data={PAYLOAD_17} payload={{}} />);
    const card = container.querySelector(".placesTileCard:not(.viewAllCard)");
    expect(card.querySelector(".placesInfoText")).toHaveClass("fitWords");
    expect(card.querySelector(".placesTileIndexRow")).toHaveClass("fitWords");
    expect(card.querySelector(".placesTileIndexRow").textContent).toContain("The Nephites laid its foundation.");
  });

  test("H1: a one-word gloss loses to a real phrase; 'City of and Land of' reads cleanly", () => {
    const p = mkPlace(0, {
      name: "City of and Land of Shilom",
      index: [
        { ref: "Alma 50:13", text: "Retained" },
        { ref: "Mosiah 9:6", text: "Shilom is possessed by Zeniff" },
      ],
    });
    const { container } = renderIn(<PlacesTile data={[p]} payload={{}} seed={0} />);
    expect(container.textContent).toContain("City and Land of Shilom");
    expect(container.textContent).toContain("Shilom is possessed by Zeniff");
    expect(container.textContent).not.toContain("Retained");
  });
});

describe("PlaceProfileTile blind-audit fixes", () => {
  beforeEach(() => sessionStorage.clear());
  test("H2: eyebrow says it is a profile, like the person profile", () => {
    const { container } = renderIn(<PlaceProfileTile payload={{ places: PAYLOAD_17 }} />);
    expect(container.querySelector(".tileHeading").textContent).toMatch(/Profile/);
  });
  test("E1: an expanded profile stays expanded across a remount (Back)", () => {
    const long = { ...mkPlace(16), description: "Long ".repeat(200) };
    const places = [...PAYLOAD_17.slice(0, 16), long];
    const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
    try {
      const a = renderIn(<PlaceProfileTile payload={{ places }} />);
      fireEvent.click(screen.getByRole("button", { name: "Read more" }));
      a.unmount();
      renderIn(<PlaceProfileTile payload={{ places }} />);
      expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Open/ })).toBeInTheDocument();
    } finally {
      if (sh) Object.defineProperty(HTMLElement.prototype, "scrollHeight", sh); else delete HTMLElement.prototype.scrollHeight;
      if (ch) Object.defineProperty(HTMLElement.prototype, "clientHeight", ch); else delete HTMLElement.prototype.clientHeight;
    }
  });
});

describe("H4: no featured place repeats across infinite batches", () => {
  const mk = (ids) => ids.map((i) => mkPlace(i));
  test("featured = the 5 cards + the profiled place", () => {
    const places = mk([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect([...featuredPlaceSlugs({ places })]).toEqual(["place-0", "place-1", "place-2", "place-3", "place-4", "place-16"]);
  });
  test("already-featured places leave the cards and the profile slot of a later batch", () => {
    const seen = new Set(["place-2", "place-16", "place-20"]);
    const places = mk([2, 3, 20, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    const out = withoutSeenPlaces({ places, seed: 9 }, seen);
    expect(out.seed).toBe(9);
    expect(out.places).toHaveLength(17); // the mosaic keeps its pool
    const featured = [...featuredPlaceSlugs(out)];
    featured.forEach((s) => expect(seen.has(s)).toBe(false));
  });
  test("untouched when nothing was seen", () => {
    const payload = { places: mk([1, 2, 3]) };
    expect(withoutSeenPlaces(payload, new Set())).toBe(payload);
  });
});
