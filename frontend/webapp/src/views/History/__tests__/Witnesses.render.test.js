import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route } from "react-router-dom";

/**
 * Render harness for the Witnesses view.
 *
 * Three decisions later tasks inherit:
 *
 * 1. The component is rendered through a real <Route> whose path is copied from
 *    src/models/Routes.js. Witnesses() reads useParams(), and react-router v5
 *    only populates params from a matched Route — a bare <MemoryRouter> yields
 *    {} and silently renders the index page instead of the detail page. Routing
 *    through the real path means one harness serves both the detail page
 *    (Tasks 3, 10-14) and the index page (Task 15), and keeps SingleWitness
 *    unexported.
 *
 * 2. WitnessLifeHeatmap is stubbed. It is a large presentational grid with its
 *    own test file, its markup changes in Tasks 4-9, and its year labels emit
 *    four-digit strings that collide with assertions about card dates. The stub
 *    keeps the two things this view actually cares about observable: the
 *    selectedYearMonth it hands down, and the onSelectYearMonth callback that
 *    drives filtering. Selecting a month in a test is therefore independent of
 *    whatever cells the real heatmap happens to draw.
 *
 * 3. Fixtures are verbatim bom_xtras_history rows (see FIXTURE_ROWS). Real rows
 *    only — the corrupt `date` values and the near-identical Moyle titles are
 *    the defects under test, and paraphrasing them would blunt the tests.
 */

const mockSetPopUp = jest.fn();

// Months the heatmap stub offers as selectable. Reset per test by renderWitness.
const mockSelectableMonths = { current: [] };

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
    useAppController: () => ({ functions: { setPopUp: mockSetPopUp } }),
}));

jest.mock("../WitnessLifeHeatmap", () => ({
    __esModule: true,
    default: ({ selectedYearMonth, onSelectYearMonth }) => {
        const R = require("react");
        return R.createElement(
            "div",
            { "data-testid": "heatmap" },
            R.createElement("span", { "data-testid": "heatmap-selection" }, selectedYearMonth || "none"),
            mockSelectableMonths.current.map((ym) =>
                R.createElement(
                    "button",
                    { key: ym, type: "button", onClick: () => onSelectYearMonth(ym) },
                    `select ${ym}`
                )
            )
        );
    },
}));

import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import Witnesses from "../Witnesses";

/** Copied from src/models/Routes.js — keep in sync. */
const WITNESS_ROUTE = "/history/witnesses/:witness?/:source?";

/**
 * Five real David Whitmer rows. Four are Moyle accounts with near-identical
 * titles (that is real, and is why Task 11 adds bylines). Between them they hit
 * every branch of the date logic:
 *
 *   moyle1945   month-precise, event is the composition occasion
 *   moyle1940   year-only composition, recalls an earlier month-precise event
 *   moyle1938   month-precise from a full YYYY-MM-DD event_date
 *   moyle1930   month-precise, same shape, different month
 *   seymour1875 month-precise composition whose `date` column holds a reprint
 *               year (1879) — the Case B corruption
 */
const FIXTURE_ROWS = {
    moyle1945: {
        slug: "1945-09-james-h-moyle-david-whitmer",
        year: 1945, date: "1945-09", event_year: 1945, event_date: "1945-09", seq: 1245,
        document: "James H. Moyle give lengthy account of his meeting with David Whitmer.",
        author: "James H. Moyle",
        citation: "James H. Moyle, \"A Visit to David Whitmer,\" The Instructor 80, no. 9 (September 1945): 400–404",
        principal: "David Whitmer",
    },
    moyle1940: {
        slug: "1885-06-28-james-h-moyle-david-whitmer-5",
        year: 1940, date: "1885-06-28", event_year: 1885, event_date: "1885-06-28", seq: 1252,
        document: "James H. Moyle recalls his meeting with David Whitmer in ca. 1940 memoir and personal history.",
        author: "James H. Moyle",
        citation: "James H. Moyle, Memoir, ca. 1940, rep. in Gene A. Sessions, ed., Mormon Democrat (Salt Lake City, UT: Signature Books, 1998), 125–126",
        principal: "David Whitmer",
    },
    moyle1938: {
        slug: "1938-09-13-james-h-moyle-david-whitmer",
        year: 1938, date: "1938-09-13", event_year: 1938, event_date: "1938-09-13", seq: 813,
        document: "James Henry Moyle, in an interview, recalls David Whitmer telling him that he had a clear vision and knowledge of the plates and the angel.",
        author: "James H. Moyle",
        citation: "James Henry Moyle, “David Whitmer’s Testimony,” Liahona 36, no. 7 (September 13, 1938): 150-51",
        principal: "David Whitmer",
    },
    moyle1930: {
        slug: "1930-04-08-james-h-moyle-david-whitmer",
        year: 1930, date: "1930-04-08", event_year: 1930, event_date: "1930-04-08", seq: 800,
        document: "James H. Moyle recalls David Whitmer's description of seeing the angel and the plates.",
        author: "James H. Moyle",
        citation: "James H. Moyle, Speech, April 8, 1930, in One Hundredth Annual Conference (Salt Lake City, UT, 1930), 121–122",
        principal: "David Whitmer",
    },
    seymour1875: {
        slug: "1875-12-08-david-whitmer-to-james-n-seymour",
        year: 1875, date: "1879", event_year: 1875, event_date: "1875-12-08", seq: 584,
        document: "David Whitmer to James N. Seymour",
        author: "David Whitmer",
        citation: "David Whitmer to James N. Seymour, 8 Dec 1875, Richmond, Missouri, The Saints' Herald, 1879.",
        principal: "David Whitmer",
    },
    // Task 11 (source card rebuild): the one firsthand row in the fixture set —
    // Whitmer's own words, not someone recounting a meeting with him. Distinct
    // document title so tests can find it without colliding with the Moyle rows.
    whitmerOwnStatement: {
        slug: "1881-12-david-whitmer-own-statement",
        year: 1881, date: "1881-12", event_year: 1881, event_date: "1881-12", seq: 640,
        document: "Whitmer's own statement",
        author: "David Whitmer",
        quote_is_witness_voice: true,
        witness_label: "David Whitmer",
        citation: "Richmond Conservator",
        principal: "David Whitmer",
    },
    // Task 13 (filter chip widen affordance): year-only composition sharing 1945
    // with moyle1945 (month-precise). Deliberately no event_date, so
    // compositionDate degrades to year precision and matchesYearMonth("1945-09")
    // excludes it — exactly the source the chip's "N more dated 1945 without a
    // month" widen button exists to surface.
    yearOnly1945: {
        slug: "1945-uncertain-month-david-whitmer",
        year: 1945, event_year: 1945, event_date: null, seq: 1246,
        document: "Undated 1945 recollection of David Whitmer",
        author: "Anonymous",
        citation: "Undated clipping, 1945",
        principal: "David Whitmer",
    },
};

/** Deliberately out of order — the sort under test must impose the order. */
const WHITMER_SOURCES = [
    FIXTURE_ROWS.moyle1930,
    FIXTURE_ROWS.moyle1945,
    FIXTURE_ROWS.seymour1875,
    FIXTURE_ROWS.moyle1938,
    FIXTURE_ROWS.moyle1940,
];

const mockHistory = (rows) => BoMOnlineAPI.mockResolvedValue({ history: rows });

const renderWitness = (path = "/history/witnesses/david-whitmer", { months = [] } = {}) => {
    mockSelectableMonths.current = months;
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Route path={WITNESS_ROUTE}>
                <Witnesses />
            </Route>
        </MemoryRouter>
    );
};

/**
 * Cards in reading order.
 *
 * Originally written for react-masonry-css, which distributed item i into
 * column i % columnCount — document order was column-major and did NOT match
 * the sorted list, so a bare querySelectorAll would have tested the masonry
 * layout, not the sort. The round-robin reconstruction below existed to undo that.
 *
 * Task 12 replaced masonry with decade-grouped `<section>`s over a row-major CSS
 * grid, so the `.my-masonry-grid_column` wrappers this queries for no longer
 * exist. Confirmed by running the full pre-Task-12 suite unchanged afterward:
 * every test built on cardEls()/cardTitles()/cardDates()/cardRecalls() still
 * passed, silently taking the plain-`.historycard` fallback branch below — the
 * degradation this comment predicted, not a rewrite. Left in place rather than
 * simplified to a bare querySelectorAll so the fallback keeps working if masonry
 * (or any other column-splitting wrapper) ever comes back for this view.
 */
const cardEls = () => {
    const columns = Array.from(document.querySelectorAll(".witness-sources .my-masonry-grid_column"));
    if (!columns.length) return Array.from(document.querySelectorAll(".witness-sources .historycard"));
    const perColumn = columns.map((col) => Array.from(col.children).filter((el) => el.matches(".historycard")));
    const depth = Math.max(0, ...perColumn.map((c) => c.length));
    const ordered = [];
    for (let i = 0; i < depth; i++) for (const col of perColumn) if (col[i]) ordered.push(col[i]);
    return ordered;
};
// dev's HistorySourceCard shows no document title for the witness variant (reception-only)
// and no "recalling an earlier occasion" annotation at all -- both branch-only markup dev's
// card redesign dropped. `.citation` is the one field that both still renders AND is unique
// per fixture row, so it stands in for title as the cross-row identity anchor below.
// `.dateChip` replaces the branch's own `.date` class.
const cardCitation = (card) => card.querySelector(".citation");
const cardCitations = () => cardEls().map((c) => cardCitation(c)?.textContent ?? null);
const cardDates = () => cardEls().map((c) => c.querySelector(".dateChip")?.textContent ?? null);

/** Wait for the async source fetch to land. */
const awaitCards = async (expected) => {
    await waitFor(() => expect(cardEls()).toHaveLength(expected));
    return cardEls();
};

const selectMonth = (ym) => fireEvent.click(screen.getByRole("button", { name: `select ${ym}` }));

beforeEach(() => {
    jest.clearAllMocks();
    mockHistory(WHITMER_SOURCES);
});

describe("witness source cards — ordering", () => {
    it("renders cards newest composition first, not in fetch order", async () => {
        renderWitness();
        await awaitCards(5);
        expect(cardCitations()).toEqual([
            FIXTURE_ROWS.moyle1945.citation,
            FIXTURE_ROWS.moyle1940.citation,
            FIXTURE_ROWS.moyle1938.citation,
            FIXTURE_ROWS.moyle1930.citation,
            FIXTURE_ROWS.seymour1875.citation,
        ]);
    });

    it("orders by the same field it displays, so the dates read downward", async () => {
        renderWitness();
        await awaitCards(5);
        // The D1 symptom was a first row reading 1945, 1885, 1938, 1930.
        expect(cardDates()).toEqual(["Sep 1945", "1940", "Sep 1938", "Apr 1930", "Dec 1875"]);
    });
});

describe("witness source cards — composition date", () => {
    it("formats month-precise compositions as 'Sep 1945'", async () => {
        renderWitness();
        const cards = await awaitCards(5);
        expect(cards[0].querySelector(".dateChip").textContent).toBe("Sep 1945");
    });

    it("formats year-only compositions as a bare year", async () => {
        renderWitness();
        const cards = await awaitCards(5);
        expect(cards[1].querySelector(".dateChip")).toHaveTextContent("1940");
        expect(cards[1].querySelector(".dateChip").textContent).toBe("1940");
    });

    it("never reads the corrupt `date` column", async () => {
        // Same rows, every `date` replaced with the archive's junk values. If the
        // view read `date` at all, the rendered dates would move.
        mockHistory(WHITMER_SOURCES.map((s) => ({ ...s, date: "8795" })));
        renderWitness();
        await awaitCards(5);
        expect(cardDates()).toEqual(["Sep 1945", "1940", "Sep 1938", "Apr 1930", "Dec 1875"]);
        expect(cardCitations()[0]).toBe(FIXTURE_ROWS.moyle1945.citation);
    });

    it("does not surface a reprint year as the card's date", async () => {
        renderWitness();
        const cards = await awaitCards(5);
        // seymour1875 carries date="1879" (a Saints' Herald reprint). It is
        // composed Dec 1875 and must say so.
        const seymour = cards[4];
        expect(seymour.querySelector(".dateChip").textContent).toBe("Dec 1875");
    });
});

// KNOWN GAP, not ported: the "↳ recalling <date>" annotation for a source whose
// composition postdates the occasion it recounts (recalledEvent in witnessSources.js) had
// no equivalent in dev's redesigned HistorySourceCard and was out of the keyboard-access /
// byline / firsthand-badge scope this port covers. recalledEvent() itself still exists and
// is tested in witnessSources.test.js; only its card-level display is missing.

describe("witness source cards — month filtering", () => {
    it("shows only the sources composed in the selected month", async () => {
        renderWitness("/history/witnesses/david-whitmer", { months: ["1938-09"] });
        await awaitCards(5);
        selectMonth("1938-09");
        await waitFor(() => expect(cardCitations()).toEqual([FIXTURE_ROWS.moyle1938.citation]));
        expect(screen.getByTestId("heatmap-selection")).toHaveTextContent("1938-09");
    });

    it("filters on composition month, not on the month buried in `date`", async () => {
        // moyle1940 has date="1885-06-28" but was composed in 1940. Selecting
        // June 1885 must not surface it — that is the old date-driven filter.
        renderWitness("/history/witnesses/david-whitmer", { months: ["1885-06"] });
        await awaitCards(5);
        selectMonth("1885-06");
        await waitFor(() => expect(cardEls()).toHaveLength(0));
        // Task 13: the empty state names the actual month selected, not a
        // generic "this month" — formatYearMonth("1885-06") => "June 1885".
        expect(screen.getByText("No sources in June 1885.")).toBeInTheDocument();
    });

    it("is month-strict: a year-only source does not match a month of its year", async () => {
        renderWitness("/history/witnesses/david-whitmer", { months: ["1940-06"] });
        await awaitCards(5);
        selectMonth("1940-06");
        await waitFor(() => expect(cardEls()).toHaveLength(0));
    });
});

// Task 13 (W8): the heatmap's own "Clear filter (1945-09)" button is gone —
// the filter's consequence (the card list) now carries its own control, in a
// form readable without decoding a YYYY-MM key. WITMER_SOURCES is 5 rows (see
// FIXTURE_ROWS/WHITMER_SOURCES above), not the plan draft's guessed 4.
describe("month filter", () => {
    it("shows a readable filter chip above the cards", async () => {
        renderWitness("/history/witnesses/david-whitmer", { months: ["1945-09"] });
        await awaitCards(5);
        selectMonth("1945-09");
        // The visible chip is a normal conditional UI element — sighted users see it appear,
        // no accessibility concern there. role="status" now lives on a separate,
        // permanently-mounted announcement node (see the comment in Witnesses.js on why a
        // freshly-inserted role="status" element is an unreliable AT announcement).
        const chip = await waitFor(() => {
            const el = document.querySelector(".witness-filter-chip");
            expect(el).not.toBeNull();
            return el;
        });
        expect(chip).toHaveTextContent("September 1945");
        const announcement = await screen.findByRole("status");
        expect(announcement).toHaveTextContent("September 1945");
        expect(announcement).toHaveTextContent("1 source");
        expect(announcement).not.toHaveTextContent("1945-09");
    });

    it("clears the filter from the chip", async () => {
        renderWitness("/history/witnesses/david-whitmer", { months: ["1945-09"] });
        await awaitCards(5);
        selectMonth("1945-09");
        const announcement = await screen.findByRole("status");
        expect(announcement).toHaveTextContent("September 1945");
        fireEvent.click(screen.getByRole("button", { name: /show all sources/i }));
        // The live-region node stays mounted (it must, to keep announcing future filter
        // changes) but its text empties out — an empty announcement is itself the
        // announcement-worthy event for "filter cleared". The visible chip, by contrast,
        // really does unmount.
        await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(""));
        expect(document.querySelector(".witness-filter-chip")).toBeNull();
        await waitFor(() => expect(cardEls()).toHaveLength(5));
    });

    it("offers a way out of the empty state", async () => {
        // 1899 falls inside the fixture's overall span (1875-1945) but no row
        // is composed then — a plausible key with no match, not an
        // out-of-range one.
        renderWitness("/history/witnesses/david-whitmer", { months: ["1899-01"] });
        await awaitCards(5);
        selectMonth("1899-01");
        expect(await screen.findByText(/No sources in January 1899/)).toBeInTheDocument();
        // Two "Show all sources" controls exist here — the chip's and the empty
        // state's own — both clear the filter the same way; either is a valid exit.
        const [showAllBtn] = screen.getAllByRole("button", { name: /show all sources/i });
        fireEvent.click(showAllBtn);
        await waitFor(() => expect(cardEls()).toHaveLength(5));
    });

    // Self-review point #1: the widen button's *effect*, not just its
    // presence. yearOnly1945 has no event_date, so matchesYearMonth("1945-09")
    // excludes it (month-strict) but the chip's own yearOnlyInYear count
    // (computed off the full `sources` list, not visibleSources) should still
    // find it and the widen click should flip the filter to the bare year.
    it("widens to the whole year to surface a year-only source sharing the month's year", async () => {
        mockHistory([...WHITMER_SOURCES, FIXTURE_ROWS.yearOnly1945]);
        renderWitness("/history/witnesses/david-whitmer", { months: ["1945-09"] });
        await awaitCards(6);
        selectMonth("1945-09");
        await waitFor(() => expect(cardEls()).toHaveLength(1));
        const widenBtn = await screen.findByRole("button", { name: /1 more dated 1945 without a month/i });
        fireEvent.click(widenBtn);
        await waitFor(() => expect(cardEls()).toHaveLength(2));
        expect(cardCitations()).toEqual(
            expect.arrayContaining([FIXTURE_ROWS.moyle1945.citation, FIXTURE_ROWS.yearOnly1945.citation])
        );
    });
});

describe("witness hero", () => {
  it("shows the name once, in the hero, not as a separate centered title", async () => {
    renderWitness("/history/witnesses/david-whitmer");
    expect(await screen.findAllByText("David Whitmer")).toHaveLength(2); // breadcrumb + hero
    expect(document.querySelector(".title.text-center")).toBeNull();
  });
  it("shows the full life facts", async () => {
    renderWitness("/history/witnesses/david-whitmer");
    expect(await screen.findByText("Born")).toBeInTheDocument();
    expect(screen.getByText("7 Jan 1805")).toBeInTheDocument();
    expect(screen.getByText("Died")).toBeInTheDocument();
    expect(screen.getByText("25 Jan 1888")).toBeInTheDocument();
    expect(screen.getByText("Excommunicated")).toBeInTheDocument();
    expect(screen.getByText("13 Apr 1838")).toBeInTheDocument();
    expect(screen.getByText("Age in 1829")).toBeInTheDocument();
  });
  it("omits the excommunication fact for witnesses who were never excommunicated", async () => {
    renderWitness("/history/witnesses/hyrum-smith");
    await screen.findByText("Born");
    expect(screen.queryByText("Excommunicated")).toBeNull();
  });
  // KNOWN DIFFERENCE, not a regression: dev's own later, independent change to this hero
  // renders a "Biography coming soon." placeholder for an empty bio -- deliberate, and kept
  // as-is rather than reverted to the branch's original no-placeholder choice.
  it("shows a placeholder when the biography is empty", async () => {
    renderWitness("/history/witnesses/david-whitmer");
    await screen.findByText("Born");
    expect(screen.getByText(/Biography coming soon/)).toBeInTheDocument();
  });
});

// Task 16 (W-load-jump): the heatmap used to mount only once `sources` arrived, so the card
// grid below it jumped up while loading and back down when the fetch landed. A skeleton now
// reserves the space in between.
describe("heatmap load skeleton", () => {
    it("reserves the heatmap's space while sources are in flight", () => {
        renderWitness("/history/witnesses/david-whitmer");
        // Deliberately no `await` before this assertion — the mocked fetch's promise has not
        // resolved yet at this point, so `sources` is still its initial `null`. That is
        // exactly the window this test exists to check; awaiting anything first would let the
        // promise land and miss it entirely.
        expect(document.querySelector(".witness-life-heatmap-skeleton")).toBeInTheDocument();
        expect(screen.queryByTestId("heatmap")).toBeNull();
    });

    it("swaps the skeleton for the heatmap once sources land", async () => {
        renderWitness("/history/witnesses/david-whitmer");
        expect(document.querySelector(".witness-life-heatmap-skeleton")).toBeInTheDocument();
        await screen.findByTestId("heatmap");
        expect(document.querySelector(".witness-life-heatmap-skeleton")).toBeNull();
    });

    it("renders neither the skeleton nor the heatmap once sources resolve to an empty list", async () => {
        // Distinguishes the in-flight state (`sources === null`, skeleton shown) from the
        // resolved-but-empty state (`sources` is `[]`, nothing to plot) — a witness with zero
        // sources should not hold open space for a chart that will never draw anything.
        mockHistory([]);
        renderWitness("/history/witnesses/david-whitmer");
        await screen.findByText(/No sources available/);
        expect(document.querySelector(".witness-life-heatmap-skeleton")).toBeNull();
        expect(screen.queryByTestId("heatmap")).toBeNull();
    });

    it("renders neither element for a witness with no principal names (nothing to fetch)", () => {
        // william-hussey-azel-vandruver has `principalNames: []` in Witnesses.js's `data` —
        // the effect's early-return branch sets `sources` to `[]` synchronously, with no
        // fetch and therefore no in-flight window for the skeleton to occupy.
        renderWitness("/history/witnesses/william-hussey-azel-vandruver");
        expect(document.querySelector(".witness-life-heatmap-skeleton")).toBeNull();
        expect(screen.queryByTestId("heatmap")).toBeNull();
    });
});

// Task 11 (D2, W5): `source` is blank on all 444 rows; the card header used to
// reserve space for it while never showing `author` — exactly the field that
// distinguishes the four near-identical Moyle cards from each other.
describe("source cards", () => {
    beforeEach(() => {
        mockHistory([...WHITMER_SOURCES, FIXTURE_ROWS.whitmerOwnStatement]);
    });

    it("shows the author byline instead of the blank source column", async () => {
        renderWitness("/history/witnesses/david-whitmer");
        await awaitCards(6);
        // Four Moyle rows in the fixture set (moyle1945/1940/1938/1930), each its
        // own card, each bylined "James H. Moyle" — that's the point: the byline
        // is what tells them apart now that the title alone reads near-identical.
        expect(screen.getAllByText("James H. Moyle")).toHaveLength(4);
        expect(document.querySelector(".sourcebox .pub")).toBeNull();
    });

    it("marks firsthand accounts", async () => {
        renderWitness("/history/witnesses/david-whitmer");
        // The witness card variant shows no document title (that field is reception-only
        // on dev's HistorySourceCard), so wait on the citation text instead.
        await screen.findByText(FIXTURE_ROWS.whitmerOwnStatement.citation, { exact: false });
        expect(document.querySelectorAll(".historycard.is-firsthand")).toHaveLength(1);
        // and only the firsthand row gets it — the four Moyle-recounts-Whitmer
        // cards are not first-person and must not be marked as such.
        const firsthandCard = document.querySelector(".historycard.is-firsthand");
        expect(firsthandCard).toHaveTextContent(FIXTURE_ROWS.whitmerOwnStatement.citation);
    });

    it("renders the citation in the card", async () => {
        renderWitness("/history/witnesses/david-whitmer");
        const citation = await screen.findByText(/The Instructor 80/);
        expect(citation).toBeInTheDocument();
        expect(citation).toHaveClass("citation");
        // Readable-contrast is a CSS assertion (#666 on #EEE ≈ 4.95:1, clears
        // WCAG AA's 4.5:1) verified by computation in the task report, not by
        // this test — jsdom does not apply the stylesheet, so a unit test can
        // only confirm the citation renders with the class the CSS rule targets.
    });
});

// Task 11 also makes cards keyboard-reachable — previously bare `<div onClick>`.
// NOTE ON TEST VALIDITY: userEvent.type() auto-clicks its target before sending
// keys unless passed `{ skipClick: true }`. Since the card's onClick and
// onKeyDown both call the same openSource(doc), a test built on userEvent.type
// without that flag would pass even with onKeyDown deleted entirely — a
// vacuous test (this exact trap sank two tests in Task 7). These tests instead
// use fireEvent.keyDown directly, which never touches the mouse/click path at
// all, and assert toHaveBeenCalledTimes(1) rather than a bare
// toHaveBeenCalledWith(...), so a duplicate/accidental trigger also fails.
// Task 12 (W4): masonry's round-robin column fill made on-screen reading order
// diverge from the sort past the first row. Decade-grouped <section>s with a
// plain row-major CSS grid replace it. WHITMER_SOURCES (the outer beforeEach's
// default fixture — 5 rows, no whitmerOwnStatement) spans three decades once
// grouped: 1940s (moyle1945, moyle1940), 1930s (moyle1938, moyle1930), 1870s
// (seymour1875) — verified against FIXTURE_ROWS/WHITMER_SOURCES above rather
// than assumed from the plan's draft, which sketched a four-title order that
// only holds if whitmerOwnStatement were part of the default set. It isn't —
// that row is only added by the "source cards" describe block's own beforeEach.
describe("card grid — decade grouping", () => {
    it("groups cards under decade headings, in composition order", async () => {
        renderWitness();
        await awaitCards(5);
        const headings = screen.getAllByRole("heading", { level: 2 });
        expect(headings.map((h) => h.textContent)).toEqual(["1940s", "1930s", "1870s"]);
    });

    it("renders cards in DOM order matching the sort, decade headers notwithstanding", async () => {
        renderWitness();
        await awaitCards(5);
        expect(cardCitations()).toEqual([
            FIXTURE_ROWS.moyle1945.citation,
            FIXTURE_ROWS.moyle1940.citation,
            FIXTURE_ROWS.moyle1938.citation,
            FIXTURE_ROWS.moyle1930.citation,
            FIXTURE_ROWS.seymour1875.citation,
        ]);
    });

    it("keeps decade headings at h2, between the h1 hero and the h3 card titles", async () => {
        renderWitness();
        await awaitCards(5);
        expect(document.querySelectorAll("h1")).toHaveLength(1);
        expect(document.querySelectorAll(".witness-decade-label").length).toBeGreaterThan(0);
        document.querySelectorAll(".witness-decade-label").forEach((el) => {
            expect(el.tagName).toBe("H2");
        });
    });

    // KNOWN DIFFERENCE, not a regression: the branch dropped Masonry for a plain CSS grid;
    // dev's own later, independent redesign of this card grid kept Masonry. Kept as-is.
    it("still uses masonry to pack the variable-height cards, per decade section", async () => {
        renderWitness();
        await awaitCards(5);
        expect(document.querySelectorAll(".witness-decade .my-masonry-grid").length).toBe(3); // 1940s/1930s/1870s
    });
});

describe("source cards — keyboard access", () => {
    it("is focusable and self-describing", async () => {
        renderWitness();
        const cards = await awaitCards(5);
        expect(cards[0]).toHaveAttribute("role", "button");
        expect(cards[0]).toHaveAttribute("tabindex", "0");
        // No custom aria-label: role="button" with no explicit name falls back to the
        // subtree's own text content, which already includes the byline/date/citation.
        expect(cards[0]).not.toHaveAttribute("aria-label", "");
        expect(cards[0].textContent.length).toBeGreaterThan(0);
    });

    it("opens the source on Enter", async () => {
        renderWitness();
        const cards = await awaitCards(5);
        cards[0].focus();
        fireEvent.keyDown(cards[0], { key: "Enter" });
        expect(mockSetPopUp).toHaveBeenCalledTimes(1);
        expect(mockSetPopUp).toHaveBeenCalledWith(
            expect.objectContaining({ ids: [FIXTURE_ROWS.moyle1945.slug] })
        );
    });

    it("opens the source on Space", async () => {
        renderWitness();
        const cards = await awaitCards(5);
        cards[0].focus();
        fireEvent.keyDown(cards[0], { key: " " });
        expect(mockSetPopUp).toHaveBeenCalledTimes(1);
        expect(mockSetPopUp).toHaveBeenCalledWith(
            expect.objectContaining({ ids: [FIXTURE_ROWS.moyle1945.slug] })
        );
    });

    it("does not open on unrelated keys", async () => {
        renderWitness();
        const cards = await awaitCards(5);
        cards[0].focus();
        fireEvent.keyDown(cards[0], { key: "Tab" });
        fireEvent.keyDown(cards[0], { key: "a" });
        expect(mockSetPopUp).not.toHaveBeenCalled();
    });

    it("still opens on a plain click (mouse path unaffected by the keyboard fix)", async () => {
        renderWitness();
        const cards = await awaitCards(5);
        fireEvent.click(cards[0]);
        expect(mockSetPopUp).toHaveBeenCalledTimes(1);
    });
});

// Task 14: the breadcrumb dropdown is a navigation menu (links to other
// witness pages), not a listbox (value selection) — role/aria-haspopup are
// corrected to match. A page-lifetime global keydown handler used to call
// window.history.back() on Escape with no awareness of this dropdown's own
// Escape handling, double-firing against it and risking an off-site
// navigation for anyone who arrived via a direct link. That handler is
// deleted; the dropdown's own Escape handling is now the only Escape path.
describe("breadcrumb dropdown", () => {
    // Dev's shared Breadcrumb.Dropdown (frontend/webapp/src/views/_Common/Breadcrumb) --
    // which superseded this file's own hand-rolled nav+dropdown -- uses aria-haspopup +
    // aria-expanded on the trigger button and a plain `.bc-dropdown` content panel, not a
    // role="menu"/"menuitem" pattern. Its own open/close/Escape/outside-click machinery has
    // its own test coverage (Breadcrumb.test.jsx); these tests check only what is specific
    // to using it here -- that opening it does not regress into the deleted global
    // Escape-navigates-back handler.
    it("closes on Escape without navigating away", async () => {
        const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
        renderWitness("/history/witnesses/david-whitmer");
        const trigger = await screen.findByRole("button", { name: /David Whitmer/ });
        // fireEvent.click, not userEvent.click: Breadcrumb.test.jsx's own working Escape
        // coverage uses fireEvent -- userEvent.click's effect-flush timing left the
        // dropdown's keydown listener unattached when Escape fired immediately after.
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        fireEvent.keyDown(document, { key: "Escape" });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(back).not.toHaveBeenCalled();
        back.mockRestore();
    });

    it("exposes other witnesses as navigable links", async () => {
        renderWitness("/history/witnesses/david-whitmer");
        userEvent.click(await screen.findByRole("button", { name: /David Whitmer/ }));
        expect(document.querySelectorAll(".bc-dropdown .witness-option").length).toBeGreaterThan(15);
    });

    it("returns focus to the trigger button when Escape closes the menu", async () => {
        renderWitness("/history/witnesses/david-whitmer");
        const trigger = await screen.findByRole("button", { name: /David Whitmer/ });
        fireEvent.click(trigger);
        // fireEvent.click, unlike a real browser click (or userEvent.click), does not itself
        // move focus -- simulate the browser's default click-focuses-the-target behavior
        // explicitly, since that is the actual precondition this test means to check
        // ("focus RETURNS", i.e. stays put through the close, not that it moves there).
        trigger.focus();
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        fireEvent.keyDown(document, { key: "Escape" });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(document.activeElement).toBe(trigger);
    });

    it("does not call history.back on Escape when the menu is closed", async () => {
        // The deleted global handler fired for the page's whole lifetime,
        // independent of the dropdown's open state. Confirm Escape is inert
        // with the menu never opened at all.
        const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
        renderWitness("/history/witnesses/david-whitmer");
        await screen.findByRole("button", { name: /David Whitmer/ });
        userEvent.type(document.body, "{esc}", { skipClick: true });
        expect(back).not.toHaveBeenCalled();
        back.mockRestore();
    });
});

// Task 15 (D7, D8, D9): index-page tests — every describe block above renders
// Witnesses() through a witness slug and exercises SingleWitness. These
// render "/history/witnesses" with no slug, which is the branch that returns
// the index markup (three group blocks) at the bottom of Witnesses.js.
//
// The comparator-mutation regression test (does the sort copy `data` instead
// of reordering it in place?) lives in its own file,
// Witnesses.index-mutation.test.js, not here — its correctness depends on
// `data` being in pristine, source-declared order the first time it's read,
// and Jest's per-file module isolation makes that structural rather than a
// matter of this describe block's test order. See that file's header comment
// for the full reasoning and the empirical before/after verification.
describe("witness index", () => {
    it("has no empty section heading", async () => {
        renderWitness("/history/witnesses");
        // Wait for the page to settle (index render is synchronous, but this
        // keeps the assertion after any pending effects from prior tests).
        await screen.findByText("Three Witnesses");
        expect(screen.queryByRole("heading", { name: "Witness Statements" })).toBeNull();
    });

    it("does not invent an age from a placeholder birthday", async () => {
        renderWitness("/history/witnesses");
        // Hiram Page's `data` birthday is the bare placeholder "1800" — no
        // confident "Age N" chip should be rendered for him.
        const page = (await screen.findByText("Hiram Page")).closest(".witness");
        expect(page.textContent).not.toMatch(/Age \d/);
    });

    // Self-review point #3: grepping `data` directly (see the task report)
    // turned up a FOURTH placeholder birthday the plan's prose omits — Josiah
    // Stoal is also "1771", a bare year, alongside Hiram Page, Willard Chase,
    // and the Hussey/Vandruver pair. Pin all four rather than trusting the
    // plan's list, since `preciseAge` is length-based, not name-based, and a
    // name-based test would have missed this.
    it.each([
        ["Hiram Page"],
        ["Willard Chase"],
        ["Josiah Stoal"],
        ["William T. Hussey and Azel Vandruver"],
    ])("does not invent an age for %s (bare-year placeholder birthday)", async (name) => {
        renderWitness("/history/witnesses");
        const card = (await screen.findByText(name)).closest(".witness");
        expect(card.textContent).not.toMatch(/Age \d/);
    });

    it("shows real ages where the birthday is precise", async () => {
        renderWitness("/history/witnesses");
        const whitmer = (await screen.findByText("David Whitmer")).closest(".witness");
        expect(whitmer.textContent).toMatch(/Age 24/);
    });

    it("spells possession correctly", async () => {
        renderWitness("/history/witnesses");
        expect(await screen.findByText(/while in possession of the plates/)).toBeInTheDocument();
        expect(screen.queryByText(/posession/)).toBeNull();
    });
});
