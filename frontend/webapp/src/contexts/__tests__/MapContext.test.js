import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MapProvider, useMapController } from "../MapContext";

const fixture = { mapName: "test", setTooltip: jest.fn() };

function Probe() {
  const mapController = useMapController();
  return <div>{mapController.mapName}</div>;
}

test("useMapController returns the provided controller", () => {
  render(
    <MapProvider mapController={fixture}>
      <Probe />
    </MapProvider>
  );
  expect(screen.getByText("test")).toBeInTheDocument();
});

test("useMapController throws a helpful error without a provider", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/MapProvider/);
  console.error.mockRestore();
});
