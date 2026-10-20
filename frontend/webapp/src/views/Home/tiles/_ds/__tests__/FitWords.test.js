import React from "react";
import { render } from "@testing-library/react";
import FitWords from "../FitWords";

const TEXT = "Lamanites in Shimnilom are converted to the Lord";

afterEach(() => {
  delete HTMLElement.prototype.scrollHeight;
  delete HTMLElement.prototype.clientHeight;
});

// Layout stub: the box "fits" when its text is at most `max` characters.
const stubFit = (max) => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return 20; } });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() { return this.classList?.contains("fitWords") && this.textContent.length > max ? 40 : 20; },
  });
};

test("text that fits renders whole", () => {
  stubFit(200);
  const { container } = render(<FitWords text={TEXT} />);
  expect(container.textContent).toBe(TEXT);
});

test("overflowing text is cut at a whole word and never on a function word", () => {
  stubFit(26);
  const { container } = render(<FitWords text={TEXT} />);
  const out = container.textContent;
  expect(out.endsWith("…")).toBe(true);
  expect(out.length).toBeLessThanOrEqual(26);
  const words = out.replace(/…$/, "").split(" ");
  words.forEach((w) => expect(TEXT.split(" ")).toContain(w));
  expect(words[words.length - 1]).not.toMatch(/^(in|to|the|are)$/);
});

test("a prefix shares the box and is never cut", () => {
  stubFit(40);
  const { container } = render(<FitWords text={TEXT} prefix={<b>Alma 23:8</b>} />);
  expect(container.querySelector("b").textContent).toBe("Alma 23:8");
  expect(container.textContent.length).toBeLessThanOrEqual(40);
});

test("a padded box fits against its CONTENT bottom, not the padding (padding only widens hit areas)", () => {
  // box: 0..60 with 16px bottom padding → text may end at 44 at most.
  // Each word adds 1px of line bottom past 30: 15 words → 45 (overflows the
  // content box but would still pass against the padded border box).
  const getBCR = HTMLElement.prototype.getBoundingClientRect;
  const getRects = HTMLElement.prototype.getClientRects;
  HTMLElement.prototype.getBoundingClientRect = function () {
    return this.classList?.contains("fitWords") ? { top: 0, bottom: 60, left: 0, right: 100, width: 100, height: 60 } : getBCR.call(this);
  };
  HTMLElement.prototype.getClientRects = function () {
    if (!this.hasAttribute?.("data-fit-text")) return getRects.call(this);
    const n = this.textContent.split(" ").length;
    return [{ top: 0, bottom: 30 + n, left: 0, right: 10 }];
  };
  const text = Array.from({ length: 20 }, (_, i) => `w${i}`).join(" ");
  try {
    const real = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((el, ...rest) => {
      const cs = real.call(window, el, ...rest);
      return el.classList?.contains("fitWords") ? { ...cs, paddingBottom: "16px" } : cs;
    });
    const { container } = render(<FitWords text={text} />);
    const out = container.querySelector("[data-fit-text]").textContent.replace(/…$/, "");
    expect(out.split(" ").length).toBeLessThanOrEqual(14);
  } finally {
    HTMLElement.prototype.getBoundingClientRect = getBCR;
    HTMLElement.prototype.getClientRects = getRects;
    vi.restoreAllMocks();
  }
});

// Systemic C3 (blind R6): a fit computed in the fallback font is stale once the
// web font lands — FitWords re-fits on fonts.ready / loadingdone, both ways.
test("re-fits when a web font loads (fallback measure → web-font measure)", () => {
  const { act } = require("@testing-library/react");
  const fonts = new EventTarget();
  fonts.ready = new Promise(() => {});
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
  try {
    stubFit(200); // fallback font: fits whole
    const { container } = render(<FitWords text={TEXT} />);
    expect(container.textContent).toBe(TEXT);
    stubFit(26); // web font is wider: now it overflows
    act(() => { fonts.dispatchEvent(new Event("loadingdone")); });
    expect(container.textContent.endsWith("…")).toBe(true);
    stubFit(200); // and back: the full text returns
    act(() => { fonts.dispatchEvent(new Event("loadingdone")); });
    expect(container.textContent).toBe(TEXT);
  } finally {
    delete document.fonts;
  }
});
