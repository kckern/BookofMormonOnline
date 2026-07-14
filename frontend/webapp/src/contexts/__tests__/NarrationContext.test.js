import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NarrationProvider, useNarration } from "../NarrationContext";

const fixture = { states: { isOpen: true } };

function Probe() {
  const narrationController = useNarration();
  return <div>{narrationController.states.isOpen ? "open" : "closed"}</div>;
}

test("useNarration returns the provided controller", () => {
  render(
    <NarrationProvider narrationController={fixture}>
      <Probe />
    </NarrationProvider>
  );
  expect(screen.getByText("open")).toBeInTheDocument();
});

test("useNarration throws a helpful error without a provider", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/NarrationProvider/);
  console.error.mockRestore();
});
