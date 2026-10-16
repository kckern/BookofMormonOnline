vi.mock("src/models/BoMOnlineAPI.js", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
}));
vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { GutterAvatar } from "../ScriptureExcerpt";

// The speaker portrait beside a scripture block renders ~3.5rem wide but used to
// fetch the 150-650KB original. It takes the 256px variant, falling back to the
// original once if the variant is missing, then hiding.
describe("GutterAvatar", () => {
  const KEY = "REACT_APP_MEDIA_VARIANTS";
  let saved;
  beforeEach(() => { saved = process.env[KEY]; process.env[KEY] = "1"; });
  afterEach(() => { if (saved === undefined) delete process.env[KEY]; else process.env[KEY] = saved; });

  test("uses the 256px variant, lazily", () => {
    const { container } = render(<GutterAvatar slug="nephi1" voice="Nephi" />);
    const img = container.querySelector("img");
    expect(img.getAttribute("srcset")).toBe("https://media.test/variants/256/people/nephi1.webp 256w");
    expect(img.getAttribute("loading")).toBe("lazy");
    // decorative: the voice name is rendered beside it (audit art-G3)
    expect(img.getAttribute("alt")).toBe("");
  });

  test("a missing variant falls back to the original once, then hides", () => {
    const { container } = render(<GutterAvatar slug="nephi1" voice="Nephi" />);
    const img = container.querySelector("img");
    fireEvent.error(img);
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img.getAttribute("src")).toBe("https://media.test/people/nephi1");
    fireEvent.error(img);
    expect(img.style.visibility).toBe("hidden");
  });

  test("no slug renders nothing", () => {
    const { container } = render(<GutterAvatar slug={null} voice="Narrator" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
