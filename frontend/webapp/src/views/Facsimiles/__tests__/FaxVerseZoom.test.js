import React from "react";
import { render, fireEvent } from "@testing-library/react";
import FaxVerseZoom from "../FaxVerseZoom";

describe("FaxVerseZoom", () => {
  test("reports the crop image's natural size on load", () => {
    const onNaturalSize = jest.fn();
    render(<FaxVerseZoom src="https://media.example/crop.jpg" onNaturalSize={onNaturalSize} />);

    const img = document.querySelector(".faxVerseZoom img");
    // jsdom never actually loads images, so naturalWidth/Height stay 0 —
    // define them, then fire the load event the component listens for.
    Object.defineProperty(img, "naturalWidth", { value: 900, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 1600, configurable: true });
    fireEvent.load(img);

    expect(onNaturalSize).toHaveBeenCalledWith({ w: 900, h: 1600 });
  });

  test("does not throw when onNaturalSize is omitted", () => {
    render(<FaxVerseZoom src="https://media.example/crop.jpg" />);
    const img = document.querySelector(".faxVerseZoom img");
    Object.defineProperty(img, "naturalWidth", { value: 10, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 20, configurable: true });
    expect(() => fireEvent.load(img)).not.toThrow();
  });
});
