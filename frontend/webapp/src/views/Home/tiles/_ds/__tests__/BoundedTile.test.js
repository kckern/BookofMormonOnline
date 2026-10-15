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

describe("BoundedTile collapse keeps the tile in view", () => {
  const setup = (top) => {
    const restore = fakeHeights(1000, 384);
    const scroll = vi.fn();
    const had = Object.prototype.hasOwnProperty.call(Element.prototype, "scrollIntoView");
    const prev = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll; // jsdom has none
    const sp = { mockRestore: () => { if (had) Element.prototype.scrollIntoView = prev; else delete Element.prototype.scrollIntoView; } };
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top, bottom: top + 1100, left: 0, right: 0, width: 0, height: 1100 });
    render(<BoundedTile className="tile"><p>long</p></BoundedTile>);
    return { scroll, restore: () => { restore(); sp.mockRestore(); rect.mockRestore(); } };
  };

  test("Show less scrolls the tile back when its top is above the viewport", () => {
    const { scroll, restore } = setup(-700);
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.calls[0][0]).toMatchObject({ block: "nearest" });
    restore();
  });

  test("Show less does not scroll when the tile top is visible; Read more never scrolls", () => {
    const { scroll, restore } = setup(40);
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(scroll).not.toHaveBeenCalled();
    restore();
  });
});
