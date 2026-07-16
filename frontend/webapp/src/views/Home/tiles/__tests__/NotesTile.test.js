import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotesTile from "../NotesTile";

// ScriptureExcerpt fetches the passage via the API on mount; keep it pending so
// the excerpt stays empty and assertions target the note content only.
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));

// ScriptureExcerpt imports BoMOnlineAPI with a .js extension — mock it directly
// so the sub-component renders nothing rather than trying a real API call.
jest.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
  readPath: (ref) => (ref ? `/read/${ref}` : null),
}));

const notes = [
  { id: "n1", title: null, text: "Alma gave the same admonition to Helaman at Alma 36:3.", reference: "Alma 36:3", publication: { source_name: "BMC Notes" } },
  { id: "n2", title: null, text: "Fulfilled at Mosiah 19:13-15.", reference: "Mosiah 19:13", publication: { source_name: "Second Source" } },
];

const renderTile = (data) =>
  render(
    <MemoryRouter>
      <NotesTile data={data} />
    </MemoryRouter>
  );

describe("NotesTile", () => {
  test("renders each note's text and source", () => {
    renderTile(notes);
    expect(screen.getByText(/same admonition to Helaman/)).toBeTruthy();
    expect(screen.getByText(/Fulfilled at Mosiah/)).toBeTruthy();
    expect(screen.getByText("BMC Notes")).toBeTruthy();
    expect(screen.getByText("Second Source")).toBeTruthy();
  });

  test("returns null for empty data", () => {
    const { container } = renderTile([]);
    expect(container.firstChild).toBeNull();
  });
});
