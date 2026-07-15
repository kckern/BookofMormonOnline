// Grid of scripture references with an active selection — previously
// duplicated between Narration's ScripturePanel (keyboard-nav variant) and
// Utils' ScripturesContainer (plain variant). Inner item markup is injectable
// because the two sites style their items differently; the keyboard handling
// stays at the Narration call site (it is the genuinely different part).
import React from "react";

export function ScriptureRefGrid({
  items,
  activeIndex = null,
  onSelect = () => {},
  className = "",
  renderItemContent = (item) => item,
}) {
  if (!items?.length) return null;
  return (
    <div className={("scripturePanel " + className).trim()}>
      {items.map((item, i) => (
        <div
          key={item + "_" + i}
          className={"scriptureItem" + (activeIndex === i ? " active" : "")}
          onClick={() => onSelect(i)}
        >
          {renderItemContent(item)}
        </div>
      ))}
    </div>
  );
}
