/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterPanel from "./FilterPanel";
import { isMobile } from "src/models/Utils";

jest.mock("src/models/Utils", () => ({ label: (k) => k, tr: (k, fb) => fb, isMobile: jest.fn(() => false) }));
jest.mock("src/views/_Common/SearchPopUp", () => ({
  SearchPopUp: (props) =>
    props.isOpen ? (
      <div data-testid="searchpopup">
        {props.placeholder}:{props.initSearchString}
        <button onClick={() => props.selectItemHandler("slug-1")}>pick-result</button>
      </div>
    ) : null,
}));
jest.mock("bootstrap-switch-button-react", () => ({
  __esModule: true,
  default: ({ checked }) => <span data-testid="switch" data-checked={checked ? "1" : "0"} />,
}));
const mockSetPopUp = jest.fn();
const mockCtx = {
  states: { popUp: { type: null }, user: { social: { user_id: "u1" } } },
  functions: { setPopUp: mockSetPopUp },
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

// Default (mini) mode hides each axis's options behind a dropdown button; open
// the axis by clicking its toolbar button (the title), then assert on options.
const openAxis = (title) => fireEvent.click(screen.getByText(title));

describe("FilterPanel — mini toolbar (default)", () => {
  beforeEach(() => { try { window.localStorage.clear(); } catch (e) { /* noop */ } });

  test("renders axis buttons; options appear only once the axis is opened", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} />);
    expect(screen.getByText("Identification")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.queryByText("Nephite")).toBeNull(); // popover closed
    openAxis("Identification");
    expect(screen.getByText("Nephite")).toBeInTheDocument();
    expect(screen.getByText("Jaredite")).toBeInTheDocument();
  });

  test("an active axis shows a count badge of its selections", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: ["N", "J"], unit: [] }} onChange={() => {}} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("option checked-state reflects value[axis].includes(tag)", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={() => {}} />);
    openAxis("Identification");
    const switches = screen.getAllByTestId("switch");
    expect(switches[0]).toHaveAttribute("data-checked", "1"); // Nephite
    expect(switches[1]).toHaveAttribute("data-checked", "0"); // Jaredite
  });

  test("clicking an unchecked option adds its tag; a checked one removes it", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={onChange} />
    );
    openAxis("Identification");
    fireEvent.click(screen.getByText("Nephite"));
    expect(onChange).toHaveBeenLastCalledWith({ id: ["N"], unit: [] });
    rerender(<FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={onChange} />);
    fireEvent.click(screen.getByText("Nephite"));
    expect(onChange).toHaveBeenLastCalledWith({ id: [], unit: [] });
  });

  test("per-axis select-all / clear only touch that axis", () => {
    const onChange = jest.fn();
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: ["I"] }} onChange={onChange} />);
    openAxis("Identification");
    fireEvent.click(screen.getByText("select_all"));
    expect(onChange).toHaveBeenLastCalledWith({ id: ["N", "J"], unit: ["I"] });
    fireEvent.click(screen.getByText("clear"));
    expect(onChange).toHaveBeenLastCalledWith({ id: [], unit: ["I"] });
  });

  test("Clear all empties every axis at once", () => {
    const onChange = jest.fn();
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: ["I"] }} onChange={onChange} />);
    fireEvent.click(screen.getByText("Clear all"));
    expect(onChange).toHaveBeenLastCalledWith({ id: [], unit: [] });
  });

  test("resultCount renders in the toolbar tail", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} resultCount={42} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  test("Expand reveals the classic inline columns", () => {
    const { container } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} />
    );
    expect(container.querySelector(".ppColumns")).toBeNull(); // mini
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(container.querySelector(".ppColumns")).toBeInTheDocument(); // main
    // in main mode all options are inline (no popover needed)
    expect(screen.getByText("Nephite")).toBeInTheDocument();
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

  test("selecting a search result calls the view handler and closes the popup", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍" }));
    fireEvent.click(screen.getByText("pick-result"));
    expect(SEARCH.selectItemHandler).toHaveBeenCalledWith("slug-1");
    expect(screen.queryByTestId("searchpopup")).toBeNull(); // closed
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

  test("while the pFilter drawer is open, a value change re-pushes the panel snapshot", () => {
    isMobile.mockReturnValue(true);
    mockCtx.states.popUp.type = "pFilter";
    const { rerender } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />
    );
    mockSetPopUp.mockClear();
    rerender(
      <FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={() => {}} search={SEARCH} />
    );
    expect(mockSetPopUp).toHaveBeenCalledWith(
      expect.objectContaining({ popUpData: expect.objectContaining({ filterBox: expect.anything() }) })
    );
  });

  test("re-rendering with the same selection content does NOT re-push (no infinite loop)", () => {
    isMobile.mockReturnValue(true);
    mockCtx.states.popUp.type = "pFilter";
    const { rerender } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={() => {}} search={SEARCH} />
    );
    mockSetPopUp.mockClear();
    // Same CONTENT, new object identity (as the real view adapters produce every render):
    rerender(
      <FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={() => {}} search={SEARCH} />
    );
    expect(mockSetPopUp).not.toHaveBeenCalled();
  });
});
