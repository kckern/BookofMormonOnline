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
