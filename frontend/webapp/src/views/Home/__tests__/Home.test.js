import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";

jest.mock("../Sampler", () => () => <div>SAMPLER</div>);
jest.mock("../Community", () => () => <div>COMMUNITY</div>);
jest.mock("../../User/User", () => () => <div>USER</div>);
jest.mock("../HomeTabs", () => () => <div>TABS</div>);
jest.mock("src/models/featureFlags", () => ({ isMessengerEnabled: jest.fn(() => true) }));
jest.mock("src/models/Utils", () => ({ isMobile: jest.fn(() => false), label: (k) => k }));

import { isMessengerEnabled } from "src/models/featureFlags";
import { isMobile } from "src/models/Utils";
import Home from "../Home";

const renderAt = (path) => {
  let location;
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Home />
      <Route path="*" render={({ location: l }) => { location = l; return null; }} />
    </MemoryRouter>
  );
  return { view, getLocation: () => location };
};

beforeEach(() => {
  isMessengerEnabled.mockReturnValue(true);
  isMobile.mockReturnValue(false);
});

describe("Home shell routing", () => {
  test("/home renders Sampler", () => {
    renderAt("/home");
    expect(screen.getByText("SAMPLER")).toBeInTheDocument();
  });
  test("/home/community renders Community", () => {
    renderAt("/home/community");
    expect(screen.getByText("COMMUNITY")).toBeInTheDocument();
  });
  test("/home/community/:channelId renders Community", () => {
    renderAt("/home/community/abc123");
    expect(screen.getByText("COMMUNITY")).toBeInTheDocument();
  });
  test("/home/community/:channelId/:messageId renders Community", () => {
    renderAt("/home/community/chan/456");
    expect(screen.getByText("COMMUNITY")).toBeInTheDocument();
  });
  test("/home/user renders User", () => {
    renderAt("/home/user");
    expect(screen.getByText("USER")).toBeInTheDocument();
  });
  test("/home/user/history renders User", () => {
    renderAt("/home/user/history");
    expect(screen.getByText("USER")).toBeInTheDocument();
  });
  test("legacy /home/:channelId redirects to /home/community/:channelId", () => {
    const { getLocation } = renderAt("/home/xyz789");
    expect(getLocation().pathname).toBe("/home/community/xyz789");
  });
});

describe("Home shell tab bar visibility", () => {
  test("renders tab bar on desktop", () => {
    renderAt("/home");
    expect(screen.getByText("TABS")).toBeInTheDocument();
  });
  test("hides tab bar on mobile", () => {
    isMobile.mockReturnValue(true);
    renderAt("/home");
    expect(screen.queryByText("TABS")).not.toBeInTheDocument();
    expect(screen.getByText("SAMPLER")).toBeInTheDocument();
  });
});

describe("Home shell messenger gate", () => {
  test("/home/community redirects to /home when messenger off", () => {
    isMessengerEnabled.mockReturnValue(false);
    const { getLocation } = renderAt("/home/community");
    expect(getLocation().pathname).toBe("/home");
    expect(screen.getByText("SAMPLER")).toBeInTheDocument();
  });
  test("deep /home/community/:channelId redirects to /home when messenger off", () => {
    isMessengerEnabled.mockReturnValue(false);
    const { getLocation } = renderAt("/home/community/abc");
    expect(getLocation().pathname).toBe("/home");
  });
});
