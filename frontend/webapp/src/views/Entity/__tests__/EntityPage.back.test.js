import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import EntityPage from "../EntityPage";

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(), assetUrl: "https://media.bookofmormon.online" }));

const DOC = { slug: "d1", document: "Golden Bible notice", source: "Palmyra Freeman", date: "1830-03-26", transcript: "text" };
const fixture = { states: { popUp: { open: false, type: null, ids: [], activeId: null } }, preLoad: {}, popUpData: {}, functions: { setPopUp: vi.fn(), closePopUp: vi.fn() } };
const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderAt = (entries, index) =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter initialEntries={entries} initialIndex={index}>
        <Where />
        <Routes>
          <Route path="/home/discover" element={<div>discover</div>} />
          <Route path="/history" element={<div>history index</div>} />
          <Route path="/history/:slug" element={<EntityPage type="history" />} />
        </Routes>
      </MemoryRouter>
    </AppControllerProvider>,
  );

// Prod 2026-10-20: Home → tile → entity page → the "‹ Places" breadcrumb was a plain
// link to the index, so "back" dropped the reader out of Discover into /places.
describe("EntityPage back control", () => {
  beforeEach(() => { vi.clearAllMocks(); BoMOnlineAPI.mockResolvedValue({ history: { d1: DOC } }); });

  test.each(["Breadcrumb"])("arrived from inside the app: the top control steps Back to where they were", async () => {
    renderAt(["/home/discover", "/history/d1"], 1);
    await waitFor(() => expect(screen.getByText(/Golden Bible notice/)).toBeInTheDocument());
    const back = screen.getAllByRole("button", { name: /back/i })[0];
    fireEvent.click(back);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/home/discover"));
  });

  test("direct load (no in-app history): a link to the index", async () => {
    renderAt(["/history/d1"], 0);
    await waitFor(() => expect(screen.getByText(/Golden Bible notice/)).toBeInTheDocument());
    expect(screen.queryAllByRole("button", { name: /back/i })).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: /‹|❮/ })[0]).toHaveAttribute("href", "/history");
  });
});
