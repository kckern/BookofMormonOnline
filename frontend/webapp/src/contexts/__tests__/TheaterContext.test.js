import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TheaterProvider, useTheater } from "../TheaterContext";

const fixture = { isPlaying: false, pause: jest.fn() };

function Probe() {
  const theaterController = useTheater();
  return <div>{theaterController.isPlaying ? "playing" : "paused"}</div>;
}

test("useTheater returns the provided controller", () => {
  render(
    <TheaterProvider theaterController={fixture}>
      <Probe />
    </TheaterProvider>
  );
  expect(screen.getByText("paused")).toBeInTheDocument();
});

test("useTheater throws a helpful error without a provider", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/TheaterProvider/);
  console.error.mockRestore();
});
