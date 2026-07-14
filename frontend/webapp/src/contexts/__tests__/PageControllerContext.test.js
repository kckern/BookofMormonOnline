import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  PageControllerProvider,
  usePageController,
} from "../PageControllerContext";

function Probe({ pageController }) {
  const resolved = usePageController(pageController);
  return <div>{resolved?.id ?? "none"}</div>;
}

test("provider round-trip: in-tree consumer reads the provided controller", () => {
  render(
    <PageControllerProvider pageController={{ id: "ctx" }}>
      <Probe />
    </PageControllerProvider>,
  );
  expect(screen.getByText("ctx")).toBeInTheDocument();
});

test("no provider returns null (does NOT throw)", () => {
  render(<Probe />);
  expect(screen.getByText("none")).toBeInTheDocument();
});

test("override precedence: the prop wins over the provider value", () => {
  render(
    <PageControllerProvider pageController={{ id: "ctx" }}>
      <Probe pageController={{ id: "prop" }} />
    </PageControllerProvider>,
  );
  expect(screen.getByText("prop")).toBeInTheDocument();
});
