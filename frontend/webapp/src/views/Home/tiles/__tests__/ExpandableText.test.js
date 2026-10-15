import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevealProvider, useReveal } from "../_ds/Reveal";
import ExpandableText from "../ExpandableText";

// Force truncation: jsdom reports 0 for scrollHeight/clientHeight, so stub them
// so ExpandableText's "overflowing" check is true and the read-more renders.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const RevealState = () => {
  const { revealed } = useReveal();
  return <span data-testid="revealed">{revealed ? "yes" : "no"}</span>;
};

test("expanding fires reveal() so a sibling Layer-2 can appear", () => {
  render(
    <RevealProvider>
      <RevealState />
      <ExpandableText lines={2}>
        <span>lots of text that overflows the clamp box</span>
      </ExpandableText>
    </RevealProvider>
  );
  expect(screen.getByTestId("revealed").textContent).toBe("no");
  fireEvent.click(screen.getByRole("button")); // the read-more pill
  expect(screen.getByTestId("revealed").textContent).toBe("yes");
});

test("reveal is reversible: one button toggles Read more / Show less and keeps focus", () => {
  render(
    <ExpandableText lines={2}>
      <span>lots of text that overflows the clamp box</span>
    </ExpandableText>
  );
  const btn = screen.getByRole("button", { name: "Read more" });
  expect(btn).toHaveAttribute("aria-expanded", "false");
  btn.focus();
  fireEvent.click(btn);
  const after = screen.getByRole("button", { name: "Show less" });
  expect(after).toBe(btn); // same element — not unmounted/remounted
  expect(after).toHaveAttribute("aria-expanded", "true");
  expect(document.activeElement).toBe(btn);
  fireEvent.click(btn);
  expect(screen.getByRole("button", { name: "Read more" })).toBe(btn);
  expect(btn).toHaveAttribute("aria-expanded", "false");
  expect(document.activeElement).toBe(btn);
});

// A parent re-render passes NEW JSX children while the text is expanded (the
// Sampler balancer re-renders reserve tiles on its settle ticks). Expanded, the
// box no longer overflows — re-measuring then would drop the pill and strand
// the reader with no Show less (and lose focus). Only the collapsed box is measured.
test("a parent re-render while expanded keeps the Show less control", () => {
  const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() { return this.classList.contains("clampLines") ? 500 : 100; },
  });
  try {
    const ui = (n) => (
      <ExpandableText lines={2}>
        <span>{`lots of text that overflows the clamp box ${n}`}</span>
      </ExpandableText>
    );
    const { rerender } = render(ui(1));
    const btn = screen.getByRole("button", { name: "Read more" });
    btn.focus();
    fireEvent.click(btn);
    rerender(ui(2));
    expect(screen.getByRole("button", { name: "Show less" })).toBe(btn);
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    rerender(ui(3));
    expect(screen.getByRole("button", { name: "Read more" })).toBe(btn);
  } finally {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", sh);
  }
});
