/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { highlightTextJSX, generateHighlightedText } from "../highlighter";

describe("highlighter", () => {
  test("matched phrase is wrapped in a highlight span", () => {
    const { container } = render(
      <p>{highlightTextJSX("I have dreamed a dream tonight", ["dreamed a dream"], 1)}</p>
    );
    expect(container.querySelector(".highlight").textContent).toContain("dreamed a dream");
  });

  test("unmatched highlight degrades to plain text — never a debug dump", () => {
    const { container } = render(
      <p>{highlightTextJSX("plain verse text", ["no such phrase"], 1)}</p>
    );
    expect(container.querySelector("pre")).toBeNull();
    expect(container.textContent).toBe("plain verse text");
  });

  test("no highlight strings at all passes text through", () => {
    const { container } = render(<p>{highlightTextJSX("some verse", undefined, 1)}</p>);
    expect(container.querySelector("pre")).toBeNull();
    expect(container.textContent).toBe("some verse");
  });

  // Token-based matching tests
  const plain = (result) =>
    result.jsx.map((n) => n.props.children).join("");
  const highlighted = (result) =>
    result.jsx
      .filter((n) => n.props.className === "highlight")
      .map((n) => n.props.children)
      .join("");

  test("matches across an apostrophe the text spells without one", () => {
    // API string has the apostrophe; local text does not (or vice-versa)
    const res = generateHighlightedText("and the Lords anointed came", ["Lord's anointed"]);
    expect(highlighted(res).toLowerCase()).toContain("lords anointed");
  });

  test("matches across a hyphen and surrounding punctuation", () => {
    const res = generateHighlightedText("his well beloved Son, whom", ["well-beloved"]);
    expect(highlighted(res).toLowerCase().replace(/[^a-z ]/g, "")).toContain("well beloved");
  });

  test("a regex-metacharacter highlight string does not throw and can match", () => {
    const res = generateHighlightedText("fear God (the Lord) alway", ["God the Lord"]);
    expect(highlighted(res).toLowerCase()).toContain("god");
    // and the full text is still present (nothing dropped)
    expect(plain(res).length).toBeGreaterThan(0);
  });

  test("a string genuinely absent from the text degrades to plain, unhighlighted text", () => {
    const res = generateHighlightedText("wherefore it came to pass", ["not present here"]);
    expect(highlighted(res)).toBe("");
    expect(plain(res)).toBe("wherefore it came to pass");
  });
});
