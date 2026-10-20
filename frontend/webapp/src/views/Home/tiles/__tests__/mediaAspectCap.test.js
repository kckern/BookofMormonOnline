import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TileImage from "../_ds/TileImage";
import ImageArtTile from "../ImageArtTile";
import { MAX_PORTRAIT, capAspect } from "../_ds/mediaAspect";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
}));
vi.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
  readPath: () => "/read/alma-17/7",
}));

// Systemic A1/F1 (R6 art: a 186x600 strip became a 1526px desktop / 2837px
// tablet tile): no Home image may be taller than MAX_PORTRAIT (3:4) of its
// width; a taller source is cropped (object-fit: cover, upper focal point).

const ratioOf = (s) => {
  const m = String(s).split("/").map(Number);
  return m.length === 2 ? m[0] / m[1] : m[0];
};

test("capAspect clamps width/height to the portrait cap", () => {
  expect(capAspect(186 / 600)).toBeCloseTo(MAX_PORTRAIT);
  expect(capAspect(16 / 9)).toBeCloseTo(16 / 9);
});

test("TileImage with a tall reserved aspect is capped and cropped", () => {
  const { container } = render(<TileImage path="art/1" aspect="1 / 3" />);
  const img = container.querySelector("img");
  expect(ratioOf(img.style.aspectRatio)).toBeGreaterThanOrEqual(MAX_PORTRAIT - 1e-6);
  expect(img.style.objectFit).toBe("cover");
});

test("TileImage with no aspect caps itself once a tall natural image loads", () => {
  const { container } = render(<TileImage path="art/2" />);
  const img = container.querySelector("img");
  Object.defineProperty(img, "naturalWidth", { value: 186 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  expect(ratioOf(img.style.aspectRatio)).toBeGreaterThanOrEqual(MAX_PORTRAIT - 1e-6);
  expect(img.style.objectFit).toBe("cover");
});

test("a landscape image is untouched", () => {
  const { container } = render(<TileImage path="art/3" aspect="16 / 9" />);
  expect(ratioOf(container.querySelector("img").style.aspectRatio)).toBeCloseTo(16 / 9);
});

test("the art tile frame of a tall strip is capped", () => {
  const { container } = render(
    <MemoryRouter>
      <ImageArtTile payload={{ art: [{ id: 9, title: "Strip", width: 186, height: 600, ref: "Alma 1:1" }] }} />
    </MemoryRouter>,
  );
  const frame = container.querySelector(".imageArtFrame");
  expect(ratioOf(frame.style.aspectRatio)).toBeGreaterThanOrEqual(MAX_PORTRAIT - 1e-6);
});

// Static: inline aspect ratios in tile code go through capAspect (or TileImage,
// which caps), so a new tile cannot reintroduce an unbounded frame.
test("every inline aspectRatio in tile code is capped", () => {
  const dir = path.resolve(__dirname, "..");
  const bad = fs
    .readdirSync(dir)
    .filter((f) => /\.(js|jsx)$/.test(f))
    .filter((f) => {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      return /aspectRatio:/.test(src) && !/capAspect|CROP_MAX_H/.test(src);
    });
  expect(bad).toEqual([]);
});
