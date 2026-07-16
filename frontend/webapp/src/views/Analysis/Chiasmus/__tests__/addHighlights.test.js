import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));

import { addHighlights } from "../Chiasm";

const html = (nodes) => renderToStaticMarkup(<>{nodes}</>);

describe("addHighlights", () => {
  test("wraps plain matches in highlight spans", () => {
    expect(html(addHighlights("the word of God", ["word of God"]))).toContain(
      '<span class="highlight">word of God</span>'
    );
  });
  test("does not throw on regex special characters", () => {
    expect(() => addHighlights("he said (behold)", ["(behold)"])).not.toThrow();
    expect(html(addHighlights("he said (behold)", ["(behold)"]))).toContain(
      '<span class="highlight">(behold)</span>'
    );
  });
  test("does not double-wrap overlapping highlights", () => {
    const out = html(addHighlights("great faith", ["great faith", "faith"]));
    expect(out.match(/<span/g).length).toBe(1);
  });
});
