jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true, default: jest.fn(), assetUrl: "https://media.test", ApiBaseUrl: "",
}));

import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowseToolbar } from "../Chiasmus";
import { DEFAULTS } from "../useBrowseState";

const props = {
  state: { ...DEFAULTS }, set: jest.fn(),
  depthCounts: { 2: 145, 3: 91, "+": 11 },
  categoryCounts: { compound: 35, biblical: 28 },
  shownCount: 12, totalCount: 367,
};

test("selects carry visible Group/Sort labels", () => {
  render(<BrowseToolbar {...props} />);
  expect(screen.getByLabelText(/group/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^sort/i)).toBeInTheDocument();
  expect(screen.getByText("Group")).toBeVisible();
  expect(screen.getByText("Sort")).toBeVisible();
});

test("depth chips read value-first with a Levels caption, and bucket + renders as 8+", () => {
  render(<BrowseToolbar {...props} />);
  expect(screen.getByText(/levels/i)).toBeVisible();
  const chip = screen.getByRole("button", { name: /depth 2 — 145 chiasms/i });
  expect(chip.textContent).toMatch(/^2/);          // value before count
  expect(screen.getByRole("button", { name: /depth 8\+ — 11 chiasms/i })).toBeInTheDocument();
});

test("shows the result count", () => {
  render(<BrowseToolbar {...props} />);
  expect(screen.getByText(/12 of 367/i)).toBeVisible();
});
