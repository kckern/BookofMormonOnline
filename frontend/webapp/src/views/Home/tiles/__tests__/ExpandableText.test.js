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

// Audit G2 (people/personProfile): Tab must not reach controls hidden below the
// collapsed clamp — focusing one scrolls the overflow:hidden box and scrambles
// the prose. Hidden controls leave the Tab order while collapsed; visible ones
// stay; expanding restores them; a stray scroll of the clamp box snaps back.
describe("collapsed clamp keeps hidden controls out of the Tab order", () => {
  const rect = (top, bottom) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON() {} });
  let gbcr;
  beforeEach(() => {
    gbcr = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains("clampLines")) return rect(0, 100);
      const y = Number(this.dataset.y || 0);
      return rect(y, y + 17);
    };
  });
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = gbcr;
  });
  const ui = () => (
    <ExpandableText lines={2}>
      <span>
        intro <button data-y="10">Alma 1:1</button> more <button data-y="90">Alma 2:2</button> later{" "}
        <button data-y="140">Alma 3:3</button> <button data-y="300">Alma 4:4</button>
      </span>
    </ExpandableText>
  );

  test("controls below (or cut by) the clamp edge are tabindex=-1; visible ones untouched", () => {
    render(ui());
    expect(screen.getByText("Alma 1:1")).not.toHaveAttribute("tabindex");
    expect(screen.getByText("Alma 2:2")).toHaveAttribute("tabindex", "-1"); // 90–107 straddles the 100px edge
    expect(screen.getByText("Alma 3:3")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Alma 4:4")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Read more" })).not.toHaveAttribute("tabindex");
  });

  test("expanding restores every control to the Tab order", () => {
    render(ui());
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    ["Alma 1:1", "Alma 2:2", "Alma 3:3", "Alma 4:4"].forEach((t) =>
      expect(screen.getByText(t)).not.toHaveAttribute("tabindex")
    );
  });

  test("a scroll of the collapsed clamp box snaps back to the top", () => {
    const { container } = render(ui());
    const box = container.querySelector(".clampLines");
    box.scrollTop = 130;
    fireEvent.scroll(box);
    expect(box.scrollTop).toBe(0);
  });
});

// Audit H3: -webkit-line-clamp drops its ellipsis at any character ("The nex…").
// `fade` clamps by whole line boxes (max-height in lh) and fades the end of the
// last line instead, so the cut always falls between words.
test("fade mode clamps whole lines (no line-clamp ellipsis) via --clamp-lines", () => {
  const { container } = render(
    <ExpandableText lines={7} fade>
      <span>lots of text that overflows the clamp box</span>
    </ExpandableText>
  );
  const box = container.querySelector(".clampLines");
  expect(box).toHaveClass("clampFade");
  expect(box.style.getPropertyValue("--clamp-lines")).toBe("7");
  expect(box.style.WebkitLineClamp || "").toBe("");
});

describe("persistKey: the reveal survives a Back (audit placeProfile E1)", () => {
  beforeEach(() => sessionStorage.clear());
  const ui = () => (
    <RevealProvider>
      <RevealState />
      <ExpandableText lines={2} persistKey="placeProfile:zarahemla">
        <span>lots of text that overflows the clamp box</span>
      </ExpandableText>
    </RevealProvider>
  );
  test("an expanded box remounts expanded, with its Layer-2 revealed", () => {
    const first = render(ui());
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    first.unmount();
    render(ui());
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("revealed").textContent).toBe("yes");
  });
  test("collapsing forgets it; clearSession (resample) forgets it", async () => {
    const { clearSession } = await import("../samplerSession");
    const a = render(ui());
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    a.unmount();
    const b = render(ui());
    expect(screen.getByRole("button", { name: "Read more" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    b.unmount();
    clearSession();
    render(ui());
    expect(screen.getByRole("button", { name: "Read more" })).toBeTruthy();
  });
});
