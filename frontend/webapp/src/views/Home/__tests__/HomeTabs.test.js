import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

jest.mock("src/models/featureFlags", () => ({ isMessengerEnabled: jest.fn(() => true) }));
jest.mock("src/models/Utils", () => ({ label: (k) => k }));

import { isMessengerEnabled } from "src/models/featureFlags";
import HomeTabs, { activeTabFor } from "../HomeTabs";

const renderAt = (path) =>
  render(<MemoryRouter initialEntries={[path]}><HomeTabs /></MemoryRouter>);

describe("HomeTabs", () => {
  beforeEach(() => isMessengerEnabled.mockReturnValue(true));

  test("shows all three tabs when messenger on", () => {
    renderAt("/home");
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("menu_community")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  test("hides Community tab when messenger off", () => {
    isMessengerEnabled.mockReturnValue(false);
    renderAt("/home");
    expect(screen.queryByText("menu_community")).not.toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  test("marks the active tab from the URL", () => {
    renderAt("/home/community");
    expect(screen.getByText("menu_community").closest("a")).toHaveClass("active");
    expect(screen.getByText("Explore").closest("a")).not.toHaveClass("active");
  });

  test("Explore is active on bare /home", () => {
    renderAt("/home");
    expect(screen.getByText("Explore").closest("a")).toHaveClass("active");
  });
});

describe("activeTabFor", () => {
  test("deep user path → user", () => expect(activeTabFor("/home/user/history")).toBe("user"));
  test("deep community path → community", () => expect(activeTabFor("/home/community/abc/5")).toBe("community"));
  test("bare /home → explore", () => expect(activeTabFor("/home")).toBe("explore"));
});
