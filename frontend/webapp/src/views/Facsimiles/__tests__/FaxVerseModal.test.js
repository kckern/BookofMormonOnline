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

  test("cutout image points at the page asset", () => {
    render(<FaxVerseModal verse={verse} pageScale={700} onClose={() => {}} />);
    const img = document.querySelector(".faxVerseModal-cutout img");
    expect(img.getAttribute("src")).toBe(verse.pageAssetUrl);
  });

  test("backdrop click and Escape both call onClose", () => {
    const onClose = jest.fn();
    render(<FaxVerseModal verse={verse} pageScale={700} onClose={onClose} />);
    fireEvent.click(document.querySelector(".faxVerseModal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
