import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BoundedTile from "../BoundedTile";
import { RevealProvider, useReveal } from "../Reveal";

// jsdom has no layout: fake an overflowing (or fitting) box.
const fakeHeights = (scroll, client) => {
  const s = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scroll);
  const c = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(client);
  return () => { s.mockRestore(); c.mockRestore(); };
};

function InnerReveal() {
  const { reveal } = useReveal();
  return <button onClick={reveal}>inner expand</button>;
}

describe("BoundedTile", () => {
  test("overflowing: bounded + fade + Read more; clicking lifts the bound, Show less restores it", () => {
    const restore = fakeHeights(1000, 384);
    const { container } = render(<BoundedTile className="tile tile-narration"><p>long</p></BoundedTile>);
    const wrap = container.firstChild;
    expect(wrap.className).toContain("boundedTile");
    expect(wrap.className).toContain("isOverflowing");
    expect(wrap.className).not.toContain("revealed");
    const more = screen.getByRole("button", { name: "Read more" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(wrap.className).toContain("revealed");
    const less = screen.getByRole("button", { name: "Show less" });
    expect(less).toBe(more); // one toggle, focus stays put
    fireEvent.click(less);
    expect(wrap.className).not.toContain("revealed");
    restore();
  });

  test("content that fits: no fade, no button", () => {
    const restore = fakeHeights(200, 200);
    const { container } = render(<BoundedTile className="tile"><p>short</p></BoundedTile>);
    expect(container.firstChild.className).not.toContain("isOverflowing");
    expect(screen.queryByRole("button")).toBeNull();
    restore();
  });

  test("a RevealProvider inside the tile lifts the bound when its Reveal fires", () => {
    const restore = fakeHeights(1000, 384);
    const { container } = render(
      <BoundedTile className="tile tile-contents">
        <RevealProvider><InnerReveal /></RevealProvider>
      </BoundedTile>,
    );
    fireEvent.click(screen.getByText("inner expand"));
    expect(container.firstChild.className).toContain("revealed");
    restore();
  });
});
