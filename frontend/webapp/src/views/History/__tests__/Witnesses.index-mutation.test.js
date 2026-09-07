import React from "react";
import "@testing-library/jest-dom";
import { render, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";

/**
 * Isolated in its own file ON PURPOSE.
 *
 * This test's correctness depends on `data` (module-level state in
 * Witnesses.js) being in its pristine, source-declared order the first time
 * the dropdown order is captured below. Living inside the larger
 * Witnesses.render.test.js, that pristine-ness was only guaranteed by this
 * being the first test in the file to render "/history/witnesses" — enforced
 * by a comment, not by the test framework. If the sort-mutation bug were ever
 * reintroduced AND some earlier-positioned test in that file also happened to
 * render the bare index route first, the `before` snapshot captured here
 * would already be corrupted the same way `after` would be, and the assertion
 * could pass despite the regression — the exact class of vacuous test this
 * task rejected the plan's own prescribed version for (see the sibling test
 * file's "witness index" describe block history).
 *
 * Jest gives each test FILE its own module registry, so putting this
 * assertion alone in its own file makes the guarantee structural instead of
 * positional: no other test anywhere can have touched this file's copy of
 * `data` before this test runs, regardless of describe-block order, test
 * run order flags, or future edits to the sibling file.
 */

jest.mock("src/models/BoMOnlineAPI", () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve({ history: [] })),
    assetUrl: "https://assets.test",
}));

jest.mock("src/models/Utils", () => ({
    // Real en labels (see docs/plans/2026-08-07-history-translation.md) -- displayDate
    // formats through these, so a naive identity mock would feed moment.format() the
    // literal key string instead of a format token and produce garbage dates.
    label: (k) => ({
        history_date_format_full: "D MMM YYYY",
        history_date_format_year: "YYYY",
        history_date_format_month: "MMM YYYY",
    }[k] ?? k),
}));

jest.mock("src/contexts/AppControllerContext", () => ({
    useAppController: () => ({ functions: { setPopUp: jest.fn() } }),
}));

// Not exercised here (sources resolve to [] so the heatmap never mounts), but
// stubbed anyway to keep this file's import graph as light as the sibling
// harness's and avoid coupling to WitnessLifeHeatmap's own internals.
jest.mock("../WitnessLifeHeatmap", () => ({
    __esModule: true,
    default: () => null,
}));

import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import Witnesses from "../Witnesses";

/** Copied from src/models/Routes.js — keep in sync (see Witnesses.render.test.js). */
const WITNESS_ROUTE = "/history/witnesses/:witness?/:source?";

// CRA's default Jest config sets `resetMocks: true`, which strips a mock's
// factory-provided implementation before EVERY test (not just calls/instances
// — the implementation itself). Without re-establishing it here, `BoMOnlineAPI`
// resolves to a bare no-op returning `undefined`, and SingleWitness's
// `.then(...)` on that blows up. The sibling harness (Witnesses.render.test.js)
// hits the same reset and works around it identically via its own `beforeEach`.
beforeEach(() => {
    BoMOnlineAPI.mockResolvedValue({ history: [] });
});

describe("witness index — comparator mutation", () => {
    // Comparator mutation (Task 15).
    //
    // A naive "rerender the same tree and diff the Age order" test does NOT
    // exercise this bug: the old `.sort((b, a) => ...)` and the new
    // `[...arr].sort(byAgeAtEvent)` are both deterministic, and this data has
    // no tied birthdays, so re-running the same comparator over an
    // already-sorted array is a no-op whether or not the sort mutates its
    // input. Confirmed empirically — reverting to the old inline
    // `.sort((b, a) => ...)` and keeping only a rerender-and-diff assertion,
    // that assertion still passed. Vacuous.
    //
    // The real, observable consequence (per the plan) is that the mutation
    // reorders `WitnessBreadcrumbs`'s dropdown, which reads the very same
    // `data` object the index page sorts. THAT is order-sensitive across
    // renders, because the dropdown just maps `data[groupKey]` as it finds it
    // — it never sorts. This test reproduces the cross-component consequence
    // directly: read the dropdown's order for a witness's group before the
    // index page has ever rendered in this file's module registry, render the
    // index page (the old code's mutation site, once per group), then read
    // the dropdown again and assert the order is unchanged.
    //
    // Verified both directions: with the OLD `data[groupKey].sort((b, a) =>
    // ...)` restored, this test fails (`afterOrder` comes back age-sorted
    // instead of matching the declared order `beforeOrder` captured). With the
    // `[...data[groupKey]]` copy in place, it passes.
    it("does not mutate the module-level data while sorting for display", async () => {
        const dropdownOrder = async (path) => {
            const result = render(
                <MemoryRouter initialEntries={[path]}>
                    <Route path={WITNESS_ROUTE}><Witnesses /></Route>
                </MemoryRouter>
            );
            const trigger = await within(result.container).findByRole("button", { name: /Martin Harris/ });
            fireEvent.click(trigger);
            // dev's shared Breadcrumb.Dropdown renders the group as plain `.witness-option`
            // links, not role="menuitem" items (see Witnesses.render.test.js's "breadcrumb
            // dropdown" describe block for the same adaptation).
            const order = Array.from(
                result.container.querySelectorAll(".bc-dropdown .witness-option")
            ).map((el) => el.textContent);
            result.unmount();
            return order;
        };

        const before = await dropdownOrder("/history/witnesses/martin-harris");

        // Render the bare index page — this is exactly where the old
        // `data[groupKey].sort((b, a) => ...)` ran, once per group, mutating
        // the module-level arrays in place.
        const indexRender = render(
            <MemoryRouter initialEntries={["/history/witnesses"]}>
                <Route path={WITNESS_ROUTE}><Witnesses /></Route>
            </MemoryRouter>
        );
        await within(indexRender.container).findByText("Three Witnesses");
        indexRender.unmount();

        const after = await dropdownOrder("/history/witnesses/martin-harris");

        expect(after).toEqual(before);
    });
});
