import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WitnessLifeHeatmap from "../WitnessLifeHeatmap";

/**
 * Render harness for the heatmap. Decisions later tasks (5-9) inherit:
 *
 * 1. The real component is rendered, not a stub — this file exists to test the
 *    grid itself. It draws 12 rows x one column per year. Task 8 bounds the grid
 *    at the witness's death year rather than the latest composition year, so
 *    WHITMER's default axis (1829-1888) is ~720 cells, not the ~1300 it was
 *    before that task (1829-1940). Still fine in jsdom, and
 *    `container.querySelectorAll` remains the right tool for cell-level
 *    assertions over role-based queries.
 *
 * 2. jsdom has no ResizeObserver, so the width effect bails and `wrapperWidth`
 *    stays 0. Consequence: `shouldCompress` is always false here and every year
 *    gets its own column. Any test about compressed columns has to stub
 *    ResizeObserver first.
 *
 * 3. Fixtures set `archive: 'witnesses'` explicitly. compositionDate dispatches
 *    on that field (see witnessSources' DATE_STRATEGY); an absent archive falls
 *    back to the same 'event' strategy today, so these rows would behave
 *    identically without it, but pinning it documents which archive's rules are
 *    under test and survives a change to the fallback.
 */

const WHITMER = {
    slug: "david-whitmer", name: "David Whitmer",
    birthday: "1805-01-07", deathday: "1888-01-25", excommunication: "1838-04-13",
};

/**
 * Four rows in the shapes the archive actually produces. `date` is populated
 * with the real corrupt values so the tests below prove it is never read — a
 * fixture that simply omitted `date` would pass even if the component still
 * consumed it.
 */
const sources = [
    // month-precise: event_date describes the composition year
    { slug: "a", archive: "witnesses", year: 1885, date: "1885-06-28", event_year: 1885, event_date: "1885-06-28" },
    // year-only: no event_date to take a month from
    { slug: "b", archive: "witnesses", year: 1886, date: "1886", event_year: 1886, event_date: null },
    // year-only composition that recounts an earlier, month-precise occasion (the Moyle shape)
    { slug: "c", archive: "witnesses", year: 1940, date: "1885-06-28", event_year: 1885, event_date: "1885-06-28" },
    // month-precise, but `date` holds a modern reprint year (the Case B shape)
    { slug: "d", archive: "witnesses", year: 1918, date: "2003", event_year: 1918, event_date: "1918-04-25" },
];

const setup = (props = {}) => render(
    <WitnessLifeHeatmap witness={WHITMER} sources={sources}
        selectedYearMonth={null} onSelectYearMonth={jest.fn()} {...props} />
);

describe("heatmap meta strip", () => {
    it("accounts for every source, and the numbers add up", () => {
        setup();
        // WHITMER died Jan 1888. Of the 4 fixture rows, only `a` (1885-06, month-precise)
        // and `b` (1886, year-only) predate the death; `c` (1940) and `d` (1918-04) are
        // now posthumous (Task 8) and no longer count as monthPrecise/yearOnly here —
        // see the "posthumous split" describe block below for their new home.
        expect(screen.getByText(/1 of 4 sources placed/)).toBeInTheDocument();
        expect(screen.getByText(/1 year-only/)).toBeInTheDocument();
        // "after death", not "after his death" -- several witnesses in the real data are
        // women (Mary Whitmer, Lucy Mack Smith, Katherine Smith, Emma Smith).
        expect(screen.getByText(/2 after death/)).toBeInTheDocument();
    });

    it("reports recalled events as an overlapping annotation, not a placement", () => {
        setup();
        // Row `c` is composed 1940 about an 1885 occasion, so exactly one source
        // recalls an earlier event. The count is asserted exactly: a strip that
        // said 0, 2 or 4 would fail here. "also" is load-bearing wording — the
        // recall count overlaps the placement counts and must not read as a
        // fourth addend. See accountSources' docblock in witnessSources.js.
        expect(screen.getByText("1 also recall an earlier event")).toBeInTheDocument();
    });

    it("never reports undated sources when every row has a year", () => {
        setup();
        expect(screen.queryByText(/undated/)).not.toBeInTheDocument();
    });

    it("reports a source with no usable year as undated", () => {
        setup({ sources: [...sources, { slug: "e", archive: "witnesses", year: 0, date: "1850-01" }] });
        expect(screen.getByText(/1 undated/)).toBeInTheDocument();
        // 1 monthPrecise (`a`) + 4 = 5 total; `c`/`d` are posthumous, not placed. See above.
        expect(screen.getByText(/1 of 5 sources placed/)).toBeInTheDocument();
    });
});

describe("heatmap axis", () => {
    it("ends at the death year, not the latest composition year", () => {
        setup();
        // Pre-Task-8 this asserted 1829–1940 (the latest composition year, from row `c`).
        // Task 8 bounds the grid at the witness's death (1888) instead: sources composed
        // after death (`c` 1940, `d` 1918) are excluded from the grid and move into the
        // posthumous strip (see "posthumous split" below), so the axis no longer runs
        // out to whatever the latest publication/recollection happens to be.
        expect(screen.getByText(/1829–1888/)).toBeInTheDocument();
    });

    it("extends to the death year when every source predates it", () => {
        setup({ sources: [sources[0]] });
        expect(screen.getByText(/1829–1888/)).toBeInTheDocument();
    });
});

describe("heatmap cells", () => {
    it("places a source in its composition month", () => {
        const { container } = setup();
        // Only `a` (1885-06) is both month-precise and pre-death; `d` (1918-04) is
        // month-precise but posthumous (Task 8) and no longer draws a grid cell at all.
        const filled = [...container.querySelectorAll(".cell:not(.bucket-0)")];
        expect(filled).toHaveLength(1);
    });

    it("places a source using event_date's month, not the corrupt `date` reprint year", () => {
        // Same "Case B" shape as fixture row `d` (date holds a modern reprint, event_date
        // holds the true composition date) but composed in 1880 -- before WHITMER's 1888
        // death -- so it still lands in the grid. Row `d` itself can no longer serve this
        // test: at 1918 it is posthumous under Task 8's death bound and never reaches the
        // grid, regardless of how well event_date resolves.
        const reprintCaseB = {
            slug: "f", archive: "witnesses", year: 1880, date: "2003",
            event_year: 1880, event_date: "1880-07-15",
        };
        const onSelect = jest.fn();
        const { container } = setup({ sources: [reprintCaseB], onSelectYearMonth: onSelect });
        const filled = container.querySelectorAll(".cell:not(.bucket-0)");
        expect(filled).toHaveLength(1);
        filled[0].click();
        expect(onSelect).toHaveBeenCalledWith("1880-07");
    });

    it("draws no cell for a year-only source", () => {
        const { container } = setup({ sources: [sources[1]] });
        expect(container.querySelectorAll(".cell:not(.bucket-0)")).toHaveLength(0);
    });
});

describe("legend", () => {
  it("shows every bucket in the ramp, not a mislabeled subset", () => {
    const { container } = setup();
    expect(screen.queryByText("1–3 sources")).not.toBeInTheDocument();
    expect(screen.getByText("fewer")).toBeInTheDocument();
    expect(screen.getByText("more")).toBeInTheDocument();
    // buckets 1..4 each get a swatch
    [1, 2, 3, 4].forEach(b => {
      expect(container.querySelector(`.witness-life-heatmap-legend .swatch.bucket-${b}`)).toBeTruthy();
    });
  });
});

describe("cell affordances", () => {
  it("marks only cells with sources as clickable", () => {
    const { container } = setup();
    const clickable = container.querySelectorAll(".cell.is-clickable");
    // "cells with sources" means count > 0, i.e. a real (non-zero) color bucket.
    // NOT `.cell:not(.bucket-0)`: compressed-run cells (`era-compressed`, rendered
    // when shouldCompress is true) carry no bucket-N class at all, so they lack
    // `.bucket-0` exactly as much as a genuine bucket-1 cell does — `:not(.bucket-0)`
    // would count them as "with sources" too. Enumerating the actual non-empty
    // buckets sidesteps that; compressed cells never match any of bucket-1..4.
    // (Also not `.has-sources`: that class covers isMarker cells with zero sources
    // too — e.g. the death/excommunication/event months in this fixture, none of
    // which land on a sourced month — so it overcounts "clickable" by exactly those
    // marker cells.)
    const withSources = container.querySelectorAll(
      ".cell.bucket-1, .cell.bucket-2, .cell.bucket-3, .cell.bucket-4"
    );
    expect(clickable.length).toBe(withSources.length);
    expect(clickable.length).toBeGreaterThan(0);
  });
  it("does not mark the empty death-marker cell as clickable", () => {
    const { container } = setup({ sources: [] });
    expect(container.querySelector(".cell.era-death.is-clickable")).toBeNull();
  });
});

describe("heatmap accessibility", () => {
  it("exposes the grid with a role and label", () => {
    setup();
    expect(screen.getByRole("grid", { name: /David Whitmer/i })).toBeInTheDocument();
  });
  it("gives clickable cells an accessible name", () => {
    setup();
    expect(screen.getByRole("gridcell", { name: /June 1885, 1 source/i })).toBeInTheDocument();
  });
  it("filters on Enter", () => {
    const onSelect = jest.fn();
    setup({ onSelectYearMonth: onSelect });
    const cell = screen.getByRole("gridcell", { name: /June 1885, 1 source/i });
    cell.focus();
    // skipClick: true — userEvent.type() otherwise auto-clicks the target before
    // processing keys (see @testing-library/user-event/dist/type.js, top of
    // `type()`), which alone would call activate() and satisfy toHaveBeenCalledWith
    // without onKeyDown doing anything. The call-count assertion is what actually
    // proves Enter (not the harness's implicit click) triggered the handler.
    userEvent.type(cell, "{enter}", { skipClick: true });
    expect(onSelect).toHaveBeenCalledWith("1885-06");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
  it("filters on Space", () => {
    const onSelect = jest.fn();
    setup({ onSelectYearMonth: onSelect });
    const cell = screen.getByRole("gridcell", { name: /June 1885, 1 source/i });
    cell.focus();
    userEvent.type(cell, "{space}", { skipClick: true });
    expect(onSelect).toHaveBeenCalledWith("1885-06");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
  it("announces the hover/focus detail panel politely, including dynamic content", () => {
    const { container } = setup();
    const hover = () => container.querySelector(".witness-life-heatmap-hover");
    // Static placeholder branch (no interaction) — can't drift, but checked for completeness.
    expect(hover().getAttribute("aria-live")).toBe("polite");

    // The sourced-cell branch, which actually carries per-cell dynamic content.
    const cell = screen.getByRole("gridcell", { name: /June 1885, 1 source/i });
    fireEvent.mouseEnter(cell);
    expect(hover().getAttribute("aria-live")).toBe("polite");
    expect(hover().textContent).toMatch(/June 1885/);
  });
  it("announces the compressed-run branch politely too, when compression is active", () => {
    // The default fixture never compresses: jsdom has no ResizeObserver, so the
    // width effect bails and wrapperWidth stays 0, forcing shouldCompress false
    // (see this file's header comment, point 2). To reach the compressed-run
    // branch of WitnessLifeHeatmapHover at all, ResizeObserver and
    // getBoundingClientRect are stubbed here so the component actually compresses.
    const originalRO = global.ResizeObserver;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    // Width dropped from 600 (pre-Task-8) to 300: Task 8 bounds the default axis at
    // WHITMER's death (1829-1888, 60 columns) instead of the latest composition year
    // (1829-1940, 112 columns). At 600px the 60-column grid computes a per-cell width
    // above COMFORT_CELL_PX and never actually compresses, so the sanity check below
    // (compression is active) would fail; 300px keeps per-cell width under the comfort
    // threshold with the shorter axis too.
    const rectSpy = jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 300, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {},
    });
    try {
      const { container } = setup();
      const compressedCell = container.querySelector(".cell.era-compressed");
      expect(compressedCell).toBeTruthy(); // sanity: compression is actually active
      fireEvent.mouseEnter(compressedCell);
      const hover = container.querySelector(".witness-life-heatmap-hover");
      expect(hover.getAttribute("aria-live")).toBe("polite");
      expect(hover.textContent).toMatch(/empty years compressed/);
    } finally {
      rectSpy.mockRestore();
      global.ResizeObserver = originalRO;
    }
  });
  it("keeps empty cells out of the tab order, and clickable cells in it", () => {
    const { container } = setup();
    container.querySelectorAll(".cell:not(.is-clickable)").forEach(cell => {
      expect(cell.getAttribute("tabindex")).toBeNull();
    });
    // The positive case: without this, tabIndex={count ? 0 : undefined} could be
    // broken to always omit tabindex (stranding every cell out of the tab order)
    // and the negative-only version of this test would still pass.
    const clickable = container.querySelectorAll(".cell.is-clickable");
    expect(clickable.length).toBeGreaterThan(0);
    clickable.forEach(cell => {
      expect(cell.getAttribute("tabindex")).toBe("0");
    });
  });
  it("tags the death-month cell's accessible name", () => {
    setup();
    // WHITMER's deathday is 1888-01-25 -> death era lands on January 1888.
    expect(screen.getByRole("gridcell", { name: /January 1888, no sources, death month/i }))
      .toBeInTheDocument();
  });
  it("tags the excommunication-month cell's accessible name", () => {
    setup();
    // WHITMER's excommunication is 1838-04-13 -> April 1838.
    expect(screen.getByRole("gridcell", { name: /April 1838, no sources, excommunication/i }))
      .toBeInTheDocument();
  });
  it("tags the witness-event cell's accessible name", () => {
    setup();
    expect(screen.getByRole("gridcell", { name: /June 1829, no sources, witness event/i }))
      .toBeInTheDocument();
  });
  it("tags a posthumous cell's accessible name", () => {
    setup();
    // Pre-Task-8 this used row `d` (April 1918, "1 source, posthumous"). Task 8 excludes
    // posthumous sources from the grid entirely (they move to the strip instead), so no
    // sourced cell can ever carry the posthumous tag any more -- there is no such cell to
    // find. What's left of the grid's own death-year months (WHITMER died 25 Jan 1888, so
    // Feb-Dec 1888 are still drawn, still bounded by the death-year yearEnd) still needs the
    // posthumous era for coloring, just with no sources in it.
    expect(screen.getByRole("gridcell", { name: /February 1888, no sources, posthumous/i }))
      .toBeInTheDocument();
  });
  it("marks the selected cell with aria-selected", () => {
    const { container } = setup({ selectedYearMonth: "1885-06" });
    const selected = screen.getByRole("gridcell", { name: /June 1885, 1 source/i });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    // and nothing else in the grid is marked selected
    const others = [...container.querySelectorAll(".witness-life-heatmap-grid [role='gridcell']")]
      .filter(el => el !== selected);
    others.forEach(el => expect(el.getAttribute("aria-selected")).toBeNull());
  });
  it("keeps the focused cell's detail visible when the mouse merely passes over another cell", () => {
    // Reproduces: Tab to cell A -> panel shows A. Mouse drifts across cell B with
    // no click and focus untouched -> mouseenter(B) then mouseleave(B). Before the
    // hover/focus split, mouseleave(B) cleared shared state to null (because it was
    // still `=== B`), and the panel went to the empty placeholder even though A was
    // still visibly focused. It should keep showing A throughout.
    // Row `d` (April 1918) used to be cellB here, but Task 8 makes it posthumous relative
    // to WHITMER's 1888 death, so it no longer draws a grid cell at all. A second
    // pre-death, month-precise source is added just for this test so two real, distinct
    // sourced cells still exist to hover/focus between.
    const preDeathExtra = {
        slug: "f", archive: "witnesses", year: 1837, event_year: 1837, event_date: "1837-03-01",
    };
    const { container } = setup({ sources: [...sources, preDeathExtra] });
    const hover = () => container.querySelector(".witness-life-heatmap-hover");
    const cellA = screen.getByRole("gridcell", { name: /June 1885, 1 source/i });
    const cellB = screen.getByRole("gridcell", { name: /March 1837, 1 source/i });

    cellA.focus();
    expect(hover().textContent).toMatch(/June 1885/);

    fireEvent.mouseEnter(cellB);
    expect(hover().textContent).toMatch(/March 1837/);

    fireEvent.mouseLeave(cellB);
    expect(hover().textContent).toMatch(/June 1885/);
    expect(hover().textContent).not.toMatch(/Hover a cell for details/);
  });
});

describe("posthumous split", () => {
  it("ends the grid at the death year", () => {
    setup();
    expect(screen.getByText(/1829–1888/)).toBeInTheDocument();
  });

  it("lists posthumous sources in a separate strip", () => {
    setup();
    const strip = screen.getByRole("group", { name: /composed after .*death/i });
    expect(strip).toHaveTextContent("1918");
    expect(strip).toHaveTextContent("1940");
  });

  it("omits the strip when nothing is posthumous", () => {
    setup({ sources: [{ slug: "x", archive: "witnesses", year: 1885, event_year: 1885, event_date: "1885-06" }] });
    expect(screen.queryByRole("group", { name: /composed after .*death/i })).toBeNull();
  });

  it("omits the strip for a witness with no recorded death", () => {
    setup({ witness: { ...WHITMER, deathday: null } });
    expect(screen.queryByRole("group", { name: /composed after .*death/i })).toBeNull();
  });

  it("excludes a source composed later in the death year itself, not just later years", () => {
    // WHITMER died 25 Jan 1888. A source composed in Feb 1888 -- same calendar year, but
    // after the death -- must NOT appear as a grid cell. This is real: the live archive has
    // two such sources (a Richmond Democrat obituary and an Angus M. Cannon interview,
    // verified against bom_xtras_history at implementation time). A year-only exclusion
    // check (`comp.year > deathYear`) would miss both; only an ordinal check catches them.
    const { container } = setup({
        sources: [{ slug: "obit", archive: "witnesses", year: 1888, event_year: 1888, event_date: "1888-02-02" }],
    });
    expect(container.querySelector(".cell.bucket-1")).toBeNull();
    const strip = screen.getByRole("group", { name: /composed after .*death/i });
    expect(strip).toHaveTextContent("1888");
  });

  it("keeps the strip's placed count equal to the number of sourced grid cells actually rendered", () => {
    // The property all of this exists to protect: the meta strip's "N of M placed" must
    // never claim a cell the grid didn't draw. Checked against the real component, not
    // just the pure accountSources unit tests, since a wiring mistake (e.g. forgetting to
    // pass deathOrdinal through) would still pass those in isolation.
    const { container } = setup();
    const renderedCells = container.querySelectorAll(".cell.bucket-1, .cell.bucket-2, .cell.bucket-3, .cell.bucket-4");
    expect(screen.getByText(`${renderedCells.length} of 4 sources placed`)).toBeInTheDocument();
    expect(renderedCells).toHaveLength(1); // only row `a`, 1885-06
  });
});

describe("coarse-pointer cell floor", () => {
  // widthFor()'s `!wrapperWidth` early return (jsdom has no ResizeObserver by default -- see
  // this file's header comment, point 2) means the touch floor can only be exercised with
  // ResizeObserver AND getBoundingClientRect stubbed, same as the compressed-column test
  // above. window.matchMedia is undefined in jsdom by default (verified directly against this
  // project's test environment before writing these), so it also needs stubbing per case.
  let originalRO;
  let rectSpy;
  let originalMatchMedia;

  const mockMatchMedia = (coarse) => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: coarse && query === "(pointer: coarse)",
      media: query,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() {},
    }));
  };

  beforeEach(() => {
    originalRO = global.ResizeObserver;
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    // This 4-row fixture is sparse enough that most of WHITMER's 1829-1888 axis compresses
    // (only row `a`, 1885, and the 1829/1838/1888 marker years survive as real columns -- 8
    // display columns total, verified directly). At 80px, available space per column
    // (80 - 14 - 8 = 58, / 8 columns) computes to a raw 6px cell -- comfortably below the
    // 12px floor, so the floor has visible, unclamped work to do (unlike a wider stub, which
    // would clamp to CELL_PX_MAX=16 regardless of the floor and test nothing).
    rectSpy = jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 80, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {},
    });
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    global.ResizeObserver = originalRO;
    rectSpy.mockRestore();
    window.matchMedia = originalMatchMedia;
  });

  const cellPxOf = (container) => {
    const wrapper = container.querySelector(".witness-life-heatmap");
    return wrapper.style.getPropertyValue("--bom-heatmap-cell");
  };

  it("raises the cell size to the 12px floor when the device reports a coarse pointer", () => {
    mockMatchMedia(true);
    const { container } = setup();
    expect(cellPxOf(container)).toBe("12px");
  });

  it("leaves the computed cell size alone on a fine (mouse) pointer", () => {
    mockMatchMedia(false); // no query in this test reports coarse -- a mouse/trackpad device
    const { container } = setup();
    // 6.25px, not a round 6px: the column count this divides 80px by shifted when
    // HEATMAP_END_YEAR (dev's later cap-at-1930 change) widened the date range.
    expect(cellPxOf(container)).toBe("6.25px");
  });

  it("does not shrink an already-larger cell down to the floor (a true floor, not a clamp)", () => {
    // A wider viewport where the computed cell (clamped at CELL_PX_MAX) is already above
    // the 12px floor -- the floor must not pull it back down to exactly 12. CELL_PX_MAX is
    // 18, not this test's original 16 -- dev's own later tuning raised it.
    rectSpy.mockReturnValue({
      width: 2000, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {},
    });
    mockMatchMedia(true);
    const { container } = setup();
    expect(cellPxOf(container)).toBe("18px");
  });

  it("falls back to the untouched (non-floored) size when matchMedia is unavailable", () => {
    // jsdom's actual default (no matchMedia at all) -- confirms the `typeof window.matchMedia
    // === 'function'` guard degrades safely rather than throwing, matching the pattern used
    // elsewhere in this codebase (Names.js, appController.js, MapStoryTile.js).
    delete window.matchMedia;
    const { container } = setup();
    expect(cellPxOf(container)).toBe("6.25px");
  });

  it("does not change the compression decision -- pointer type only affects the final cell size", () => {
    // Caught during implementation: an earlier version applied the floor inside the same
    // helper that also measures `uncompressedCellPx` (the probe `shouldCompress` compares
    // against COMFORT_CELL_PX). That inflated the probe too, so a coarse-pointer render
    // measured a floored-to-12px "uncompressed" width, read it as already comfortable, and
    // skipped compression a fine-pointer render (correctly measuring 4px, well under the 7px
    // comfort threshold) would apply -- two different column counts for the same content,
    // driven by pointer type rather than by anything about the layout itself. The number of
    // display columns (and so how many years get compressed together) must be identical
    // regardless of pointer type; only the rendered cell SIZE should differ.
    mockMatchMedia(true);
    const coarse = render(
      <WitnessLifeHeatmap witness={WHITMER} sources={sources}
        selectedYearMonth={null} onSelectYearMonth={jest.fn()} />
    );
    const coarseCompressedCells = coarse.container.querySelectorAll(".cell.era-compressed").length;
    coarse.unmount();

    mockMatchMedia(false);
    const fine = render(
      <WitnessLifeHeatmap witness={WHITMER} sources={sources}
        selectedYearMonth={null} onSelectYearMonth={jest.fn()} />
    );
    const fineCompressedCells = fine.container.querySelectorAll(".cell.era-compressed").length;

    expect(coarseCompressedCells).toBeGreaterThan(0); // sanity: compression is actually active
    expect(coarseCompressedCells).toBe(fineCompressedCells);
  });
});

describe("ARIA grid conformance: role=row, roving tabindex, arrow-key navigation", () => {
  // A "plus" of five clickable cells around a June-1850 center, spread across three
  // adjacent years and three adjacent months, so Left/Right (year/column movement) and
  // Up/Down (month/row movement) each have an unambiguous, distinct target to land on.
  // No deathday, so nothing here is posthumous and the axis runs to the latest
  // composition year (1851) -- HEATMAP_START_YEAR (1829) is always the axis start, so
  // year Y sits at column index (Y - 1829) in the (uncompressed, jsdom has no
  // ResizeObserver -- see this file's header comment) displayColumns array.
  const CROSS_WITNESS = { slug: "cross", name: "Cross Witness", birthday: "1800-01-01", deathday: null, excommunication: null };
  const crossSources = [
    { slug: "up", archive: "witnesses", year: 1850, event_year: 1850, event_date: "1850-05-10" },     // May 1850   (mi=4)
    { slug: "left", archive: "witnesses", year: 1849, event_year: 1849, event_date: "1849-06-10" },   // Jun 1849   (ci-1)
    { slug: "center", archive: "witnesses", year: 1850, event_year: 1850, event_date: "1850-06-10" }, // Jun 1850   (mi=5, ci=21)
    { slug: "right", archive: "witnesses", year: 1851, event_year: 1851, event_date: "1851-06-10" },  // Jun 1851   (ci+1)
    { slug: "down", archive: "witnesses", year: 1850, event_year: 1850, event_date: "1850-07-10" },   // Jul 1850   (mi=6)
  ];
  const crossSetup = (props = {}) => render(
    <WitnessLifeHeatmap witness={CROSS_WITNESS} sources={crossSources}
      selectedYearMonth={null} onSelectYearMonth={jest.fn()} {...props} />
  );
  const cellNamed = (re) => screen.getByRole("gridcell", { name: re });

  it("wraps each month's cells in exactly 12 role=row elements, one per month", () => {
    // Deliberately no assertion on the row's own accessible name: role="row" doesn't
    // require one (Task 7b exists to satisfy gridcell's need for a row ANCESTOR, not a
    // NAMED one), and every cell's own label already states the month -- a named row
    // would just double-announce it on every vertical arrow move. What matters here is
    // structural: exactly 12 rows, each scoped to that month's own cells.
    const { container } = crossSetup();
    const rows = container.querySelectorAll(".witness-life-heatmap-grid [role='row']");
    expect(rows).toHaveLength(12);
    // June is month index 5 (0-based) -- its row contains the left/center/right cells.
    const juneRow = rows[5];
    expect(juneRow.querySelector(".cell.is-clickable[aria-label^='June 1849']")).toBeTruthy();
    expect(juneRow.querySelector(".cell.is-clickable[aria-label^='June 1850']")).toBeTruthy();
    expect(juneRow.querySelector(".cell.is-clickable[aria-label^='June 1851']")).toBeTruthy();
    // and each row actually contains that month's cells, not some other month's
    const mayRow = rows[4];
    expect(mayRow.querySelector(".cell.is-clickable[aria-label^='May 1850']")).toBeTruthy();
    expect(mayRow.querySelector(".cell[aria-label^='June']")).toBeNull();
  });

  it("only one clickable cell has tabindex 0 at a time; every other clickable cell has -1", () => {
    const { container } = crossSetup();
    const clickable = [...container.querySelectorAll(".cell.is-clickable")];
    expect(clickable.length).toBe(5); // sanity: all five fixture sources drew a cell
    const zeroes = clickable.filter(c => c.getAttribute("tabindex") === "0");
    const minusOnes = clickable.filter(c => c.getAttribute("tabindex") === "-1");
    expect(zeroes).toHaveLength(1);
    expect(minusOnes).toHaveLength(clickable.length - 1);
  });

  it("Tab from outside the grid lands on exactly one cell, not on all of them", () => {
    render(
      <div>
        <button>before</button>
        <WitnessLifeHeatmap witness={CROSS_WITNESS} sources={crossSources}
          selectedYearMonth={null} onSelectYearMonth={jest.fn()} />
      </div>
    );
    screen.getByText("before").focus();
    userEvent.tab();
    // This witness's grid spans many empty years (birth 1800, sources only 1849-1851),
    // so the compress-toggle switch -- a later dev addition, not part of the grid --
    // renders before it and is the first tabbable thing after "before".
    expect(document.activeElement.type).toBe("checkbox");
    userEvent.tab();
    const focused = document.activeElement;
    expect(focused.getAttribute("role")).toBe("gridcell");
    expect(focused.getAttribute("tabindex")).toBe("0");
    const others = [...document.querySelectorAll(".cell.is-clickable")].filter(c => c !== focused);
    expect(others.length).toBeGreaterThan(0); // sanity: there were other clickable cells to skip
    others.forEach(c => expect(c.getAttribute("tabindex")).toBe("-1"));
  });

  it("ArrowRight moves focus to the next clickable cell in the same row (a later year)", () => {
    crossSetup();
    const center = cellNamed(/^June 1850/);
    center.focus();
    fireEvent.keyDown(center, { key: "ArrowRight" });
    expect(cellNamed(/^June 1851/)).toHaveFocus();
  });

  it("ArrowLeft moves focus to the previous clickable cell in the same row (an earlier year)", () => {
    crossSetup();
    const center = cellNamed(/^June 1850/);
    center.focus();
    fireEvent.keyDown(center, { key: "ArrowLeft" });
    expect(cellNamed(/^June 1849/)).toHaveFocus();
  });

  it("ArrowUp moves focus to the previous clickable cell in the same column (an earlier month)", () => {
    crossSetup();
    const center = cellNamed(/^June 1850/);
    center.focus();
    fireEvent.keyDown(center, { key: "ArrowUp" });
    expect(cellNamed(/^May 1850/)).toHaveFocus();
  });

  it("ArrowDown moves focus to the next clickable cell in the same column (a later month)", () => {
    crossSetup();
    const center = cellNamed(/^June 1850/);
    center.focus();
    fireEvent.keyDown(center, { key: "ArrowDown" });
    expect(cellNamed(/^July 1850/)).toHaveFocus();
  });

  it("moves the roving tabindex to the newly-focused cell after an arrow key", () => {
    const { container } = crossSetup();
    const center = cellNamed(/^June 1850/);
    center.focus();
    fireEvent.keyDown(center, { key: "ArrowRight" });
    const right = cellNamed(/^June 1851/);
    expect(right.getAttribute("tabindex")).toBe("0");
    expect(center.getAttribute("tabindex")).toBe("-1");
    const clickable = [...container.querySelectorAll(".cell.is-clickable")];
    expect(clickable.filter(c => c.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("moves the roving tabindex to a cell reached by click, not just by arrow key", () => {
    // Raw `.click()`/`fireEvent.click` do NOT trigger `onFocus` in jsdom -- only
    // `userEvent.click` simulates the real browser behavior of a mousedown/mouseup on a
    // focusable element also moving focus. That distinction matters here: click-then-focus
    // is exactly the mechanism that could move the roving tab stop somewhere a keyboard user
    // never asked to go, so it needs its own direct test rather than trusting the arrow-key
    // coverage above to stand in for it.
    const { container } = crossSetup();
    const center = cellNamed(/^June 1850/);
    center.focus();
    expect(center.getAttribute("tabindex")).toBe("0");

    const right = cellNamed(/^June 1851/);
    expect(right.getAttribute("tabindex")).toBe("-1");
    userEvent.click(right);
    expect(right.getAttribute("tabindex")).toBe("0");
    expect(center.getAttribute("tabindex")).toBe("-1");
    const clickable = [...container.querySelectorAll(".cell.is-clickable")];
    expect(clickable.filter(c => c.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("composes with the existing focus/hover split: arrow-focusing a cell updates the detail panel", () => {
    // Confirms the arrow-key .focus() call fires the same onFocus handler a Tab or click
    // would, so the hover/detail panel tracks keyboard arrow navigation, not just Tab/click.
    const { container } = crossSetup();
    const center = cellNamed(/^June 1850/);
    center.focus();
    fireEvent.keyDown(center, { key: "ArrowDown" });
    const hover = container.querySelector(".witness-life-heatmap-hover");
    expect(hover.textContent).toMatch(/July 1850/);
  });

  it("stays put at a row edge (no cell further right) without crashing or selecting", () => {
    const onSelect = jest.fn();
    crossSetup({ onSelectYearMonth: onSelect });
    const right = cellNamed(/^June 1851/); // rightmost clickable cell in the June row
    right.focus();
    fireEvent.keyDown(right, { key: "ArrowRight" });
    expect(right).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Home/End jump to the first/last clickable cell in the row", () => {
    crossSetup();
    const center = cellNamed(/^June 1850/);
    center.focus();
    fireEvent.keyDown(center, { key: "End" });
    expect(cellNamed(/^June 1851/)).toHaveFocus();
    fireEvent.keyDown(cellNamed(/^June 1851/), { key: "Home" });
    expect(cellNamed(/^June 1849/)).toHaveFocus();
  });

  it("arrow keys never activate a cell -- only Enter/Space call onSelectYearMonth", () => {
    const onSelect = jest.fn();
    crossSetup({ onSelectYearMonth: onSelect });
    const center = cellNamed(/^June 1850/);
    center.focus();
    fireEvent.keyDown(center, { key: "ArrowRight" });
    fireEvent.keyDown(cellNamed(/^June 1851/), { key: "ArrowLeft" });
    fireEvent.keyDown(cellNamed(/^June 1850/), { key: "ArrowUp" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("falls back to a different roving cell gracefully when the previous one stops being clickable", () => {
    // Simulates what a resize-driven compression change or a data refresh could do to the
    // "current" cell: it disappears from the clickable set entirely. The grid must not be
    // left with zero tab stops (Tab-in from outside would then skip the grid altogether).
    const { container, rerender } = render(
      <WitnessLifeHeatmap witness={CROSS_WITNESS} sources={crossSources}
        selectedYearMonth={null} onSelectYearMonth={jest.fn()} />
    );
    const center = screen.getByRole("gridcell", { name: /^June 1850/ });
    center.focus();
    expect(center.getAttribute("tabindex")).toBe("0");

    rerender(
      <WitnessLifeHeatmap witness={CROSS_WITNESS}
        sources={crossSources.filter(s => s.slug !== "center")}
        selectedYearMonth={null} onSelectYearMonth={jest.fn()} />
    );
    const clickable = [...container.querySelectorAll(".cell.is-clickable")];
    expect(clickable.length).toBeGreaterThan(0); // sanity: still cells to fall back to
    expect(clickable.filter(c => c.getAttribute("tabindex") === "0")).toHaveLength(1);
    const formerCenter = container.querySelector(".cell[aria-label^='June 1850']");
    expect(formerCenter.classList.contains("is-clickable")).toBe(false);
    expect(formerCenter.getAttribute("tabindex")).toBeNull();
  });

  it("renders with no crash and no tab stop when the grid has zero clickable cells", () => {
    const { container } = render(
      <WitnessLifeHeatmap witness={CROSS_WITNESS} sources={[]}
        selectedYearMonth={null} onSelectYearMonth={jest.fn()} />
    );
    expect(container.querySelectorAll(".cell.is-clickable")).toHaveLength(0);
    const anyZero = [...container.querySelectorAll(".cell")].some(c => c.getAttribute("tabindex") === "0");
    expect(anyZero).toBe(false);
  });

  it("gives compressed-run cells a gridcell role and a real, matching label", () => {
    const originalRO = global.ResizeObserver;
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    const rectSpy = jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 300, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {},
    });
    try {
      const { container } = setup(); // the WHITMER default fixture, which compresses at 300px
      const compressedCell = container.querySelector(".cell.era-compressed");
      expect(compressedCell).toBeTruthy(); // sanity: compression is actually active
      expect(compressedCell.getAttribute("role")).toBe("gridcell");
      const label = compressedCell.getAttribute("aria-label");
      // Checks the arithmetic, not just the shape: a regex matching "\d+ empty years
      // compressed" would still pass under an off-by-one (e.g. endYear - startYear with
      // no + 1), since any non-negative integer satisfies \d+. Extract the three numbers
      // and assert the count is actually (end - start + 1), and that start <= end.
      const m = label.match(/^(\d{4})–(\d{4}), (\d+) empty years compressed$/);
      expect(m).toBeTruthy();
      const [, startYear, endYear, count] = m.map(Number);
      expect(startYear).toBeLessThanOrEqual(endYear);
      expect(count).toBe(endYear - startYear + 1);
      // Not part of the interactive/roving/arrow-key model: no click handler, nothing to
      // activate -- see this file's docblock comment on `clickableKeys` for the rationale.
      expect(compressedCell.getAttribute("tabindex")).toBeNull();
    } finally {
      rectSpy.mockRestore();
      global.ResizeObserver = originalRO;
    }
  });
});
