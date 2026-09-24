import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import PersonBody, { PersonChooser } from "../PersonBody";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({})),
  assetUrl: "https://media.bookofmormon.online",
}));

const NOAH = {
  slug: "noah2",
  name: "Noah2",
  title: "Wicked king of the Nephites",
  description: "King Noah taxed his people one fifth of all they possessed.",
  index: [],
  relations: [],
  xrels: [],
};

// Minimal fixture — the body only needs appController to hand to
// renderPersonPlaceHTML, which uses it for scripture-link click handling.
const fixture = {
  states: { popUp: { open: false, type: null, ids: [], activeId: null } },
  preLoad: {},
  popUpData: {},
  functions: { setPopUp: jest.fn(), closePopUp: jest.fn() },
};

const wrap = (ui) =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AppControllerProvider>,
  );

describe("PersonBody", () => {
  test("renders the person's name, title and description from props alone", () => {
    wrap(<PersonBody data={NOAH} setPopUpRef={() => {}} PopUpRef={null} onEntityClick={() => {}} />);
    // processName superscripts the disambiguator digit, so the heading reads "Noah²".
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Noah");
    expect(screen.getByText(/Wicked king/)).toBeInTheDocument();
    expect(screen.getByText(/taxed his people/)).toBeInTheDocument();
  });

  test("renders no modal chrome — no popUp card, no close button", () => {
    const { container } = wrap(
      <PersonBody data={NOAH} setPopUpRef={() => {}} PopUpRef={null} onEntityClick={() => {}} />,
    );
    expect(container.querySelector("#popUp")).toBeNull();
    expect(container.querySelector(".close")).toBeNull();
  });

  test("renders nothing rather than crashing on missing data", () => {
    const { container } = wrap(
      <PersonBody data={null} setPopUpRef={() => {}} PopUpRef={null} onEntityClick={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("chooser lists each candidate and reports the clicked slug", () => {
    const onEntityClick = jest.fn();
    wrap(
      <PersonChooser
        requested="noah"
        candidates={[
          { slug: "noah1", name: "Noah1", title: "Son of Lamech" },
          { slug: "noah2", name: "Noah2", title: "Wicked king" },
        ]}
        onEntityClick={onEntityClick}
      />,
    );
    expect(screen.getByText(/Son of Lamech/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Wicked king/));
    expect(onEntityClick).toHaveBeenCalledWith("noah2");
  });

  test("chooser with no candidates shows the requested name as an empty state", () => {
    const { container } = wrap(
      <PersonChooser requested="king-noah" candidates={[]} onEntityClick={() => {}} />,
    );
    expect(container.querySelector(".emptyState")).toBeInTheDocument();
  });
});
