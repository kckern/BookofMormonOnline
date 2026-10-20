import "@testing-library/jest-dom";
import React, { useRef } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RevealProvider, useReveal } from "../Reveal";
import { useClampGuard } from "../clampGuard";
import ExpandableText from "../../ExpandableText";
import CommentaryTile from "../../CommentaryTile";

// Systemic guard for every Home clamp (blind rounds 1-6): G2 keyboard focus
// under a clamp, and C3 measuring before the web font lands.

const rect = (top, bottom) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON() {} });

// A controllable document.fonts: `ready` resolves at once, `loadingdone` is ours to fire.
let fonts;
beforeEach(() => {
  fonts = new EventTarget();
  fonts.ready = Promise.resolve();
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
});
afterEach(() => {
  delete document.fonts;
});
const fontsLoaded = () => act(() => { fonts.dispatchEvent(new Event("loadingdone")); });

describe("useClampGuard (G2: hidden controls leave the Tab order)", () => {
  let gbcr;
  let edge;
  beforeEach(() => {
    edge = 100;
    gbcr = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.dataset.box) return rect(0, edge);
      const y = Number(this.dataset.y || 0);
      return rect(y, y + 17);
    };
  });
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = gbcr;
  });
  function Box({ clamped }) {
    const ref = useRef(null);
    const onScroll = useClampGuard(ref, clamped);
    return (
      <div ref={ref} data-box="1" onScroll={onScroll}>
        <a href="#a" data-y="10">top</a> <a href="#b" data-y="120">under</a>
      </div>
    );
  }
  test("a control under the edge is tabindex=-1 while clamped, restored when not", () => {
    const { rerender } = render(<Box clamped />);
    expect(screen.getByText("top")).not.toHaveAttribute("tabindex");
    expect(screen.getByText("under")).toHaveAttribute("tabindex", "-1");
    rerender(<Box clamped={false} />);
    expect(screen.getByText("under")).not.toHaveAttribute("tabindex");
  });
  test("a font load that moves the edge re-runs the pass", () => {
    render(<Box clamped />);
    expect(screen.getByText("under")).toHaveAttribute("tabindex", "-1");
    edge = 200; // the web font made lines shorter: the pill is visible now
    fontsLoaded();
    expect(screen.getByText("under")).not.toHaveAttribute("tabindex");
  });
  test("a stray scroll of the clamped box snaps back", () => {
    const { container } = render(<Box clamped />);
    const box = container.querySelector("[data-box]");
    box.scrollTop = 40;
    fireEvent.scroll(box);
    expect(box.scrollTop).toBe(0);
  });
});

describe("ExpandableText re-measures after web fonts (C3), two-way", () => {
  let over;
  let sh;
  beforeEach(() => {
    over = false;
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() { return this.classList.contains("clampLines") && over ? 500 : 0; },
    });
  });
  afterEach(() => {
    delete HTMLElement.prototype.scrollHeight;
  });
  const Gate = () => {
    const { gated } = useReveal();
    return <span data-testid="gated">{gated ? "y" : "n"}</span>;
  };
  const ui = () => (
    <RevealProvider>
      <Gate />
      <ExpandableText lines={3} fade>
        <span>prose</span>
      </ExpandableText>
    </RevealProvider>
  );
  test("fits in the fallback font, overflows once the web font lands → gate + Read more appear", () => {
    render(ui());
    expect(screen.queryByRole("button", { name: "Read more" })).toBeNull();
    expect(screen.getByTestId("gated").textContent).toBe("n");
    over = true;
    fontsLoaded();
    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();
    expect(screen.getByTestId("gated").textContent).toBe("y");
  });
  test("overflowed pre-paint, fits after the font → the gate retracts (Layer-2 link shows)", () => {
    over = true;
    render(ui());
    expect(screen.getByTestId("gated").textContent).toBe("y");
    over = false;
    fontsLoaded();
    expect(screen.queryByRole("button", { name: "Read more" })).toBeNull();
    expect(screen.getByTestId("gated").textContent).toBe("n");
  });
});

describe("Reveal gates are two-way", () => {
  function Probe() {
    const { gated, registerGate } = useReveal();
    return (
      <div>
        <span data-testid="g">{gated ? "y" : "n"}</span>
        <button onClick={() => registerGate(true, "a")}>a+</button>
        <button onClick={() => registerGate(true, "b")}>b+</button>
        <button onClick={() => registerGate(false, "a")}>a-</button>
        <button onClick={() => registerGate(false, "b")}>b-</button>
      </div>
    );
  }
  test("gated while any gate is registered; clears when all retract", () => {
    render(<RevealProvider><Probe /></RevealProvider>);
    fireEvent.click(screen.getByText("a+"));
    fireEvent.click(screen.getByText("b+"));
    fireEvent.click(screen.getByText("a-"));
    expect(screen.getByTestId("g").textContent).toBe("y");
    fireEvent.click(screen.getByText("b-"));
    expect(screen.getByTestId("g").textContent).toBe("n");
  });
});

// R6 commentary-G2: the commentary excerpt is its own clamp (not
// ExpandableText) — its pills under the cut must leave the Tab order too.
describe("CommentaryTile excerpt clamp (G2)", () => {
  let gbcr;
  beforeEach(() => {
    gbcr = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() { return this.classList.contains("commentaryTileExcerpt") ? 900 : 0; },
    });
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains("commentaryTileExcerpt")) return rect(0, 100);
      if (this.closest(".commentaryTileExcerpt") && this.matches("button, a")) return rect(140, 157); // under the cut
      return rect(0, 10);
    };
  });
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = gbcr;
    delete HTMLElement.prototype.scrollHeight;
  });
  test("pills below the clamp are tabindex=-1 until Read more", () => {
    const data = {
      id: 991,
      title: "On faith",
      reference: "Alma 32:21",
      text: "<p>See Alma 32:21 and Ether 12:6 and Moroni 7:33 and Hebrews 11:1 for more.</p>",
      publication: { source_id: "11", source_title: "CES", source_name: "CES" },
    };
    const { container } = render(<MemoryRouter><CommentaryTile data={data} /></MemoryRouter>);
    const pills = [...container.querySelectorAll(".commentaryTileExcerpt button, .commentaryTileExcerpt a")];
    expect(pills.length).toBeGreaterThan(0);
    pills.forEach((p) => expect(p).toHaveAttribute("tabindex", "-1")); // below the 100px cut
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    [...container.querySelectorAll(".commentaryTileExcerpt button, .commentaryTileExcerpt a")].forEach((p) =>
      expect(p).not.toHaveAttribute("data-clamp-hidden"),
    );
  });
});
