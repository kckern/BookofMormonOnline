import React from "react";
import { render, fireEvent } from "@testing-library/react";
import TileImage from "../TileImage";
import { variantUrl } from "../mediaVariants";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
}));

const KEY = "REACT_APP_MEDIA_VARIANTS";

describe("TileImage", () => {
  const saved = process.env[KEY];
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  test("variants disabled: original src, no srcset, lazy + async decode", () => {
    delete process.env[KEY];
    const { container } = render(<TileImage path="people/nephi1" alt="Nephi" />);
    const img = container.querySelector("img");
    expect(img.getAttribute("src")).toBe("https://media.test/people/nephi1");
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.hasAttribute("fetchpriority")).toBe(false);
    expect(img.getAttribute("alt")).toBe("Nephi");
    expect(img.classList.contains("tileImage")).toBe(true);
  });

  test("widths=[] (no variants exist, e.g. art): no srcset even with variants on; onError reaches the caller", () => {
    process.env[KEY] = "1";
    const onError = vi.fn();
    const { container } = render(<TileImage path="art/3294" widths={[]} alt="" onError={onError} />);
    const img = container.querySelector("img");
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img.hasAttribute("sizes")).toBe(false);
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("eager: loading=eager and fetchpriority=high", () => {
    const { container } = render(<TileImage path="people/nephi1" alt="" eager />);
    const img = container.querySelector("img");
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });

  test("variants enabled: srcset lists each width's webp variant", () => {
    process.env[KEY] = "1";
    const { container } = render(<TileImage path="people/nephi1" alt="" sizes="(max-width: 900px) 100vw, 33vw" />);
    const img = container.querySelector("img");
    const srcset = img.getAttribute("srcset");
    expect(srcset).toContain("variants/256/people/nephi1.webp 256w");
    expect(srcset).toContain("variants/640/people/nephi1.webp 640w");
    expect(img.getAttribute("sizes")).toBe("(max-width: 900px) 100vw, 33vw");
    expect(img.getAttribute("src")).toBe("https://media.test/people/nephi1");
  });

  test("onError drops srcset and falls back to the original", () => {
    process.env[KEY] = "1";
    const { container } = render(<TileImage path="people/nephi1" alt="" />);
    const img = container.querySelector("img");
    expect(img.hasAttribute("srcset")).toBe(true);
    fireEvent.error(img);
    const after = container.querySelector("img");
    expect(after.hasAttribute("srcset")).toBe(false);
    expect(after.getAttribute("src")).toBe("https://media.test/people/nephi1");
  });

  test("aspect sets an aspect-ratio box and className is appended", () => {
    const { container } = render(<TileImage path="art/12" alt="" aspect="4 / 3" className="artHero" />);
    const img = container.querySelector("img");
    expect(img.style.aspectRatio).toBe("4 / 3");
    expect(img.className).toBe("tileImage artHero");
  });

  // Variants exist only for people/places/matters (Task 11). Archive media
  // (fax, history, witnesses, art) must not request a 404ing srcset first.
  test("variants enabled but no variant family for the path: plain src, onError fires once", () => {
    process.env[KEY] = "1";
    const onError = vi.fn();
    const { container } = render(<TileImage path="fax/covers/1830" alt="" onError={onError} />);
    const img = container.querySelector("img");
    expect(img.hasAttribute("srcset")).toBe(false);
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("an absolute URL is used verbatim (render-host crops), never variant-mapped", () => {
    process.env[KEY] = "1";
    const { container } = render(<TileImage path="http://render.test/fax/render/1830/crop/w800/x.jpg" alt="" />);
    const img = container.querySelector("img");
    expect(img.getAttribute("src")).toBe("http://render.test/fax/render/1830/crop/w800/x.jpg");
    expect(img.hasAttribute("srcset")).toBe(false);
  });

  test("variantUrl shape", () => {
    expect(variantUrl("people/nephi1", 256)).toBe("https://media.test/variants/256/people/nephi1.webp");
  });

  test("widths={[]} (no variants for this asset family): plain src, and onError reaches the caller", () => {
    process.env[KEY] = "1";
    const onError = vi.fn();
    const { container } = render(<TileImage path="source/cover/193" widths={[]} onError={onError} />);
    const img = container.querySelector("img");
    expect(img.hasAttribute("srcset")).toBe(false);
    fireEvent.error(img);
    expect(onError).toHaveBeenCalled();
  });
});
