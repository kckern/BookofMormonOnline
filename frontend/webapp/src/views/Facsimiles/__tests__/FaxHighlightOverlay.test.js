import React from "react";
import { render } from "@testing-library/react";
import FaxHighlightOverlay from "../FaxHighlightOverlay";

describe("FaxHighlightOverlay", () => {
  test("positions each box scaled by displayedWidth / pageScale", () => {
    const boxes = [{ x: 357, y: 291, w: 288, h: 152 }];
    // displayedWidth 1400, pageScale 700 -> scale 2
    const { container } = render(
      <FaxHighlightOverlay boxes={boxes} pageScale={700} displayedWidth={1400} />
    );
    const box = container.querySelector(".faxHighlightBox");
    expect(box).toBeTruthy();
    expect(box.style.left).toBe("714px");   // 357 * 2
    expect(box.style.top).toBe("582px");    // 291 * 2
    expect(box.style.width).toBe("576px");  // 288 * 2
    expect(box.style.height).toBe("304px"); // 152 * 2
  });

  test("renders no box divs without boxes", () => {
    const { container } = render(
      <FaxHighlightOverlay boxes={[]} pageScale={700} displayedWidth={700} />
    );
    expect(container.querySelector(".faxHighlightBox")).toBeNull();
  });

  test("measure path: highlights appear after boxes arrive (mobile, no displayedWidth)", () => {
    global.ResizeObserver = class {
      constructor(cb) { this.cb = cb; }
      observe() {}
      disconnect() {}
    };
    const spy = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 700, height: 1000, top: 0, left: 0, right: 700, bottom: 1000, x: 0, y: 0, toJSON: () => {} });
    const { container, rerender } = render(<FaxHighlightOverlay boxes={[]} pageScale={700} />);
    expect(container.querySelector(".faxHighlightBox")).toBeNull(); // none yet
    rerender(<FaxHighlightOverlay boxes={[{ x: 350, y: 100, w: 100, h: 50 }]} pageScale={700} />);
    const box = container.querySelector(".faxHighlightBox");
    expect(box).toBeTruthy();          // would be null before FIX 1 (measured stayed 0)
    expect(box.style.left).toBe("350px"); // 350 * (700/700)
    spy.mockRestore();
  });
});
