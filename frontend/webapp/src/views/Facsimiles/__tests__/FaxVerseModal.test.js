import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FaxVerseModal from "../FaxVerseModal";

const verse = {
  verse_id: 100, ref: "Alma 5:1", text: "verse text here",
  person_slug: "alma-the-younger", voice: "alma",
  boxes: [{ x: 100, y: 200, w: 300, h: 80 }],
  pageAssetUrl: "https://media.example/fax/pages/1830/010.jpg",
};

describe("FaxVerseModal", () => {
  test("renders nothing when verse is null", () => {
    const { container } = render(<FaxVerseModal verse={null} pageScale={700} onClose={() => {}} />);
    expect(container.querySelector(".faxVerseModal")).toBeNull();
  });

  test("renders reference, verse text, and speaker avatar", () => {
    render(<FaxVerseModal verse={verse} pageScale={700} onClose={() => {}} />);
    expect(screen.getByText("Alma 5:1")).toBeTruthy();
    expect(screen.getByText("verse text here")).toBeTruthy();
    const avatar = document.querySelector(".faxVerseModal-avatar");
    expect(avatar.getAttribute("src")).toContain("/people/alma-the-younger");
  });

  test("with a version -> native-res render-crop zoom box", () => {
    render(<FaxVerseModal verse={verse} version="2013" pageScale={700} onClose={() => {}} />);
    const zoom = document.querySelector(".faxVerseModal-cutout .faxVerseZoom");
    expect(zoom).toBeTruthy();
    const src = zoom.querySelector("img").getAttribute("src");
    expect(src).toContain("/fax/render/2013/crop/wfull/ids/100.jpg"); // native res
  });

  test("no version -> CSS crop of the page asset (fallback)", () => {
    render(<FaxVerseModal verse={verse} version={null} pageScale={700} onClose={() => {}} />);
    const img = document.querySelector(".faxVerseModal-cutout img");
    expect(img.getAttribute("src")).toBe(verse.pageAssetUrl);
    expect(document.querySelector(".faxVerseZoom")).toBeNull();
  });

  test("centers the card on the optical-center anchorX", () => {
    render(<FaxVerseModal verse={verse} version="1830" anchorX={818} pageScale={700} onClose={() => {}} />);
    const card = document.querySelector(".faxVerseModal-card");
    expect(card.style.left).toBe("818px");
    expect(card.style.transform).toContain("-50%");
  });

  test("prev/next buttons and arrow keys step verses", () => {
    const onPrev = jest.fn(), onNext = jest.fn();
    render(<FaxVerseModal verse={verse} version="1830" pageScale={700} onPrev={onPrev} onNext={onNext} onClose={() => {}} />);
    fireEvent.click(document.querySelector(".faxVerseModal-nav.next"));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector(".faxVerseModal-nav.prev"));
    expect(onPrev).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNext).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onPrev).toHaveBeenCalledTimes(2);
  });

  test("the reference is a link that calls onRead", () => {
    const onRead = jest.fn();
    render(<FaxVerseModal verse={verse} version="1830" pageScale={700} onRead={onRead} onClose={() => {}} />);
    expect(document.querySelector(".faxVerseModal-read")).toBeNull(); // no separate button
    fireEvent.click(document.querySelector(".faxVerseModal-ref.as-link"));
    expect(onRead).toHaveBeenCalledWith(verse);
  });

  test("backdrop click and Escape both call onClose", () => {
    const onClose = jest.fn();
    render(<FaxVerseModal verse={verse} version="1830" pageScale={700} onClose={onClose} />);
    fireEvent.click(document.querySelector(".faxVerseModal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  describe("crop box height", () => {
    let rectSpy;
    beforeEach(() => {
      // Give every element a fixed 560px width so the height useLayoutEffect
      // (width -> px height via the aspect) actually runs under jsdom.
      rectSpy = jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockReturnValue({ width: 560, height: 0, top: 0, left: 0, right: 560, bottom: 0, x: 0, y: 0, toJSON: () => {} });
    });
    afterEach(() => rectSpy.mockRestore());

    const crossPageVerse = {
      verse_id: 108, ref: "Jacob 1:8", text: "verse text",
      boxes: [{ x: 100, y: 600, w: 300, h: 80 }], // only ONE page's fragment (1 line)
    };

    test("pre-load reserve uses the per-page box estimate", () => {
      render(<FaxVerseModal verse={crossPageVerse} version="1842" pageScale={700} onClose={() => {}} />);
      const cutout = document.querySelector(".faxVerseModal-cutout.landscape");
      // 560 * (80 / 300) = 149.33 -> 149
      expect(cutout.style.height).toBe("149px");
    });

    test("corrects to the loaded crop's true aspect (taller)", () => {
      render(<FaxVerseModal verse={crossPageVerse} version="1842" pageScale={700} onClose={() => {}} />);
      const img = document.querySelector(".faxVerseZoom img");
      Object.defineProperty(img, "naturalWidth", { value: 900, configurable: true });
      Object.defineProperty(img, "naturalHeight", { value: 1600, configurable: true });
      fireEvent.load(img);

      const cutout = document.querySelector(".faxVerseModal-cutout.landscape");
      // 560 * (1600 / 900) = 995.55 -> 996
      expect(cutout.style.height).toBe("996px");
    });

    test("resets the loaded aspect when the verse changes", () => {
      const { rerender } = render(<FaxVerseModal verse={crossPageVerse} version="1842" pageScale={700} onClose={() => {}} />);
      const img = document.querySelector(".faxVerseZoom img");
      Object.defineProperty(img, "naturalWidth", { value: 900, configurable: true });
      Object.defineProperty(img, "naturalHeight", { value: 1600, configurable: true });
      fireEvent.load(img);

      const nextVerse = { verse_id: 109, ref: "Jacob 1:9", text: "next", boxes: [{ x: 0, y: 0, w: 400, h: 300 }] };
      rerender(<FaxVerseModal verse={nextVerse} version="1842" pageScale={700} onClose={() => {}} />);

      const cutout = document.querySelector(".faxVerseModal-cutout.landscape");
      // stale 900/1600 must NOT carry over; new estimate 560 * (300 / 400) = 420
      expect(cutout.style.height).toBe("420px");
    });
  });
});
