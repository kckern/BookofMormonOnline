import React from "react";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { highlightTextJSX } from "../highlighter";

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
});
