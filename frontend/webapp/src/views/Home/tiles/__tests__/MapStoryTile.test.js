import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MapStoryTile from "../MapStoryTile";

// The inner map is OpenLayers — mock it out (jsdom has no canvas); the lazy
// import resolves to this stub.
jest.mock("../MapStoryTileInner", () => ({
  __esModule: true,
  default: () => <div data-testid="map-canvas" />,
}));
jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  slug: "lehis-journey",
  title: "Lehi's Journey",
  description: "From Jerusalem to the promised land",
  moves: [
    { seq: 1, start: "Jerusalem", end: "Valley of Lemuel", travelers: "Lehi's family", description: "Fled into the wilderness", duration: "3 days", ref: "1 Nephi 2:4", startLat: "18.1", startLng: "-97.2", endLat: "18.3", endLng: "-97.0" },
    { seq: 2, start: "Valley of Lemuel", end: "Bountiful", travelers: "Lehi's family", description: "Eight years in the wilderness", duration: "8 years", ref: "1 Nephi 17:4", startLat: "18.3", startLng: "-97.0", endLat: "18.6", endLng: "-96.7" },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <MapStoryTile data={d} />
    </MemoryRouter>
  );

describe("MapStoryTile", () => {
  test("renders the story title and ordered move list", () => {
    renderTile(data);
    expect(screen.getByText("Lehi's Journey")).toBeTruthy();
    expect(screen.getByText(/Jerusalem → Valley of Lemuel/)).toBeTruthy();
    expect(screen.getByText(/Valley of Lemuel → Bountiful/)).toBeTruthy();
  });

  test("move ref opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("1 Nephi 2:4"));
    expect(openScripture).toHaveBeenCalledWith("1 Nephi 2:4");
  });

  test("renders the lazy map canvas", async () => {
    renderTile(data);
    expect(await screen.findByTestId("map-canvas")).toBeTruthy();
  });

  test("returns null with fewer than 2 moves", () => {
    const { container } = renderTile({ ...data, moves: data.moves.slice(0, 1) });
    expect(container.firstChild).toBeNull();
  });
});
