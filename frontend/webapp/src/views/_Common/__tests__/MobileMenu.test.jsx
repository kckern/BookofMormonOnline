import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import MobileMenu from "../MobileMenu";

// MobileMenu only needs the menu list and the label helper; stub the heavy
// Sidebar module so the test exercises the link targets, not the sidebar.
vi.mock("../Sidebar", () => ({
  loadMenu: () => [
    { slug: "home", jsx: <span>home</span> },
    { slug: "contents", jsx: <span>Contents</span> },
    { slug: "read", jsx: <span>Read</span> },
    { slug: "timeline", jsx: <span>Timeline</span> },
  ],
  MenuItem: ({ labelKey }) => <span>{labelKey}</span>,
}));
vi.mock("src/models/Utils", () => ({ label: (k) => k }));

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/mobilemenu"]}>
      <Routes>
        <Route path="/mobilemenu" element={<MobileMenu />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

test("menu links are absolute, so they land on their own page, not /mobilemenu/<slug>", async () => {
  renderMenu();
  await userEvent.click(screen.getByText("Read"));
  expect(screen.getByTestId("where").textContent).toBe("/read");
});

test("search and other entries also resolve from the site root", async () => {
  renderMenu();
  await userEvent.click(screen.getByText("menu_search"));
  expect(screen.getByTestId("where").textContent).toBe("/search");
});
