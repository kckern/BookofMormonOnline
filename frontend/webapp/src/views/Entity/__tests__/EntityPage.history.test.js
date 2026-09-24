import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import EntityPage from "../EntityPage";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.bookofmormon.online",
}));

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
  functions: { setPopUp: jest.fn(), closePopUp: jest.fn() },
};

const renderDoc = (slug) =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter initialEntries={[`/history/${slug}`]}>
        <Route path="/history/:slug">
          <EntityPage type="history" />
        </Route>
      </MemoryRouter>
    </AppControllerProvider>,
  );

describe("EntityPage — history documents", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renders the document itself, not a redirect to the reception hub", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: { [DOC.slug]: DOC } });
    renderDoc(DOC.slug);
    await waitFor(() => expect(screen.getByText(/Golden Bible notice/)).toBeInTheDocument());
    expect(screen.getByText(/greatest piece of superstition/)).toBeInTheDocument();
  });

  test("does not open the modal", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: { [DOC.slug]: DOC } });
    renderDoc(DOC.slug);
    await waitFor(() => expect(screen.getByText(/Golden Bible notice/)).toBeInTheDocument());
    expect(fixture.functions.setPopUp).not.toHaveBeenCalled();
  });

  test("unknown slug renders not-found (history slugs have no numeric variants)", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: { nope: null } });
    renderDoc("nope");
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
