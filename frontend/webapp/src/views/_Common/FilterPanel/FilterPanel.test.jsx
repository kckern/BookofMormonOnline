/* eslint-disable testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterPanel from "./FilterPanel";
import { isMobile } from "src/models/Utils";

jest.mock("src/models/Utils", () => ({ label: (k) => k, isMobile: jest.fn(() => false) }));
jest.mock("src/views/_Common/SearchPopUp", () => ({
  SearchPopUp: (props) =>
    props.isOpen ? <div data-testid="searchpopup">{props.placeholder}:{props.initSearchString}</div> : null,
}));
jest.mock("bootstrap-switch-button-react", () => ({
  __esModule: true,
  default: ({ checked }) => <span data-testid="switch" data-checked={checked ? "1" : "0"} />,
}));
const mockSetPopUp = jest.fn();
const mockCtx = {
  states: { popUp: { type: null }, user: { social: { user_id: "u1" } } },
  functions: { setPopUp: mockSetPopUp },
  preLoad: {},
};
jest.mock("src/contexts/AppControllerContext", () => ({ useAppController: () => mockCtx }));

const AXES = [
  { name: "id", title: "Identification", options: [{ tag: "N", label: "Nephite" }, { tag: "J", label: "Jaredite" }] },
  { name: "unit", title: "Unit", options: [{ tag: "I", label: "Individual" }] },
];
const SEARCH = {
  placeholder: "search_for_a_person", preLoadData: [],
  testFieldNames: { primary: "name", secondary: "title" }, assetName: "people",
  selectItemHandler: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  isMobile.mockReturnValue(false);
  mockCtx.states.popUp.type = null;
});

describe("FilterPanel — trail/axes", () => {
  test("renders each axis title and its options", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} />);
    expect(screen.getByText("Identification")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Nephite")).toBeInTheDocument();
    expect(screen.getByText("Individual")).toBeInTheDocument();
  });

  test("option checked-state reflects value[axis].includes(tag)", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={() => {}} />);
    const switches = screen.getAllByTestId("switch");
    expect(switches[0]).toHaveAttribute("data-checked", "1");
    expect(switches[1]).toHaveAttribute("data-checked", "0");
    expect(switches[2]).toHaveAttribute("data-checked", "0");
  });

  test("clicking an unchecked option adds its tag; a checked one removes it", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={onChange} />
    );
    fireEvent.click(screen.getByText("Nephite"));
    expect(onChange).toHaveBeenLastCalledWith({ id: ["N"], unit: [] });
    rerender(<FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={onChange} />);
    fireEvent.click(screen.getByText("Nephite"));
    expect(onChange).toHaveBeenLastCalledWith({ id: [], unit: [] });
  });

  test("select-all sets the axis to all tags; clear sets it to [] without touching other axes", () => {
    const onChange = jest.fn();
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: ["I"] }} onChange={onChange} />);
    fireEvent.click(screen.getAllByText("select_all")[0]);
    expect(onChange).toHaveBeenLastCalledWith({ id: ["N", "J"], unit: ["I"] });
    fireEvent.click(screen.getAllByText("clear")[0]);
    expect(onChange).toHaveBeenLastCalledWith({ id: [], unit: ["I"] });
  });
});

describe("FilterPanel — search", () => {
  test("with search: 🔍 opens the SearchPopUp; without search: no button", () => {
    const { rerender } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />
    );
    expect(screen.queryByTestId("searchpopup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "🔍" }));
    expect(screen.getByTestId("searchpopup")).toHaveTextContent("search_for_a_person");
    rerender(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "🔍" })).toBeNull();
  });

  test("type-to-search: a printable key opens the popup seeded with that key", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />);
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByTestId("searchpopup")).toHaveTextContent("search_for_a_person:a");
  });
});

describe("FilterPanel — mobile", () => {
  test("mobile renders the filter-drawer button, not the inline columns", () => {
    isMobile.mockReturnValue(true);
    const { container } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />
    );
    expect(container.querySelector(".filterDrawerButton")).toBeInTheDocument();
    expect(container.querySelector(".ppColumns")).toBeNull();
  });

  test("mobile Filters button opens the pFilter popup with a filterBox", () => {
    isMobile.mockReturnValue(true);
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />);
    fireEvent.click(screen.getByRole("button", { name: "filters" }));
    expect(mockSetPopUp).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pFilter", underSlug: "people", popUpData: expect.objectContaining({ filterBox: expect.anything() }) })
    );
  });
});
