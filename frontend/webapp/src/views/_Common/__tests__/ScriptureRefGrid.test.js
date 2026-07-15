import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { ScriptureRefGrid } from "../ScriptureRefGrid";

const refs = ["Alma 5:2", "Mosiah 3:19"];

test("renders one item per ref, marks the active index, selects on click", () => {
  const onSelect = jest.fn();
  const { container } = render(
    <ScriptureRefGrid items={refs} activeIndex={1} onSelect={onSelect} />
  );
  const items = container.querySelectorAll(".scriptureItem");
  expect(items).toHaveLength(2);
  expect(items[1].className).toContain("active");
  expect(items[0].className).not.toContain("active");
  fireEvent.click(screen.getByText("Alma 5:2"));
  expect(onSelect).toHaveBeenCalledWith(0);
});

test("renders nothing for empty items", () => {
  const { container } = render(<ScriptureRefGrid items={[]} onSelect={() => {}} />);
  expect(container.firstChild).toBeNull();
});

test("renderItemContent customizes inner markup; className extends the wrapper", () => {
  const { container } = render(
    <ScriptureRefGrid
      items={refs}
      activeIndex={0}
      onSelect={() => {}}
      className="noselect"
      renderItemContent={(ref) => <div className="ref">{ref}</div>}
    />
  );
  expect(container.querySelector(".scripturePanel").className).toBe(
    "scripturePanel noselect"
  );
  expect(container.querySelectorAll(".scriptureItem .ref")).toHaveLength(2);
});

test("clicking with no onSelect provided does not throw", () => {
  render(<ScriptureRefGrid items={["Alma 5:2"]} activeIndex={0} />);
  expect(() => fireEvent.click(screen.getByText("Alma 5:2"))).not.toThrow();
});
