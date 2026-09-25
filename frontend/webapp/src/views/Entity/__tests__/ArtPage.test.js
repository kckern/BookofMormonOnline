import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { Route, Routes, MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import ArtPage from "../ArtPage";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.bookofmormon.online",
}));

const ART = {
  id: 1000,
  title: "Lehi's Dream",
  artist: "Minerva Teichert",
  link: "https://example.org/source",
  width: 1200,
  height: 800,
  location: { slug: "lehites/3" },
};

const fixture = {
  states: { popUp: { open: false, type: null, ids: [], activeId: null } },
  preLoad: {},
  popUpData: {},
  functions: { setPopUp: vi.fn(), closePopUp: vi.fn(), requestImageActivation: vi.fn() },
};

// react-router 7 owns its history, so these tests can no longer spy on a
// history object. useNavigationType() reports PUSH vs REPLACE directly, which is
// what the old `expect(history.replace).toHaveBeenCalledWith(...)` was really
// checking — and it also verifies the resulting URL rather than the call.
function NavProbe({ sink }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  sink.location = location;
  if (sink.lastKey !== location.key) {
    sink.lastKey = location.key;
    sink.types.push(navigationType);
  }
  return null;
}

const renderArt = (path, routePath) => {
  const sink = { lastKey: null, types: [] };
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={<ArtPage />} />
        </Routes>
        <NavProbe sink={sink} />
      </MemoryRouter>
    </AppControllerProvider>,
  );
  return {
    get location() { return sink.location; },
    get types() { return sink.types; },
  };
};

describe("ArtPage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test("renders the artwork, title and artist", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: ART } });
    renderArt("/art/1000", "/art/:imageId");
    await waitFor(() => expect(screen.getByText(/Lehi's Dream/)).toBeInTheDocument());
    expect(screen.getByText(/Minerva Teichert/)).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://media.bookofmormon.online/art/1000",
    );
  });

  test("links to the passage the art illustrates", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: ART } });
    renderArt("/art/1000", "/art/:imageId");
    await waitFor(() => expect(screen.getByText(/Lehi's Dream/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /passage/i })).toHaveAttribute("href", "/lehites/3");
  });

  test("does not activate the in-chapter image viewer", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: ART } });
    renderArt("/art/1000", "/art/:imageId");
    await waitFor(() => expect(screen.getByText(/Lehi's Dream/)).toBeInTheDocument());
    expect(fixture.functions.requestImageActivation).not.toHaveBeenCalled();
  });

  test("/image/<id> canonicalizes to /art/<id>", async () => {
    // Pre-existing contract, asserted by e2e/deeplink-image.spec.js and matching
    // the canonical SSR path (frontend/next/app/art/[id]).
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: ART } });
    const history = renderArt("/image/1000", "/image/:imageId");
    await waitFor(() => expect(history.location.pathname).toBe("/art/1000"));
    expect(history.types).toContain("REPLACE");
  });

  test("unknown id renders not-found rather than crashing", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 999999: null } });
    renderArt("/art/999999", "/art/:imageId");
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });

  test("renders without a location, which older records lack", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: { ...ART, location: null } } });
    renderArt("/art/1000", "/art/:imageId");
    await waitFor(() => expect(screen.getByText(/Lehi's Dream/)).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /passage/i })).toBeNull();
  });
});
