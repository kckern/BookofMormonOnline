jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true, default: jest.fn(), assetUrl: "https://media.test", ApiBaseUrl: "",
}));

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BrowseToolbar } from "../Chiasmus";
import { DEFAULTS } from "../useBrowseState";

const props = {
  state: { ...DEFAULTS }, set: jest.fn(),
  depthCounts: { 2: 145, 3: 91, "+": 11 },
  categoryCounts: { compound: 35, biblical: 28 },
  shownCount: 12, totalCount: 367,
};

beforeEach(() => jest.clearAllMocks());

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

test("clicking an unselected depth chip adds it to depths", () => {
  render(<BrowseToolbar {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /depth 2 — 145 chiasms/i }));
  expect(props.set).toHaveBeenCalledTimes(1);
  expect(props.set).toHaveBeenCalledWith({ depths: ["2"] });
});

test("clicking a selected depth chip removes only it", () => {
  render(<BrowseToolbar {...props} state={{ ...DEFAULTS, depths: ["2", "3"] }} />);
  fireEvent.click(screen.getByRole("button", { name: /depth 2 — 145 chiasms/i }));
  expect(props.set).toHaveBeenCalledWith({ depths: ["3"] });
});

test("dir button toggles asc → desc and desc → asc", () => {
  const { rerender } = render(<BrowseToolbar {...props} />);
  const dir = () => screen.getByRole("button", { name: /reverse sort direction/i });
  fireEvent.click(dir());
  expect(props.set).toHaveBeenCalledWith({ dir: "desc" });
  rerender(<BrowseToolbar {...props} state={{ ...DEFAULTS, dir: "desc" }} />);
  fireEvent.click(dir());
  expect(props.set).toHaveBeenLastCalledWith({ dir: "asc" });
});

describe("search debounce", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("keystrokes coalesce into one set({ q }) with the final value", () => {
    render(<BrowseToolbar {...props} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "al" } });
    fireEvent.change(input, { target: { value: "alma" } });
    expect(props.set).not.toHaveBeenCalled();     // nothing before the window closes
    act(() => jest.advanceTimersByTime(250));
    expect(props.set).toHaveBeenCalledTimes(1);
    expect(props.set).toHaveBeenCalledWith({ q: "alma" });
  });

  test("external state.q change (Clear all / back-button) resets the input and drops the in-flight debounce", () => {
    const { rerender } = render(<BrowseToolbar {...props} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "pending" } });
    rerender(<BrowseToolbar {...props} state={{ ...DEFAULTS, q: "zoram" }} />);
    expect(input).toHaveValue("zoram");           // adopted the external value
    act(() => jest.advanceTimersByTime(250));
    expect(props.set).not.toHaveBeenCalled();     // stale "pending" debounce cancelled
  });
});
