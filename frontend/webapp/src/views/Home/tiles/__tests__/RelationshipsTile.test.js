import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RelationshipsTile from "../RelationshipsTile";

jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  hubType: "people",
  hubSlug: "alma2",
  hubName: "Alma the Younger",
  hubTitle: "High Priest",
  edges: [
    { rel: "father of", dstType: "people", dstSlug: "helaman", dstName: "Helaman", dstTitle: null, note: null, ref: null },
    { rel: "traveled to", dstType: "place", dstSlug: "zarahemla", dstName: "Zarahemla", dstTitle: "Capital city", note: "Returned to preach (Alma 5:1)", ref: "Alma 5:1" },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <RelationshipsTile data={d} />
    </MemoryRouter>
  );

describe("RelationshipsTile", () => {
  test("renders the hub linked to its profile", () => {
    renderTile(data);
    const hub = screen.getByText("Alma the Younger");
    expect(hub.closest("a").getAttribute("href")).toBe("/people/alma2");
  });

  test("renders edges with rel labels and profile links per dstType", () => {
    renderTile(data);
    expect(screen.getByText("father of")).toBeTruthy();
    expect(screen.getByText("Helaman").closest("a").getAttribute("href")).toBe("/people/helaman");
    expect(screen.getByText("Zarahemla").closest("a").getAttribute("href")).toBe("/places/zarahemla");
  });

  test("ref chip opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("Alma 5:1"));
    expect(openScripture).toHaveBeenCalledWith("Alma 5:1");
  });

  test("returns null with fewer than 2 edges", () => {
    const { container } = renderTile({ ...data, edges: data.edges.slice(0, 1) });
    expect(container.firstChild).toBeNull();
  });
});
