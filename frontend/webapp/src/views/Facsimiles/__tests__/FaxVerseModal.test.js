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
    expect(src).toContain("/fax/render/2013/crop/full/ids/100.jpg"); // full res
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

  test("Read button calls onRead with the verse", () => {
    const onRead = jest.fn();
    render(<FaxVerseModal verse={verse} version="1830" pageScale={700} onRead={onRead} onClose={() => {}} />);
    fireEvent.click(document.querySelector(".faxVerseModal-read"));
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
});
