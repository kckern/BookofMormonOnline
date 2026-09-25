import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import PlaceBody from "../PlaceBody";
import MatterBody from "../MatterBody";
import HistoryBody, { historyMeta } from "../HistoryBody";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({})),
  assetUrl: "https://media.bookofmormon.online",
}));

const PLACE = {
  slug: "zarahemla",
  name: "Zarahemla",
  info: "City and land",
  description: "The chief city of the Nephites for much of their history.",
  index: [],
  maps: [],
  xrels: [],
};
const MATTER = {
  slug: "faith",
  name: "Faith",
  subtitle: "A principle of action",
  description: "Faith is a principle of action and power.",
  index: [],
  xrels: [],
};
const DOC = {
  slug: "1830-03-26-palmyra-freeman",
  document: "Golden Bible notice",
  source: "Palmyra Freeman",
  date: "1830-03-26",
  transcript: "The greatest piece of superstition that has ever come within our knowledge.",
};

const fixture = {
  states: { popUp: { open: false, type: null, ids: [], activeId: null } },
  preLoad: {},
  popUpData: {},
  functions: { setPopUp: vi.fn(), closePopUp: vi.fn() },
};

const wrap = (ui) =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AppControllerProvider>,
  );
const noop = () => {};

describe("entity bodies render from props with no modal chrome", () => {
  test("PlaceBody", () => {
    const { container } = wrap(
      <PlaceBody data={PLACE} setPopUpRef={noop} onMapClick={noop} />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Zarahemla");
    expect(screen.getByText(/chief city/)).toBeInTheDocument();
    expect(container.querySelector("#popUp")).toBeNull();
  });

  test("MatterBody", () => {
    const { container } = wrap(<MatterBody data={MATTER} setPopUpRef={noop} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Faith");
    expect(screen.getByText(/principle of action and power/)).toBeInTheDocument();
    expect(container.querySelector("#popUp")).toBeNull();
  });

  test("HistoryBody", () => {
    const { container } = wrap(<HistoryBody data={DOC} />);
    expect(screen.getByText(/Golden Bible notice/)).toBeInTheDocument();
    expect(screen.getByText(/greatest piece of superstition/)).toBeInTheDocument();
    expect(container.querySelector("#popUp")).toBeNull();
  });

  test("historyMeta builds the meta line the modal header also needs", () => {
    expect(historyMeta(DOC)).toContain("Palmyra Freeman");
    expect(historyMeta(null)).toEqual([]);
  });

  test("bodies render nothing rather than crashing on missing data", () => {
    expect(wrap(<PlaceBody data={null} setPopUpRef={noop} onMapClick={noop} />).container).toBeEmptyDOMElement();
    expect(wrap(<MatterBody data={null} setPopUpRef={noop} />).container).toBeEmptyDOMElement();
    expect(wrap(<HistoryBody data={null} />).container).toBeEmptyDOMElement();
  });
});
