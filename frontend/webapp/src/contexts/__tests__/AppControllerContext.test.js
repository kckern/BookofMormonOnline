import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  AppControllerProvider,
  useAppController,
} from "../AppControllerContext";

const fixture = {
  states: { user: { user: "testuser" } },
  functions: {},
};

function Probe() {
  const appController = useAppController();
  return <div>{appController.states.user.user}</div>;
}

test("useAppController returns the provided controller", () => {
  render(
    <AppControllerProvider appController={fixture}>
      <Probe />
    </AppControllerProvider>
  );
  expect(screen.getByText("testuser")).toBeInTheDocument();
});

test("useAppController throws a helpful error without a provider", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/AppControllerProvider/);
  console.error.mockRestore();
});
