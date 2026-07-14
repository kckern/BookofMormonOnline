import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TextContentProvider, useTextContent } from "../TextContentContext";

const fixture = { states: { isOpen: true } };

function Probe() {
  const textContentController = useTextContent();
  return <div>{textContentController.states.isOpen ? "open" : "closed"}</div>;
}

test("useTextContent returns the provided controller", () => {
  render(
    <TextContentProvider textContentController={fixture}>
      <Probe />
    </TextContentProvider>
  );
  expect(screen.getByText("open")).toBeInTheDocument();
});

test("useTextContent throws a helpful error without a provider", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/TextContentProvider/);
  console.error.mockRestore();
});
