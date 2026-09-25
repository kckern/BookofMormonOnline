jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true, default: jest.fn(), assetUrl: "https://media.test", ApiBaseUrl: "",
}));

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrowseToolbar } from "../Chiasmus";
import { DEFAULTS } from "../useBrowseState";

/**
 * Rewritten for the browse toolbar as c2b72ec2 redesigned it. The previous
 * suite was written against the older control set and had been failing since
 * that commit, which also dropped the BrowseToolbar export it imports.
 *
 * What changed, per that commit's own description ("filter by voice (searchable
 * 3-col popover), type (Simple/Compound/Biblical), and depth; result count +
 * clear"):
 *   - the Group select is gone — a flat list is the default now, so DEFAULTS
 *     keeps `group` only to keep old URLs valid
 *   - depth moved from multi-select chips to a single <select>, so `depths`
 *     stays an array but holds at most one value
 *   - the count reads "12 chiasms" rather than "12 of 367"; there is no
 *     totalCount prop any more
 *   - voice and type filters are new
 *
 * Two tests covering a debounced `q` search box are NOT carried over: that
 * input no longer exists. `q` survives in DEFAULTS for URL compatibility only
 * (see its comment there), and the only search input in the toolbar today is
 * the voice popover's local filter, which never touches browse state. The
 * popover's own search is covered below instead.
 */

const SPEAKERS = [
  { slug: "alma2", name: "Alma", count: 112 },
  { slug: "nephi1", name: "Nephi", count: 64 },
  { slug: "mormon2", name: "Mormon", count: 9 },
];

// depthCounts is keyed by bucket, "+" being the deepest; depthOrder sorts it last.
const baseProps = () => ({
  state: { ...DEFAULTS },
  set: jest.fn(),
  speakers: SPEAKERS,
  depthCounts: { 2: 145, 3: 91, "+": 11 },
  resultCount: 12,
});

const renderToolbar = (overrides = {}) => {
  const props = { ...baseProps(), ...overrides };
  render(<BrowseToolbar {...props} />);
  return props;
};

describe("depth filter", () => {
  test("defaults to all depths and lists each bucket with its count, deepest last", () => {
    renderToolbar();
    const select = screen.getByLabelText("Filter by depth");
    expect(select).toHaveValue("");
    expect(
      Array.from(select.options).map((o) => o.textContent)
    ).toEqual(["All depths", "Level 2 · 145", "Level 3 · 91", "Level + · 11"]);
  });

  test("choosing a depth sets it as the only depth", () => {
    const { set } = renderToolbar();
    fireEvent.change(screen.getByLabelText("Filter by depth"), { target: { value: "2" } });
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ depths: ["2"] });
  });

  test("choosing all depths clears the depth filter", () => {
    const { set } = renderToolbar({ state: { ...DEFAULTS, depths: ["3"] } });
    fireEvent.change(screen.getByLabelText("Filter by depth"), { target: { value: "" } });
    expect(set).toHaveBeenCalledWith({ depths: [] });
  });
});

describe("sort", () => {
  test("sort select offers the three orders and reports the active one", () => {
    renderToolbar({ state: { ...DEFAULTS, sort: "depth" } });
    const select = screen.getByLabelText("Sort");
    expect(select).toHaveValue("depth");
    expect(
      Array.from(select.options).map((o) => o.value)
    ).toEqual(["canonical", "depth", "length"]);
  });

  test("changing sort reports the new order", () => {
    const { set } = renderToolbar();
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "length" } });
    expect(set).toHaveBeenCalledWith({ sort: "length" });
  });

  // Carried over unchanged from the previous suite: this control survived the
  // redesign, and was failing only because the module export had gone.
  test("dir button toggles asc → desc and desc → asc", () => {
    const { set } = renderToolbar();
    const dir = () => screen.getByLabelText("Reverse sort direction");
    expect(dir()).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(dir());
    expect(set).toHaveBeenCalledWith({ dir: "desc" });

    set.mockClear();
    renderToolbar({ state: { ...DEFAULTS, dir: "desc" }, set });
    const pressed = screen.getAllByLabelText("Reverse sort direction")[1];
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pressed);
    expect(set).toHaveBeenLastCalledWith({ dir: "asc" });
  });
});

describe("result count and clear", () => {
  test("shows the result count", () => {
    renderToolbar();
    expect(screen.getByText("12 chiasms")).toBeVisible();
  });

  test("Clear appears only once a filter is active, and resets every facet", () => {
    const { set } = renderToolbar({ state: { ...DEFAULTS, type: "compound" } });
    const clear = screen.getByRole("button", { name: "Clear" });
    fireEvent.click(clear);
    expect(set).toHaveBeenCalledWith(DEFAULTS);
  });

  test("Clear is absent when nothing is filtered", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

describe("type filter", () => {
  test("All is selected when no type is set", () => {
    renderToolbar();
    expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
  });

  test("picking a type filters by it; picking the active one clears it", () => {
    const { set } = renderToolbar();
    fireEvent.click(screen.getByRole("radio", { name: "Compound" }));
    expect(set).toHaveBeenCalledWith({ type: "compound" });

    set.mockClear();
    renderToolbar({ state: { ...DEFAULTS, type: "compound" }, set });
    fireEvent.click(screen.getAllByRole("radio", { name: "Compound" })[1]);
    expect(set).toHaveBeenCalledWith({ type: null });
  });
});

describe("voice filter", () => {
  test("closed trigger reads Voice and hides the list", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "Voice" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("opening lists every speaker with a count, and picking one filters by slug", () => {
    const { set } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Voice" }));
    const list = within(screen.getByRole("listbox"));
    expect(list.getAllByRole("option")).toHaveLength(3);
    fireEvent.click(list.getByRole("option", { name: /Nephi/ }));
    expect(set).toHaveBeenCalledWith({ speaker: "nephi1" });
  });

  test("the popover search narrows the list without touching browse state", () => {
    const { set } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Voice" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mor" } });
    const shown = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(shown.map((o) => o.textContent)).toEqual(["Mormon9"]);
    expect(set).not.toHaveBeenCalled();
  });

  test("a search matching nothing says so", () => {
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Voice" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(within(screen.getByRole("listbox")).queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matches")).toBeVisible();
  });

  test("an active voice becomes the trigger and can be cleared", () => {
    const { set } = renderToolbar({ state: { ...DEFAULTS, speaker: "alma2" } });
    expect(screen.getByText("Alma")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear voice filter" }));
    expect(set).toHaveBeenCalledWith({ speaker: null });
  });
});
