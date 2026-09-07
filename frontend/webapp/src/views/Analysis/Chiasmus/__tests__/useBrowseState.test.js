import React from "react";
import { render, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import useBrowseState, { DEFAULTS } from "../useBrowseState";

// No @testing-library/react-hooks in this repo — probe component pattern:
// render a component that calls the hook and captures its output.
let captured;
function Probe() {
  const { state, set } = useBrowseState();
  const location = useLocation();
  captured = { state, set, location };
  return null;
}

const renderProbe = (initialEntry = "/analysis/chiasmus") => {
  captured = undefined;
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Probe />
    </MemoryRouter>
  );
};

describe("useBrowseState", () => {
  test("empty query string yields DEFAULTS", () => {
    renderProbe("/analysis/chiasmus");
    expect(captured.state).toEqual(DEFAULTS);
    expect(captured.state).toEqual({
      q: "",
      group: "book",
      sort: "canonical",
      dir: "asc",
      depths: [],
      type: null,
    });
  });

  test("reads full state from the query string", () => {
    renderProbe(
      "/analysis/chiasmus?group=depth&sort=depth&dir=desc&d=3,4&type=compound&q=alma"
    );
    expect(captured.state).toEqual({
      q: "alma",
      group: "depth",
      sort: "depth",
      dir: "desc",
      depths: ["3", "4"],
      type: "compound",
    });
  });

  test("set() round-trips through the URL", () => {
    renderProbe("/analysis/chiasmus");
    act(() => {
      captured.set({ group: "depth", q: "faith" });
    });
    expect(captured.state.group).toBe("depth");
    expect(captured.state.q).toBe("faith");
    // untouched fields keep defaults
    expect(captured.state.sort).toBe("canonical");
    expect(captured.state.dir).toBe("asc");
    expect(captured.location.search).toContain("group=depth");
    expect(captured.location.search).toContain("q=faith");
    expect(captured.location.pathname).toBe("/analysis/chiasmus");
  });

  test("setting everything back to defaults yields a clean URL", () => {
    renderProbe("/analysis/chiasmus?group=speaker&dir=desc&q=nephi&d=5");
    act(() => {
      captured.set({
        q: DEFAULTS.q,
        group: DEFAULTS.group,
        sort: DEFAULTS.sort,
        dir: DEFAULTS.dir,
        depths: DEFAULTS.depths,
        type: DEFAULTS.type,
      });
    });
    expect(captured.location.search).toBe("");
    expect(captured.state).toEqual(DEFAULTS);
  });

  test('depths round-trip, including the "+" bucket', () => {
    renderProbe("/analysis/chiasmus");
    act(() => {
      captured.set({ depths: ["5", "+"] });
    });
    // "+" in a raw query string decodes as a space; URLSearchParams.toString()
    // must have percent-encoded it (%2B) so it survives the round trip.
    expect(captured.location.search).toContain("d=5%2C%2B");
    expect(captured.state.depths).toEqual(["5", "+"]);
  });

  test("set() preserves fields not in the patch across successive calls", () => {
    renderProbe("/analysis/chiasmus?q=alma&type=simple");
    act(() => {
      captured.set({ sort: "length" });
    });
    expect(captured.state).toEqual({
      q: "alma",
      group: "book",
      sort: "length",
      dir: "asc",
      depths: [],
      type: "simple",
    });
    act(() => {
      captured.set({ q: "" });
    });
    expect(captured.state.q).toBe("");
    expect(captured.state.sort).toBe("length");
    expect(captured.state.type).toBe("simple");
    expect(captured.location.search).not.toContain("q=");
  });
});
