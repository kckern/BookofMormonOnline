import "@testing-library/jest-dom";
import React from "react";
import { render } from "@testing-library/react";
import ExpandableText from "../ExpandableText";

// Systemic A1 (R6 matterProfile, earlier people/placeProfile): on touch a 14px
// hit padding, or an inline ref chip taller than 1lh, put the CSS
// "N × 1lh (+ pad)" edge through the middle of a line. The fade clamp now
// snaps its max-height DOWN to the bottom of the last whole line box that fits
// under the CSS bound, measured from the real line rects.

const rect = (top, bottom, left = 0, right = 300) => ({ top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON() {} });

let realRange, gcs, gbcr;
beforeEach(() => {
  realRange = document.createRange;
  gcs = window.getComputedStyle;
  gbcr = HTMLElement.prototype.getBoundingClientRect;
  // line boxes: 14px touch pad on top, 20px lines, line 3 holds a 26px chip
  const lines = [rect(14, 34), rect(34, 54), rect(54, 80), rect(80, 100), rect(100, 120), rect(120, 140)];
  document.createRange = () => ({ selectNodeContents() {}, getClientRects: () => lines });
  window.getComputedStyle = (el) => {
    const cs = gcs(el);
    if (el.classList?.contains("clampLines")) {
      return new Proxy(cs, { get: (t, p) => (p === "maxHeight" ? "114px" : p === "lineHeight" ? "20px" : t[p]) });
    }
    return cs;
  };
  HTMLElement.prototype.getBoundingClientRect = function () {
    return this.classList.contains("clampLines") ? rect(0, 114) : rect(0, 10);
  };
});
afterEach(() => {
  document.createRange = realRange;
  window.getComputedStyle = gcs;
  HTMLElement.prototype.getBoundingClientRect = gbcr;
});

test("the fade clamp ends on a whole line (100px), not the CSS 114px that slices line 5", () => {
  const { container } = render(
    <ExpandableText lines={5} fade>
      <span>long prose with a chip</span>
    </ExpandableText>,
  );
  expect(container.querySelector(".clampLines").style.maxHeight).toBe("100px");
});
