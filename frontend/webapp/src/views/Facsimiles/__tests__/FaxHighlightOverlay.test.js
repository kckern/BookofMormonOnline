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

  test("renders nothing without boxes", () => {
    const { container } = render(
      <FaxHighlightOverlay boxes={[]} pageScale={700} displayedWidth={700} />
    );
    expect(container.firstChild).toBeNull();
  });
});
