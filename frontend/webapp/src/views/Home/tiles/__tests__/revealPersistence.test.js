import "@testing-library/jest-dom";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TileIdentity } from "../_ds/tileIdentity";
import ExpandableText from "../ExpandableText";
import BoundedTile from "../_ds/BoundedTile";
import PersonFeature from "../PersonFeature";
import NarrationTile from "../NarrationTile";
import { clearSession } from "../samplerSession";

// Systemic E2 (blind R1-R6): every reveal on Home survives a Back — keyed by
// the tile's identity, so no tile has to remember to pass a persistKey.

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return 500; } });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return 100; } });
});
afterAll(() => {
  delete HTMLElement.prototype.scrollHeight;
  delete HTMLElement.prototype.clientHeight;
});
beforeEach(() => clearSession());

const inTile = (id, node) => (
  <MemoryRouter>
    <TileIdentity value={id}>{node}</TileIdentity>
  </MemoryRouter>
);

test("ExpandableText with no persistKey restores its expansion on remount (tile identity)", () => {
  const ui = () => inTile("42|people", <ExpandableText lines={2} fade><span>a long bio that overflows</span></ExpandableText>);
  render(ui());
  fireEvent.click(screen.getByRole("button", { name: "Read more" }));
  cleanup(); // Back: the tile unmounts and remounts
  render(ui());
  expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
});

test("two reveals in one tile persist separately (keyed by their text)", () => {
  const ui = () =>
    inTile(
      "42|story",
      <>
        <ExpandableText lines={2}><span>first description</span></ExpandableText>
        <ExpandableText lines={2}><span>second description</span></ExpandableText>
      </>,
    );
  render(ui());
  fireEvent.click(screen.getAllByRole("button", { name: "Read more" })[1]);
  cleanup();
  render(ui());
  const btns = screen.getAllByRole("button");
  expect(btns[0]).toHaveAttribute("aria-expanded", "false");
  expect(btns[1]).toHaveAttribute("aria-expanded", "true");
});

test("a different seed (new sample) does not inherit the reveal", () => {
  render(inTile("42|people", <ExpandableText lines={2}><span>bio</span></ExpandableText>));
  fireEvent.click(screen.getByRole("button", { name: "Read more" }));
  cleanup();
  render(inTile("43|people", <ExpandableText lines={2}><span>bio</span></ExpandableText>));
  expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();
});

test("BoundedTile restores its lifted bound on remount", () => {
  const ui = () => inTile("42|contents", <BoundedTile className="tile" tileId="contents"><p>long</p></BoundedTile>);
  const { container } = render(ui());
  fireEvent.click(screen.getByRole("button", { name: "Read more" }));
  expect(container.querySelector(".boundedTile")).toHaveClass("revealed");
  cleanup();
  const again = render(ui());
  expect(again.container.querySelector(".boundedTile")).toHaveClass("revealed");
});

test("PersonFeature (People + PersonProfile) restores the expanded bio", () => {
  const person = { slug: "nephi1", name: "Nephi", title: "Prophet", description: "A very long biography ".repeat(30) };
  const ui = () => inTile("42|people", <PersonFeature person={person} />);
  render(ui());
  fireEvent.click(screen.getByRole("button", { name: "Read more" }));
  cleanup();
  render(ui());
  expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
});

test("NarrationTile's More beats toggle is restored", () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ narration: { description: `Beat number ${i + 1}`, slug: `b${i}` } }));
  const data = { title: "Lehi's Dream", slug: "lehis-dream", page: { title: "Lehi", slug: "lehi" }, rows };
  const ui = () => inTile("42|narration", <NarrationTile data={data} />);
  const first = render(ui());
  const toggle = first.container.querySelector("[aria-expanded]");
  expect(toggle).not.toBeNull();
  fireEvent.click(toggle);
  cleanup();
  const again = render(ui());
  expect(again.container.querySelector("[aria-expanded]")).toHaveAttribute("aria-expanded", "true");
});

// Static: any tile control that exposes aria-expanded must persist its state
// (ExpandableText / BoundedTile / usePersistedOpen / writeExpanded).
test("every aria-expanded toggle in the tiles persists through a Back", () => {
  const dir = path.resolve(__dirname, "..");
  const files = [
    ...fs.readdirSync(dir).filter((f) => /\.(js|jsx)$/.test(f)).map((f) => path.join(dir, f)),
    ...fs.readdirSync(path.join(dir, "_ds")).filter((f) => /\.(js|jsx)$/.test(f)).map((f) => path.join(dir, "_ds", f)),
  ];
  const bad = files.filter((f) => {
    const src = fs.readFileSync(f, "utf8");
    if (!/aria-expanded=/.test(src)) return false;
    return !/usePersistedOpen|writeExpanded/.test(src);
  });
  expect(bad.map((f) => path.basename(f))).toEqual([]);
});
