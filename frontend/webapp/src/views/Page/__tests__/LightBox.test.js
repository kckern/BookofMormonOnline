import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LightBox } from "../Narration";
import { useNarration } from "src/contexts/NarrationContext";

vi.mock("src/contexts/NarrationContext", () => ({
  __esModule: true,
  useNarration: vi.fn(),
  NarrationProvider: ({ children }) => children,
}));
vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({})),
  assetUrl: "https://media.bookofmormon.online",
}));

// Pins the simple-react-lightbox -> yet-another-react-lightbox port. The old
// library discovered images by scraping a hidden div and recovered the current
// id by regex from a slide's src; these assertions exist so that hack cannot
// creep back in and so the slide list stays derived from panelImageIds.
const controller = (over = {}) => ({
  states: { activeImageId: 1002, panelImageIds: [1001, 1002, 1003], ...(over.states || {}) },
  supplement: { image: { 1001: { title: "First" }, 1002: { title: "Second" }, 1003: { title: "Third" } } },
  functions: { setActiveImageId: vi.fn(), preLoadSupplement: vi.fn() },
  ...over,
});

describe("LightBox (yet-another-react-lightbox port)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test("renders a slide per panel image, sourced from assetUrl/art/<id>", () => {
    useNarration.mockReturnValue(controller());
    render(<LightBox setOpenLightBox={() => {}} />);
    const imgs = [...document.querySelectorAll(".yarl__slide img")];
    expect(imgs.length).toBeGreaterThan(0);
    const srcs = imgs.map((i) => i.getAttribute("src"));
    expect(srcs.some((s) => s && s.endsWith("/art/1002"))).toBe(true);
  });

  test("opens on the active image rather than the first", () => {
    useNarration.mockReturnValue(controller());
    render(<LightBox setOpenLightBox={() => {}} />);
    // yarl marks the current slide; the active id (1002) is the second entry.
    const current = document.querySelector(".yarl__slide_current img");
    expect(current?.getAttribute("src")).toMatch(/\/art\/1002$/);
  });

  test("closing reports back so the caller can unmount it", async () => {
    const setOpenLightBox = vi.fn();
    useNarration.mockReturnValue(controller());
    render(<LightBox setOpenLightBox={setOpenLightBox} />);
    fireEvent.click(screen.getByLabelText(/close/i));
    // yet-another-react-lightbox runs its close through a transition, so the
    // callback lands after the click rather than synchronously with it.
    await waitFor(() => expect(setOpenLightBox).toHaveBeenCalledWith(false));
  });

  test("renders nothing without an active image", () => {
    useNarration.mockReturnValue(controller({ states: { activeImageId: null, panelImageIds: [] } }));
    const { container } = render(<LightBox setOpenLightBox={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector(".yarl__root")).toBeNull();
  });

  test("falls back to the active image when there is no panel list", () => {
    useNarration.mockReturnValue(controller({ states: { activeImageId: 1007, panelImageIds: [] } }));
    render(<LightBox setOpenLightBox={() => {}} />);
    const imgs = [...document.querySelectorAll(".yarl__slide img")].map((i) => i.getAttribute("src"));
    expect(imgs.some((s) => s && s.endsWith("/art/1007"))).toBe(true);
  });
});
