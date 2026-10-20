/* eslint-disable testing-library/no-node-access */
// Blind audit R7 witness-D5: the Home witness tile's eyebrow lands on
// /history/witnesses, which read as an unresolved label ("Title Witnesses")
// under the bare site name.
import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(() => new Promise(() => {})), assetUrl: "https://media.test" }));
// the English labels row for title_witnesses is a placeholder, "Title Witnesses"
vi.mock("../../../models/Utils", () => ({
  label: (k) => (k === "home_title" ? "Book of Mormon Online" : k === "title_witnesses" ? "Title Witnesses" : k),
}));
vi.mock("src/contexts/AppControllerContext", () => ({ useAppController: () => ({}) }));
vi.mock("../HistoryBreadcrumb", () => ({ __esModule: true, default: () => null }));
vi.mock("../WitnessLifeHeatmap", () => ({ __esModule: true, default: () => null }));

import Witnesses from "../Witnesses";

test("the witnesses index has a real heading and its own tab title", () => {
  render(
    <MemoryRouter initialEntries={["/history/witnesses"]}>
      <Routes><Route path="/history/witnesses" element={<Witnesses />} /></Routes>
    </MemoryRouter>
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The Witnesses");
  expect(screen.queryByText(/title_witnesses|Title Witnesses/)).toBeNull();
  expect(document.title).toBe("The Witnesses | Book of Mormon Online");
});
